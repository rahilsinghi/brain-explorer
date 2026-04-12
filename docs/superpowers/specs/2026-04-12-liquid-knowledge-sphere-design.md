# Liquid Knowledge Sphere — Design Specification

## Overview

Transition the Brain Explorer from a CPU-bound force-directed simulation to a high-performance, GPU-accelerated static spherical layout with premium visual aesthetics. Nodes become clear glass orbs via MeshTransmissionMaterial, edges become static color-gradient lines with additive blending, and the UI gets glassmorphic styling.

**Approach:** Layered migration — each system is swapped independently in isolation, producing a working commit at each step.

## Migration Layers

1. Fibonacci sphere layout (replaces force simulation)
2. MeshTransmissionMaterial nodes (replaces solid spheres + glow halos)
3. Static gradient edges (replaces lines + particle system)
4. Bloom retuning (adjust thresholds/intensity, remove fog)
5. Glassmorphic ArticlePanel + Tooltip
6. Cosmetic drag with snap-back (replaces physics-based drag)

---

## 1. Fibonacci Sphere Layout

**Replaces:** `useSimulation.ts`, `force-simulation.ts`, `d3-force-3d` dependency, `SimNode` type, simulation state (alpha, decay, reheat).

**New module:** `useSphereLayout` hook.

### Algorithm

1. Sort nodes by category.
2. Assign each category a latitude band on a sphere of radius 35. Band widths are proportional to the number of nodes in that category — categories with more nodes get wider bands.
3. Within each band, distribute nodes using a Fibonacci spiral. The golden angle (pi * (3 - sqrt(5))) ensures even angular spacing, preventing polar clumping.
4. Convert (latitude, longitude) to Cartesian (x, y, z) and write positions once to a `Float32Array`.

### Interface

```typescript
function useSphereLayout(nodes: GraphNode[]): {
  positionsRef: React.MutableRefObject<Float32Array>;
  restPositionsRef: React.MutableRefObject<Float32Array>;
  nodeIndexMap: Map<string, number>;
};
```

**Computation timing:** Positions are computed in `useMemo` (not `useEffect`) so refs are populated before child components read them during the same render. This follows the pattern established when `useSimulation` was moved to `useMemo` to fix timing issues.

- `positionsRef` — mutable positions (updated during drag). Same shared buffer pattern used by `InstancedNodes` and `Edges`.
- `restPositionsRef` — immutable sphere positions computed once. Used as snap-back target for drag.
- `nodeIndexMap` — O(1) index lookups by node ID. Same as current.

### What Gets Deleted

- `src/hooks/useSimulation.ts`
- `src/lib/force-simulation.ts`
- `src/lib/d3-force-3d.d.ts`
- `SimNode` type from `types.ts`
- `ALPHA_MIN` constant
- `d3-force-3d` from `package.json`

### What Stays

- `positionsRef: Float32Array` as the shared position buffer interface
- `nodeIndexMap` for O(1) lookups
- `neighborMap` from `useGraphData`

### Constants

- `SPHERE_RADIUS = 35`

---

## 2. Glass Nodes — MeshTransmissionMaterial

**Replaces:** Dual InstancedMesh (solid spheres + glow halo sprites).

### Appearance

- Single InstancedMesh with `MeshTransmissionMaterial` from `@react-three/drei`.
- Clear, translucent crystal orbs — high transmission, low roughness (~0.1), IOR ~1.5.
- Category color applied as a subtle tint on the transmission color — nodes read as "clear glass with a hint of color", not solid fills.
- Thin luminous borders via Fresnel-driven emissive edge glow.
- Focused/hovered nodes: slightly increased emissive intensity.
- Unfocused nodes (when another is focused): reduced transmission/opacity to dim.

### Performance Tuning

MeshTransmissionMaterial renders an extra FBO pass. With 354 nodes this is the primary perf risk.

- `samples`: start at 1, increase if quality is insufficient
- `resolution`: start at 256, increase if too blurry
- If perf is unacceptable at minimum settings, fallback to `MeshPhysicalMaterial` with `transmission: 1, roughness: 0.1, ior: 1.5`

### What Gets Deleted

- Second InstancedMesh for glow halos (GLOW_SCALE, GLOW_OPACITY constants)
- Emissive color boost logic
- Radial gradient sprite material

### What Stays

- InstancedMesh pattern with `setMatrixAt()` per frame
- Color dimming for unfocused nodes (adapted for transmission)
- `getNodeRadius()` from `categories.ts`

---

## 3. Static Gradient Edges

**Replaces:** Dynamic BufferGeometry lines + animated particle system.

### Appearance

- Line segments with per-vertex colors. Source vertex gets source node's category color, target vertex gets target node's category color.
- GPU linearly interpolates color between vertices — no custom shader needed for the gradient.
- `AdditiveBlending` on the material — dense edge clusters glow brighter where lines overlap.
- `vertexColors: true` on the line material.

### Focus Behavior (unchanged from current)

- Edges connected to focused node: opacity 0.8
- Other edges when focused: opacity 0.05
- No focus: all edges at base opacity (~0.3-0.4, tuned with bloom)

### Position Source

Positions still read from shared `positionsRef` via `nodeIndexMap`. Positions update during drag (only the dragged node's edges move).

### What Gets Deleted

- Particle system: particle positions, speeds, interpolation in `useFrame`
- `PARTICLE_SPEED` constant
- Particle-related BufferAttributes

### What Stays

- BufferGeometry with dynamic position attributes
- Focus alpha logic (FOCUS_ALPHA, DIMMED_ALPHA)
- Edge geometry rebuild on `links.length` change

---

## 4. Bloom Retuning

**Adjustments to existing `@react-three/postprocessing` bloom setup.**

### Changes

- Lower bloom threshold to ~0.2 — additive-blended edge intersections and transmission refractions pick up bloom.
- Increase bloom intensity — dense edge clusters should read as visually "hot".
- Adjust radius/smoothing — bloom bleeds softly without washing out glass nodes. Nodes stay crisp, edges glow.
- Remove `FogExp2` (currently density 0.003) — fog conflicts with transmission material and muddies the sphere. Bloom falloff provides sufficient atmospheric depth.

### Tuning Approach

Numeric tweaks, not structural changes. Set initial values, refine by eye in the browser.

---

## 5. Glassmorphic ArticlePanel + Tooltip

**Restyling of existing 2D overlay components. No structural changes.**

### ArticlePanel

- Semi-transparent background: `rgba(15, 15, 30, 0.6)`
- `backdrop-filter: blur(20px)`
- Subtle border: `1px solid rgba(255, 255, 255, 0.1)`
- Soft `border-radius`
- White/light gray text, fully readable
- Same fixed overlay position on the right side of the viewport

### Tooltip

- Same glassmorphic treatment (frosted glass background, border, blur)
- Same positioning logic (follows pointer near hovered node)

### Behavior (unchanged)

- ArticlePanel appears on node click, hides on Escape or click-away
- Displays article title, category, tags, connection count, markdown content
- Wikilink click navigates to linked node

---

## 6. Cosmetic Drag with Snap-Back

**Replaces:** Physics-based drag with force simulation reheat/settle.

### Behavior

1. **Pointerdown + 5px threshold:** Node begins following pointer projection onto camera-perpendicular plane (same projection math as current `useDrag`).
2. **During drag:** Node's position in `positionsRef` updated directly each frame. Neighbors are NOT affected.
3. **Pointerup:** Animate node back to its sphere position (`restPositionsRef`) via lerp over ~300ms with ease-out.
4. **OrbitControls:** Disabled during drag, re-enabled on release.

### State Machine

Simplified from current: `IDLE → DRAGGING → IDLE`

The `RELEASING` state is removed — snap-back is a lerp animation within the IDLE state (or a brief transitional animation managed by a ref, not a state machine state).

### What Gets Deleted

- `RELEASING` state and alpha-threshold transition check
- `reheat()`, `pin(fx/fy/fz)`, `unpin()`, `restoreDecay()`
- `alphaDecay` manipulation
- Elastic tether behavior (neighbor response)
- `SimNode` mutable position type (already deleted in layer 1)

### What Stays

- Pointer-to-plane projection math
- 5px drag threshold
- OrbitControls coordination via `controlsRef`
- Drag triggers `setFocusedNode()`
- Position clamping (±80 units)

### Snap-Back Position Source

`restPositionsRef: Float32Array` — computed once by `useSphereLayout`, stores the original sphere positions. Drag writes to `positionsRef`; snap-back lerps `positionsRef` back toward `restPositionsRef`.

---

## Type Changes

### Deleted

```typescript
// Remove from types.ts
interface SimNode { ... }
type DragState = "IDLE" | "DRAGGING" | "RELEASING";
const ALPHA_MIN = 0.001;
```

### Modified

```typescript
// Simplified DragState
type DragState = "IDLE" | "DRAGGING";
```

---

## Dependencies

### Added

None — MeshTransmissionMaterial is already available via `@react-three/drei`.

### Removed

- `d3-force-3d` (+ `@types` if separate)

---

## Camera & Controls

### OrbitControls (unchanged structure, tuned values)

- Min distance: 20
- Max distance: 150
- Damping factor: 0.05
- Auto-rotation: kept (existing `CameraController.tsx`)

### Camera Position

- May need adjustment from `[0, 0, 120]` since sphere radius changes from SCENE_RADIUS=50 to SPHERE_RADIUS=35. Starting position ~`[0, 0, 90]` likely appropriate — tune by eye.

---

## Existing Category Colors

No changes to the color palette. All 9 categories retain their current colors from `categories.ts`:

- projects: #a78bfa (violet)
- skills: #06b6d4 (cyan)
- companies: #ec4899 (pink)
- experience: #f59e0b (amber)
- decisions: #22c55e (green)
- people: #f4723b (orange)
- concepts: #e2e8f0 (slate)
- synthesis: #14b8a6 (teal)
- tracking: #06b6d4 (cyan)

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| MeshTransmissionMaterial tanks FPS with 354 nodes | High | High | Layer 2 lands early. Fallback: MeshPhysicalMaterial with transmission. Tuning knobs: samples (1-6), resolution (128-1024). |
| Glass nodes are too subtle / invisible against dark background | Medium | Medium | Tune emissive intensity, Fresnel strength, and category color tint. Bloom will also help visibility. |
| Additive blending on edges produces unreadable white-out in dense clusters | Medium | Low | Reduce base edge opacity. Tune bloom threshold to control glow intensity. |
| Snap-back drag feels cheap without physics | Low | Low | Tune ease curve and duration. Add subtle scale bounce on snap. |
