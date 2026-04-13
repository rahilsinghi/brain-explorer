# Force-Directed Simulation + Node Dragging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static UMAP+collision layout with a live d3-force-3d simulation and add node dragging with elastic tether feedback.

**Architecture:** d3-force-3d runs a cool-and-reheat simulation initialized from UMAP positions. A shared `Float32Array` bridges d3 (which mutates `SimNode` objects) and Three.js (which reads the array in `useFrame`). Dragging pins a node via `fx/fy/fz`, reheats the simulation, and `forceLink` provides elastic tether feedback for free.

**Tech Stack:** d3-force-3d v3.0.6, React Three Fiber, Three.js, zustand, TypeScript strict

**Spec:** `docs/superpowers/specs/2026-04-10-force-simulation-and-dragging-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/force-simulation.ts` | Pure d3 logic: create simulation, configure forces, `syncPositions()`, build `nodeIndexMap` |
| `src/hooks/useSimulation.ts` | React lifecycle wrapper: init/destroy simulation, expose refs + control functions (`reheat`, `pin`, `unpin`, `restoreDecay`) |
| `src/hooks/useDrag.ts` | Drag state machine (IDLE→DRAGGING→RELEASING→IDLE), pointer-to-3D projection, OrbitControls coordination |
| `src/lib/force-simulation.test.ts` | Unit tests for `createForceSimulation` and `syncPositions` |

### Modified Files

| File | Change |
|------|--------|
| `src/lib/types.ts` | Add `SimNode` interface, `DragState` type, `ALPHA_MIN` constant |
| `src/types/d3-force-3d.d.ts` | Extend with `alpha()`, `alphaDecay()`, `alphaMin()`, `restart()`, `forceLink`, `forceManyBody`, `forceCenter` |
| `src/hooks/useGraphData.ts` | Remove `applyCollisionLayout` call and import |
| `src/lib/graph-data.ts` | No changes (keep `normalizePositions` and `buildNeighborMap` as-is) |
| `src/hooks/useGraphState.ts` | Add `isDragging` flag to zustand store |
| `src/components/GraphView.tsx` | Instantiate `useSimulation`, `useDrag`; thread refs to InstancedNodes, Edges |
| `src/components/InstancedNodes.tsx` | Read positions from `positionsRef` Float32Array; tick simulation in `useFrame`; apply 1.3x drag scale; check RELEASING→IDLE transition |
| `src/components/Edges.tsx` | Replace static `useMemo` positions with dynamic `Float32Array`; read from `positionsRef` via `nodeIndexMap`; fix particle system; early-return in `useFrame` when `!simulationActive` |
| `src/components/CameraController.tsx` | Check `isDragging` to skip flyTo and keep OrbitControls disabled during drag |

### Deleted Files

| File | Reason |
|------|--------|
| `src/lib/force-layout.ts` | Replaced entirely by `force-simulation.ts` |

---

## Task 1: Types and Declarations

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/types/d3-force-3d.d.ts`

- [ ] **Step 1: Add SimNode and related types to types.ts**

Add after the `GraphLink` interface (line 17):

```typescript
export interface SimNode {
  id: string;
  title: string;
  tags: string[];
  category: string;
  source_type: string;
  created_at: string;
  connection_count: number;
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

export type DragState = "IDLE" | "DRAGGING" | "RELEASING";

export const ALPHA_MIN = 0.001;
```

- [ ] **Step 2: Extend d3-force-3d type declarations**

Replace the entire contents of `src/types/d3-force-3d.d.ts` with:

```typescript
declare module "d3-force-3d" {
  export interface SimulationNode {
    index?: number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
  }

  export interface Force<NodeDatum extends SimulationNode> {
    (alpha: number): void;
  }

  export interface Simulation<NodeDatum extends SimulationNode> {
    tick(): void;
    stop(): Simulation<NodeDatum>;
    restart(): Simulation<NodeDatum>;
    force(name: string): Force<NodeDatum> | undefined;
    force(name: string, force: Force<NodeDatum> | null): Simulation<NodeDatum>;
    velocityDecay(decay: number): Simulation<NodeDatum>;
    nodes(): NodeDatum[];
    nodes(nodes: NodeDatum[]): Simulation<NodeDatum>;
    alpha(): number;
    alpha(alpha: number): Simulation<NodeDatum>;
    alphaDecay(): number;
    alphaDecay(decay: number): Simulation<NodeDatum>;
    alphaMin(): number;
    alphaMin(min: number): Simulation<NodeDatum>;
  }

  export function forceSimulation<NodeDatum extends SimulationNode>(
    nodes?: NodeDatum[],
    numDimensions?: number,
  ): Simulation<NodeDatum>;

  export function forceLink<
    NodeDatum extends SimulationNode,
    LinkDatum extends { source: string; target: string },
  >(
    links?: LinkDatum[],
  ): Force<NodeDatum> & {
    id(fn: (node: NodeDatum) => string): ReturnType<typeof forceLink>;
    strength(s: number): ReturnType<typeof forceLink>;
    distance(d: number): ReturnType<typeof forceLink>;
  };

  export function forceManyBody<
    NodeDatum extends SimulationNode,
  >(): Force<NodeDatum> & {
    strength(s: number): ReturnType<typeof forceManyBody>;
  };

  export function forceCenter<NodeDatum extends SimulationNode>(
    x?: number,
    y?: number,
    z?: number,
  ): Force<NodeDatum> & {
    strength(s: number): ReturnType<typeof forceCenter>;
  };

  export function forceCollide<NodeDatum extends SimulationNode>(
    radius?: number | ((node: NodeDatum) => number),
  ): Force<NodeDatum> & {
    iterations(iterations: number): ReturnType<typeof forceCollide>;
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/rahilsinghi/Desktop/brain-explorer && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (existing errors, if any, should be unchanged)

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/types/d3-force-3d.d.ts
git commit -m "feat(types): add SimNode, DragState, and extended d3-force-3d declarations"
```

---

## Task 2: Core Simulation Module

**Files:**
- Create: `src/lib/force-simulation.ts`
- Create: `src/lib/force-simulation.test.ts`

- [ ] **Step 1: Write failing tests for createForceSimulation and syncPositions**

Create `src/lib/force-simulation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createForceSimulation, syncPositions } from "./force-simulation";
import type { GraphNode, GraphLink } from "./types";

function makeNode(id: string, x: number, y: number, z: number): GraphNode {
  return {
    id,
    title: id,
    tags: [],
    category: "concept",
    source_type: "wiki",
    created_at: "2026-01-01",
    connection_count: 1,
    x,
    y,
    z,
  };
}

describe("createForceSimulation", () => {
  it("returns simulation, simNodes, positionsRef, and nodeIndexMap", () => {
    const nodes = [makeNode("a", 1, 2, 3), makeNode("b", 4, 5, 6)];
    const links: GraphLink[] = [{ source: "a", target: "b" }];

    const result = createForceSimulation(nodes, links);

    expect(result.simulation).toBeDefined();
    expect(result.simNodes).toHaveLength(2);
    expect(result.positionsRef).toBeInstanceOf(Float32Array);
    expect(result.positionsRef.length).toBe(6); // 2 nodes * 3
    expect(result.nodeIndexMap.get("a")).toBe(0);
    expect(result.nodeIndexMap.get("b")).toBe(1);
  });

  it("seeds simNodes with input positions", () => {
    const nodes = [makeNode("a", 10, 20, 30)];
    const links: GraphLink[] = [];

    const { simNodes } = createForceSimulation(nodes, links);

    expect(simNodes[0].x).toBe(10);
    expect(simNodes[0].y).toBe(20);
    expect(simNodes[0].z).toBe(30);
  });

  it("initializes velocity and fix fields", () => {
    const nodes = [makeNode("a", 0, 0, 0)];
    const { simNodes } = createForceSimulation(nodes, []);

    expect(simNodes[0].vx).toBe(0);
    expect(simNodes[0].vy).toBe(0);
    expect(simNodes[0].vz).toBe(0);
    expect(simNodes[0].fx).toBeNull();
    expect(simNodes[0].fy).toBeNull();
    expect(simNodes[0].fz).toBeNull();
  });

  it("copies all GraphNode fields to SimNode", () => {
    const nodes = [makeNode("a", 1, 2, 3)];
    nodes[0].tags = ["test"];
    nodes[0].category = "project";

    const { simNodes } = createForceSimulation(nodes, []);

    expect(simNodes[0].id).toBe("a");
    expect(simNodes[0].title).toBe("a");
    expect(simNodes[0].tags).toEqual(["test"]);
    expect(simNodes[0].category).toBe("project");
  });
});

describe("syncPositions", () => {
  it("copies simNode positions into Float32Array", () => {
    const positions = new Float32Array(6);
    const simNodes = [
      { x: 10, y: 20, z: 30 },
      { x: 40, y: 50, z: 60 },
    ] as Array<{ x: number; y: number; z: number }>;

    syncPositions(simNodes, positions);

    expect(positions[0]).toBe(10);
    expect(positions[1]).toBe(20);
    expect(positions[2]).toBe(30);
    expect(positions[3]).toBe(40);
    expect(positions[4]).toBe(50);
    expect(positions[5]).toBe(60);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/rahilsinghi/Desktop/brain-explorer && npx vitest run src/lib/force-simulation.test.ts 2>&1 | tail -20`
Expected: FAIL — module `./force-simulation` not found

- [ ] **Step 3: Implement force-simulation.ts**

Create `src/lib/force-simulation.ts`:

```typescript
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force-3d";
import type { Simulation } from "d3-force-3d";
import type { GraphNode, GraphLink, SimNode } from "./types";

export function createForceSimulation(
  nodes: GraphNode[],
  links: GraphLink[],
): {
  simulation: Simulation<SimNode>;
  simNodes: SimNode[];
  positionsRef: Float32Array;
  nodeIndexMap: Map<string, number>;
} {
  const simNodes: SimNode[] = nodes.map((n) => ({
    id: n.id,
    title: n.title,
    tags: n.tags,
    category: n.category,
    source_type: n.source_type,
    created_at: n.created_at,
    connection_count: n.connection_count,
    x: n.x,
    y: n.y,
    z: n.z,
    vx: 0,
    vy: 0,
    vz: 0,
    fx: null,
    fy: null,
    fz: null,
  }));

  const simulation = forceSimulation(simNodes, 3)
    .force(
      "link",
      forceLink<SimNode, GraphLink>(links)
        .id((d: SimNode) => d.id)
        .strength(0.3)
        .distance(15),
    )
    .force("charge", forceManyBody<SimNode>().strength(-30))
    .force("center", forceCenter<SimNode>(0, 0, 0).strength(0.01))
    .force("collide", forceCollide<SimNode>(2.0))
    .alphaDecay(0.02)
    .velocityDecay(0.4);

  // Critical: stop d3's internal RAF timer immediately.
  // We tick manually in useFrame to avoid double-ticking and jitter.
  simulation.stop();

  const positionsRef = new Float32Array(nodes.length * 3);
  syncPositions(simNodes, positionsRef);

  const nodeIndexMap = new Map<string, number>();
  for (let i = 0; i < simNodes.length; i++) {
    nodeIndexMap.set(simNodes[i].id, i);
  }

  return { simulation, simNodes, positionsRef, nodeIndexMap };
}

export function syncPositions(
  simNodes: Array<{ x: number; y: number; z: number }>,
  positions: Float32Array,
): void {
  for (let i = 0; i < simNodes.length; i++) {
    const offset = i * 3;
    positions[offset] = simNodes[i].x;
    positions[offset + 1] = simNodes[i].y;
    positions[offset + 2] = simNodes[i].z;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/rahilsinghi/Desktop/brain-explorer && npx vitest run src/lib/force-simulation.test.ts 2>&1 | tail -20`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/force-simulation.ts src/lib/force-simulation.test.ts
git commit -m "feat(simulation): add createForceSimulation and syncPositions with tests"
```

---

## Task 3: Simulation React Hook

**Files:**
- Create: `src/hooks/useSimulation.ts`

- [ ] **Step 1: Implement useSimulation.ts**

Create `src/hooks/useSimulation.ts`:

```typescript
"use client";

import { useRef, useEffect, useCallback } from "react";
import type { Simulation } from "d3-force-3d";
import type { GraphNode, GraphLink, SimNode, DragState } from "@/lib/types";
import { ALPHA_MIN } from "@/lib/types";
import { createForceSimulation, syncPositions } from "@/lib/force-simulation";

interface UseSimulationReturn {
  positionsRef: React.MutableRefObject<Float32Array>;
  simNodesRef: React.MutableRefObject<SimNode[]>;
  nodeIndexMap: React.MutableRefObject<Map<string, number>>;
  simulationRef: React.MutableRefObject<Simulation<SimNode>>;
  simulationActive: React.MutableRefObject<boolean>;
  tick: () => void;
  reheat: (alpha?: number) => void;
  pin: (index: number, x: number, y: number, z: number) => void;
  unpin: (index: number) => void;
  restoreDecay: () => void;
}

export function useSimulation(
  nodes: GraphNode[],
  links: GraphLink[],
): UseSimulationReturn {
  const positionsRef = useRef<Float32Array>(new Float32Array(0));
  const simNodesRef = useRef<SimNode[]>([]);
  const nodeIndexMapRef = useRef<Map<string, number>>(new Map());
  const simulationRef = useRef<Simulation<SimNode>>(null!);
  const simulationActive = useRef(true);

  useEffect(() => {
    if (nodes.length === 0) return;

    const { simulation, simNodes, positionsRef: positions, nodeIndexMap } =
      createForceSimulation(nodes, links);

    simulationRef.current = simulation;
    simNodesRef.current = simNodes;
    positionsRef.current = positions;
    nodeIndexMapRef.current = nodeIndexMap;
    simulationActive.current = true;

    return () => {
      simulation.stop();
    };
  }, [nodes, links]);

  const tick = useCallback(() => {
    if (!simulationRef.current || !simulationActive.current) return;

    simulationRef.current.tick();
    syncPositions(simNodesRef.current, positionsRef.current);

    if (simulationRef.current.alpha() < ALPHA_MIN) {
      simulationActive.current = false;
    }
  }, []);

  const reheat = useCallback((alpha = 0.15) => {
    if (!simulationRef.current) return;
    simulationRef.current.alpha(alpha);
    simulationActive.current = true;
  }, []);

  const pin = useCallback((index: number, x: number, y: number, z: number) => {
    const node = simNodesRef.current[index];
    if (!node) return;
    node.fx = x;
    node.fy = y;
    node.fz = z;
  }, []);

  const unpin = useCallback((index: number) => {
    const node = simNodesRef.current[index];
    if (!node) return;
    node.fx = null;
    node.fy = null;
    node.fz = null;
  }, []);

  const restoreDecay = useCallback(() => {
    if (!simulationRef.current) return;
    simulationRef.current.alphaDecay(0.02);
  }, []);

  return {
    positionsRef,
    simNodesRef,
    nodeIndexMap: nodeIndexMapRef,
    simulationRef,
    simulationActive,
    tick,
    reheat,
    pin,
    unpin,
    restoreDecay,
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/rahilsinghi/Desktop/brain-explorer && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSimulation.ts
git commit -m "feat(simulation): add useSimulation React hook"
```

---

## Task 4: Remove Collision Layout

**Files:**
- Modify: `src/hooks/useGraphData.ts:6,38`
- Delete: `src/lib/force-layout.ts`

- [ ] **Step 1: Remove collision layout from useGraphData.ts**

In `src/hooks/useGraphData.ts`, remove the import on line 6:

```typescript
// DELETE this line:
import { applyCollisionLayout } from "@/lib/force-layout";
```

Remove the `COLLIDE_RADIUS` constant on line 18:

```typescript
// DELETE this line:
const COLLIDE_RADIUS = 2.0;
```

Replace line 38 (`const positioned = applyCollisionLayout(normalized, COLLIDE_RADIUS);`) and line 40 (`setNodes(positioned);`) with:

```typescript
        setNodes(normalized);
```

The full `load` function after changes:

```typescript
    async function load() {
      try {
        const res = await fetch("/graph.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: GraphCache = await res.json();

        const normalized = normalizePositions(data.nodes, SCENE_RADIUS);

        setNodes(normalized);
        setLinks(data.links);
        setNeighborMap(buildNeighborMap(data.links));
        setGeneratedAt(data.generated_at);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load graph");
      } finally {
        setLoading(false);
      }
    }
```

- [ ] **Step 2: Delete force-layout.ts**

Run: `rm src/lib/force-layout.ts`

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/rahilsinghi/Desktop/brain-explorer && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useGraphData.ts
git rm src/lib/force-layout.ts
git commit -m "refactor: remove collision layout, simulation handles spacing now"
```

---

## Task 5: Add isDragging to Zustand Store

**Files:**
- Modify: `src/hooks/useGraphState.ts`

- [ ] **Step 1: Add isDragging to the store**

In `src/hooks/useGraphState.ts`, add `isDragging` to the interface and initial state:

Add to the `GraphState` interface (after line 7 `hoveredNodeId`):

```typescript
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
```

Add to the `create` call (after line 18 `hoveredNodeId: null,`):

```typescript
  isDragging: false,
  setIsDragging: (dragging) => set({ isDragging: dragging }),
```

The full file after changes:

```typescript
import { create } from "zustand";

interface GraphState {
  focusedNodeId: string | null;
  hoveredNodeId: string | null;
  isDragging: boolean;
  filterCategory: string | null;
  filterQuery: string;
  setFocusedNode: (id: string | null) => void;
  clearFocus: () => void;
  setHoveredNode: (id: string | null) => void;
  setIsDragging: (dragging: boolean) => void;
  setFilterCategory: (category: string | null) => void;
  setFilterQuery: (query: string) => void;
}

export const useGraphState = create<GraphState>((set) => ({
  focusedNodeId: null,
  hoveredNodeId: null,
  isDragging: false,
  filterCategory: null,
  filterQuery: "",
  setFocusedNode: (id) => set({ focusedNodeId: id }),
  clearFocus: () => set({ focusedNodeId: null }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setIsDragging: (dragging) => set({ isDragging: dragging }),
  setFilterCategory: (category) => set({ filterCategory: category }),
  setFilterQuery: (query) => set({ filterQuery: query }),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/rahilsinghi/Desktop/brain-explorer && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGraphState.ts
git commit -m "feat(state): add isDragging flag to zustand store"
```

---

## Task 6: CameraController — Drag Coordination

**Files:**
- Modify: `src/components/CameraController.tsx:58-74,76-91`

The CameraController needs two small changes: (1) skip flyTo when dragging, and (2) keep OrbitControls disabled during drag.

- [ ] **Step 1: Update CameraController to respect isDragging**

In `src/components/CameraController.tsx`:

Add import at the top — the existing `useGraphState` import on line 8 already exists, so no new import needed. We'll read `isDragging` from the store.

After line 22 (`const focusedNodeId = ...`), add:

```typescript
  const isDragging = useGraphState((s) => s.isDragging);
```

Update the flyTo `useEffect` (lines 58-74). Add `isDragging` guard and dependency:

```typescript
  useEffect(() => {
    if (isDragging) return;
    if (focusedNodeId) {
      const node = nodeMap.get(focusedNodeId);
      if (!node) return;
      savedOrbitRef.current.position.copy(camera.position);
      if (controlsRef.current) {
        savedOrbitRef.current.target.copy(controlsRef.current.target);
      }
      flyTo(
        new THREE.Vector3(node.x, node.y, node.z),
        camera.position.clone(),
        controlsRef.current?.target.clone() ?? DEFAULT_TARGET.clone(),
      );
    } else {
      resetTo(savedOrbitRef.current.position, savedOrbitRef.current.target);
    }
  }, [focusedNodeId, isDragging, nodeMap, camera, flyTo, resetTo]);
```

Update the `useFrame` callback (lines 76-91). Add `isDragging` to the controls-enabled check:

```typescript
  useFrame((_, delta) => {
    const animating = update(delta, camera, controlsRef.current);
    if (controlsRef.current) {
      controlsRef.current.enabled = !animating && !isDragging;
    }

    const controls = controlsRef.current;
    if (autoRotateRef.current.active && !animating && !focusedNodeId && !isDragging && controls) {
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += AUTO_ROTATE_SPEED;
      offset.setFromSpherical(spherical);
      camera.position.copy(controls.target).add(offset);
      camera.lookAt(controls.target);
    }
  });
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/rahilsinghi/Desktop/brain-explorer && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/CameraController.tsx
git commit -m "feat(camera): skip flyTo and disable orbit controls during drag"
```

---

## Task 7: Drag Hook

**Files:**
- Create: `src/hooks/useDrag.ts`

- [ ] **Step 1: Implement useDrag.ts**

Create `src/hooks/useDrag.ts`:

```typescript
"use client";

import { useRef, useCallback } from "react";
import { useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Simulation } from "d3-force-3d";
import type { SimNode, DragState } from "@/lib/types";
import { useGraphState } from "@/hooks/useGraphState";

const DRAG_THRESHOLD_PX = 5;
const POSITION_CLAMP = 80;

interface UseDragParams {
  simulationRef: React.MutableRefObject<Simulation<SimNode>>;
  simNodesRef: React.MutableRefObject<SimNode[]>;
  positionsRef: React.MutableRefObject<Float32Array>;
  nodeIndexMap: React.MutableRefObject<Map<string, number>>;
  reheat: (alpha?: number) => void;
  pin: (index: number, x: number, y: number, z: number) => void;
  unpin: (index: number) => void;
  restoreDecay: () => void;
}

interface UseDragReturn {
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  dragState: React.MutableRefObject<DragState>;
  draggedIndex: React.MutableRefObject<number | null>;
}

export function useDrag({
  simulationRef,
  simNodesRef,
  positionsRef,
  nodeIndexMap,
  reheat,
  pin,
  unpin,
  restoreDecay,
}: UseDragParams): UseDragReturn {
  const { camera, raycaster } = useThree();
  const dragState = useRef<DragState>("IDLE");
  const draggedIndex = useRef<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const thresholdCrossed = useRef(false);

  const plane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());
  const normal = useRef(new THREE.Vector3());

  const setFocusedNode = useGraphState((s) => s.setFocusedNode);
  const clearFocus = useGraphState((s) => s.clearFocus);
  const setIsDragging = useGraphState((s) => s.setIsDragging);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (draggedIndex.current === null) return;
      const idx = draggedIndex.current;

      // Check threshold before entering drag state
      if (!thresholdCrossed.current) {
        const dx = e.clientX - pointerStart.current.x;
        const dy = e.clientY - pointerStart.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_PX) return;

        // Threshold crossed — enter DRAGGING state
        thresholdCrossed.current = true;
        dragState.current = "DRAGGING";

        const simNode = simNodesRef.current[idx];
        setIsDragging(true);
        setFocusedNode(simNode.id);
        reheat(0.15);
      }

      // Project pointer onto camera-perpendicular plane through the pinned node
      const positions = positionsRef.current;
      const offset = idx * 3;
      const nodePos = new THREE.Vector3(
        positions[offset],
        positions[offset + 1],
        positions[offset + 2],
      );

      camera.getWorldDirection(normal.current);
      plane.current.setFromNormalAndCoplanarPoint(normal.current, nodePos);

      // Build ray from pointer position
      const ndc = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);

      if (raycaster.ray.intersectPlane(plane.current, intersection.current)) {
        const x = Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, intersection.current.x));
        const y = Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, intersection.current.y));
        const z = Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, intersection.current.z));
        pin(idx, x, y, z);
      }
    },
    [camera, raycaster, simNodesRef, positionsRef, pin, reheat, setFocusedNode, setIsDragging],
  );

  const handlePointerUp = useCallback(() => {
    window.removeEventListener("pointermove", handlePointerMove);

    const idx = draggedIndex.current;

    if (!thresholdCrossed.current && idx !== null) {
      // Pointer didn't cross threshold — treat as click (focus)
      const simNode = simNodesRef.current[idx];
      if (simNode) {
        setFocusedNode(simNode.id);
      }
      draggedIndex.current = null;
      dragState.current = "IDLE";
      return;
    }

    if (idx !== null) {
      unpin(idx);
      simulationRef.current.alphaDecay(0.05);
      dragState.current = "RELEASING";
    }

    draggedIndex.current = null;
    setIsDragging(false);
    clearFocus();
  }, [handlePointerMove, simNodesRef, unpin, simulationRef, setFocusedNode, setIsDragging, clearFocus]);

  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (dragState.current !== "IDLE") return;
      const instanceId = event.instanceId;
      if (instanceId === undefined) return;

      event.stopPropagation();
      draggedIndex.current = instanceId;
      thresholdCrossed.current = false;
      pointerStart.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
    },
    [handlePointerMove, handlePointerUp],
  );

  return { onPointerDown, dragState, draggedIndex };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/rahilsinghi/Desktop/brain-explorer && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (or only pre-existing errors)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDrag.ts
git commit -m "feat(drag): add useDrag hook with state machine and pointer-to-3D projection"
```

---

## Task 8: InstancedNodes Overhaul

**Files:**
- Modify: `src/components/InstancedNodes.tsx`

This is the most complex change. InstancedNodes must:
1. Accept simulation refs as props
2. Read positions from `positionsRef` Float32Array (not `node.x/y/z`)
3. Tick the simulation in `useFrame`
4. Apply 1.3x scale to the dragged node
5. Check RELEASING → IDLE transition
6. Wire drag `onPointerDown` (replacing existing `onClick`)

- [ ] **Step 1: Update InstancedNodes props and imports**

Replace the props interface and imports at the top of `src/components/InstancedNodes.tsx`:

```typescript
"use client";

import { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Simulation } from "d3-force-3d";
import type { GraphNode, SimNode, DragState } from "@/lib/types";
import { ALPHA_MIN } from "@/lib/types";
import { getCategoryColor, getGlowColor, getNodeRadius } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";
import { syncPositions } from "@/lib/force-simulation";

interface InstancedNodesProps {
  nodes: GraphNode[];
  neighborMap: Map<string, Set<string>>;
  positionsRef: React.MutableRefObject<Float32Array>;
  simulationRef: React.MutableRefObject<Simulation<SimNode>>;
  simNodesRef: React.MutableRefObject<SimNode[]>;
  simulationActive: React.MutableRefObject<boolean>;
  tick: () => void;
  restoreDecay: () => void;
  dragState: React.MutableRefObject<DragState>;
  draggedIndex: React.MutableRefObject<number | null>;
  onNodePointerDown: (event: ThreeEvent<PointerEvent>) => void;
}
```

- [ ] **Step 2: Update component signature and internal nodeIndexMap**

Replace the component function signature and the internal `nodeIndexMap` (which mapped `number → string` for hover/click, now renamed to `instanceToNodeId` for clarity):

```typescript
export function InstancedNodes({
  nodes,
  neighborMap,
  positionsRef,
  simulationRef,
  simNodesRef,
  simulationActive,
  tick,
  restoreDecay,
  dragState,
  draggedIndex,
  onNodePointerDown,
}: InstancedNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const setHoveredNode = useGraphState((s) => s.setHoveredNode);

  const instanceToNodeId = useMemo(() => {
    const map = new Map<number, string>();
    nodes.forEach((n, i) => map.set(i, n.id));
    return map;
  }, [nodes]);
```

- [ ] **Step 3: Update handlePointerMove, handlePointerOut, remove handleClick**

Replace the pointer handlers. Remove `handleClick` entirely (drag `onPointerDown` replaces it). Update `handlePointerMove` and `handlePointerOut` to use `instanceToNodeId`:

```typescript
  const pointerOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (pointerOutTimer.current) clearTimeout(pointerOutTimer.current);
      const instanceId = e.instanceId;
      if (instanceId !== undefined) {
        const nodeId = instanceToNodeId.get(instanceId) ?? null;
        setHoveredNode(nodeId);
        document.body.style.cursor = "pointer";
      }
    },
    [instanceToNodeId, setHoveredNode],
  );

  const handlePointerOut = useCallback(() => {
    pointerOutTimer.current = setTimeout(() => {
      setHoveredNode(null);
      document.body.style.cursor = "default";
    }, 50);
  }, [setHoveredNode]);
```

- [ ] **Step 4: Update useFrame to tick simulation and read from positionsRef**

Replace the `useFrame` callback:

```typescript
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const glow = glowRef.current;
    const time = clock.getElapsedTime();

    // Tick simulation when active
    if (simulationActive.current) {
      tick();

      // Check RELEASING → IDLE transition
      if (
        dragState.current === "RELEASING" &&
        simulationRef.current.alpha() < ALPHA_MIN
      ) {
        dragState.current = "IDLE";
        restoreDecay();
        simulationActive.current = false;
      }
    }

    const positions = positionsRef.current;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const baseRadius = radii[i];

      const pulse =
        1 + 0.05 * Math.sin(time * ((2 * Math.PI) / 3) + i * 0.7);
      let scale = baseRadius * pulse;

      // 1.3x scale on dragged node
      if (dragState.current === "DRAGGING" && i === draggedIndex.current) {
        scale *= 1.3;
      }

      // Read position from shared Float32Array
      const offset = i * 3;
      tempObject.position.set(
        positions[offset],
        positions[offset + 1],
        positions[offset + 2],
      );
      tempObject.scale.set(scale, scale, scale);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);

      // Glow sprite: same position, larger scale, uses billboard plane
      if (glow) {
        const glowScale = scale * GLOW_SCALE;
        tempObject.scale.set(glowScale, glowScale, 1);
        tempObject.updateMatrix();
        glow.setMatrixAt(i, tempObject.matrix);
      }

      if (focusNeighbors) {
        const isFocused = node.id === focusedNodeId;
        const isNeighbor = focusNeighbors.has(node.id);
        const opacity = isFocused || isNeighbor ? 1.0 : 0.1;
        tempColor.copy(baseColors[i]).multiplyScalar(opacity);
        mesh.setColorAt(i, tempColor);

        if (glow) {
          const glowOpacity =
            isFocused || isNeighbor ? GLOW_OPACITY : 0.015;
          tempColor.copy(glowColors[i]).multiplyScalar(glowOpacity);
          glow.setColorAt(i, tempColor);
        }
      } else {
        mesh.setColorAt(i, baseColors[i]);

        if (glow) {
          tempColor.copy(glowColors[i]).multiplyScalar(GLOW_OPACITY);
          glow.setColorAt(i, tempColor);
        }
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    if (glow) {
      glow.instanceMatrix.needsUpdate = true;
      if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
    }
  });
```

- [ ] **Step 5: Update JSX — replace onClick with onPointerDown**

In the return JSX, replace `onClick={handleClick}` on the core node mesh with `onPointerDown={onNodePointerDown}`:

```typescript
      {/* Core node spheres */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, nodes.length]}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onPointerDown={onNodePointerDown}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd /Users/rahilsinghi/Desktop/brain-explorer && npx tsc --noEmit 2>&1 | head -20`
Expected: Errors only from GraphView.tsx (not yet updated to pass new props) — that's expected

- [ ] **Step 7: Commit**

```bash
git add src/components/InstancedNodes.tsx
git commit -m "feat(nodes): read positions from simulation Float32Array, tick in useFrame, support drag"
```

---

## Task 9: Edges Overhaul

**Files:**
- Modify: `src/components/Edges.tsx`

Edges switches from a static `useMemo` position computation to a dynamic `Float32Array` updated each frame from `positionsRef`. Particle system also switches to reading from `positionsRef`.

- [ ] **Step 1: Update Edges props and imports**

Replace the top of `src/components/Edges.tsx`:

```typescript
"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GraphNode, GraphLink } from "@/lib/types";
import { useGraphState } from "@/hooks/useGraphState";
import { getCategoryColor } from "@/lib/categories";

interface EdgesProps {
  nodes: GraphNode[];
  links: GraphLink[];
  positionsRef: React.MutableRefObject<Float32Array>;
  nodeIndexMap: React.MutableRefObject<Map<string, number>>;
  simulationActive: React.MutableRefObject<boolean>;
}
```

- [ ] **Step 2: Replace the static geometry useMemo with dynamic Float32Array**

Replace the component body. The key change: positions are no longer baked into the geometry at creation time. Instead, a persistent `Float32Array` is updated each frame in `useFrame`.

```typescript
export function Edges({
  nodes,
  links,
  positionsRef,
  nodeIndexMap,
  simulationActive,
}: EdgesProps) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const particleRef = useRef<THREE.Points>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);

  // Node map for category color lookup only
  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  // Edge positions Float32Array — rebuilt when link count changes
  const edgePositionsRef = useRef<Float32Array>(new Float32Array(0));

  // Build geometry with initial positions and colors
  const { geometry, linkSourceTargets, edgeColors } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (links.length === 0)
      return { geometry: geo, linkSourceTargets: [], edgeColors: [] };

    const positions = new Float32Array(links.length * 6);
    const colors: number[] = [];
    const sourceTargets: Array<{ source: string; target: string }> = [];
    const edgeColorList: THREE.Color[] = [];
    const indexMap = nodeIndexMap.current;
    const nodePositions = positionsRef.current;

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const source = nodeMap.get(link.source);
      if (!source) continue;

      const color = new THREE.Color(getCategoryColor(source.category));
      edgeColorList.push(color);

      // Initial positions from positionsRef
      const si = indexMap.get(link.source);
      const ti = indexMap.get(link.target);
      if (si !== undefined && ti !== undefined) {
        const offset = i * 6;
        positions[offset] = nodePositions[si * 3];
        positions[offset + 1] = nodePositions[si * 3 + 1];
        positions[offset + 2] = nodePositions[si * 3 + 2];
        positions[offset + 3] = nodePositions[ti * 3];
        positions[offset + 4] = nodePositions[ti * 3 + 1];
        positions[offset + 5] = nodePositions[ti * 3 + 2];
      }

      colors.push(color.r, color.g, color.b, DEFAULT_ALPHA);
      colors.push(color.r, color.g, color.b, DEFAULT_ALPHA);
      sourceTargets.push({ source: link.source, target: link.target });
    }

    edgePositionsRef.current = positions;

    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));

    return {
      geometry: geo,
      linkSourceTargets: sourceTargets,
      edgeColors: edgeColorList,
    };
  }, [links, nodes, nodeMap, nodeIndexMap, positionsRef]);

  // Particle system
  const { particleGeometry, particleProgress } = useMemo(() => {
    const count = linkSourceTargets.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const progress = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      progress[i] = Math.random();
      if (edgeColors[i]) {
        colors[i * 3] = edgeColors[i].r;
        colors[i * 3 + 1] = edgeColors[i].g;
        colors[i * 3 + 2] = edgeColors[i].b;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return { particleGeometry: geo, particleProgress: progress };
  }, [linkSourceTargets, edgeColors]);

  // Focus-alpha: mutate color attribute on focus change
  useEffect(() => {
    const colorAttr = geometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute | null;
    if (!colorAttr || linkSourceTargets.length === 0) return;

    for (let i = 0; i < linkSourceTargets.length; i++) {
      const { source, target } = linkSourceTargets[i];
      let alpha: number;

      if (focusedNodeId) {
        const isFocusEdge =
          source === focusedNodeId || target === focusedNodeId;
        alpha = isFocusEdge ? FOCUS_ALPHA : DIMMED_ALPHA;
      } else {
        alpha = DEFAULT_ALPHA;
      }

      const idx = i * 2;
      colorAttr.setW(idx, alpha);
      colorAttr.setW(idx + 1, alpha);
    }

    colorAttr.needsUpdate = true;
  }, [focusedNodeId, geometry, linkSourceTargets]);

  // Frame loop: update edge positions + particle interpolation
  useFrame((_, delta) => {
    // Update edge line positions when simulation is active
    if (simulationActive.current) {
      const positions = positionsRef.current;
      const indexMap = nodeIndexMap.current;
      const edgePositions = edgePositionsRef.current;

      for (let i = 0; i < linkSourceTargets.length; i++) {
        const si = indexMap.get(linkSourceTargets[i].source)!;
        const ti = indexMap.get(linkSourceTargets[i].target)!;
        const offset = i * 6;

        edgePositions[offset] = positions[si * 3];
        edgePositions[offset + 1] = positions[si * 3 + 1];
        edgePositions[offset + 2] = positions[si * 3 + 2];
        edgePositions[offset + 3] = positions[ti * 3];
        edgePositions[offset + 4] = positions[ti * 3 + 1];
        edgePositions[offset + 5] = positions[ti * 3 + 2];
      }

      const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
    }

    // Particle interpolation — always runs (particles animate even when settled)
    if (!particleRef.current || linkSourceTargets.length === 0) return;
    const particlePosAttr = particleGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const positions = positionsRef.current;
    const indexMap = nodeIndexMap.current;

    for (let i = 0; i < linkSourceTargets.length; i++) {
      const si = indexMap.get(linkSourceTargets[i].source);
      const ti = indexMap.get(linkSourceTargets[i].target);
      if (si === undefined || ti === undefined) continue;

      particleProgress[i] = (particleProgress[i] + delta * PARTICLE_SPEED) % 1;
      const t = particleProgress[i];

      const sx = positions[si * 3];
      const sy = positions[si * 3 + 1];
      const sz = positions[si * 3 + 2];
      const tx = positions[ti * 3];
      const ty = positions[ti * 3 + 1];
      const tz = positions[ti * 3 + 2];

      particlePosAttr.setXYZ(
        i,
        sx + (tx - sx) * t,
        sy + (ty - sy) * t,
        sz + (tz - sz) * t,
      );
    }
    particlePosAttr.needsUpdate = true;
  });

  if (links.length === 0) return null;

  return (
    <>
      <lineSegments ref={lineRef} geometry={geometry}>
        <lineBasicMaterial vertexColors transparent />
      </lineSegments>
      <points ref={particleRef} geometry={particleGeometry}>
        <pointsMaterial
          vertexColors
          size={3}
          transparent
          opacity={0.9}
          sizeAttenuation={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/rahilsinghi/Desktop/brain-explorer && npx tsc --noEmit 2>&1 | head -20`
Expected: Errors only from GraphView.tsx (not yet passing new Edges props)

- [ ] **Step 3: Commit**

```bash
git add src/components/Edges.tsx
git commit -m "feat(edges): dynamic Float32Array positions, particle system reads from positionsRef"
```

---

## Task 10: GraphView Wiring

**Files:**
- Modify: `src/components/GraphView.tsx`

Wire `useSimulation` and `useDrag` into GraphView, thread all refs and handlers down to InstancedNodes and Edges.

- [ ] **Step 1: Update GraphView imports and hook calls**

Replace the full content of `src/components/GraphView.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { GraphCanvas } from "@/components/GraphCanvas";
import { InstancedNodes } from "@/components/InstancedNodes";
import { Edges } from "@/components/Edges";
import { CameraController } from "@/components/CameraController";
import { Tooltip } from "@/components/Tooltip";
import { CommandPalette } from "@/components/CommandPalette";
import { ArticlePanel } from "@/components/ArticlePanel";
import { AdminRefresh } from "@/components/AdminRefresh";
import { GraphMeta } from "@/components/GraphMeta";
import { useGraphData } from "@/hooks/useGraphData";
import { useGraphState } from "@/hooks/useGraphState";
import { useSimulation } from "@/hooks/useSimulation";
import { SimulationConsumer } from "@/components/SimulationConsumer";

export function GraphView() {
  const { nodes, links, neighborMap, generatedAt, loading, error } =
    useGraphData();
  const clearFocus = useGraphState((s) => s.clearFocus);
  const setFocusedNode = useGraphState((s) => s.setFocusedNode);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);

  // Esc to clear focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearFocus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearFocus]);

  // Listen for wikilink CustomEvent from ArticlePanel
  useEffect(() => {
    const handler = (e: Event) => {
      const slug = (e as CustomEvent<string>).detail;
      if (slug) setFocusedNode(slug);
    };
    window.addEventListener("brain:focus", handler);
    return () => window.removeEventListener("brain:focus", handler);
  }, [setFocusedNode]);

  // Deep-link: read ?focus= on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const focusParam = params.get("focus");
    if (focusParam && nodes.length > 0) {
      const match = nodes.find((n) => n.id === focusParam);
      if (match) setFocusedNode(match.id);
    }
  }, [nodes, setFocusedNode]);

  // Deep-link: update URL on focus change
  useEffect(() => {
    const url = new URL(window.location.href);
    if (focusedNodeId) {
      url.searchParams.set("focus", focusedNodeId);
    } else {
      url.searchParams.delete("focus");
    }
    window.history.replaceState({}, "", url.toString());
  }, [focusedNodeId]);

  if (loading) {
    return (
      <main className="h-screen w-screen flex items-center justify-center">
        <p className="text-slate-500 text-sm animate-pulse">
          Loading graph...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="h-screen w-screen flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen relative">
      <GraphCanvas onPointerMissed={clearFocus}>
        <SimulationConsumer nodes={nodes} links={links} neighborMap={neighborMap} />
        <CameraController nodes={nodes} />
        <Tooltip nodes={nodes} neighborMap={neighborMap} />
      </GraphCanvas>

      <CommandPalette nodes={nodes} />
      <ArticlePanel nodes={nodes} neighborMap={neighborMap} />
      <GraphMeta nodeCount={nodes.length} generatedAt={generatedAt} />
      <AdminRefresh />
    </main>
  );
}
```

Note: `useSimulation` and `useDrag` use R3F hooks (`useThree`, `useFrame` indirectly), so they must be called inside the Canvas tree. We create a `SimulationConsumer` component that lives inside the Canvas to host these hooks.

- [ ] **Step 2: Create SimulationConsumer component**

Create `src/components/SimulationConsumer.tsx`:

```typescript
"use client";

import type { GraphNode, GraphLink } from "@/lib/types";
import { useSimulation } from "@/hooks/useSimulation";
import { useDrag } from "@/hooks/useDrag";
import { InstancedNodes } from "@/components/InstancedNodes";
import { Edges } from "@/components/Edges";

interface SimulationConsumerProps {
  nodes: GraphNode[];
  links: GraphLink[];
  neighborMap: Map<string, Set<string>>;
}

export function SimulationConsumer({ nodes, links, neighborMap }: SimulationConsumerProps) {
  const {
    positionsRef,
    simNodesRef,
    nodeIndexMap,
    simulationRef,
    simulationActive,
    tick,
    reheat,
    pin,
    unpin,
    restoreDecay,
  } = useSimulation(nodes, links);

  const { onPointerDown, dragState, draggedIndex } = useDrag({
    simulationRef,
    simNodesRef,
    positionsRef,
    nodeIndexMap,
    reheat,
    pin,
    unpin,
    restoreDecay,
  });

  if (nodes.length === 0) return null;

  return (
    <>
      <Edges
        nodes={nodes}
        links={links}
        positionsRef={positionsRef}
        nodeIndexMap={nodeIndexMap}
        simulationActive={simulationActive}
      />
      <InstancedNodes
        nodes={nodes}
        neighborMap={neighborMap}
        positionsRef={positionsRef}
        simulationRef={simulationRef}
        simNodesRef={simNodesRef}
        simulationActive={simulationActive}
        tick={tick}
        restoreDecay={restoreDecay}
        dragState={dragState}
        draggedIndex={draggedIndex}
        onNodePointerDown={onPointerDown}
      />
    </>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/rahilsinghi/Desktop/brain-explorer && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Run the unit tests**

Run: `cd /Users/rahilsinghi/Desktop/brain-explorer && npx vitest run 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/GraphView.tsx src/components/SimulationConsumer.tsx
git commit -m "feat(graph): wire useSimulation and useDrag through SimulationConsumer"
```

---

## Task 11: Visual Verification

**Files:** None (verification only)

- [ ] **Step 1: Start the dev server**

Run: `cd /Users/rahilsinghi/Desktop/brain-explorer && pnpm dev`

- [ ] **Step 2: Verify simulation on load**

Open http://localhost:3000 in the browser. Verify:
- Nodes render and animate into position (~3-4 seconds of settling)
- Edges connect the correct nodes and follow their positions during settling
- Particles flow along edges during and after settling
- Graph settles to a stable layout (no jitter, no drift)
- After settling, graph is idle (check with React DevTools profiler or FPS counter — CPU usage should drop)

- [ ] **Step 3: Verify node dragging**

Test drag interaction:
- Click a node without moving: should focus it (article panel opens, camera flies to it, neighbors highlight)
- Click and drag a node past 5px: should enter drag mode (node scales 1.3x, non-neighbors dim, orbit controls disabled)
- During drag: neighbors should visibly pull toward the dragged node (elastic tether effect from forceLink)
- Release: node springs back to equilibrium, focus clears, orbit controls re-enable, graph settles in ~1 second
- Drag to edge of graph: position should clamp at ±80 (no node flying off to infinity)

- [ ] **Step 4: Verify existing features still work**

Regression check:
- Command palette (Cmd+K): search and focus still works
- Wikilinks in ArticlePanel: clicking still focuses the target node
- Deep link (?focus=some-id): still works on page load
- Esc key: clears focus
- Hover tooltip: still appears over nodes
- Auto-rotation: resumes after idle
- Click on empty space: clears focus

- [ ] **Step 5: Commit if any fixes were needed**

If adjustments were made during verification:
```bash
git add -A
git commit -m "fix: adjustments from visual verification"
```

---

## Known Limitations (Intentional for v1.2)

1. **Camera flyTo uses GraphNode positions:** When focusing a node (via click, command palette, or wikilink), the camera flies to the original UMAP-seeded position, not the simulation's current position. This is acceptable because the simulation refines from UMAP positions with weak forces — final positions are close to seeds. Can be fixed in a follow-up by having CameraController read from `positionsRef`.

2. **No Web Worker:** 354 nodes / 239 edges is trivially small. The ~0.15ms per-frame cost doesn't justify worker complexity.

3. **No persistent drag pin:** Dragged nodes always spring back on release. Persistent pinning (shift+drag) is a Phase 5 feature.
