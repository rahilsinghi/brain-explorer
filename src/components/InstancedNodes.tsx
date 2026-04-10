"use client";

import { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { GraphNode } from "@/lib/types";
import { getCategoryColor, getNodeRadius } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";

interface InstancedNodesProps {
  nodes: GraphNode[];
  neighborMap: Map<string, Set<string>>;
}

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

export function InstancedNodes({ nodes, neighborMap }: InstancedNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
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

  // Precompute base colors as THREE.Color instances
  const baseColors = useMemo(
    () => nodes.map((n) => new THREE.Color(getCategoryColor(n.category))),
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

      // Focus dimming
      if (focusNeighbors) {
        const isFocused = node.id === focusedNodeId;
        const isNeighbor = focusNeighbors.has(node.id);
        const opacity = isFocused || isNeighbor ? 1.0 : 0.1;
        tempColor.copy(baseColors[i]).multiplyScalar(opacity);
        mesh.setColorAt(i, tempColor);
      } else {
        mesh.setColorAt(i, baseColors[i]);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial
        emissive="white"
        emissiveIntensity={1.5}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
