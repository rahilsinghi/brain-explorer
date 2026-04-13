<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Architecture — Liquid Knowledge Sphere

3D knowledge graph visualizer using React Three Fiber + drei. Two-layer rendering:

- **Wiki nodes**: Glass spheres via `InstancedNodes.tsx` (MeshTransmissionMaterial + sphereGeometry)
- **Code nodes**: Glass cubes via `CodeNodes.tsx` (MeshTransmissionMaterial + boxGeometry, green-tinted)
- **Edges**: Quadratic Bezier arcs via `buildArcGeometryArrays()` in `arc-geometry.ts`
- **Layout**: Fibonacci sphere (`computeSpherePositions()` in `sphere-layout.ts`), no force simulation
- **Drag**: Spring-based with snap-back (`useDrag.ts` + `spring.ts`)
- **God nodes**: Pushed 3x outward from sphere center in `useSphereLayout.ts`

### Key patterns

- **Shared position buffer**: Both InstancedMesh components read from one `positionsRef: Float32Array` managed by `useSphereLayout`. Each uses a local-to-global index mapping.
- **Layer filtering**: `useGraphData` stores raw data, derives filtered view via `filterByLayer()` reacting to Zustand `activeLayer` + `drillInNodeIds`.
- **Selective bloom**: Edges on layer 1, nodes on layer 0. Bloom pass targets layer 1 only.

### Phase 5 status (2026-04-12)

Two-layer visualization complete:
- Layer toggle (Wiki/Code/All) with URL param `?layer=`
- Code nodes as glass cubes with community hue shift
- Cross-layer edges (white arcs)
- God-node outward offset
- Drill-in UX (centrality-capped reveal from repo wiki nodes)
- Code-node tooltip (file path, community, repo)
- Deep-linking with URI-encoded `code://` IDs

**Test fixture**: `public/graph.json` has 10 code nodes for dev testing. Real data flows from the Brain daemon's `POST /graph-push` endpoint once the daemon sets `layer` field on code nodes.

### What's NOT done yet

- Daemon graph cache doesn't set `layer` field on nodes — needs update in `~/Desktop/brain/src/graph/cache.ts` to set `layer: "wiki"` on wiki nodes and propagate `layer: "code"` from Graphify nodes
- No fly-in arc animation for drill-in (top 20 appear instantly, rest after 1.2s delay — but no spatial animation)
- God-node pulse animation (spec says slow pulse, not implemented)
