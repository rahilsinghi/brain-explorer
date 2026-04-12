"use client";

import { useRef, useCallback, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Simulation } from "d3-force-3d";
import type { SimNode, DragState } from "@/lib/types";
import { useGraphState } from "@/hooks/useGraphState";

const DRAG_THRESHOLD_PX = 5;
const POSITION_CLAMP = 80;

interface UseDragParams {
  simulationRef: React.MutableRefObject<Simulation<SimNode>>;
  simNodesRef: React.MutableRefObject<SimNode[]>;
  positionsRef: React.MutableRefObject<Float32Array>;
  nodeIndexMap: React.MutableRefObject<Map<string, number>>;
  reheat: (alpha?: number) => void;
  pin: (index: number, x: number, y: number, z: number) => void;
  unpin: (index: number) => void;
  restoreDecay: () => void;
}

interface UseDragReturn {
  onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  dragState: React.MutableRefObject<DragState>;
  draggedIndex: React.MutableRefObject<number | null>;
}

export function useDrag({
  simulationRef,
  simNodesRef,
  positionsRef,
  nodeIndexMap,
  reheat,
  pin,
  unpin,
  restoreDecay,
}: UseDragParams): UseDragReturn {
  const { camera, raycaster } = useThree();
  const dragState = useRef<DragState>("IDLE");
  const draggedIndex = useRef<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const thresholdCrossed = useRef(false);

  const plane = useRef(new THREE.Plane());
  const intersection = useRef(new THREE.Vector3());
  const normal = useRef(new THREE.Vector3());
  const nodePos = useRef(new THREE.Vector3());
  const ndc = useRef(new THREE.Vector2());

  const setFocusedNode = useGraphState((s) => s.setFocusedNode);
  const clearFocus = useGraphState((s) => s.clearFocus);
  const setIsDragging = useGraphState((s) => s.setIsDragging);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (draggedIndex.current === null) return;
      const idx = draggedIndex.current;

      // Check threshold before entering drag state
      if (!thresholdCrossed.current) {
        const dx = e.clientX - pointerStart.current.x;
        const dy = e.clientY - pointerStart.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD_PX) return;

        // Threshold crossed — enter DRAGGING state
        thresholdCrossed.current = true;
        dragState.current = "DRAGGING";

        const simNode = simNodesRef.current[idx];
        setIsDragging(true);
        setFocusedNode(simNode.id);
        reheat(0.15);
      }

      // Project pointer onto camera-perpendicular plane through the pinned node
      const positions = positionsRef.current;
      const offset = idx * 3;
      nodePos.current.set(
        positions[offset],
        positions[offset + 1],
        positions[offset + 2],
      );

      camera.getWorldDirection(normal.current);
      plane.current.setFromNormalAndCoplanarPoint(normal.current, nodePos.current);

      // Build ray from pointer position
      ndc.current.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1,
      );
      raycaster.setFromCamera(ndc.current, camera);

      if (raycaster.ray.intersectPlane(plane.current, intersection.current)) {
        const x = Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, intersection.current.x));
        const y = Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, intersection.current.y));
        const z = Math.max(-POSITION_CLAMP, Math.min(POSITION_CLAMP, intersection.current.z));
        pin(idx, x, y, z);
      }
    },
    [camera, raycaster, simNodesRef, positionsRef, pin, reheat, setFocusedNode, setIsDragging],
  );

  const handlePointerUp = useCallback(() => {
    window.removeEventListener("pointermove", handlePointerMove);

    const idx = draggedIndex.current;

    if (!thresholdCrossed.current && idx !== null) {
      // Pointer didn't cross threshold — treat as click (focus)
      const simNode = simNodesRef.current[idx];
      if (simNode) {
        setFocusedNode(simNode.id);
      }
      draggedIndex.current = null;
      dragState.current = "IDLE";
      return;
    }

    if (idx !== null) {
      unpin(idx);
      simulationRef.current.alphaDecay(0.05);
      dragState.current = "RELEASING";
    }

    draggedIndex.current = null;
    setIsDragging(false);
    clearFocus();
  }, [handlePointerMove, simNodesRef, unpin, simulationRef, setFocusedNode, setIsDragging, clearFocus]);

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

  // Cleanup window listeners on unmount to prevent leaks during mid-drag re-renders
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  return { onPointerDown, dragState, draggedIndex };
}
