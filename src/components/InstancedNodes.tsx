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

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

const GLOW_SCALE = 2.5;
const GLOW_OPACITY = 0.08;

// Create a soft radial gradient texture for glow sprites
function createGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.5)");
  gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.1)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

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

  // Maps instanceId (number) → nodeId (string) for hover/click
  const instanceToNodeId = useMemo(() => {
    const map = new Map<number, string>();
    nodes.forEach((n, i) => map.set(i, n.id));
    return map;
  }, [nodes]);

  const radii = useMemo(
    () => nodes.map((n) => getNodeRadius(n.connection_count)),
    [nodes],
  );

  const EMISSIVE_BOOST = 1.6;
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

  // Soft radial gradient texture for glow sprites
  const glowTexture = useMemo(() => createGlowTexture(), []);

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

  return (
    <>
      {/* Glow layer: billboard planes with soft radial gradient */}
      <instancedMesh
        ref={glowRef}
        args={[undefined, undefined, nodes.length]}
        raycast={() => null}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={glowTexture}
          toneMapped={false}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
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
    </>
  );
}
