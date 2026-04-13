# Brain Explorer v1.1 Visual Revamp

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the brain-explorer from a functional but visually flat 3D graph into a polished, atmospheric portfolio piece with glowing nodes, animated edges, readable panels, and cinematic depth.

**Architecture:** Targeted modifications to existing components — no architecture changes. InstancedNodes gets an additive glow layer, CameraController gets auto-rotation, Edges gets category-tinted lines with particles, GraphCanvas gets starfield + fog, Tooltip/ArticlePanel get redesigned styling. One daemon-side bug fix in brain repo for empty links array.

**Tech Stack:** React Three Fiber, drei, Three.js postprocessing, Zustand, Tailwind CSS, d3-force-3d. Daemon: Bun + TypeScript.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/components/CameraController.tsx` | Add auto-rotation (0.001 rad/frame Y), pause on interaction, resume after 3s |
| Modify | `src/components/InstancedNodes.tsx` | Add second InstancedMesh (additive glow halos) |
| Modify | `src/lib/categories.ts` | Brighten purple, add `CATEGORY_GLOW_COLORS` |
| Modify | `src/components/Edges.tsx` | Category-tinted lines + animated particle dots |
| Modify | `src/components/Tooltip.tsx` | White text, category pill, spaced tag pills, connection badge, fade-in |
| Modify | `src/components/ArticlePanel.tsx` | Glass redesign, metadata card fallback, close button, spring slide-in |
| Modify | `src/components/GraphCanvas.tsx` | Add Starfield + FogExp2 |
| Create | `src/components/Starfield.tsx` | 2000-point static star field at radius 200-500 |
| Modify | `src/app/globals.css` | fade-in keyframe, spring slide-in keyframe, tag pill styles |
| Modify | `~/Desktop/brain/src/graph/scan-wiki.ts` | Fix normalizeTarget to resolve wikilink targets against full node IDs |

**Not touched:** GraphView.tsx, useGraphState.ts, useGraphData.ts, useCameraAnimation.ts, CommandPalette.tsx, GraphMeta.tsx, AdminRefresh.tsx, force-layout.ts, graph-data.ts, wikilink-plugin.ts, types.ts.

---

### Task 1: Fix Empty Links in Brain Daemon

This is a daemon-side bug in the brain repo (`~/Desktop/brain`), not the explorer repo. The wikilink `[[exp-kismet-tracking]]` normalizes to `exp-kismet-tracking.md`, but the node ID is `experience/exp-kismet-tracking.md`. Every link gets filtered out in export.ts because targets never match node IDs.

**Files:**
- Modify: `~/Desktop/brain/src/graph/scan-wiki.ts:44-55` (normalizeTarget function)
- Test: `~/Desktop/brain/tests/graph/scan-wiki.test.ts` (existing or create)

- [ ] **Step 1: Write the failing test**

Create or append to `~/Desktop/brain/tests/graph/scan-wiki.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { scanWiki } from "../../src/graph/scan-wiki.js";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("scanWiki link resolution", () => {
  it("resolves bare wikilink targets to full node IDs with category prefix", () => {
    // Create a temp vault with wiki/ structure
    const vaultRoot = mkdtempSync(join(tmpdir(), "brain-test-"));
    const wikiDir = join(vaultRoot, "wiki");
    mkdirSync(join(wikiDir, "experience"), { recursive: true });
    mkdirSync(join(wikiDir, "projects"), { recursive: true });

    // Source file links to target via bare name
    writeFileSync(
      join(wikiDir, "experience", "exp-acme.md"),
      "---\ntitle: Acme Experience\ntags: [experience]\nauthor: ai\ncreated_at: 2026-01-01\n---\nWorked on [[proj-karen]].",
    );
    writeFileSync(
      join(wikiDir, "projects", "proj-karen.md"),
      "---\ntitle: Karen Project\ntags: [projects]\nauthor: ai\ncreated_at: 2026-01-01\n---\nA project.",
    );

    const result = scanWiki(vaultRoot);

    expect(result.links.length).toBe(1);
    expect(result.links[0]).toEqual({
      source: "experience/exp-acme.md",
      target: "projects/proj-karen.md",
    });

    // Cleanup
    rmSync(vaultRoot, { recursive: true, force: true });
  });

  it("resolves wikilink with category prefix unchanged", () => {
    const vaultRoot = mkdtempSync(join(tmpdir(), "brain-test-"));
    const wikiDir = join(vaultRoot, "wiki");
    mkdirSync(join(wikiDir, "experience"), { recursive: true });
    mkdirSync(join(wikiDir, "projects"), { recursive: true });

    writeFileSync(
      join(wikiDir, "experience", "exp-acme.md"),
      "---\ntitle: Acme\ntags: []\nauthor: ai\ncreated_at: 2026-01-01\n---\nSee [[projects/proj-karen]].",
    );
    writeFileSync(
      join(wikiDir, "projects", "proj-karen.md"),
      "---\ntitle: Karen\ntags: []\nauthor: ai\ncreated_at: 2026-01-01\n---\nProject.",
    );

    const result = scanWiki(vaultRoot);

    expect(result.links.length).toBe(1);
    expect(result.links[0].target).toBe("projects/proj-karen.md");

    rmSync(vaultRoot, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Desktop/brain && pnpm test tests/graph/scan-wiki.test.ts`
Expected: FAIL — links array is empty because normalizeTarget returns `proj-karen.md` instead of `projects/proj-karen.md`.

- [ ] **Step 3: Fix normalizeTarget to resolve against node IDs**

In `~/Desktop/brain/src/graph/scan-wiki.ts`, the fix goes in `scanWiki()` — after collecting all nodes, build a filename-to-ID lookup, then resolve raw link targets against it. Replace the current normalizeTarget usage:

```typescript
function normalizeTarget(raw: string): string {
  let target = raw.trim();
  if (target.startsWith("wiki/")) {
    target = target.slice(5);
  }
  if (!target.endsWith(".md")) {
    target = target + ".md";
  }
  return target;
}

export function scanWiki(vaultRoot: string): ScanResult {
  const wikiDir = join(vaultRoot, "wiki");
  const files = walkDir(wikiDir);

  const nodes: ScanNode[] = [];
  const rawLinks: { source: string; target: string }[] = [];

  for (const filePath of files) {
    const id = relative(wikiDir, filePath);
    const category = id.split("/")[0];

    const { data, content } = readFrontmatter<WikiFrontmatter>(filePath);

    const node: ScanNode = {
      id,
      title: data.title ?? basename(filePath, ".md"),
      tags: data.tags ?? [],
      category,
      source_type: data.author ?? "unknown",
      created_at: data.created_at ?? "",
      connection_count: 0,
    };
    nodes.push(node);

    // Extract wiki links (store raw targets for now)
    let match: RegExpExecArray | null;
    while ((match = WIKI_LINK_RE.exec(content)) !== null) {
      const target = normalizeTarget(match[1]);
      rawLinks.push({ source: id, target });
    }
  }

  // Build filename → full ID lookup for resolving bare wikilink targets
  const nodeIds = new Set(nodes.map((n) => n.id));
  const filenameToId = new Map<string, string>();
  for (const node of nodes) {
    const filename = node.id.split("/").pop()!;
    // Only map if unambiguous (first wins — collisions are rare in practice)
    if (!filenameToId.has(filename)) {
      filenameToId.set(filename, node.id);
    }
  }

  // Resolve link targets: if target already matches a node ID, keep it.
  // Otherwise, look up by filename.
  const resolvedLinks = rawLinks
    .map((link) => {
      if (nodeIds.has(link.target)) return link;
      const filename = link.target.split("/").pop()!;
      const resolvedId = filenameToId.get(filename);
      if (resolvedId) return { source: link.source, target: resolvedId };
      return null; // Dangling link — target doesn't exist
    })
    .filter((l): l is { source: string; target: string } => l !== null);

  // Deduplicate bidirectional edges
  const seen = new Set<string>();
  const links: { source: string; target: string }[] = [];

  for (const link of resolvedLinks) {
    if (link.source === link.target) continue; // Skip self-links
    const key = [link.source, link.target].sort().join("|||");
    if (!seen.has(key)) {
      seen.add(key);
      links.push(link);
    }
  }

  // Count connections
  const connectionCounts = new Map<string, number>();
  for (const link of links) {
    connectionCounts.set(link.source, (connectionCounts.get(link.source) ?? 0) + 1);
    connectionCounts.set(link.target, (connectionCounts.get(link.target) ?? 0) + 1);
  }

  for (const node of nodes) {
    node.connection_count = connectionCounts.get(node.id) ?? 0;
  }

  return { nodes, links };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/Desktop/brain && pnpm test tests/graph/scan-wiki.test.ts`
Expected: PASS

- [ ] **Step 5: Run full brain test suite**

Run: `cd ~/Desktop/brain && pnpm test`
Expected: All tests pass.

- [ ] **Step 6: Rebuild graph cache and push to explorer**

Run: `cd ~/Desktop/brain && curl -X POST http://localhost:3577/graph-push`

If the daemon isn't running: `cd ~/Desktop/brain && pnpm start` first, wait for "ready" log, then POST.

After push completes, verify: `cd ~/Desktop/brain-explorer && node -e "const g = require('./public/graph.json'); console.log('links:', g.links.length)"`

Expected: `links:` followed by a number > 0.

- [ ] **Step 7: Commit daemon fix**

```bash
cd ~/Desktop/brain
git add src/graph/scan-wiki.ts tests/graph/scan-wiki.test.ts
git commit -m "fix(graph): resolve bare wikilink targets to full node IDs

normalizeTarget was producing 'proj-karen.md' but node IDs are
'projects/proj-karen.md'. Build filename→ID lookup after scanning
all nodes, resolve targets before dedup. Fixes empty links array."
```

---

### Task 2: Brighten Purple + Add Glow Color Map

**Files:**
- Modify: `~/Desktop/brain-explorer/src/lib/categories.ts`
- Test: `~/Desktop/brain-explorer/src/lib/categories.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `~/Desktop/brain-explorer/src/lib/categories.test.ts`:

```typescript
import { CATEGORY_COLORS, CATEGORY_GLOW_COLORS, getCategoryColor, getGlowColor } from "./categories";

describe("CATEGORY_COLORS", () => {
  it("projects color is brighter violet (#a78bfa)", () => {
    expect(CATEGORY_COLORS.projects).toBe("#a78bfa");
  });
});

describe("getGlowColor", () => {
  it("returns glow color for known category", () => {
    expect(getGlowColor("projects")).toBe("#c4b5fd");
  });

  it("returns default glow for unknown category", () => {
    expect(getGlowColor("nonexistent")).toBe("#e2e8f0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/Desktop/brain-explorer && pnpm test src/lib/categories.test.ts`
Expected: FAIL — `CATEGORY_GLOW_COLORS` and `getGlowColor` don't exist, projects is still `#8b5cf6`.

- [ ] **Step 3: Update categories.ts**

Replace the full contents of `~/Desktop/brain-explorer/src/lib/categories.ts`:

```typescript
export const CATEGORY_COLORS: Record<string, string> = {
  projects: "#a78bfa",    // Brighter violet (was #8b5cf6)
  skills: "#06b6d4",      // Cyan
  companies: "#ec4899",   // Pink
  experience: "#f59e0b",  // Amber
  decisions: "#22c55e",   // Green
  people: "#f4723b",      // Orange
  concepts: "#e2e8f0",    // Slate-200
  synthesis: "#14b8a6",   // Teal
  tracking: "#06b6d4",    // Cyan
};

// Lighter/more saturated versions for glow halos
export const CATEGORY_GLOW_COLORS: Record<string, string> = {
  projects: "#c4b5fd",    // Light violet
  skills: "#22d3ee",      // Bright cyan
  companies: "#f472b6",   // Light pink
  experience: "#fbbf24",  // Bright amber
  decisions: "#4ade80",   // Light green
  people: "#fb923c",      // Light orange
  concepts: "#f1f5f9",    // Slate-100
  synthesis: "#2dd4bf",   // Light teal
  tracking: "#22d3ee",    // Bright cyan
};

const DEFAULT_COLOR = "#e2e8f0";

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR;
}

export function getGlowColor(category: string): string {
  return CATEGORY_GLOW_COLORS[category] ?? DEFAULT_COLOR;
}

const MIN_RADIUS = 0.3;
const MAX_RADIUS = 1.5;
const MAX_CONNECTIONS = 40;

export function getNodeRadius(connectionCount: number): number {
  const t = Math.min(connectionCount / MAX_CONNECTIONS, 1);
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/Desktop/brain-explorer && pnpm test src/lib/categories.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/brain-explorer
git add src/lib/categories.ts src/lib/categories.test.ts
git commit -m "feat(colors): brighten purple to #a78bfa, add glow color map"
```

---

### Task 3: Ambient Camera Auto-Rotation

**Files:**
- Modify: `~/Desktop/brain-explorer/src/components/CameraController.tsx`

- [ ] **Step 1: Write the failing test**

This is a useFrame-driven behavior — testing it in jsdom would require mocking the entire R3F render loop. Instead, we'll verify visually. Skip to implementation.

- [ ] **Step 2: Add auto-rotation logic to CameraController**

Replace the full contents of `~/Desktop/brain-explorer/src/components/CameraController.tsx`:

```typescript
"use client";

import { useRef, useEffect, useMemo, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { GraphNode } from "@/lib/types";
import { useGraphState } from "@/hooks/useGraphState";
import { useCameraAnimation } from "@/hooks/useCameraAnimation";

interface CameraControllerProps {
  nodes: GraphNode[];
}

const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 0, 120);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
const AUTO_ROTATE_SPEED = 0.001; // rad/frame on Y axis
const IDLE_RESUME_DELAY = 3000; // ms before auto-rotate resumes

export function CameraController({ nodes }: CameraControllerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const { flyTo, resetTo, update } = useCameraAnimation();
  const { camera } = useThree();

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const savedOrbitRef = useRef({
    position: DEFAULT_CAMERA_POS.clone(),
    target: DEFAULT_TARGET.clone(),
  });

  // Auto-rotation state
  const autoRotateRef = useRef({
    active: true,
    idleTimer: null as ReturnType<typeof setTimeout> | null,
  });

  // Pause auto-rotation on user interaction
  const handleInteractionStart = useCallback(() => {
    const state = autoRotateRef.current;
    state.active = false;
    if (state.idleTimer) clearTimeout(state.idleTimer);
  }, []);

  const handleInteractionEnd = useCallback(() => {
    const state = autoRotateRef.current;
    if (state.idleTimer) clearTimeout(state.idleTimer);
    state.idleTimer = setTimeout(() => {
      state.active = true;
    }, IDLE_RESUME_DELAY);
  }, []);

  useEffect(() => {
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
  }, [focusedNodeId, nodeMap, camera, flyTo, resetTo]);

  useFrame((_, delta) => {
    const animating = update(delta, camera, controlsRef.current);
    if (controlsRef.current) {
      controlsRef.current.enabled = !animating;
    }

    // Auto-rotate when idle and not focused/animating
    if (
      autoRotateRef.current.active &&
      !animating &&
      !focusedNodeId &&
      controlsRef.current
    ) {
      const controls = controlsRef.current;
      // Rotate camera position around Y axis through the target
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += AUTO_ROTATE_SPEED;
      offset.setFromSpherical(spherical);
      camera.position.copy(controls.target).add(offset);
      camera.lookAt(controls.target);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={200}
      makeDefault
      onStart={handleInteractionStart}
      onEnd={handleInteractionEnd}
    />
  );
}
```

- [ ] **Step 3: Visual verification**

Run: `cd ~/Desktop/brain-explorer && pnpm dev`
Open http://localhost:3000. Verify:
1. Graph slowly rotates on Y axis on load
2. Grabbing orbit controls stops rotation
3. Releasing controls, rotation resumes after ~3 seconds
4. Clicking a node (focus) stops rotation
5. Pressing Esc (clear focus) rotation resumes after 3s

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/brain-explorer
git add src/components/CameraController.tsx
git commit -m "feat(camera): add ambient auto-rotation with idle resume"
```

---

### Task 4: Node Glow via Additive Blending Layer

We'll use a second InstancedMesh with additive blending, larger scale, lower opacity, and the glow color palette. This approach gives consistent halos regardless of luminance — purple glows as well as green.

**Files:**
- Modify: `~/Desktop/brain-explorer/src/components/InstancedNodes.tsx`

- [ ] **Step 1: Add glow layer to InstancedNodes**

Replace the full contents of `~/Desktop/brain-explorer/src/components/InstancedNodes.tsx`:

```typescript
"use client";

import { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { GraphNode } from "@/lib/types";
import { getCategoryColor, getGlowColor, getNodeRadius } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";

interface InstancedNodesProps {
  nodes: GraphNode[];
  neighborMap: Map<string, Set<string>>;
}

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

const EMISSIVE_BOOST = 1.6;
const GLOW_SCALE = 3.0; // Glow halo radius multiplier
const GLOW_OPACITY = 0.15; // Base glow opacity

export function InstancedNodes({ nodes, neighborMap }: InstancedNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const setHoveredNode = useGraphState((s) => s.setHoveredNode);
  const setFocusedNode = useGraphState((s) => s.setFocusedNode);

  const nodeIndexMap = useMemo(() => {
    const map = new Map<number, string>();
    nodes.forEach((n, i) => map.set(i, n.id));
    return map;
  }, [nodes]);

  const radii = useMemo(
    () => nodes.map((n) => getNodeRadius(n.connection_count)),
    [nodes],
  );

  const baseColors = useMemo(
    () =>
      nodes.map((n) => {
        const c = new THREE.Color(getCategoryColor(n.category));
        c.multiplyScalar(EMISSIVE_BOOST);
        return c;
      }),
    [nodes],
  );

  const glowColors = useMemo(
    () => nodes.map((n) => new THREE.Color(getGlowColor(n.category))),
    [nodes],
  );

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
        const nodeId = nodeIndexMap.get(instanceId) ?? null;
        setHoveredNode(nodeId);
        document.body.style.cursor = "pointer";
      }
    },
    [nodeIndexMap, setHoveredNode],
  );

  const handlePointerOut = useCallback(() => {
    pointerOutTimer.current = setTimeout(() => {
      setHoveredNode(null);
      document.body.style.cursor = "default";
    }, 50);
  }, [setHoveredNode]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const instanceId = e.instanceId;
      if (instanceId !== undefined) {
        const nodeId = nodeIndexMap.get(instanceId) ?? null;
        setFocusedNode(nodeId);
      }
    },
    [nodeIndexMap, setFocusedNode],
  );

  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    const glow = glowRef.current;
    if (!mesh) return;
    const time = clock.getElapsedTime();

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const baseRadius = radii[i];

      const pulse =
        1 + 0.05 * Math.sin(time * ((2 * Math.PI) / 3) + i * 0.7);
      const scale = baseRadius * pulse;

      // Core node
      tempObject.position.set(node.x, node.y, node.z);
      tempObject.scale.set(scale, scale, scale);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);

      // Glow halo — larger, same position
      if (glow) {
        const glowScale = scale * GLOW_SCALE;
        tempObject.scale.set(glowScale, glowScale, glowScale);
        tempObject.updateMatrix();
        glow.setMatrixAt(i, tempObject.matrix);
      }

      // Focus dimming
      if (focusNeighbors) {
        const isFocused = node.id === focusedNodeId;
        const isNeighbor = focusNeighbors.has(node.id);
        const opacity = isFocused || isNeighbor ? 1.0 : 0.1;
        tempColor.copy(baseColors[i]).multiplyScalar(opacity);
        mesh.setColorAt(i, tempColor);

        if (glow) {
          const glowOpacity = isFocused || isNeighbor ? GLOW_OPACITY : 0.02;
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

  return (
    <>
      {/* Glow halo layer — rendered first (behind), additive blending */}
      <instancedMesh
        ref={glowRef}
        args={[undefined, undefined, nodes.length]}
        raycast={() => null}
      >
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          toneMapped={false}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={1}
        />
      </instancedMesh>

      {/* Core node layer */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, nodes.length]}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}
```

- [ ] **Step 2: Visual verification**

Run: `cd ~/Desktop/brain-explorer && pnpm dev`
Open http://localhost:3000. Verify:
1. Every node has a soft glow halo around it
2. Purple nodes glow distinctly — not flat/matte
3. All 8 category colors produce visible, distinct halos
4. Focus dimming still works — unfocused nodes and their halos dim
5. No performance regression (should still be 60fps — only 2 draw calls total)

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/brain-explorer
git add src/components/InstancedNodes.tsx
git commit -m "feat(nodes): add additive glow halo layer for all categories"
```

---

### Task 5: Starfield + Fog Atmosphere

**Files:**
- Create: `~/Desktop/brain-explorer/src/components/Starfield.tsx`
- Modify: `~/Desktop/brain-explorer/src/components/GraphCanvas.tsx`

- [ ] **Step 1: Create Starfield component**

Write `~/Desktop/brain-explorer/src/components/Starfield.tsx`:

```typescript
"use client";

import { useMemo } from "react";
import * as THREE from "three";

const STAR_COUNT = 2000;
const MIN_RADIUS = 200;
const MAX_RADIUS = 500;

export function Starfield() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Random point in spherical shell [MIN_RADIUS, MAX_RADIUS]
      const r =
        MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#ffffff"
        size={0.5}
        transparent
        opacity={0.3}
        sizeAttenuation={false}
        depthWrite={false}
      />
    </points>
  );
}
```

- [ ] **Step 2: Add Starfield and fog to GraphCanvas**

Replace the full contents of `~/Desktop/brain-explorer/src/components/GraphCanvas.tsx`:

```typescript
"use client";

import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { Starfield } from "@/components/Starfield";

interface GraphCanvasProps {
  children: React.ReactNode;
  onPointerMissed?: () => void;
}

export function GraphCanvas({ children, onPointerMissed }: GraphCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 120], fov: 60, near: 0.1, far: 1000 }}
      style={{ position: "absolute", inset: 0 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor("#050510");
        scene.fog = new THREE.FogExp2("#050510", 0.003);
      }}
      onPointerMissed={onPointerMissed}
    >
      <ambientLight intensity={0.15} />
      <pointLight position={[50, 50, 50]} intensity={0.5} />

      <Starfield />
      {children}

      <EffectComposer>
        <Bloom
          intensity={1.8}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.3}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  );
}
```

- [ ] **Step 3: Visual verification**

Run: `cd ~/Desktop/brain-explorer && pnpm dev`
Open http://localhost:3000. Verify:
1. Faint white stars visible in the background (especially when rotating)
2. Far nodes fade slightly into the dark background (fog effect)
3. Near nodes are unaffected by fog
4. Stars don't interfere with node interaction
5. Stars don't bloom (they're below the luminance threshold at 0.3 opacity)

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/brain-explorer
git add src/components/Starfield.tsx src/components/GraphCanvas.tsx
git commit -m "feat(atmosphere): add starfield background and exponential fog"
```

---

### Task 6: Edge Styling — Category-Tinted Lines + Animated Particles

Now that Task 1 has populated links in graph.json, restyle edges with category-tinted colors and add animated particle dots flowing along them.

**Files:**
- Modify: `~/Desktop/brain-explorer/src/components/Edges.tsx`

- [ ] **Step 1: Rewrite Edges with category tinting and particles**

Replace the full contents of `~/Desktop/brain-explorer/src/components/Edges.tsx`:

```typescript
"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GraphNode, GraphLink } from "@/lib/types";
import { getCategoryColor } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";

interface EdgesProps {
  nodes: GraphNode[];
  links: GraphLink[];
}

const DEFAULT_ALPHA = 0.5;
const FOCUS_ALPHA = 0.8;
const DIMMED_ALPHA = 0.05;
const PARTICLE_COUNT_PER_EDGE = 1;
const PARTICLE_SPEED = 0.4; // fraction of edge per second

export function Edges({ nodes, links }: EdgesProps) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const particleRef = useRef<THREE.Points>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  // Build edge geometry with category-tinted colors
  const { geometry, linkSourceTargets, edgeColors } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (links.length === 0)
      return { geometry: geo, linkSourceTargets: [], edgeColors: [] };

    const positions: number[] = [];
    const colors: number[] = [];
    const sourceTargets: Array<{ source: string; target: string }> = [];
    const edgeColorList: THREE.Color[] = [];

    for (const link of links) {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) continue;

      positions.push(source.x, source.y, source.z);
      positions.push(target.x, target.y, target.z);

      // Tint from source node category at reduced opacity
      const color = new THREE.Color(getCategoryColor(source.category));
      edgeColorList.push(color);

      colors.push(color.r, color.g, color.b, DEFAULT_ALPHA);
      colors.push(color.r, color.g, color.b, DEFAULT_ALPHA);

      sourceTargets.push({ source: link.source, target: link.target });
    }

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
  }, [links, nodes, nodeMap]);

  // Build particle geometry — one dot per edge, staggered start
  const { particleGeometry, particleProgress } = useMemo(() => {
    const count = linkSourceTargets.length * PARTICLE_COUNT_PER_EDGE;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const progress = new Float32Array(count);

    for (let i = 0; i < linkSourceTargets.length; i++) {
      // Stagger start: each particle starts at a random offset
      progress[i] = Math.random();

      // Initial color matches edge
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

  // Mutate edge colors on focus change
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

  // Animate particles along edges
  useFrame((_, delta) => {
    if (!particleRef.current || linkSourceTargets.length === 0) return;

    const posAttr = particleGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;

    for (let i = 0; i < linkSourceTargets.length; i++) {
      const { source, target } = linkSourceTargets[i];
      const sNode = nodeMap.get(source);
      const tNode = nodeMap.get(target);
      if (!sNode || !tNode) continue;

      // Advance progress
      particleProgress[i] = (particleProgress[i] + delta * PARTICLE_SPEED) % 1;
      const t = particleProgress[i];

      // Lerp position
      posAttr.setXYZ(
        i,
        sNode.x + (tNode.x - sNode.x) * t,
        sNode.y + (tNode.y - sNode.y) * t,
        sNode.z + (tNode.z - sNode.z) * t,
      );
    }

    posAttr.needsUpdate = true;
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

- [ ] **Step 2: Visual verification**

Run: `cd ~/Desktop/brain-explorer && pnpm dev`
Open http://localhost:3000. Verify:
1. Edges are visible and tinted with the source node's category color
2. Small bright dots flow along each edge from source to target
3. Particles loop continuously with staggered timing
4. Focus dimming: focused node's edges bright, others nearly invisible
5. Particles still flow on focused edges (bright), barely visible on dimmed edges

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/brain-explorer
git add src/components/Edges.tsx
git commit -m "feat(edges): category-tinted lines with animated particles"
```

---

### Task 7: Tooltip Redesign

**Files:**
- Modify: `~/Desktop/brain-explorer/src/components/Tooltip.tsx`
- Modify: `~/Desktop/brain-explorer/src/app/globals.css`

- [ ] **Step 1: Add fade-in keyframe to globals.css**

Add to `~/Desktop/brain-explorer/src/app/globals.css` (before the closing of the file):

```css
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 150ms ease-out;
}
```

- [ ] **Step 2: Rewrite Tooltip component**

Replace the full contents of `~/Desktop/brain-explorer/src/components/Tooltip.tsx`:

```typescript
"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import type { GraphNode } from "@/lib/types";
import { getCategoryColor } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";

interface TooltipProps {
  nodes: GraphNode[];
  neighborMap: Map<string, Set<string>>;
}

export function Tooltip({ nodes, neighborMap }: TooltipProps) {
  const hoveredNodeId = useGraphState((s) => s.hoveredNodeId);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  if (focusedNodeId || !hoveredNodeId) return null;

  const node = nodeMap.get(hoveredNodeId);
  if (!node) return null;

  const color = getCategoryColor(node.category);
  const connectionCount = neighborMap.get(node.id)?.size ?? node.connection_count;

  return (
    <Html
      position={[node.x, node.y + 2, node.z]}
      center
      style={{ pointerEvents: "none" }}
    >
      <div className="glass rounded-lg px-3 py-2.5 max-w-[260px] shadow-xl animate-fade-in">
        {/* Title */}
        <p className="truncate text-sm font-semibold text-slate-200 leading-tight">
          {node.title}
        </p>

        {/* Category pill + connection badge */}
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white/90"
            style={{ backgroundColor: color }}
          >
            {node.category}
          </span>
          {connectionCount > 0 && (
            <span className="text-[10px] text-slate-500">
              {connectionCount} connection{connectionCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Tags */}
        {node.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {node.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Html>
  );
}
```

- [ ] **Step 3: Update Tooltip usage in GraphView to pass neighborMap**

In `~/Desktop/brain-explorer/src/components/GraphView.tsx`, find:

```tsx
<Tooltip nodes={nodes} />
```

Replace with:

```tsx
<Tooltip nodes={nodes} neighborMap={neighborMap} />
```

- [ ] **Step 4: Visual verification**

Run: `cd ~/Desktop/brain-explorer && pnpm dev`
Open http://localhost:3000. Hover over nodes. Verify:
1. White/slate text on glass background — clearly readable
2. Title in semibold at top
3. Category shown as colored pill (not just a dot)
4. Connection count displayed when > 0
5. Tags as spaced pills with subtle borders, max 3
6. Smooth fade-in animation (150ms)
7. Tooltip hidden when a node is focused (article panel open)

- [ ] **Step 5: Commit**

```bash
cd ~/Desktop/brain-explorer
git add src/components/Tooltip.tsx src/components/GraphView.tsx src/app/globals.css
git commit -m "feat(tooltip): redesign with category pills, connection badge, fade-in"
```

---

### Task 8: Article Panel Redesign

**Files:**
- Modify: `~/Desktop/brain-explorer/src/components/ArticlePanel.tsx`
- Modify: `~/Desktop/brain-explorer/src/app/globals.css`

- [ ] **Step 1: Add spring slide-in keyframe to globals.css**

Replace the existing `slide-in` keyframe and class in `~/Desktop/brain-explorer/src/app/globals.css`:

Find:
```css
@keyframes slide-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
```

Replace with:
```css
@keyframes slide-in {
  0% {
    transform: translateX(100%);
    opacity: 0;
  }
  60% {
    transform: translateX(-3%);
    opacity: 1;
  }
  80% {
    transform: translateX(1%);
  }
  100% {
    transform: translateX(0);
  }
}

.animate-slide-in {
  animation: slide-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

- [ ] **Step 2: Rewrite ArticlePanel**

Replace the full contents of `~/Desktop/brain-explorer/src/components/ArticlePanel.tsx`:

```typescript
"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { remarkWikilinks } from "@/lib/wikilink-plugin";
import type { GraphNode } from "@/lib/types";
import { getCategoryColor } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";

interface ArticlePanelProps {
  nodes: GraphNode[];
  neighborMap: Map<string, Set<string>>;
}

export function ArticlePanel({ nodes, neighborMap }: ArticlePanelProps) {
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const clearFocus = useGraphState((s) => s.clearFocus);
  const [articleContent, setArticleContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const focusedNode = focusedNodeId ? nodeMap.get(focusedNodeId) : null;

  useEffect(() => {
    if (!focusedNodeId) {
      setArticleContent(null);
      return;
    }
    setLoading(true);
    fetch(`http://localhost:3577/wiki/${focusedNodeId}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.text();
      })
      .then((text) => {
        setArticleContent(text);
        setLoading(false);
      })
      .catch(() => {
        setArticleContent(null);
        setLoading(false);
      });
  }, [focusedNodeId]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("wikilink")) {
      const slug = target.dataset.slug;
      if (slug)
        window.dispatchEvent(new CustomEvent("brain:focus", { detail: slug }));
    }
  }, []);

  if (!focusedNode) return null;

  const color = getCategoryColor(focusedNode.category);
  const connectionCount =
    neighborMap.get(focusedNode.id)?.size ?? focusedNode.connection_count;

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] z-40 animate-slide-in">
      <div className="h-full glass rounded-l-2xl flex flex-col overflow-hidden">
        {/* Close button */}
        <button
          onClick={clearFocus}
          className="absolute top-3 right-3 z-50 flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Close panel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1 1L13 13M13 1L1 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
          {/* Category pill */}
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium text-white/90 uppercase tracking-wider"
            style={{ backgroundColor: color }}
          >
            {focusedNode.category}
          </span>

          {/* Title */}
          <h2 className="mt-2 text-white text-lg font-semibold leading-tight">
            {focusedNode.title}
          </h2>

          {/* Date */}
          <p className="mt-1 text-[11px] text-slate-500">
            {new Date(focusedNode.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>

          {/* Tags — horizontal scroll */}
          {focusedNode.tags.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {focusedNode.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex-shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4"
          onClick={handleClick}
        >
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-3/4 rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-white/5 animate-pulse" />
            </div>
          ) : articleContent ? (
            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-200 prose-p:text-slate-400 prose-a:text-cyan-400 prose-strong:text-slate-300 prose-code:text-cyan-300">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks, remarkWikilinks]}
              >
                {articleContent}
              </ReactMarkdown>
            </div>
          ) : (
            /* Metadata card fallback — the deployed version shows this */
            <div className="space-y-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
                  Node Details
                </h3>
                <dl className="space-y-2.5">
                  <div className="flex justify-between">
                    <dt className="text-xs text-slate-500">Category</dt>
                    <dd className="text-xs text-slate-300">
                      {focusedNode.category}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-xs text-slate-500">Source</dt>
                    <dd className="text-xs text-slate-300">
                      {focusedNode.source_type}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-xs text-slate-500">Connections</dt>
                    <dd className="text-xs text-slate-300">
                      {connectionCount}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-xs text-slate-500">Created</dt>
                    <dd className="text-xs text-slate-300">
                      {new Date(focusedNode.created_at).toLocaleDateString(
                        "en-US",
                        { year: "numeric", month: "short", day: "numeric" },
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Tags card */}
              {focusedNode.tags.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {focusedNode.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update ArticlePanel usage in GraphView to pass neighborMap**

In `~/Desktop/brain-explorer/src/components/GraphView.tsx`, find:

```tsx
<ArticlePanel nodes={nodes} />
```

Replace with:

```tsx
<ArticlePanel nodes={nodes} neighborMap={neighborMap} />
```

- [ ] **Step 4: Add scrollbar-hide utility to globals.css**

Add to `~/Desktop/brain-explorer/src/app/globals.css`:

```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 5: Visual verification**

Run: `cd ~/Desktop/brain-explorer && pnpm dev`
Open http://localhost:3000. Click a node. Verify:
1. Panel slides in with spring bounce (slight overshoot)
2. Close button (X) visible top-right, works
3. Category shown as colored pill
4. Title white, 18px semibold
5. Date in slate-500
6. Tags scroll horizontally
7. When daemon offline: metadata card with category, source, connections, created date — NOT "Article preview unavailable"
8. Wikilinks (if content available): cyan underline, clicking navigates to that node

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/brain-explorer
git add src/components/ArticlePanel.tsx src/components/GraphView.tsx src/app/globals.css
git commit -m "feat(panel): redesign article panel with metadata fallback, close button, spring animation"
```

---

### Task 9: Build Verification + Existing Tests

**Files:**
- No new files — just verification

- [ ] **Step 1: Run existing test suite**

Run: `cd ~/Desktop/brain-explorer && pnpm test`
Expected: All 24 tests pass. If any fail due to new imports (getGlowColor), fix the failing test.

- [ ] **Step 2: Run production build**

Run: `cd ~/Desktop/brain-explorer && pnpm build`
Expected: Build succeeds. Watch for:
- TypeScript errors (missing props on Tooltip/ArticlePanel)
- Import errors (Starfield, getGlowColor)
- Three.js SSR issues (all components are `"use client"`)

- [ ] **Step 3: Fix any build issues**

If build fails, fix the specific error. Common issues:
- If `THREE.FogExp2` causes SSR issues, it's set in `onCreated` callback (client-only), so it should be fine.
- If Starfield import fails, check the path matches `@/components/Starfield`.

- [ ] **Step 4: Run dev server and full visual verification**

Run: `cd ~/Desktop/brain-explorer && pnpm dev`

Full checklist:
1. Scene auto-rotates on load
2. Grabbing orbit stops rotation, resumes after 3s
3. All node categories have distinct glow halos
4. Purple nodes glow clearly (not flat)
5. Stars visible in background
6. Far nodes fade slightly (fog)
7. Edges visible with category tinting (if links populated)
8. Particles flow along edges
9. Tooltip: white text, category pill, tags, connection count, fade-in
10. Article panel: spring slide-in, close button, metadata card fallback
11. Command palette still works
12. URL deep-linking still works
13. Esc to clear focus still works

- [ ] **Step 5: Commit any remaining fixes**

```bash
cd ~/Desktop/brain-explorer
git add -A
git commit -m "fix: resolve build issues from visual revamp"
```

(Only if there were fixes needed. Skip if build was clean.)

---

### Task 10: Push to Main

**Files:**
- No files — just git operations

- [ ] **Step 1: Final check**

Run: `cd ~/Desktop/brain-explorer && pnpm test && pnpm build`
Both must pass.

- [ ] **Step 2: Push**

Run: `cd ~/Desktop/brain-explorer && git push origin main`

Vercel auto-deploys from main. Check https://brain.rahilsinghi.com after deploy completes (~1-2 min).
