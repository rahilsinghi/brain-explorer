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

const GLOW_SCALE = 3.0;
const GLOW_OPACITY = 0.15;

export function InstancedNodes({ nodes, neighborMap }: InstancedNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const setHoveredNode = useGraphState((s) => s.setHoveredNode);
  const setFocusedNode = useGraphState((s) => s.setFocusedNode);

  // Build node index map for raycasting
  const nodeIndexMap = useMemo(() => {
    const map = new Map<number, string>();
    nodes.forEach((n, i) => map.set(i, n.id));
    return map;
  }, [nodes]);

  // Precompute base radii
  const radii = useMemo(
    () => nodes.map((n) => getNodeRadius(n.connection_count)),
    [nodes],
  );

  // Precompute base colors as THREE.Color instances, boosted for bloom
  // Multiply by 1.6 so all channels exceed bloom luminanceThreshold (0.6)
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

  // Precompute glow colors for additive blending layer
  const glowColors = useMemo(
    () => nodes.map((n) => new THREE.Color(getGlowColor(n.category))),
    [nodes],
  );

  // Neighbor set for focused node
  const focusNeighbors = useMemo(() => {
    if (!focusedNodeId) return null;
    return neighborMap.get(focusedNodeId) ?? new Set<string>();
  }, [focusedNodeId, neighborMap]);

  // Debounce pointer out by 50ms to prevent cursor flicker in dense clusters
  const pointerOutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      // Clear any pending pointer-out debounce
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

      // Pulse: +/-5%, 3s period, offset per node
      const pulse =
        1 + 0.05 * Math.sin(time * ((2 * Math.PI) / 3) + i * 0.7);
      const scale = baseRadius * pulse;

      tempObject.position.set(node.x, node.y, node.z);
      tempObject.scale.set(scale, scale, scale);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);

      // Glow mesh: same position, scaled up by GLOW_SCALE
      if (glow) {
        const glowScale = scale * GLOW_SCALE;
        tempObject.scale.set(glowScale, glowScale, glowScale);
        tempObject.updateMatrix();
        glow.setMatrixAt(i, tempObject.matrix);
        // Reset position for reuse (already set above, just restate for clarity)
        tempObject.position.set(node.x, node.y, node.z);
      }

      // Focus dimming — core mesh
      if (focusNeighbors) {
        const isFocused = node.id === focusedNodeId;
        const isNeighbor = focusNeighbors.has(node.id);
        const opacity = isFocused || isNeighbor ? 1.0 : 0.1;
        tempColor.copy(baseColors[i]).multiplyScalar(opacity);
        mesh.setColorAt(i, tempColor);

        // Glow mesh: full opacity for focused/neighbors, very dim otherwise
        if (glow) {
          const glowOpacity =
            isFocused || isNeighbor ? GLOW_OPACITY : 0.02;
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
