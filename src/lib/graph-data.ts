import type { GraphNode, GraphLink, GraphCache } from "./types";

export async function fetchGraphData(): Promise<GraphCache> {
  const res = await fetch("/graph.json");
  if (!res.ok) throw new Error(`Failed to fetch graph: ${res.status}`);
  return res.json();
}

export function normalizePositions(
  nodes: GraphNode[],
  targetRadius: number,
): GraphNode[] {
  if (nodes.length === 0) return [];

  let cx = 0,
    cy = 0,
    cz = 0;
  for (const n of nodes) {
    cx += n.x;
    cy += n.y;
    cz += n.z;
  }
  cx /= nodes.length;
  cy /= nodes.length;
  cz /= nodes.length;

  const centered = nodes.map((n) => ({
    ...n,
    x: n.x - cx,
    y: n.y - cy,
    z: n.z - cz,
  }));

  let maxDist = 0;
  for (const n of centered) {
    const d = Math.sqrt(n.x ** 2 + n.y ** 2 + n.z ** 2);
    if (d > maxDist) maxDist = d;
  }
  if (maxDist === 0) return centered;

  const scale = targetRadius / maxDist;
  return centered.map((n) => ({
    ...n,
    x: n.x * scale,
    y: n.y * scale,
    z: n.z * scale,
  }));
}

export function buildNeighborMap(
  links: GraphLink[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const link of links) {
    if (!map.has(link.source)) map.set(link.source, new Set());
    if (!map.has(link.target)) map.set(link.target, new Set());
    map.get(link.source)!.add(link.target);
    map.get(link.target)!.add(link.source);
  }
  return map;
}
