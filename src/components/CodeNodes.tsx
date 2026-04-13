"use client";

import { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { MeshTransmissionMaterial } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { GraphNode, DragState } from "@/lib/types";
import { getCodeNodeColor, getNodeRadius } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";

interface CodeNodesProps {
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

export function CodeNodes({
  nodes,
  neighborMap,
  positionsRef,
  nodeIndexMap,
  onNodePointerDown,
  dragState,
  draggedIndex,
}: CodeNodesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const setHoveredNode = useGraphState((s) => s.setHoveredNode);

  // Filter to only code nodes
  const codeNodes = useMemo(
    () => nodes.filter((n) => n.layer === "code"),
    [nodes],
  );

  // Map from local instance index -> global nodeIndexMap index
  const { localToGlobal, instanceToNodeId } = useMemo(() => {
    const l2g = new Map<number, number>();
    const i2n = new Map<number, string>();
    const globalMap = nodeIndexMap.current;
    codeNodes.forEach((node, localIdx) => {
      const globalIdx = globalMap.get(node.id);
      if (globalIdx !== undefined) {
        l2g.set(localIdx, globalIdx);
        i2n.set(localIdx, node.id);
      }
    });
    return { localToGlobal: l2g, instanceToNodeId: i2n };
  }, [codeNodes, nodeIndexMap]);

  const radii = useMemo(() => {
    return codeNodes.map((n) => getNodeRadius(n.connection_count));
  }, [codeNodes]);

  const baseColors = useMemo(() => {
    return codeNodes.map((n) => new THREE.Color(getCodeNodeColor(n.community)));
  }, [codeNodes]);

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

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const localId = e.instanceId;
      if (localId !== undefined) {
        const globalId = localToGlobal.get(localId);
        if (globalId !== undefined) {
          e.instanceId = globalId;
          onNodePointerDown?.(e);
        }
      }
    },
    [localToGlobal, onNodePointerDown],
  );

  useFrame(({ clock }) => {
    if (!meshRef.current || codeNodes.length === 0) return;
    const mesh = meshRef.current;
    const time = clock.getElapsedTime();
    const positions = positionsRef.current;

    for (let localIdx = 0; localIdx < codeNodes.length; localIdx++) {
      const globalIdx = localToGlobal.get(localIdx);
      if (globalIdx === undefined) continue;

      const baseRadius = radii[localIdx] ?? 0.5;
      const pulse =
        1 +
        0.03 * Math.sin(time * ((2 * Math.PI) / 4) + localIdx * 0.5);
      let scale = baseRadius * pulse;

      if (
        dragState?.current === "DRAGGING" &&
        globalIdx === draggedIndex?.current
      ) {
        scale *= 1.3;
      }

      const offset = globalIdx * 3;
      tempObject.position.set(
        positions[offset],
        positions[offset + 1],
        positions[offset + 2],
      );
      tempObject.scale.set(scale, scale, scale);
      tempObject.rotation.set(0, time * 0.3 + localIdx * 0.2, 0);
      tempObject.updateMatrix();
      mesh.setMatrixAt(localIdx, tempObject.matrix);

      const nodeId = instanceToNodeId.get(localIdx);
      const isGodNode = codeNodes[localIdx]?.is_god_node;

      if (focusNeighbors && nodeId) {
        const isFocused = nodeId === focusedNodeId;
        const isNeighbor = focusNeighbors.has(nodeId);
        let opacity: number;
        if (isGodNode) {
          opacity = isFocused || isNeighbor ? 1.0 : 0.3;
        } else {
          opacity = isFocused || isNeighbor ? 1.0 : 0.1;
        }
        tempColor.copy(baseColors[localIdx]).multiplyScalar(opacity);
      } else {
        if (isGodNode) {
          tempColor.copy(baseColors[localIdx]).multiplyScalar(0.3);
        } else {
          tempColor.copy(baseColors[localIdx]);
        }
      }
      mesh.setColorAt(localIdx, tempColor);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  if (codeNodes.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, codeNodes.length]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    >
      <boxGeometry args={[1, 1, 1]} />
      <MeshTransmissionMaterial
        samples={1}
        resolution={256}
        transmission={1}
        roughness={0.15}
        ior={1.5}
        thickness={0.5}
        chromaticAberration={0.04}
        anisotropy={0.1}
        distortion={0}
        distortionScale={0}
        toneMapped={false}
        depthWrite={false}
        color="#00FF41"
      />
    </instancedMesh>
  );
}
