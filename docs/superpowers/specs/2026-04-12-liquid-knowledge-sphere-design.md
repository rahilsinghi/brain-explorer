# Liquid Knowledge Sphere — Design Specification

## Overview

Transition the Brain Explorer from a CPU-bound force-directed simulation to a high-performance, GPU-accelerated static spherical layout with premium visual aesthetics. Nodes become clear glass orbs via MeshTransmissionMaterial, edges become Great Arc curves with gradient coloring and additive blending, and the UI gets glassmorphic styling.

**Approach:** Layered migration — each system is swapped independently in isolation, producing a working commit at each step.

## Migration Layers

1. Fibonacci sphere layout (replaces force simulation)
2. MeshTransmissionMaterial nodes (replaces solid spheres + glow halos)
3. Great Arc gradient edges (replaces straight lines + particle system)
4. Selective bloom (layer-based bloom, remove fog)
5. Glassmorphic ArticlePanel + Tooltip
6. Cosmetic drag with snap-back (replaces physics-based drag)

---

## 1. Fibonacci Sphere Layout

**Replaces:** `useSimulation.ts`, `force-simulation.ts`, `d3-force-3d` dependency, `SimNode` type, simulation state (alpha, decay, reheat).

**New module:** `useSphereLayout` hook.

### Algorithm — Continuous Golden Spiral

**Why not latitude bands:** Strict latitude banding creates harsh horizontal stripes across the sphere ("striped beachball" effect), breaking the organic aesthetic. Instead, a continuous Fibonacci spiral with category-sorted input produces natural, interlocking organic swirls.

1. Sort the flat array of nodes by category (stable sort — preserves original order within each category).
2. Map the sorted array onto a single continuous Fibonacci spiral across the entire sphere surface. For node at index `i` of `N` total nodes:
   - `y = 1 - (2 * i / (N - 1))` — evenly spaced along the y-axis from +1 to -1
   - `radius_at_y = sqrt(1 - y * y)` — radius of the sphere cross-section at height y
   - `theta = golden_angle * i` where `golden_angle = pi * (3 - sqrt(5))`
   - `x = cos(theta) * radius_at_y`
   - `z = sin(theta) * radius_at_y`
   - Scale all by `SPHERE_RADIUS` (35)
3. Because nodes are sorted by category, each category naturally pools into a contiguous region of the spiral, creating organic swirl patterns rather than rigid slices.
4. Write positions once to a `Float32Array`.

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

### Depth Sorting for Transparency

Transmission materials calculate refraction by reading what's behind them via an off-screen buffer. With hundreds of overlapping transparent instances, standard depth sorting fails — back instances render on top of front instances, causing visual popping during camera orbit.

- Set `depthWrite: false` on the material
- If popping artifacts persist: implement a camera-distance sort that re-orders the InstancedMesh matrix array every few frames during rotation. Sort by distance from each instance origin to `camera.position`, farthest-first (back-to-front painter's order)
- Sort frequency: every 3-5 frames during active orbit (not every frame — sorting 354 entries is cheap but the matrix buffer upload isn't free)

### What Gets Deleted

- Second InstancedMesh for glow halos (GLOW_SCALE, GLOW_OPACITY constants)
- Emissive color boost logic
- Radial gradient sprite material

### What Stays

- InstancedMesh pattern with `setMatrixAt()` per frame
- Color dimming for unfocused nodes (adapted for transmission)
- `getNodeRadius()` from `categories.ts`

---

## 3. Great Arc Gradient Edges

**Replaces:** Dynamic BufferGeometry lines + animated particle system.

### Why Great Arcs, Not Straight Lines

Straight lines between nodes on opposite sides of the sphere cut through the center, creating a dense, chaotic web in the interior. With additive blending and bloom, this central cluster blows out to pure white, destroying dark-theme contrast. Worse, the MeshTransmissionMaterial on nodes would refract this messy bright interior instead of the deep background.

Great Arcs route edges along the sphere surface, keeping the interior hollow. Glass nodes refract the clean background and the glowing surface connections.

### Geometry

Each edge is a quadratic Bezier curve with its control point pushed outward from the sphere center:

1. Given source position `A` and target position `B` on the sphere surface:
2. Compute midpoint `M = (A + B) / 2`
3. Push `M` outward along its normal from origin: `controlPoint = normalize(M) * SPHERE_RADIUS * ARC_LIFT` where `ARC_LIFT` ~1.2-1.4 (tune by eye — higher values = more curved)
4. Tessellate the Bezier into `SEGMENTS_PER_EDGE` (~16) line segments
5. Store as a continuous BufferGeometry with per-vertex colors

### Color Gradient

- Each vertex along the curve gets a color interpolated between source and target category colors based on its parametric `t` value (0 at source, 1 at target)
- GPU interpolates between adjacent vertices — smooth gradient along the arc
- `vertexColors: true` on the line material

### Blending & Material

- `AdditiveBlending` — overlapping arcs at dense connection hubs glow brighter
- Base material opacity ~0.3-0.4 (tuned with selective bloom)

### Computation

- Arc geometry is computed **CPU-side on data load** (positions are static)
- During drag: only the dragged node's connected edges are recomputed (handful of curves, trivially cheap)
- No vertex shader needed — geometry changes are too infrequent to justify the complexity

### Focus Behavior (unchanged from current)

- Edges connected to focused node: opacity 0.8
- Other edges when focused: opacity 0.05
- No focus: all edges at base opacity (~0.3-0.4, tuned with bloom)

### Position Source

Positions read from shared `positionsRef` via `nodeIndexMap`. During drag, connected edges are retessellated from the dragged node's current position.

### Constants

- `ARC_LIFT = 1.3` (control point distance multiplier, tune by eye)
- `SEGMENTS_PER_EDGE = 16` (tessellation resolution per curve)

### What Gets Deleted

- Particle system: particle positions, speeds, interpolation in `useFrame`
- `PARTICLE_SPEED` constant
- Particle-related BufferAttributes
- Straight-line edge geometry

### What Stays

- Focus alpha logic (FOCUS_ALPHA, DIMMED_ALPHA)
- Edge geometry rebuild on `links.length` change

---

## 4. Selective Bloom

**Replaces:** Global bloom with layer-based selective bloom for independent control of edge glow vs node crispness.

### Why Selective Bloom

Cranking global bloom intensity to make edges glow also washes out the subtle Fresnel and tinting on glass nodes. Selective bloom via Three.js layers lets edges run "hot" while glass stays crisp and readable.

### Implementation

- **Layer 0 (default):** Glass nodes (InstancedMesh), starfield, background — receives subtle or no bloom
- **Layer 1 (bloom layer):** Edge geometry — receives heavy bloom
- Assign edge meshes to layer 1 via `mesh.layers.set(1)` or `mesh.layers.enable(1)`
- Configure the bloom pass to target layer 1 using a selective bloom setup with `@react-three/postprocessing`

### Bloom Parameters (edges)

- Threshold: ~0.2 — additive-blended arc intersections pick up bloom
- Intensity: high — dense connection hubs should glow visually "hot"
- Radius: moderate — soft bleed without spreading to distant nodes

### Other Changes

- Remove `FogExp2` (currently density 0.003) — fog conflicts with transmission material and muddies the sphere. Bloom falloff provides sufficient atmospheric depth.

### Tuning Approach

Set initial values, refine by eye in the browser. The layer separation means edges and nodes can be tuned independently without compromise.

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
2. **During drag:** Node's position in `positionsRef` updated directly each frame. Connected edge arcs are retessellated from the new position. Neighbors are NOT affected.
3. **Pointerup:** Animate node back to its sphere position (`restPositionsRef`) using a **damped spring simulation** (Hooke's law). See Spring Dynamics below.
4. **OrbitControls:** Disabled during drag, re-enabled on release.

### Spring Dynamics

Instead of a time-based lerp (which feels rigid for a liquid/glass aesthetic), the snap-back uses a lightweight damped spring:

```
force = -stiffness * (position - restPosition)
velocity += force * deltaTime
velocity *= damping
position += velocity * deltaTime
```

- `stiffness`: ~180 (snappy but not instant)
- `damping`: ~0.85 per frame (highly damped — settles in ~300-400ms with a slight overshoot)
- Spring runs per-axis (x, y, z independently) in `useFrame`
- Spring is considered settled when `|velocity| < 0.01` and `|displacement| < 0.01` — stop updating to avoid CPU waste

This produces a magnetic, liquid snap-back with subtle overshoot that matches the premium glass aesthetic.

### State Machine

Simplified from current: `IDLE → DRAGGING → SNAPPING → IDLE`

- `IDLE`: no drag active, no spring running
- `DRAGGING`: pointer controls position, spring inactive
- `SNAPPING`: spring simulation active, animating back to rest position. Transitions to IDLE when spring settles.

### What Gets Deleted

- `RELEASING` state and alpha-threshold transition check (replaced by `SNAPPING`)
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
const ALPHA_MIN = 0.001;
```

### Modified

```typescript
// Updated DragState — RELEASING becomes SNAPPING (spring-based)
type DragState = "IDLE" | "DRAGGING" | "SNAPPING";
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
| Transparent instance depth-sorting artifacts (visual popping during orbit) | High | Medium | Set `depthWrite: false`. If artifacts persist, implement back-to-front camera-distance sort every 3-5 frames. |
| Glass nodes are too subtle / invisible against dark background | Medium | Medium | Tune emissive intensity, Fresnel strength, and category color tint. Selective bloom keeps nodes crisp. |
| Additive blending on edges produces white-out in dense clusters | Low | Low | Great Arcs route edges along surface, keeping interior hollow. Selective bloom targets edges only. Tune base opacity. |
| Snap-back drag feels cheap without physics | Low | Low | Damped spring simulation provides tactile overshoot. Tune stiffness/damping constants. |
