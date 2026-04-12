"use client";

import { useRef, useCallback, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { DragState } from "@/lib/types";
import { stepSpring, isSpringSettled } from "@/lib/spring";
import { useGraphState } from "@/hooks/useGraphState";

const DRAG_THRESHOLD_PX = 5;
const POSITION_CLAMP = 80;
const SPRING_STIFFNESS = 180;
const SPRING_DAMPING = 0.85;

interface UseDragParams {
  positionsRef: React.MutableRefObject<Float32Array>;
  restPositionsRef: React.MutableRefObject<Float32Array>;
  nodeIndexMap: React.MutableRefObject<Map<string, number>>;
}

interface UseDragReturn {
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  dragState: React.MutableRefObject<DragState>;
  draggedIndex: React.MutableRefObject<number | null>;
}

export function useDrag({
  positionsRef,
  restPositionsRef,
  nodeIndexMap,
}: UseDragParams): UseDragReturn {
  const { camera, raycaster } = useThree();
  const dragState = useRef<DragState>("IDLE");
  const draggedIndex = useRef<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const thresholdCrossed = useRef(false);

  const springVelocity = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const snappingIndex = useRef<number | null>(null);

  const plane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());
  const normal = useRef(new THREE.Vector3());
  const nodePos = useRef(new THREE.Vector3());
  const ndc = useRef(new THREE.Vector2());

  const setFocusedNode = useGraphState((s) => s.setFocusedNode);
  const clearFocus = useGraphState((s) => s.clearFocus);
  const setIsDragging = useGraphState((s) => s.setIsDragging);

  const indexToNodeId = useRef<Map<number, string>>(new Map());
  useEffect(() => {
    const map = new Map<number, string>();
    for (const [id, idx] of nodeIndexMap.current) {
      map.set(idx, id);
    }
    indexToNodeId.current = map;
  }, [nodeIndexMap]);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (draggedIndex.current === null) return;
      const idx = draggedIndex.current;

      if (!thresholdCrossed.current) {
        const dx = e.clientX - pointerStart.current.x;
        const dy = e.clientY - pointerStart.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_PX) return;

        thresholdCrossed.current = true;
        dragState.current = "DRAGGING";
        const nodeId = indexToNodeId.current.get(idx);
        setIsDragging(true);
        if (nodeId) setFocusedNode(nodeId);
      }

      const positions = positionsRef.current;
      const offset = idx * 3;
      nodePos.current.set(positions[offset], positions[offset + 1], positions[offset + 2]);

      camera.getWorldDirection(normal.current);
      plane.current.setFromNormalAndCoplanarPoint(normal.current, nodePos.current);

      ndc.current.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
      raycaster.setFromCamera(ndc.current, camera);

      if (raycaster.ray.intersectPlane(plane.current, intersection.current)) {
        const x = Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, intersection.current.x));
        const y = Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, intersection.current.y));
        const z = Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, intersection.current.z));
        positions[offset] = x;
        positions[offset + 1] = y;
        positions[offset + 2] = z;
      }
    },
    [camera, raycaster, positionsRef, setFocusedNode, setIsDragging],
  );

  const handlePointerUp = useCallback(() => {
    window.removeEventListener("pointermove", handlePointerMove);

    const idx = draggedIndex.current;

    if (!thresholdCrossed.current && idx !== null) {
      const nodeId = indexToNodeId.current.get(idx);
      if (nodeId) setFocusedNode(nodeId);
      draggedIndex.current = null;
      dragState.current = "IDLE";
      return;
    }

    if (idx !== null) {
      snappingIndex.current = idx;
      springVelocity.current = { x: 0, y: 0, z: 0 };
      dragState.current = "SNAPPING";
    }

    draggedIndex.current = null;
    setIsDragging(false);
    clearFocus();
  }, [handlePointerMove, setFocusedNode, setIsDragging, clearFocus]);

  useFrame((_, delta) => {
    if (dragState.current !== "SNAPPING" || snappingIndex.current === null) return;

    const idx = snappingIndex.current;
    const offset = idx * 3;
    const positions = positionsRef.current;
    const rest = restPositionsRef.current;
    const vel = springVelocity.current;

    const dt = Math.min(delta, 0.05);

    const rx = stepSpring({ position: positions[offset], velocity: vel.x }, rest[offset], SPRING_STIFFNESS, SPRING_DAMPING, dt);
    const ry = stepSpring({ position: positions[offset + 1], velocity: vel.y }, rest[offset + 1], SPRING_STIFFNESS, SPRING_DAMPING, dt);
    const rz = stepSpring({ position: positions[offset + 2], velocity: vel.z }, rest[offset + 2], SPRING_STIFFNESS, SPRING_DAMPING, dt);

    positions[offset] = rx.position;
    positions[offset + 1] = ry.position;
    positions[offset + 2] = rz.position;
    vel.x = rx.velocity;
    vel.y = ry.velocity;
    vel.z = rz.velocity;

    const settled =
      isSpringSettled(rx.position - rest[offset], rx.velocity, 0) &&
      isSpringSettled(ry.position - rest[offset + 1], ry.velocity, 0) &&
      isSpringSettled(rz.position - rest[offset + 2], rz.velocity, 0);

    if (settled) {
      positions[offset] = rest[offset];
      positions[offset + 1] = rest[offset + 1];
      positions[offset + 2] = rest[offset + 2];
      snappingIndex.current = null;
      dragState.current = "IDLE";
    }
  });

  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (dragState.current !== "IDLE") return;
      const instanceId = event.instanceId;
      if (instanceId === undefined) return;

      event.stopPropagation();
      draggedIndex.current = instanceId;
      thresholdCrossed.current = false;
      pointerStart.current = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp, { once: true });
    },
    [handlePointerMove, handlePointerUp],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  return { onPointerDown, dragState, draggedIndex };
}
