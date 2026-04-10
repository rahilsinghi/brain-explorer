"use client";

import { useRef, useCallback } from "react";
import * as THREE from "three";

interface CameraAnimationState {
  active: boolean;
  startPosition: THREE.Vector3;
  startTarget: THREE.Vector3;
  endPosition: THREE.Vector3;
  endTarget: THREE.Vector3;
  progress: number;
}

const ANIMATION_SPEED = 1.8;
const ARC_HEIGHT = 15;

export function useCameraAnimation() {
  const stateRef = useRef<CameraAnimationState>({
    active: false,
    startPosition: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endPosition: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    progress: 0,
  });

  const flyTo = useCallback(
    (
      targetPos: THREE.Vector3,
      currentCameraPos: THREE.Vector3,
      currentTarget: THREE.Vector3,
    ) => {
      const state = stateRef.current;
      state.active = true;
      state.startPosition.copy(currentCameraPos);
      state.startTarget.copy(currentTarget);
      const direction = new THREE.Vector3()
        .subVectors(currentCameraPos, targetPos)
        .normalize();
      state.endPosition.copy(targetPos).addScaledVector(direction, 25);
      state.endTarget.copy(targetPos);
      state.progress = 0;
    },
    [],
  );

  const resetTo = useCallback(
    (position: THREE.Vector3, target: THREE.Vector3) => {
      const state = stateRef.current;
      state.active = true;
      state.startPosition.copy(state.active ? state.endPosition : position);
      state.startTarget.copy(state.active ? state.endTarget : target);
      state.endPosition.copy(position);
      state.endTarget.copy(target);
      state.progress = 0;
    },
    [],
  );

  const update = useCallback(
    (
      delta: number,
      camera: THREE.Camera,
      controls: { target: THREE.Vector3 } | null,
    ): boolean => {
      const state = stateRef.current;
      if (!state.active) return false;

      state.progress = Math.min(state.progress + delta * ANIMATION_SPEED, 1);
      const t =
        state.progress < 0.5
          ? 4 * state.progress ** 3
          : 1 - (-2 * state.progress + 2) ** 3 / 2;

      // Arc relative to flight trajectory (not global Y) to avoid gimbal trap
      const arcT = Math.sin(t * Math.PI) * ARC_HEIGHT;
      const flightPath = new THREE.Vector3().subVectors(
        state.endPosition,
        state.startPosition,
      );
      const arcDirection = new THREE.Vector3()
        .crossVectors(flightPath, new THREE.Vector3(0, 1, 0))
        .normalize();
      if (arcDirection.lengthSq() < 0.001) arcDirection.set(1, 0, 0);

      camera.position.lerpVectors(state.startPosition, state.endPosition, t);
      camera.position.addScaledVector(arcDirection, arcT * (1 - t));

      if (controls) {
        controls.target.lerpVectors(state.startTarget, state.endTarget, t);
      }

      if (state.progress >= 1) {
        state.active = false;
      }

      return state.active;
    },
    [],
  );

  return { flyTo, resetTo, update, stateRef };
}
