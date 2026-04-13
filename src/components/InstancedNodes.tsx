"use client";

import { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { GraphNode, DragState } from "@/lib/types";
import { getCategoryColor, getNodeRadius } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";

interface InstancedNodesProps {
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

export function InstancedNodes({
  nodes,
  neighborMap,
  positionsRef,
  nodeIndexMap,
  onNodePointerDown,
  dragState,
  draggedIndex,
}: InstancedNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const setHoveredNode = useGraphState((s) => s.setHoveredNode);

  // R3F shared buffer pattern: nodeIndexMap is a ref populated in the same render pass.
  // Manual deps include `nodes` to recompute when graph data changes.
  /* eslint-disable react-hooks/exhaustive-deps */
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
  /* eslint-enable react-hooks/exhaustive-deps */

  const radii = useMemo(() => {
    return nodes.map((n) => getNodeRadius(n.connection_count));
  }, [nodes]);

  const baseColors = useMemo(() => {
    return nodes.map((n) => new THREE.Color(getCategoryColor(n.category)));
  }, [nodes]);

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

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const localId = e.instanceId;
      if (localId !== undefined) {
        const globalId = localToGlobal.get(localId);
        if (globalId !== undefined) {
          // Mutate instanceId to global index on the original event.
          // Spreading ThreeEvent loses stopPropagation/nativeEvent bindings,
          // causing clicks to bubble to OrbitControls (camera jump bug).
          e.instanceId = globalId;
          onNodePointerDown?.(e);
        }
      }
    },
    [localToGlobal, onNodePointerDown],
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

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, nodes.length]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    >
      <sphereGeometry args={[1, 32, 32]} />
      <MeshTransmissionMaterial
        samples={1}
        resolution={256}
        transmission={1}
        roughness={0.1}
        ior={1.5}
        thickness={0.5}
        chromaticAberration={0.02}
        anisotropy={0.1}
        distortion={0}
        distortionScale={0}
        toneMapped={false}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
