"use client";

import { useRef, useMemo } from "react";
import type { GraphNode } from "@/lib/types";
import { computeSpherePositions } from "@/lib/sphere-layout";

const SPHERE_RADIUS = 35;

export function useSphereLayout(nodes: GraphNode[]) {
  const positionsRef = useRef<Float32Array>(new Float32Array(0));
  const restPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const nodeIndexMapRef = useRef<Map<string, number>>(new Map());

  useMemo(() => {
    if (nodes.length === 0) return;

    const { positions, nodeIndexMap } = computeSpherePositions(nodes, SPHERE_RADIUS);

    restPositionsRef.current = positions;
    positionsRef.current = new Float32Array(positions);
    nodeIndexMapRef.current = nodeIndexMap;
  }, [nodes]);

  return {
    positionsRef,
    restPositionsRef,
    nodeIndexMap: nodeIndexMapRef,
  };
}
