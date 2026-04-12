"use client";

import { useRef, useMemo } from "react";
import type { GraphNode } from "@/lib/types";
import { computeSpherePositions } from "@/lib/sphere-layout";

const SPHERE_RADIUS = 35;

export function useSphereLayout(nodes: GraphNode[]) {
  const positionsRef = useRef<Float32Array>(new Float32Array(0));
  const restPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const nodeIndexMapRef = useRef<Map<string, number>>(new Map());

  // R3F shared buffers must be set synchronously during render for useFrame consumers.
  // useEffect is too late — children read refs in the same render pass.
  /* eslint-disable react-hooks/refs */
  useMemo(() => {
    if (nodes.length === 0) return;

    const { positions, nodeIndexMap } = computeSpherePositions(nodes, SPHERE_RADIUS);

    restPositionsRef.current = positions;
    positionsRef.current = new Float32Array(positions);
    nodeIndexMapRef.current = nodeIndexMap;
  }, [nodes]);
  /* eslint-enable react-hooks/refs */

  return {
    positionsRef,
    restPositionsRef,
    nodeIndexMap: nodeIndexMapRef,
  };
}
