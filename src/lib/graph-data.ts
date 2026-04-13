import type { GraphNode, GraphLink, LayerMode } from "./types";

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

export function filterByLayer(
  nodes: GraphNode[],
  links: GraphLink[],
  layer: LayerMode,
  drillInNodeIds: Set<string>,
): { nodes: GraphNode[]; links: GraphLink[] } {
  let filteredNodes: GraphNode[];

  if (layer === "combined") {
    filteredNodes = nodes;
  } else if (layer === "code") {
    filteredNodes = nodes.filter((n) => n.layer === "code");
  } else {
    // wiki mode: wiki nodes (or legacy nodes without layer) + drill-in code nodes
    filteredNodes = nodes.filter(
      (n) => n.layer !== "code" || drillInNodeIds.has(n.id),
    );
  }

  const visibleIds = new Set(filteredNodes.map((n) => n.id));
  const filteredLinks = links.filter(
    (l) => visibleIds.has(l.source) && visibleIds.has(l.target),
  );

  return { nodes: filteredNodes, links: filteredLinks };
}

export function filterByNeighborhood(
  nodes: GraphNode[],
  links: GraphLink[],
  focus: string,
  depth: number,
): { nodes: GraphNode[]; links: GraphLink[] } {
  let seedIds: Set<string>;

  if (focus.startsWith("project:")) {
    const projectName = focus.slice("project:".length);
    seedIds = new Set(
      nodes.filter((n) => n.repo === projectName).map((n) => n.id),
    );
  } else {
    seedIds = new Set(nodes.filter((n) => n.id === focus).map((n) => n.id));
  }

  if (seedIds.size === 0) return { nodes, links };

  const neighborMap = buildNeighborMap(links);
  const visited = new Set<string>(seedIds);
  let frontier = new Set<string>(seedIds);

  for (let d = 0; d < depth; d++) {
    const nextFrontier = new Set<string>();
    for (const nodeId of frontier) {
      const neighbors = neighborMap.get(nodeId);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          nextFrontier.add(neighbor);
        }
      }
    }
    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  const filteredNodes = nodes.filter((n) => visited.has(n.id));
  const filteredLinks = links.filter(
    (l) => visited.has(l.source) && visited.has(l.target),
  );

  return { nodes: filteredNodes, links: filteredLinks };
}
