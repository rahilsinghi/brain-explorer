"use client";

import { useMemo } from "react";
import * as THREE from "three";

const STAR_COUNT = 2000;
const MIN_RADIUS = 200;
const MAX_RADIUS = 500;

export function Starfield() {
  const geometry = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      const r = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial
        color="#ffffff"
        size={0.5}
        transparent
        opacity={0.3}
        sizeAttenuation={false}
        depthWrite={false}
      />
    </points>
  );
}
