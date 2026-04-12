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
  positionsRef: React.MutableRefObject<Float32Array>;
  nodeIndexMap: React.MutableRefObject<Map<string, number>>;
}

const tempObject = new THREE.Object3D();
const tempColor = new THREE.Color();

export function InstancedNodes({
  nodes,
  neighborMap,
  positionsRef,
  nodeIndexMap,
}: InstancedNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const setHoveredNode = useGraphState((s) => s.setHoveredNode);

  const instanceToNodeId = useMemo(() => {
    const map = new Map<number, string>();
    const idxMap = nodeIndexMap.current;
    for (const [nodeId, idx] of idxMap) {
      map.set(idx, nodeId);
    }
    return map;
  }, [nodeIndexMap, nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const radii = useMemo(() => {
    const idxMap = nodeIndexMap.current;
    const r = new Array<number>(nodes.length);
    for (const node of nodes) {
      const idx = idxMap.get(node.id);
      if (idx !== undefined) r[idx] = getNodeRadius(node.connection_count);
    }
    return r;
  }, [nodes, nodeIndexMap]);

  const baseColors = useMemo(() => {
    const idxMap = nodeIndexMap.current;
    const colors = new Array<THREE.Color>(nodes.length);
    for (const node of nodes) {
      const idx = idxMap.get(node.id);
      if (idx !== undefined) colors[idx] = new THREE.Color(getCategoryColor(node.category));
    }
    return colors;
  }, [nodes, nodeIndexMap]);

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
    const time = clock.getElapsedTime();
    const positions = positionsRef.current;
    const count = positions.length / 3;

    for (let i = 0; i < count; i++) {
      const baseRadius = radii[i] ?? 0.5;
      const pulse = 1 + 0.05 * Math.sin(time * ((2 * Math.PI) / 3) + i * 0.7);
      const scale = baseRadius * pulse;

      const offset = i * 3;
      tempObject.position.set(positions[offset], positions[offset + 1], positions[offset + 2]);
      tempObject.scale.set(scale, scale, scale);
      tempObject.updateMatrix();
      mesh.setMatrixAt(i, tempObject.matrix);

      const nodeId = instanceToNodeId.get(i);
      if (focusNeighbors && nodeId) {
        const isFocused = nodeId === focusedNodeId;
        const isNeighbor = focusNeighbors.has(nodeId);
        const opacity = isFocused || isNeighbor ? 1.0 : 0.1;
        tempColor.copy(baseColors[i]).multiplyScalar(opacity);
      } else {
        tempColor.copy(baseColors[i]);
      }
      mesh.setColorAt(i, tempColor);
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
    >
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
