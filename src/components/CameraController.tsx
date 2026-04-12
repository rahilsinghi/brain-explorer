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

const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 0, 90);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
const AUTO_ROTATE_SPEED = 0.001;
const IDLE_RESUME_DELAY = 800;

export function CameraController({ nodes }: CameraControllerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const isDragging = useGraphState((s) => s.isDragging);
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

  const autoRotateRef = useRef<{ active: boolean; idleTimer: ReturnType<typeof setTimeout> | null }>({
    active: true,
    idleTimer: null,
  });

  const handleInteractionStart = useCallback(() => {
    autoRotateRef.current.active = false;
    if (autoRotateRef.current.idleTimer !== null) {
      clearTimeout(autoRotateRef.current.idleTimer);
      autoRotateRef.current.idleTimer = null;
    }
  }, []);

  const handleInteractionEnd = useCallback(() => {
    autoRotateRef.current.idleTimer = setTimeout(() => {
      autoRotateRef.current.active = true;
      autoRotateRef.current.idleTimer = null;
    }, IDLE_RESUME_DELAY);
  }, []);

  useEffect(() => {
    if (isDragging) return;
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
  }, [focusedNodeId, isDragging, nodeMap, camera, flyTo, resetTo]);

  useFrame((_, delta) => {
    const animating = update(delta, camera, controlsRef.current);
    if (controlsRef.current) {
      controlsRef.current.enabled = !animating && !isDragging;
    }

    const controls = controlsRef.current;
    if (autoRotateRef.current.active && !animating && !focusedNodeId && !isDragging && controls) {
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
      minDistance={20}
      maxDistance={150}
      makeDefault
      onStart={handleInteractionStart}
      onEnd={handleInteractionEnd}
    />
  );
}
