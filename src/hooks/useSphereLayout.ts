"use client";

import { useRef, useMemo } from "react";
import type { GraphNode } from "@/lib/types";
import { computeSpherePositions } from "@/lib/sphere-layout";

const SPHERE_RADIUS = 35;
const GOD_NODE_SCALE = 3.0; // push god nodes 3x farther from center

export function useSphereLayout(nodes: GraphNode[]) {
  const positionsRef = useRef<Float32Array>(new Float32Array(0));
  const restPositionsRef = useRef<Float32Array>(new Float32Array(0));
  const nodeIndexMapRef = useRef<Map<string, number>>(new Map());

  /* eslint-disable react-hooks/refs */
  useMemo(() => {
    if (nodes.length === 0) return;

    const { positions, nodeIndexMap } = computeSpherePositions(nodes, SPHERE_RADIUS);

    // Apply god-node offset: push god nodes outward from sphere center
    for (const node of nodes) {
      if (!node.is_god_node) continue;
      const idx = nodeIndexMap.get(node.id);
      if (idx === undefined) continue;
      const off = idx * 3;
      positions[off] *= GOD_NODE_SCALE;
      positions[off + 1] *= GOD_NODE_SCALE;
      positions[off + 2] *= GOD_NODE_SCALE;
    }

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
