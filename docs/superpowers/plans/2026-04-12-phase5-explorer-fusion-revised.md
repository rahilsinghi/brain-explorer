# Phase 5 — Explorer Fusion (Revised for Liquid Sphere)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two-layer visualization (wiki + code) to the Brain Explorer with layer toggling, drill-in UX for repo nodes, god-node rendering, code-node cubes, and centrality-capped summon animations — all working within the existing liquid sphere architecture (Fibonacci layout, MeshTransmissionMaterial glass nodes, arc edges, spring-based drag).

**Architecture:** The daemon (Phases 1-4 complete) produces a unified `GraphCache` where each `GraphNode` has `layer`, `is_god_node`, `community`, `repo` and each `GraphLink` has `relation`, `confidence`. The explorer parses these, filters by layer mode, renders wiki nodes as glass spheres (existing) and code nodes as glass cubes (new InstancedMesh), and handles drill-in reveals. The Fibonacci sphere layout places all visible nodes. God nodes get z-offset after layout. All edges use existing arc geometry.

**Tech Stack:** Next.js 15, React Three Fiber, drei MeshTransmissionMaterial, Zustand, TypeScript strict

**Key architectural constraint — liquid sphere redesign:**
- No force simulation. `useSphereLayout` computes Fibonacci positions in `computeSpherePositions()`.
- Nodes are glass orbs via single `InstancedMesh` + `MeshTransmissionMaterial`.
- Edges use `buildArcGeometryArrays()` for quadratic Bezier arcs.
- Drag uses spring physics (`useDrag`) with `positionsRef`/`restPositionsRef` pattern.
- `SimNode` type is deleted. `GraphNode` has static `x`, `y`, `z` (unused by sphere layout — layout computes its own positions via `computeSpherePositions`).

**Spec:** `~/Desktop/brain/docs/specs/2026-04-10-brain-graphify-fusion-design.md` — Sections 6.2-6.4, 11.1-11.4

**Assumes Phases 1-4 complete.** `public/graph.json` contains unified two-layer data.

**Repo:** `~/Desktop/brain-explorer`

---

### File Structure (changes and additions)

```
brain-explorer/src/
├── lib/
│   ├── types.ts                ← MODIFY: extend GraphNode/GraphLink with fusion fields, add LayerMode
│   ├── categories.ts           ← MODIFY: add getCodeNodeColor(), getNodeColor() dispatcher, getNodeLabel()
│   ├── graph-data.ts           ← MODIFY: add filterByLayer()
│   ├── arc-geometry.ts         ← MODIFY: pass relation to buildArcGeometryArrays for cross-layer color
│   └── url-params.ts           ← CREATE: read/write ?layer= URL params
├── hooks/
│   ├── useGraphState.ts        ← MODIFY: add activeLayer, drillInRepo, drillInNodeIds
│   ├── useGraphData.ts         ← MODIFY: store raw data, derive filtered view by layer
│   ├── useSphereLayout.ts      ← MODIFY: apply god-node z-offset after Fibonacci layout
│   └── useDrillIn.ts           ← CREATE: drill-in animation orchestrator
├── components/
│   ├── SphereConsumer.tsx       ← MODIFY: partition wiki/code, render both InstancedNodes + CodeNodes
│   ├── InstancedNodes.tsx       ← (unchanged — stays wiki-only glass spheres)
│   ├── CodeNodes.tsx            ← CREATE: code-node glass cubes (InstancedMesh + boxGeometry + MeshTransmissionMaterial)
│   ├── Edges.tsx                ← MODIFY: cross-layer edge coloring
│   ├── Tooltip.tsx              ← MODIFY: code-node hover content
│   ├── ArticlePanel.tsx         ← MODIFY: add "Drill In" button for repo wiki nodes
│   ├── LayerToggle.tsx          ← CREATE: segmented control UI (wiki/code/combined)
│   ├── GraphMeta.tsx            ← MODIFY: layer-specific node counts
│   └── GraphView.tsx            ← MODIFY: wire layer toggle, drill-in, URL params
```

**Design decision — separate CodeNodes component:** Rather than making InstancedNodes handle dual meshes (spheres + cubes), we create a parallel `CodeNodes.tsx` that renders code nodes as glass cubes. This keeps both components focused and lets SphereConsumer partition nodes and orchestrate rendering. Both share the same `positionsRef` buffer.

**Design decision — shared position buffer:** Both wiki and code nodes live in the same `positionsRef` Float32Array from `useSphereLayout`. The Fibonacci layout treats all visible nodes uniformly. Each InstancedMesh only renders its partition (wiki or code) but reads positions from the same buffer using its own index range.

---

### Task 1: Extend types for fusion data

**Files:** `src/lib/types.ts`

- [ ] **Step 1: Add fusion fields to `GraphNode`**

```typescript
export interface GraphNode {
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
  // --- fusion fields (all optional for backward compat) ---
  layer?: "wiki" | "code";
  file_type?: "code" | "document" | "rationale";
  source_file?: string;
  source_location?: string;
  community?: number;
  is_god_node?: boolean;
  confidential?: boolean;
  repo?: string;
}
```

- [ ] **Step 2: Add fusion fields to `GraphLink`**

```typescript
export interface GraphLink {
  source: string;
  target: string;
  // --- fusion fields ---
  relation?: string;
  confidence?: "EXTRACTED" | "INFERRED" | "AMBIGUOUS";
  confidence_score?: number;
}
```

- [ ] **Step 3: Add `LayerMode` type**

```typescript
export type LayerMode = "wiki" | "code" | "combined";
```

- [ ] **Step 4: Run type check**

```bash
cd ~/Desktop/brain-explorer && pnpm tsc --noEmit
```

Expected: no new errors (all new fields are optional).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): extend GraphNode/GraphLink with fusion fields"
```

---

### Task 2: URL parameter utilities

**Files:** Create `src/lib/url-params.ts`

- [ ] **Step 1: Implement URL param helpers**

```typescript
import type { LayerMode } from "./types";

const VALID_LAYERS: LayerMode[] = ["wiki", "code", "combined"];

export function readLayerParam(): LayerMode | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("layer");
  if (raw && VALID_LAYERS.includes(raw as LayerMode)) return raw as LayerMode;
  return null;
}

export function readFocusParam(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("focus");
  return raw ? decodeURIComponent(raw) : null;
}

export function updateUrlParams(updates: Record<string, string | null>): void {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }
  window.history.replaceState({}, "", url.toString());
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/url-params.ts
git commit -m "feat(url): add layer and focus URL param utilities"
```

---

### Task 3: Extend Zustand store with layer and drill-in state

**Files:** `src/hooks/useGraphState.ts`

- [ ] **Step 1: Add state fields and actions**

```typescript
import { create } from "zustand";
import type { LayerMode } from "@/lib/types";

interface GraphState {
  focusedNodeId: string | null;
  hoveredNodeId: string | null;
  isDragging: boolean;
  filterCategory: string | null;
  filterQuery: string;
  activeLayer: LayerMode;
  drillInRepo: string | null;
  drillInNodeIds: Set<string>;
  setFocusedNode: (id: string | null) => void;
  clearFocus: () => void;
  setHoveredNode: (id: string | null) => void;
  setIsDragging: (dragging: boolean) => void;
  setFilterCategory: (category: string | null) => void;
  setFilterQuery: (query: string) => void;
  setActiveLayer: (layer: LayerMode) => void;
  setDrillInRepo: (repo: string | null) => void;
  setDrillInNodeIds: (ids: Set<string>) => void;
}

export const useGraphState = create<GraphState>((set) => ({
  focusedNodeId: null,
  hoveredNodeId: null,
  isDragging: false,
  filterCategory: null,
  filterQuery: "",
  activeLayer: "wiki",
  drillInRepo: null,
  drillInNodeIds: new Set(),
  setFocusedNode: (id) => set({ focusedNodeId: id }),
  clearFocus: () =>
    set({
      focusedNodeId: null,
      drillInRepo: null,
      drillInNodeIds: new Set(),
    }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setIsDragging: (dragging) => set({ isDragging: dragging }),
  setFilterCategory: (category) => set({ filterCategory: category }),
  setFilterQuery: (query) => set({ filterQuery: query }),
  setActiveLayer: (layer) => set({ activeLayer: layer }),
  setDrillInRepo: (repo) => set({ drillInRepo: repo }),
  setDrillInNodeIds: (ids) => set({ drillInNodeIds: ids }),
}));
```

- [ ] **Step 2: Update existing test if it snapshots the store shape**

Check `src/hooks/useGraphState.test.ts` — add the new fields to any shape assertions.

- [ ] **Step 3: Run tests**

```bash
cd ~/Desktop/brain-explorer && pnpm vitest run src/hooks/useGraphState.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useGraphState.ts src/hooks/useGraphState.test.ts
git commit -m "feat(store): add activeLayer, drillInRepo, drillInNodeIds to graph state"
```

---

### Task 4: Layer-aware data filtering

**Files:** `src/lib/graph-data.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/graph-data.test.ts — add to existing file
import { filterByLayer } from "./graph-data";
import type { GraphNode, GraphLink } from "./types";

const wikiNode = (id: string): GraphNode => ({
  id, title: id, tags: [], category: "projects", source_type: "wiki",
  created_at: "", connection_count: 1, x: 0, y: 0, z: 0, layer: "wiki",
});

const codeNode = (id: string, repo = "karen"): GraphNode => ({
  id, title: id, tags: [], category: repo, source_type: "graphify",
  created_at: "", connection_count: 1, x: 0, y: 0, z: 0, layer: "code", repo,
});

describe("filterByLayer", () => {
  const nodes = [wikiNode("w1"), wikiNode("w2"), codeNode("c1"), codeNode("c2")];
  const links: GraphLink[] = [
    { source: "w1", target: "w2" },
    { source: "c1", target: "c2" },
    { source: "w1", target: "c1", relation: "cross_layer" },
  ];

  it("wiki mode returns only wiki nodes and their links", () => {
    const result = filterByLayer(nodes, links, "wiki", new Set());
    expect(result.nodes.map((n) => n.id)).toEqual(["w1", "w2"]);
    expect(result.links).toHaveLength(1);
    expect(result.links[0].source).toBe("w1");
  });

  it("code mode returns only code nodes", () => {
    const result = filterByLayer(nodes, links, "code", new Set());
    expect(result.nodes.map((n) => n.id)).toEqual(["c1", "c2"]);
  });

  it("combined mode returns all nodes", () => {
    const result = filterByLayer(nodes, links, "combined", new Set());
    expect(result.nodes).toHaveLength(4);
    expect(result.links).toHaveLength(3);
  });

  it("wiki mode includes drill-in code nodes", () => {
    const result = filterByLayer(nodes, links, "wiki", new Set(["c1"]));
    expect(result.nodes.map((n) => n.id)).toEqual(["w1", "w2", "c1"]);
  });

  it("nodes without layer field default to wiki", () => {
    const legacy = [{ ...wikiNode("old"), layer: undefined }] as GraphNode[];
    const result = filterByLayer(legacy, [], "wiki", new Set());
    expect(result.nodes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Desktop/brain-explorer && pnpm vitest run src/lib/graph-data.test.ts
```

Expected: FAIL — `filterByLayer` is not exported.

- [ ] **Step 3: Implement `filterByLayer`**

Add to `src/lib/graph-data.ts`:

```typescript
import type { GraphNode, GraphLink, LayerMode } from "./types";

export function filterByLayer(
  nodes: GraphNode[],
  links: GraphLink[],
  layer: LayerMode,
  drillInNodeIds: Set<string>,
): { nodes: GraphNode[]; links: GraphLink[] } {
  let filteredNodes: GraphNode[];

  if (layer === "combined") {
    filteredNodes = nodes;
  } else if (layer === "code") {
    filteredNodes = nodes.filter((n) => n.layer === "code");
  } else {
    // wiki mode: wiki nodes (or legacy nodes without layer) + drill-in code nodes
    filteredNodes = nodes.filter(
      (n) => n.layer !== "code" || drillInNodeIds.has(n.id),
    );
  }

  const visibleIds = new Set(filteredNodes.map((n) => n.id));
  const filteredLinks = links.filter(
    (l) => visibleIds.has(l.source) && visibleIds.has(l.target),
  );

  return { nodes: filteredNodes, links: filteredLinks };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd ~/Desktop/brain-explorer && pnpm vitest run src/lib/graph-data.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/graph-data.ts src/lib/graph-data.test.ts
git commit -m "feat(data): add filterByLayer for two-layer graph filtering"
```

---

### Task 5: Code node colors and community hue shift

**Files:** `src/lib/categories.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/lib/categories.test.ts`:

```typescript
import { getCodeNodeColor, getNodeColor, getNodeLabel } from "./categories";
import type { GraphNode } from "./types";

describe("getCodeNodeColor", () => {
  it("returns green-family color for community 0", () => {
    const color = getCodeNodeColor(0);
    expect(color).toMatch(/^hsl\(/);
  });

  it("different communities produce different hues", () => {
    expect(getCodeNodeColor(0)).not.toBe(getCodeNodeColor(1));
  });
});

describe("getNodeColor", () => {
  it("returns category color for wiki nodes", () => {
    const node = { layer: "wiki", category: "projects", community: undefined } as unknown as GraphNode;
    const color = getNodeColor(node);
    expect(color).toBe("#a78bfa"); // projects color
  });

  it("returns community hue for code nodes", () => {
    const node = { layer: "code", category: "karen", community: 3 } as unknown as GraphNode;
    const color = getNodeColor(node);
    expect(color).toMatch(/^hsl\(/);
  });
});

describe("getNodeLabel", () => {
  it("returns title for wiki nodes", () => {
    const node = { layer: "wiki", title: "My Article", source_file: undefined } as unknown as GraphNode;
    expect(getNodeLabel(node)).toBe("My Article");
  });

  it("returns file basename for code nodes", () => {
    const node = { layer: "code", title: "code://karen/src/auth/service.ts", source_file: "/Users/r/Desktop/karen/src/auth/service.ts" } as unknown as GraphNode;
    expect(getNodeLabel(node)).toBe("service.ts");
  });

  it("falls back to title if no source_file", () => {
    const node = { layer: "code", title: "service.ts", source_file: undefined } as unknown as GraphNode;
    expect(getNodeLabel(node)).toBe("service.ts");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/Desktop/brain-explorer && pnpm vitest run src/lib/categories.test.ts
```

- [ ] **Step 3: Implement the functions**

Add to `src/lib/categories.ts`:

```typescript
import type { GraphNode } from "./types";

export function getCodeNodeColor(community?: number): string {
  const hue = (120 + (community ?? 0) * 37) % 360;
  return `hsl(${hue}, 100%, 50%)`;
}

export function getNodeColor(node: GraphNode): string {
  if (node.layer === "code") return getCodeNodeColor(node.community);
  return getCategoryColor(node.category);
}

export function getNodeLabel(node: GraphNode): string {
  if (node.layer === "code" && node.source_file) {
    return node.source_file.split("/").pop() ?? node.title;
  }
  return node.title;
}
```

- [ ] **Step 4: Run tests**

```bash
cd ~/Desktop/brain-explorer && pnpm vitest run src/lib/categories.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/categories.ts src/lib/categories.test.ts
git commit -m "feat(colors): add code node colors with community hue shift"
```

---

### Task 6: God-node z-offset in sphere layout

**Files:** `src/hooks/useSphereLayout.ts`

The original plan had god nodes at `z = -200` (a separate background plane). With the Fibonacci sphere layout, we push god nodes outward from the sphere center instead — multiplying their position by a factor that places them behind the main sphere. This preserves the Fibonacci aesthetic while making god nodes visually distinct.

- [ ] **Step 1: Modify `useSphereLayout` to apply god-node offset after Fibonacci layout**

```typescript
"use client";

import { useRef, useMemo } from "react";
import type { GraphNode } from "@/lib/types";
import { computeSpherePositions } from "@/lib/sphere-layout";

const SPHERE_RADIUS = 35;
const GOD_NODE_SCALE = 3.0; // push god nodes 3x farther from center

export function useSphereLayout(nodes: GraphNode[]) {
  const positionsRef = useRef<Float32Array>(new Float32Array(0));
  const restPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const nodeIndexMapRef = useRef<Map<string, number>>(new Map());

  /* eslint-disable react-hooks/refs */
  useMemo(() => {
    if (nodes.length === 0) return;

    const { positions, nodeIndexMap } = computeSpherePositions(nodes, SPHERE_RADIUS);

    // Apply god-node z-offset: push god nodes outward from sphere
    for (const node of nodes) {
      if (!node.is_god_node) continue;
      const idx = nodeIndexMap.get(node.id);
      if (idx === undefined) continue;
      const off = idx * 3;
      positions[off] *= GOD_NODE_SCALE;
      positions[off + 1] *= GOD_NODE_SCALE;
      positions[off + 2] *= GOD_NODE_SCALE;
    }

    restPositionsRef.current = positions;
    positionsRef.current = new Float32Array(positions);
    nodeIndexMapRef.current = nodeIndexMap;
  }, [nodes]);
  /* eslint-enable react-hooks/refs */

  return {
    positionsRef,
    restPositionsRef,
    nodeIndexMap: nodeIndexMapRef,
  };
}
```

- [ ] **Step 2: Run existing tests**

```bash
cd ~/Desktop/brain-explorer && pnpm vitest run
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSphereLayout.ts
git commit -m "feat(layout): apply god-node outward offset in sphere layout"
```

---

### Task 7: Layer-aware data hook

**Files:** `src/hooks/useGraphData.ts`

- [ ] **Step 1: Modify `useGraphData` to store raw data and derive filtered view**

```typescript
"use client";

import { useEffect, useState, useMemo } from "react";
import type { GraphCache, GraphNode, GraphLink } from "@/lib/types";
import { buildNeighborMap, filterByLayer } from "@/lib/graph-data";
import { useGraphState } from "@/hooks/useGraphState";

interface GraphDataResult {
  nodes: GraphNode[];
  links: GraphLink[];
  allNodes: GraphNode[];
  neighborMap: Map<string, Set<string>>;
  generatedAt: string;
  loading: boolean;
  error: string | null;
  hasCodeNodes: boolean;
}

export function useGraphData(): GraphDataResult {
  const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
  const [allLinks, setAllLinks] = useState<GraphLink[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeLayer = useGraphState((s) => s.activeLayer);
  const drillInNodeIds = useGraphState((s) => s.drillInNodeIds);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/graph.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: GraphCache = await res.json();

        setAllNodes(data.nodes);
        setAllLinks(data.links);
        setGeneratedAt(data.generated_at);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load graph");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const hasCodeNodes = useMemo(
    () => allNodes.some((n) => n.layer === "code"),
    [allNodes],
  );

  const { nodes, links } = useMemo(
    () => filterByLayer(allNodes, allLinks, activeLayer, drillInNodeIds),
    [allNodes, allLinks, activeLayer, drillInNodeIds],
  );

  const neighborMap = useMemo(() => buildNeighborMap(links), [links]);

  return { nodes, links, allNodes, neighborMap, generatedAt, loading, error, hasCodeNodes };
}
```

- [ ] **Step 2: Run type check**

```bash
cd ~/Desktop/brain-explorer && pnpm tsc --noEmit
```

Fix any call sites that rely on the old return shape — `GraphView.tsx` destructures `useGraphData()`, so it will need `allNodes` and `hasCodeNodes` added to its destructuring (done in Task 13).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGraphData.ts
git commit -m "feat(data): layer-aware filtering in useGraphData"
```

---

### Task 8: CodeNodes component — glass cubes

**Files:** Create `src/components/CodeNodes.tsx`

This mirrors `InstancedNodes.tsx` but with `boxGeometry` and code-specific colors.

- [ ] **Step 1: Create CodeNodes component**

```typescript
"use client";

import { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { GraphNode, DragState } from "@/lib/types";
import { getCodeNodeColor, getNodeRadius } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";

interface CodeNodesProps {
  nodes: GraphNode[];
  neighborMap: Map<string, Set<string>>;
  positionsRef: React.MutableRefObject<Float32Array>;
  nodeIndexMap: React.MutableRefObject<Map<string, number>>;
  onNodePointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  dragState?: React.MutableRefObject<DragState>;
  draggedIndex?: React.MutableRefObject<number | null>;
}

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

export function CodeNodes({
  nodes,
  neighborMap,
  positionsRef,
  nodeIndexMap,
  onNodePointerDown,
  dragState,
  draggedIndex,
}: CodeNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const setHoveredNode = useGraphState((s) => s.setHoveredNode);

  // Filter to only code nodes and build local index maps
  const codeNodes = useMemo(
    () => nodes.filter((n) => n.layer === "code"),
    [nodes],
  );

  // Map from local instance index → global nodeIndexMap index
  const { localToGlobal, instanceToNodeId } = useMemo(() => {
    const l2g = new Map<number, number>();
    const i2n = new Map<number, string>();
    const globalMap = nodeIndexMap.current;
    codeNodes.forEach((node, localIdx) => {
      const globalIdx = globalMap.get(node.id);
      if (globalIdx !== undefined) {
        l2g.set(localIdx, globalIdx);
        i2n.set(localIdx, node.id);
      }
    });
    return { localToGlobal: l2g, instanceToNodeId: i2n };
  }, [codeNodes, nodeIndexMap]);

  const radii = useMemo(() => {
    return codeNodes.map((n) => getNodeRadius(n.connection_count));
  }, [codeNodes]);

  const baseColors = useMemo(() => {
    return codeNodes.map((n) => new THREE.Color(getCodeNodeColor(n.community)));
  }, [codeNodes]);

  const focusNeighbors = useMemo(() => {
    if (!focusedNodeId) return null;
    return neighborMap.get(focusedNodeId) ?? new Set<string>();
  }, [focusedNodeId, neighborMap]);

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

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // Translate local instanceId to global for the drag system
      const localId = e.instanceId;
      if (localId !== undefined) {
        const globalId = localToGlobal.get(localId);
        if (globalId !== undefined) {
          // Override the instanceId for the drag system
          const syntheticEvent = {
            ...e,
            instanceId: globalId,
          } as ThreeEvent<PointerEvent>;
          onNodePointerDown?.(syntheticEvent);
        }
      }
    },
    [localToGlobal, onNodePointerDown],
  );

  useFrame(({ clock }) => {
    if (!meshRef.current || codeNodes.length === 0) return;
    const mesh = meshRef.current;
    const time = clock.getElapsedTime();
    const positions = positionsRef.current;

    for (let localIdx = 0; localIdx < codeNodes.length; localIdx++) {
      const globalIdx = localToGlobal.get(localIdx);
      if (globalIdx === undefined) continue;

      const baseRadius = radii[localIdx] ?? 0.5;
      // Slower rotation for cubes (distinguishes from sphere pulse)
      const pulse = 1 + 0.03 * Math.sin(time * ((2 * Math.PI) / 4) + localIdx * 0.5);
      let scale = baseRadius * pulse;

      if (dragState?.current === "DRAGGING" && globalIdx === draggedIndex?.current) {
        scale *= 1.3;
      }

      const offset = globalIdx * 3;
      tempObject.position.set(positions[offset], positions[offset + 1], positions[offset + 2]);
      tempObject.scale.set(scale, scale, scale);
      // Slow rotation on Y axis for cubes
      tempObject.rotation.set(0, time * 0.3 + localIdx * 0.2, 0);
      tempObject.updateMatrix();
      mesh.setMatrixAt(localIdx, tempObject.matrix);

      const nodeId = instanceToNodeId.get(localIdx);
      const isGodNode = codeNodes[localIdx]?.is_god_node;

      if (focusNeighbors && nodeId) {
        const isFocused = nodeId === focusedNodeId;
        const isNeighbor = focusNeighbors.has(nodeId);
        let opacity: number;
        if (isGodNode) {
          opacity = isFocused || isNeighbor ? 1.0 : 0.3;
        } else {
          opacity = isFocused || isNeighbor ? 1.0 : 0.1;
        }
        tempColor.copy(baseColors[localIdx]).multiplyScalar(opacity);
      } else {
        if (isGodNode) {
          // God nodes at 30% when no focus
          tempColor.copy(baseColors[localIdx]).multiplyScalar(0.3);
        } else {
          tempColor.copy(baseColors[localIdx]);
        }
      }
      mesh.setColorAt(localIdx, tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (codeNodes.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, codeNodes.length]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    >
      <boxGeometry args={[1, 1, 1]} />
      <MeshTransmissionMaterial
        samples={1}
        resolution={256}
        transmission={1}
        roughness={0.15}
        ior={1.5}
        thickness={0.5}
        chromaticAberration={0.04}
        anisotropy={0.1}
        distortion={0}
        distortionScale={0}
        toneMapped={false}
        depthWrite={false}
        color="#00FF41"
      />
    </instancedMesh>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd ~/Desktop/brain-explorer && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/CodeNodes.tsx
git commit -m "feat(3d): add CodeNodes glass cube component for code layer"
```

---

### Task 9: Update SphereConsumer to render both meshes

**Files:** `src/components/SphereConsumer.tsx`

- [ ] **Step 1: Partition nodes and render both InstancedNodes + CodeNodes**

```typescript
"use client";

import { useMemo } from "react";
import type { GraphNode, GraphLink } from "@/lib/types";
import { useSphereLayout } from "@/hooks/useSphereLayout";
import { useDrag } from "@/hooks/useDrag";
import { InstancedNodes } from "@/components/InstancedNodes";
import { CodeNodes } from "@/components/CodeNodes";
import { Edges } from "@/components/Edges";

interface SphereConsumerProps {
  nodes: GraphNode[];
  links: GraphLink[];
  neighborMap: Map<string, Set<string>>;
}

export function SphereConsumer({ nodes, links, neighborMap }: SphereConsumerProps) {
  const { positionsRef, restPositionsRef, nodeIndexMap } = useSphereLayout(nodes);
  const { onPointerDown, dragState, draggedIndex } = useDrag({
    positionsRef,
    restPositionsRef,
    nodeIndexMap,
  });

  const wikiNodes = useMemo(
    () => nodes.filter((n) => n.layer !== "code"),
    [nodes],
  );

  const hasCodeNodes = useMemo(
    () => nodes.some((n) => n.layer === "code"),
    [nodes],
  );

  if (nodes.length === 0) return null;

  return (
    <>
      <Edges
        nodes={nodes}
        links={links}
        positionsRef={positionsRef}
        nodeIndexMap={nodeIndexMap}
      />
      <InstancedNodes
        nodes={wikiNodes}
        neighborMap={neighborMap}
        positionsRef={positionsRef}
        nodeIndexMap={nodeIndexMap}
        onNodePointerDown={onPointerDown}
        dragState={dragState}
        draggedIndex={draggedIndex}
      />
      {hasCodeNodes && (
        <CodeNodes
          nodes={nodes}
          neighborMap={neighborMap}
          positionsRef={positionsRef}
          nodeIndexMap={nodeIndexMap}
          onNodePointerDown={onPointerDown}
          dragState={dragState}
          draggedIndex={draggedIndex}
        />
      )}
    </>
  );
}
```

**Important:** `InstancedNodes` receives `wikiNodes` (filtered) but uses the shared `positionsRef` and `nodeIndexMap`. The `nodeIndexMap` contains all nodes (wiki + code) — `InstancedNodes` will only iterate over its `nodes` prop, reading the correct positions from the shared buffer via `nodeIndexMap.get(node.id)`.

However, `InstancedNodes` creates an InstancedMesh with `args={[undefined, undefined, nodes.length]}` and sets matrix/color at indices `0..N-1` using `nodeIndexMap` lookups. The problem: `nodeIndexMap` values are global indices (0..totalNodes), but InstancedMesh instance IDs are local (0..wikiNodes.length). We need `InstancedNodes` to use a local index within its own mesh, reading positions from the global buffer via a local→global mapping.

**This means InstancedNodes needs a minor change** — see Task 10.

- [ ] **Step 2: Commit**

```bash
git add src/components/SphereConsumer.tsx
git commit -m "feat(sphere): render both wiki spheres and code cubes in SphereConsumer"
```

---

### Task 10: Update InstancedNodes for local→global index mapping

**Files:** `src/components/InstancedNodes.tsx`

Currently InstancedNodes assumes its `nodes` array covers all entries in `nodeIndexMap`. After partitioning, it receives only wiki nodes but the shared `nodeIndexMap` has all nodes. We need it to build a local index (for InstancedMesh instances) that maps to global positions.

- [ ] **Step 1: Refactor InstancedNodes index mapping**

Replace the `instanceToNodeId`, `radii`, and `baseColors` memos with local-index-aware versions, and update the useFrame loop:

```typescript
// Replace existing instanceToNodeId, radii, baseColors memos with:

const { localToGlobal, instanceToNodeId } = useMemo(() => {
  const l2g = new Map<number, number>();
  const i2n = new Map<number, string>();
  const globalMap = nodeIndexMap.current;
  nodes.forEach((node, localIdx) => {
    const globalIdx = globalMap.get(node.id);
    if (globalIdx !== undefined) {
      l2g.set(localIdx, globalIdx);
      i2n.set(localIdx, node.id);
    }
  });
  return { localToGlobal: l2g, instanceToNodeId: i2n };
}, [nodeIndexMap, nodes]);

const radii = useMemo(() => {
  return nodes.map((n) => getNodeRadius(n.connection_count));
}, [nodes]);

const baseColors = useMemo(() => {
  return nodes.map((n) => new THREE.Color(getCategoryColor(n.category)));
}, [nodes]);
```

Update the useFrame loop to iterate by local index and read positions via `localToGlobal`:

```typescript
useFrame(({ clock }) => {
  if (!meshRef.current) return;
  const mesh = meshRef.current;
  const time = clock.getElapsedTime();
  const positions = positionsRef.current;

  for (let localIdx = 0; localIdx < nodes.length; localIdx++) {
    const globalIdx = localToGlobal.get(localIdx);
    if (globalIdx === undefined) continue;

    const baseRadius = radii[localIdx] ?? 0.5;
    const pulse = 1 + 0.05 * Math.sin(time * ((2 * Math.PI) / 3) + localIdx * 0.7);
    let scale = baseRadius * pulse;

    if (dragState?.current === "DRAGGING" && globalIdx === draggedIndex?.current) {
      scale *= 1.3;
    }

    const offset = globalIdx * 3;
    tempObject.position.set(positions[offset], positions[offset + 1], positions[offset + 2]);
    tempObject.scale.set(scale, scale, scale);
    tempObject.updateMatrix();
    mesh.setMatrixAt(localIdx, tempObject.matrix);

    const nodeId = instanceToNodeId.get(localIdx);
    if (focusNeighbors && nodeId) {
      const isFocused = nodeId === focusedNodeId;
      const isNeighbor = focusNeighbors.has(nodeId);
      const opacity = isFocused || isNeighbor ? 1.0 : 0.1;
      tempColor.copy(baseColors[localIdx]).multiplyScalar(opacity);
    } else {
      tempColor.copy(baseColors[localIdx]);
    }
    mesh.setColorAt(localIdx, tempColor);
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
});
```

Update the `onPointerDown` handler to translate local instanceId to global:

```typescript
const handlePointerDown = useCallback(
  (e: ThreeEvent<PointerEvent>) => {
    const localId = e.instanceId;
    if (localId !== undefined) {
      const globalId = localToGlobal.get(localId);
      if (globalId !== undefined) {
        const syntheticEvent = {
          ...e,
          instanceId: globalId,
        } as ThreeEvent<PointerEvent>;
        onNodePointerDown?.(syntheticEvent);
      }
    }
  },
  [localToGlobal, onNodePointerDown],
);
```

Wire `handlePointerDown` instead of `onNodePointerDown` on the `<instancedMesh>`:

```tsx
<instancedMesh
  ref={meshRef}
  args={[undefined, undefined, nodes.length]}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerOut={handlePointerOut}
>
```

- [ ] **Step 2: Run type check**

```bash
cd ~/Desktop/brain-explorer && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/InstancedNodes.tsx
git commit -m "refactor(nodes): local-to-global index mapping for partitioned rendering"
```

---

### Task 11: Cross-layer edge styling

**Files:** `src/components/Edges.tsx`, `src/lib/arc-geometry.ts`

- [ ] **Step 1: Pass link relation to `buildArcGeometryArrays`**

In `src/lib/arc-geometry.ts`, modify `buildArcGeometryArrays` to accept links with `relation` and apply cross-layer edge color:

Add a `CROSS_LAYER_COLOR` constant and use it when `link.relation === "cross_layer"`:

```typescript
const CROSS_LAYER_COLOR = { r: 1.0, g: 1.0, b: 1.0 }; // white
const CROSS_LAYER_ALPHA = 0.08; // subtle

// In the loop where colors are set, before the per-segment iteration:
const isCrossLayer = (link as { relation?: string }).relation === "cross_layer";
const edgeAlpha = isCrossLayer ? CROSS_LAYER_ALPHA : DEFAULT_ALPHA;

// For cross-layer edges, use white instead of category gradient:
if (isCrossLayer) {
  // Override srcColor and tgtColor for this edge
  srcColor = CROSS_LAYER_COLOR;
  tgtColor = CROSS_LAYER_COLOR;
}
```

Update the function signature to accept `GraphLink` with relation (it already uses `GraphLink` but the type now has `relation`).

The actual edit: in the `for (const { source, target, si, ti } of validLinks)` loop, after extracting `srcColor` and `tgtColor` from category maps, add:

```typescript
const link = links[validLinks.indexOf(vl)]; // need the original link for relation
```

Actually, cleaner approach — extend the `validLinks` type to carry the relation:

```typescript
const validLinks: Array<{
  source: string;
  target: string;
  si: number;
  ti: number;
  relation?: string;
}> = [];

for (const link of links) {
  const si = nodeIndexMap.get(link.source);
  const ti = nodeIndexMap.get(link.target);
  if (si === undefined || ti === undefined) continue;
  validLinks.push({ source: link.source, target: link.target, si, ti, relation: link.relation });
}
```

Then in the per-edge loop:

```typescript
for (const { source, target, si, ti, relation } of validLinks) {
  // ... existing arc tessellation ...

  const isCrossLayer = relation === "cross_layer";
  let srcCol = isCrossLayer ? CROSS_LAYER_COLOR : (categoryColors.get(srcCat) ?? DEFAULT_COLOR);
  let tgtCol = isCrossLayer ? CROSS_LAYER_COLOR : (categoryColors.get(tgtCat) ?? DEFAULT_COLOR);
  const edgeAlpha = isCrossLayer ? CROSS_LAYER_ALPHA : DEFAULT_ALPHA;

  for (let s = 0; s < segments; s++) {
    // ... same vertex/color logic, using srcCol/tgtCol/edgeAlpha instead of hardcoded values ...
    colors[vertexOffset * 4 + 3] = edgeAlpha;
    // ... etc ...
  }
}
```

- [ ] **Step 2: Update existing arc-geometry tests if they break**

```bash
cd ~/Desktop/brain-explorer && pnpm vitest run src/lib/arc-geometry.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/arc-geometry.ts src/lib/arc-geometry.test.ts
git commit -m "feat(edges): white cross-layer edge styling in arc geometry"
```

---

### Task 12: Code-node tooltip

**Files:** `src/components/Tooltip.tsx`

- [ ] **Step 1: Differentiate tooltip content by layer**

In the Tooltip component, after getting the `node`, add code-node-specific content:

```typescript
import { getCategoryColor, getNodeLabel, getCodeNodeColor } from "@/lib/categories";

// ... in the render, replace the existing title/category/connection display:

const isCodeNode = node.layer === "code";
const label = getNodeLabel(node);
const color = isCodeNode ? getCodeNodeColor(node.community) : getCategoryColor(node.category);
```

For the JSX, add a conditional section after the title:

```tsx
{isCodeNode && (
  <>
    {/* Full path */}
    {node.source_file && (
      <p style={{
        color: "#94a3b8",
        fontSize: "10px",
        fontFamily: "monospace",
        margin: "4px 0 0",
        wordBreak: "break-all",
      }}>
        {node.source_file}
      </p>
    )}
    {/* Community + repo */}
    <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
      {node.repo && (
        <span style={{ color: "#64748b", fontSize: "10px" }}>
          {node.repo}
        </span>
      )}
      {node.community !== undefined && (
        <span style={{ color: "#64748b", fontSize: "10px" }}>
          community {node.community}
        </span>
      )}
    </div>
  </>
)}
```

Also update the title display to use `label` instead of `node.title`, and update `color` usage.

- [ ] **Step 2: Dev test**

```bash
cd ~/Desktop/brain-explorer && pnpm dev
```

Hover over nodes in browser to verify tooltip renders.

- [ ] **Step 3: Commit**

```bash
git add src/components/Tooltip.tsx
git commit -m "feat(tooltip): code node tooltip with file path, community, repo"
```

---

### Task 13: Layer toggle UI component

**Files:** Create `src/components/LayerToggle.tsx`

- [ ] **Step 1: Build segmented control**

```typescript
"use client";

import type { LayerMode } from "@/lib/types";
import { useGraphState } from "@/hooks/useGraphState";
import { updateUrlParams } from "@/lib/url-params";

const LAYERS: { value: LayerMode; label: string }[] = [
  { value: "wiki", label: "Wiki" },
  { value: "code", label: "Code" },
  { value: "combined", label: "All" },
];

export function LayerToggle() {
  const activeLayer = useGraphState((s) => s.activeLayer);
  const setActiveLayer = useGraphState((s) => s.setActiveLayer);

  const handleChange = (layer: LayerMode) => {
    setActiveLayer(layer);
    updateUrlParams({ layer });
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30">
      <div
        className="flex rounded-full p-0.5"
        style={{
          background: "rgba(15, 15, 30, 0.6)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
        }}
      >
        {LAYERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handleChange(value)}
            className="px-4 py-1.5 text-xs font-medium rounded-full transition-all duration-200"
            style={{
              color: activeLayer === value ? "#e8eaf0" : "#64748b",
              background:
                activeLayer === value
                  ? "rgba(255,255,255,0.1)"
                  : "transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LayerToggle.tsx
git commit -m "feat(ui): add LayerToggle segmented control"
```

---

### Task 14: Drill-in hook

**Files:** Create `src/hooks/useDrillIn.ts`

- [ ] **Step 1: Implement drill-in orchestrator**

```typescript
"use client";

import { useCallback } from "react";
import type { GraphNode } from "@/lib/types";
import { useGraphState } from "@/hooks/useGraphState";

export function useDrillIn(allNodes: GraphNode[]) {
  const setDrillInRepo = useGraphState((s) => s.setDrillInRepo);
  const setDrillInNodeIds = useGraphState((s) => s.setDrillInNodeIds);
  const setActiveLayer = useGraphState((s) => s.setActiveLayer);

  const drillIn = useCallback(
    (repoName: string) => {
      const codeNodes = allNodes.filter(
        (n) => n.layer === "code" && n.repo === repoName,
      );

      if (codeNodes.length === 0) return;

      // Sort by centrality
      const sorted = [...codeNodes].sort(
        (a, b) => b.connection_count - a.connection_count,
      );

      // Top 20 animate in immediately
      const animated = sorted.slice(0, 20);
      const rest = sorted.slice(20);

      // Phase 1: show top 20
      const phase1Ids = new Set(animated.map((n) => n.id));
      setDrillInRepo(repoName);
      setDrillInNodeIds(phase1Ids);

      // Phase 2: fade in rest after 1.2s
      if (rest.length > 0) {
        setTimeout(() => {
          const allIds = new Set(codeNodes.map((n) => n.id));
          setDrillInNodeIds(allIds);
        }, 1200);
      }
    },
    [allNodes, setDrillInRepo, setDrillInNodeIds],
  );

  const exitDrillIn = useCallback(() => {
    setDrillInRepo(null);
    setDrillInNodeIds(new Set());
  }, [setDrillInRepo, setDrillInNodeIds]);

  return { drillIn, exitDrillIn };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useDrillIn.ts
git commit -m "feat(drill-in): add drill-in hook with centrality-capped reveal"
```

---

### Task 15: "Drill In" button in ArticlePanel

**Files:** `src/components/ArticlePanel.tsx`

- [ ] **Step 1: Add drill-in button for repo wiki nodes**

At the top of `ArticlePanel`, accept a new prop:

```typescript
interface ArticlePanelProps {
  nodes: GraphNode[];
  neighborMap: Map<string, Set<string>>;
  allNodes: GraphNode[];
  onDrillIn?: (repoName: string) => void;
  onExitDrillIn?: () => void;
}
```

Inside the component, detect if focused node is a repo wiki node:

```typescript
const drillInRepo = useGraphState((s) => s.drillInRepo);

// Extract repo name from wiki node ID: "wiki://projects/karen.md" → "karen"
// Or from node ID pattern: "projects/karen.md" → "karen"
const repoName = useMemo(() => {
  if (!focusedNode) return null;
  if (focusedNode.layer === "code") return null;
  const id = focusedNode.id;
  // Match wiki://projects/{repo}.md or projects/{repo}.md
  const match = id.match(/projects\/([^/.]+)\.md$/);
  return match?.[1] ?? null;
}, [focusedNode]);

const hasCodeNodes = useMemo(() => {
  if (!repoName) return false;
  return allNodes.some((n) => n.layer === "code" && n.repo === repoName);
}, [repoName, allNodes]);
```

Add the button in the panel JSX, after the article content:

```tsx
{hasCodeNodes && repoName && !drillInRepo && (
  <button
    onClick={() => onDrillIn?.(repoName)}
    className="w-full mt-3 py-2 px-4 rounded-lg text-xs font-medium transition-all duration-200"
    style={{
      background: "rgba(0, 255, 65, 0.1)",
      border: "1px solid rgba(0, 255, 65, 0.3)",
      color: "#00FF41",
    }}
  >
    Drill into code
  </button>
)}
{drillInRepo && (
  <button
    onClick={() => onExitDrillIn?.()}
    className="w-full mt-3 py-2 px-4 rounded-lg text-xs font-medium transition-all duration-200"
    style={{
      background: "rgba(255, 255, 255, 0.05)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      color: "#94a3b8",
    }}
  >
    Exit code view
  </button>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ArticlePanel.tsx
git commit -m "feat(panel): add drill-in / exit buttons for repo wiki nodes"
```

---

### Task 16: Layer-specific counts in GraphMeta

**Files:** `src/components/GraphMeta.tsx`

- [ ] **Step 1: Accept layer counts and display them**

```typescript
interface GraphMetaProps {
  nodeCount: number;
  generatedAt: string;
  wikiCount?: number;
  codeCount?: number;
}

export function GraphMeta({ nodeCount, generatedAt, wikiCount, codeCount }: GraphMetaProps) {
  // ... existing timeAgo ...

  const countDisplay =
    wikiCount !== undefined && codeCount !== undefined && codeCount > 0
      ? `${wikiCount} wiki + ${codeCount} code nodes`
      : `${nodeCount} nodes`;

  return (
    <div className="fixed bottom-4 left-4 z-30 opacity-20 hover:opacity-60 transition-opacity">
      <div className="text-[11px] text-slate-500 space-y-0.5">
        <div>{countDisplay}</div>
        {timeAgo && <div>Updated {timeAgo}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/GraphMeta.tsx
git commit -m "feat(meta): show wiki + code node counts"
```

---

### Task 17: Wire everything in GraphView

**Files:** `src/components/GraphView.tsx`

- [ ] **Step 1: Full GraphView rewrite with layer toggle, drill-in, URL params**

```typescript
"use client";

import { useEffect, useMemo } from "react";
import { GraphCanvas } from "@/components/GraphCanvas";
import { CameraController } from "@/components/CameraController";
import { Tooltip } from "@/components/Tooltip";
import { CommandPalette } from "@/components/CommandPalette";
import { ArticlePanel } from "@/components/ArticlePanel";
import { AdminRefresh } from "@/components/AdminRefresh";
import { GraphMeta } from "@/components/GraphMeta";
import { LayerToggle } from "@/components/LayerToggle";
import { useGraphData } from "@/hooks/useGraphData";
import { useGraphState } from "@/hooks/useGraphState";
import { useDrillIn } from "@/hooks/useDrillIn";
import { SphereConsumer } from "@/components/SphereConsumer";
import { readLayerParam, readFocusParam, updateUrlParams } from "@/lib/url-params";

export function GraphView() {
  const { nodes, links, allNodes, neighborMap, generatedAt, loading, error, hasCodeNodes } =
    useGraphData();
  const clearFocus = useGraphState((s) => s.clearFocus);
  const setFocusedNode = useGraphState((s) => s.setFocusedNode);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const setActiveLayer = useGraphState((s) => s.setActiveLayer);
  const { drillIn, exitDrillIn } = useDrillIn(allNodes);

  // Read ?layer= on mount and set initial layer
  useEffect(() => {
    const layerParam = readLayerParam();
    if (layerParam) {
      setActiveLayer(layerParam);
    } else if (hasCodeNodes) {
      setActiveLayer("combined");
    }
  }, [hasCodeNodes, setActiveLayer]);

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

  // Deep-link: read ?focus= on load (supports URI-encoded code:// IDs)
  useEffect(() => {
    const focusParam = readFocusParam();
    if (focusParam && nodes.length > 0) {
      const match = nodes.find((n) => n.id === focusParam);
      if (match) setFocusedNode(match.id);
    }
  }, [nodes, setFocusedNode]);

  // Deep-link: update URL on focus change
  useEffect(() => {
    updateUrlParams({
      focus: focusedNodeId,
    });
  }, [focusedNodeId]);

  const wikiCount = useMemo(
    () => nodes.filter((n) => n.layer !== "code").length,
    [nodes],
  );
  const codeCount = useMemo(
    () => nodes.filter((n) => n.layer === "code").length,
    [nodes],
  );

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
        <SphereConsumer nodes={nodes} links={links} neighborMap={neighborMap} />
        <CameraController nodes={nodes} />
        <Tooltip nodes={nodes} neighborMap={neighborMap} />
      </GraphCanvas>

      {hasCodeNodes && <LayerToggle />}
      <CommandPalette nodes={nodes} />
      <ArticlePanel
        nodes={nodes}
        neighborMap={neighborMap}
        allNodes={allNodes}
        onDrillIn={drillIn}
        onExitDrillIn={exitDrillIn}
      />
      <GraphMeta
        nodeCount={nodes.length}
        generatedAt={generatedAt}
        wikiCount={wikiCount}
        codeCount={codeCount}
      />
      <AdminRefresh />
    </main>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd ~/Desktop/brain-explorer && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/GraphView.tsx
git commit -m "feat(view): wire layer toggle, drill-in, URL params in GraphView"
```

---

### Task 18: Integration test with two-layer data

- [ ] **Step 1: Generate two-layer graph.json**

Option A — from daemon:
```bash
curl -X POST http://localhost:3577/graph-push
```

Option B — create a test fixture by appending code nodes to `public/graph.json`. Add 5-10 code nodes:

```json
{
  "id": "code://karen/src/auth/service.ts",
  "title": "code://karen/src/auth/service.ts",
  "tags": ["auth", "service"],
  "category": "karen",
  "source_type": "graphify",
  "created_at": "2026-04-12T00:00:00Z",
  "connection_count": 8,
  "x": 0, "y": 0, "z": 0,
  "layer": "code",
  "community": 0,
  "is_god_node": false,
  "repo": "karen",
  "source_file": "/Users/r/Desktop/karen/src/auth/service.ts"
}
```

Add corresponding links, including a cross-layer edge:

```json
{ "source": "wiki://projects/karen.md", "target": "code://karen/src/auth/service.ts", "relation": "cross_layer", "confidence": "EXTRACTED", "confidence_score": 1.0 }
```

- [ ] **Step 2: Start dev server and verify all features**

```bash
cd ~/Desktop/brain-explorer && pnpm dev
```

Test checklist:
1. Layer toggle appears (top center) and switches views
2. Wiki mode shows only wiki nodes (glass spheres)
3. Code mode shows only code nodes (glass cubes, green-tinted)
4. Combined mode shows both on same sphere
5. URL updates with `?layer=` on toggle change
6. Click repo wiki node → "Drill into code" button appears in panel
7. Click drill-in → code nodes appear (top 20 first, rest after 1.2s)
8. "Exit code view" button dismisses code nodes
9. Code node tooltip shows file path, community, repo
10. Cross-layer edges render as subtle white arcs
11. God nodes are pushed outward from sphere, at 30% opacity
12. God nodes brighten to 100% when a neighbor is focused
13. Drag + spring snap-back still works for both node types
14. `?focus=code://karen/src/auth/service.ts` deep link works (URI-encoded)
15. GraphMeta shows "X wiki + Y code nodes"

- [ ] **Step 3: Build for production**

```bash
cd ~/Desktop/brain-explorer && pnpm build
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Phase 5 complete — two-layer explorer with layer toggle, drill-in, god-nodes"
```

---

## Summary

| Task | Est. | Key File | What Changed vs. Original Plan |
|------|------|----------|-------------------------------|
| 1. Types | 2 min | `types.ts` | Same |
| 2. URL params | 2 min | `url-params.ts` | Same |
| 3. Zustand store | 3 min | `useGraphState.ts` | Same |
| 4. Layer filtering | 5 min | `graph-data.ts` | Same |
| 5. Code colors | 4 min | `categories.ts` | Same |
| 6. God-node layout | 3 min | `useSphereLayout.ts` | **NEW** — outward offset instead of z=-200, works with Fibonacci |
| 7. Layer-aware data hook | 4 min | `useGraphData.ts` | **NEW** — raw + filtered view, replaces simpler original |
| 8. CodeNodes component | 6 min | `CodeNodes.tsx` | **NEW** — separate component instead of dual mesh in InstancedNodes. Uses MeshTransmissionMaterial + boxGeometry + local→global index mapping |
| 9. SphereConsumer | 3 min | `SphereConsumer.tsx` | **NEW** — orchestrates wiki/code partition, renders both meshes |
| 10. InstancedNodes refactor | 5 min | `InstancedNodes.tsx` | **NEW** — local→global index mapping for partitioned rendering |
| 11. Cross-layer edges | 4 min | `arc-geometry.ts`, `Edges.tsx` | **CHANGED** — works with arc geometry instead of straight lines |
| 12. Code tooltip | 3 min | `Tooltip.tsx` | Same |
| 13. LayerToggle UI | 3 min | `LayerToggle.tsx` | Same |
| 14. Drill-in hook | 3 min | `useDrillIn.ts` | Same |
| 15. Drill-in button | 3 min | `ArticlePanel.tsx` | Same |
| 16. GraphMeta counts | 2 min | `GraphMeta.tsx` | Same |
| 17. GraphView wiring | 5 min | `GraphView.tsx` | **CHANGED** — uses new hooks, passes allNodes to ArticlePanel |
| 18. Integration test | 5 min | — | Same |
| **Total** | **~65 min** | | |

### Key Differences from Original Plan

1. **No SimNode deletion** — already deleted in liquid sphere redesign
2. **Fibonacci sphere layout** — code nodes placed on same sphere via `computeSpherePositions`, not force-simulated
3. **God nodes pushed outward** instead of to z=-200 background plane — preserves sphere aesthetic
4. **Separate CodeNodes component** instead of dual mesh in InstancedNodes — cleaner separation
5. **Local→global index mapping** — both InstancedMesh components share one positionsRef but render their own partition
6. **MeshTransmissionMaterial for cubes** — glass cubes match glass spheres aesthetic
7. **Arc edges for cross-layer** — white arcs via existing `buildArcGeometryArrays`, not straight lines
8. **Spring drag works unchanged** — both node types use shared positionsRef/restPositionsRef
