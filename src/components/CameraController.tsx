"use client";

import { useRef, useEffect, useMemo } from "react";
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
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={200}
      makeDefault
    />
  );
}
