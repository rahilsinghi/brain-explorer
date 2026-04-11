# Brain Explorer v1.2 — Force-Directed Simulation + Node Dragging

> Replace the static UMAP layout with a live d3-force-3d simulation. Add node dragging with elastic tether feedback.

## 1. Layout Strategy

**Hybrid force-directed with soft centering.** d3-force-3d runs a full 3D simulation with:

- **forceLink** — attraction along edges, strength ~0.3, distance ~15
- **forceManyBody** — repulsion, strength ~-30
- **forceCenter(0, 0, 0)** — very weak centering at strength ~0.01 to prevent drift without distorting UMAP cluster structure
- **forceCollide** — radius ~2.0 to prevent overlap (replaces current standalone collision layout)

No `forceRadial`. Radial forces fight UMAP's semantic clustering by compressing/expanding clusters toward a fixed radius. `forceCenter` provides drift prevention without distorting cluster distances.

**Initial positions:** UMAP positions from `graph.json`, normalized to `SCENE_RADIUS=50` by `normalizePositions()`, are seeded directly as `SimNode` initial x/y/z. The simulation refines from there — semantically similar nodes start near each other from frame 1.

## 2. Simulation Architecture

### 2.1 SimNode Type

```typescript
// src/lib/types.ts — new type
interface SimNode {
  id: string;
  title: string;
  tags: string[];
  category: string;
  source_type: string;
  created_at: string;
  connection_count: number;
  // Mutable positions — d3-force writes to these directly
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  fx: number | null;
  fy: number | null;
  fz: number | null;
}
```

`SimNode` is a separate mutable type from `GraphNode`. d3-force mutates node objects directly — if `GraphNode` has readonly fields or is spread into new objects, d3 can't write back. `SimNode` is created from `GraphNode` at simulation init by copying all fields into plain mutable objects.

### 2.2 Core Module: `src/lib/force-simulation.ts`

Pure d3 logic, no React. Creates and configures the simulation.

```typescript
function createForceSimulation(
  nodes: GraphNode[],
  links: GraphLink[]
): {
  simulation: Simulation<SimNode, undefined>;
  simNodes: SimNode[];
  positionsRef: Float32Array;       // nodeCount * 3, shared with renderer
  nodeIndexMap: Map<string, number>; // nodeId → index into positionsRef
}
```

**Critical:** `simulation.stop()` is the very first line after `forceSimulation()`. d3 starts its own internal RAF timer by default. If not stopped immediately, the simulation double-ticks — d3 advances positions on its own loop AND `useFrame` reads them, causing jitter and wasted CPU. The simulation is only ever ticked manually via `simulation.tick()` inside `useFrame`.

`positionsRef` is a `Float32Array(nodeCount * 3)`. After each `simulation.tick()`, positions are copied from `simNode.x/y/z` into the array:

```typescript
function syncPositions(simNodes: SimNode[], positions: Float32Array): void {
  for (let i = 0; i < simNodes.length; i++) {
    const offset = i * 3;
    positions[offset] = simNodes[i].x;
    positions[offset + 1] = simNodes[i].y;
    positions[offset + 2] = simNodes[i].z;
  }
}
```

`nodeIndexMap` maps `nodeId → index` into the `Float32Array`. Exported alongside `positionsRef` so that InstancedNodes, Edges, and the particle system all read from the same shared buffer using the same index mapping.

### 2.3 React Hook: `src/hooks/useSimulation.ts`

React lifecycle wrapper around force-simulation.ts.

```typescript
function useSimulation(
  nodes: GraphNode[],
  links: GraphLink[]
): {
  positionsRef: React.MutableRefObject<Float32Array>;
  simNodesRef: React.MutableRefObject<SimNode[]>;
  nodeIndexMap: React.MutableRefObject<Map<string, number>>;
  simulationRef: React.MutableRefObject<Simulation<SimNode, undefined>>;
  simulationActive: React.MutableRefObject<boolean>;
  reheat: (alpha?: number) => void;
  pin: (index: number, x: number, y: number, z: number) => void;
  unpin: (index: number) => void;
  restoreDecay: () => void;
}
```

- **Does not** receive `neighborMap` — the simulation only needs nodes and links. `neighborMap` remains a separate prop for focus-alpha in InstancedNodes/Edges.
- `reheat(alpha)` — sets `simulation.alpha(alpha)` and `simulationActive = true`. Does **not** call `restart()` — the simulation is never started via d3's internal timer. `simulation.tick()` works without `restart()` as long as alpha > alphaMin; d3-force-3d's `tick()` is stateless and just advances one step regardless of the internal timer state. If testing reveals that `tick()` is a no-op when stopped, fall back to `restart()` + immediate `stop()` with a comment explaining the one-tick timer risk.
- `pin(index, x, y, z)` — sets `simNodes[index].fx/fy/fz`.
- `unpin(index)` — clears `fx/fy/fz` to null.
- `restoreDecay()` — resets `simulation.alphaDecay(0.02)`. Called by InstancedNodes when RELEASING → IDLE transition fires.
- Cleanup: `simulation.stop()` on unmount.

### 2.4 Simulation Lifecycle

**Cool-and-reheat model.** The simulation is not continuous.

- **On load:** simulation starts hot (default alpha=1), cools via `alphaDecay: 0.02` (~230 ticks, ~3.8s at 60fps). Once `alpha < alphaMin (0.001)`, `simulationActive` is set to false.
- **On drag:** reheat to `alpha(0.15)` with `alphaDecay: 0.02`. On drag release, bump `alphaDecay` to `0.05` for snappy settle (~60 ticks, ~1s). When alpha crosses alphaMin, `restoreDecay()` resets to 0.02 and `simulationActive` goes false.
- **When settled:** `simulationActive = false`. Both InstancedNodes and Edges early-return in `useFrame` — zero CPU cost for a static graph.

### 2.5 d3-force-3d Type Declarations

Extend existing `src/types/d3-force-3d.d.ts` with:
- `Simulation<N, L>` type with `tick()`, `stop()`, `alpha()`, `alphaDecay()`, `alphaMin()`, `force()`, `nodes()`, `restart()`
- `forceLink<N, L>()` with `.id()`, `.strength()`, `.distance()`
- `forceManyBody<N>()` with `.strength()`
- `forceCenter<N>()` with `.strength()`
- `SimulationRef = React.MutableRefObject<Simulation<SimNode, undefined>>`

## 3. Edge Rendering Overhaul

### 3.1 Dynamic Line Positions

Replace the static `useMemo` position array in `Edges.tsx` with a persistent `Float32Array` ref.

**Sizing:** `links.length * 6` (two xyz vertices per edge). Rebuild the ref via `useEffect` on `links.length` change — link count can jump when Graphify layer toggle or drill-in adds code edges (Phase 5).

**In useFrame:**

```typescript
useFrame(() => {
  if (!simulationActive.current) return; // early exit — zero work when settled

  const positions = positionsRef.current;
  const indexMap = nodeIndexMap.current;

  for (let i = 0; i < links.length; i++) {
    const si = indexMap.get(links[i].source)!;
    const ti = indexMap.get(links[i].target)!;
    const offset = i * 6;

    edgePositions[offset] = positions[si * 3];
    edgePositions[offset + 1] = positions[si * 3 + 1];
    edgePositions[offset + 2] = positions[si * 3 + 2];
    edgePositions[offset + 3] = positions[ti * 3];
    edgePositions[offset + 4] = positions[ti * 3 + 1];
    edgePositions[offset + 5] = positions[ti * 3 + 2];
  }

  positionAttr.needsUpdate = true;
});
```

The early return is the optimization — when `simulationActive` is false, no Float32Array writes, no GPU uploads.

### 3.2 Particle System Fix

Particles currently look up `nodeMap.get(link.source)` which returns the original `GraphNode` with stale UMAP positions. Switch to reading from `positionsRef` via `nodeIndexMap`:

```typescript
const si = nodeIndexMap.current.get(link.source)!;
const sOffset = si * 3;
const sx = positionsRef.current[sOffset];
const sy = positionsRef.current[sOffset + 1];
const sz = positionsRef.current[sOffset + 2];
// same for target
```

### 3.3 Focus-Alpha Unchanged

The existing `useEffect` on `focusedNodeId` only touches `colorAttr.array` and sets `colorAttr.needsUpdate = true`. It does not rebuild the `BufferGeometry`. No conflict with the dynamic position updates.

## 4. Node Dragging

### 4.1 State Machine

```
IDLE → (pointerdown on node, >5px movement) → DRAGGING → (pointerup) → RELEASING → (alpha < alphaMin) → IDLE
```

**Drag threshold:** Track pointer displacement from initial pointerdown. If pointer moves <5px before pointerup, treat as a click (existing focus behavior). Only enter DRAGGING state after threshold is crossed. This prevents a focus → clear cycle on click that would clear previous focus state.

### 4.2 Hook: `src/hooks/useDrag.ts`

```typescript
function useDrag(
  simulationRef: SimulationRef,
  simNodesRef: React.MutableRefObject<SimNode[]>,
  positionsRef: React.MutableRefObject<Float32Array>,
  nodeIndexMap: React.MutableRefObject<Map<string, number>>,
  controlsRef: React.MutableRefObject<OrbitControls>,
  cameraRef: React.MutableRefObject<Camera>,
  reheat: (alpha?: number) => void,
  pin: (index: number, x: number, y: number, z: number) => void,
  unpin: (index: number) => void,
  setFocusedNode: (id: string | null) => void,
  clearFocus: () => void
): {
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  dragState: React.MutableRefObject<'IDLE' | 'DRAGGING' | 'RELEASING'>;
  draggedIndex: React.MutableRefObject<number | null>;
}
```

### 4.3 Pointer-to-3D Projection

During drag, project the pointer onto a plane perpendicular to the camera's forward vector, passing through the dragged node's current pinned position (fx/fy/fz — which equals the rendered position since the node is pinned). Standard Three.js pattern:

```typescript
const plane = new THREE.Plane();
const normal = new THREE.Vector3();
camera.getWorldDirection(normal);
plane.setFromNormalAndCoplanarPoint(normal, draggedNodePosition);
raycaster.ray.intersectPlane(plane, intersectionPoint);
```

**Position clamping:** Clamp the dragged node's projected position to ±80 on all axes. Without this, when the camera looks nearly straight down at the graph, the drag plane becomes nearly horizontal and small pointer movements cause extreme Z displacement.

### 4.4 OrbitControls Coordination

- **Drag start:** `controlsRef.current.enabled = false` before the event bubbles
- **Drag end:** `controlsRef.current.enabled = true`
- **Window listener:** `window.addEventListener("pointerup", handlePointerUp, { once: true })` — self-cleaning, handles pointer leaving canvas during drag

### 4.5 Visual Feedback (Elastic Tethers)

- **On drag start:** `setFocusedNode(draggedNodeId)` — triggers existing focus-alpha dimming on non-neighbors and edge highlighting
- **Dragged node:** scale matrix to 1.3x in useFrame when `dragState === DRAGGING && i === draggedIndex`
- **Elastic effect:** free from d3-force. `forceLink` pulls neighbors toward the pinned node. Edges follow because they read from the shared `positionsRef` Float32Array. Neighbors visibly shift toward the dragged node during drag.
- **On release:** `clearFocus()`, scale returns to 1.0. Node springs back to simulation equilibrium via forces. `alphaDecay` bumped to 0.05 for snappy settle.

### 4.6 RELEASING → IDLE Transition

Checked in useFrame inside InstancedNodes, in the same block that calls `simulation.tick()`:

```typescript
// After simulation.tick() + syncPositions()
if (dragState.current === 'RELEASING' && simulationRef.current.alpha() < alphaMin) {
  dragState.current = 'IDLE';
  restoreDecay(); // resets alphaDecay to 0.02
  simulationActive.current = false;
}
```

One owner (InstancedNodes useFrame), one function call (`restoreDecay`). No separate polling loop.

## 5. File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/lib/force-simulation.ts` | Pure d3 simulation creation, force config, syncPositions, nodeIndexMap |
| `src/hooks/useSimulation.ts` | React lifecycle wrapper: create/destroy simulation, expose refs + control functions |
| `src/hooks/useDrag.ts` | Drag state machine, pointer handlers, plane intersection, OrbitControls coordination |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `SimNode` type (mutable x/y/z/vx/vy/vz/fx/fy/fz). Add `SimulationRef` type alias |
| `src/types/d3-force-3d.d.ts` | Extend with Simulation, forceLink, forceManyBody, forceCenter type declarations |
| `src/hooks/useGraphData.ts` | Remove `applyCollisionLayout` call. `normalizePositions` output (centered, scaled to SCENE_RADIUS=50) is the direct input to SimNode initial x/y/z |
| `src/components/GraphView.tsx` | Instantiate `useSimulation(nodes, links)`. Instantiate `useDrag(...)`. Thread refs + handlers to InstancedNodes, Edges |
| `src/components/InstancedNodes.tsx` | Read positions from `positionsRef` Float32Array instead of `node.x/y/z`. Call `simulation.tick()` + `syncPositions()` in useFrame. Apply 1.3x drag scale. Check RELEASING → IDLE transition. Wire `useDrag` pointer handlers |
| `src/components/Edges.tsx` | Replace static useMemo positions with dynamic Float32Array (rebuild via useEffect on links.length change). Read from `positionsRef` via `nodeIndexMap`. Early-return in useFrame when `!simulationActive`. Fix particle system to read from positionsRef |
| `src/lib/graph-data.ts` | Remove `applyCollisionLayout` export |

### Deleted Files

| File | Reason |
|------|--------|
| `src/lib/force-layout.ts` | Replaced entirely by `force-simulation.ts` |

### Unchanged Files

| File | Why |
|------|-----|
| `src/components/CameraController.tsx` | Auto-rotation already pauses during focus (which drag triggers). OrbitControls enable/disable handled by useDrag via controlsRef |
| `src/components/Tooltip.tsx` | No changes — tooltip reads from zustand hoveredNodeId, unaffected by simulation |
| `src/components/ArticlePanel.tsx` | No changes — panel reads from zustand focusedNodeId |
| `src/components/CommandPalette.tsx` | No changes |

## 6. Data Flow

### Load → Render

```
graph.json
  → useGraphData: fetch, normalizePositions(SCENE_RADIUS=50), buildNeighborMap
  → useSimulation: create SimNodes from GraphNodes, init forces, simulation.stop()
  → useFrame: simulation.tick(), syncPositions() → positionsRef Float32Array
  → InstancedNodes: read positionsRef → tempObject.position.set() → setMatrixAt()
  → Edges: read positionsRef via nodeIndexMap → line position attribute
  → simulation cools (alpha < alphaMin) → simulationActive = false → useFrame early-returns
```

### Drag → Release

```
pointerdown on node
  → useDrag: track initial pointer position
  → pointermove crosses 5px threshold
  → useDrag: IDLE → DRAGGING
  → setFocusedNode(draggedId): focus-alpha activates in Edges + InstancedNodes
  → OrbitControls disabled
  → pin(index, x, y, z): simNode.fx/fy/fz set, positions clamped ±80
  → reheat(0.15): simulation reactivated, simulationActive = true
  → useFrame resumes: tick + sync, neighbors pulled by forceLink, edges follow

pointermove during drag
  → update pin(index, newX, newY, newZ) via plane intersection

pointerup (window, { once: true })
  → useDrag: DRAGGING → RELEASING
  → unpin(index): fx/fy/fz cleared, node springs back
  → simulation.alphaDecay(0.05): snappy settle
  → OrbitControls re-enabled
  → clearFocus()

useFrame detects alpha < alphaMin while RELEASING
  → dragState = IDLE
  → restoreDecay(): alphaDecay back to 0.02
  → simulationActive = false
```

## 7. Performance Budget

| Operation | Cost | When |
|-----------|------|------|
| simulation.tick() | ~0.1ms | Each frame while active |
| syncPositions (354 nodes) | ~0.01ms | Each frame while active |
| Edge position updates (239 links) | ~0.02ms | Each frame while active |
| Particle interpolation (239 particles) | ~0.02ms | Each frame always (unaffected by simulation state) |
| **Total per frame (active)** | **~0.15ms** | Well within 16ms budget |
| **Total per frame (settled)** | **~0.02ms** | Particles only |

354 nodes with 239 edges is trivially small for d3-force-3d. No Web Worker needed.

## 8. Future Compatibility (Phase 5)

This design accommodates Phase 5 (Graphify Explorer Integration) without changes:

- **Layer toggle:** When code nodes are added, `useSimulation` is re-initialized with the new node/link set. `positionsRef` and `nodeIndexMap` are rebuilt. Edge Float32Array rebuilds via useEffect on `links.length` change.
- **Drill-in:** Code nodes fly in via the drill-in animation hook (Phase 5, Task 8), then join the simulation. Reheat handles the new nodes settling.
- **God nodes:** Can be pinned at z=-200 via `fx/fy/fz` — same pinning mechanism as drag, but set permanently during `createForceSimulation()` node initialization (not via the drag `pin()`/`unpin()` functions, which are temporary). God node `fx/fy/fz` are never cleared.
