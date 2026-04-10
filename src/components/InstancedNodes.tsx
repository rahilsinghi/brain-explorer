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
    if (!meshRef.current) return;
    const mesh = meshRef.current;
    const glow = glowRef.current;
    const time = clock.getElapsedTime();

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const baseRadius = radii[i];

      const pulse =
        1 + 0.05 * Math.sin(time * ((2 * Math.PI) / 3) + i * 0.7);
      const scale = baseRadius * pulse;

      tempObject.position.set(node.x, node.y, node.z);
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
        onClick={handleClick}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </>
  );
}
