import type { GraphNode } from "./types";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function computeSpherePositions(
  nodes: GraphNode[],
  radius: number,
): {
  positions: Float32Array;
  nodeIndexMap: Map<string, number>;
} {
  if (nodes.length === 0) {
    return { positions: new Float32Array(0), nodeIndexMap: new Map() };
  }

  const sorted = [...nodes].sort((a, b) => a.category.localeCompare(b.category));

  const N = sorted.length;
  const positions = new Float32Array(N * 3);
  const nodeIndexMap = new Map<string, number>();

  for (let i = 0; i < N; i++) {
    const node = sorted[i];
    nodeIndexMap.set(node.id, i);

    if (N === 1) {
      positions[0] = 0;
      positions[1] = radius;
      positions[2] = 0;
      continue;
    }

    const y = 1 - (2 * i) / (N - 1);
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = GOLDEN_ANGLE * i;

    positions[i * 3] = Math.cos(theta) * radiusAtY * radius;
    positions[i * 3 + 1] = y * radius;
    positions[i * 3 + 2] = Math.sin(theta) * radiusAtY * radius;
  }

  return { positions, nodeIndexMap };
}
