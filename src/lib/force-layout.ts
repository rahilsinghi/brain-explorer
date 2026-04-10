import { forceSimulation, forceCollide } from "d3-force-3d";
import type { GraphNode } from "./types";

interface SimNode {
  index: number;
  x: number;
  y: number;
  z: number;
}

export function applyCollisionLayout(
  nodes: GraphNode[],
  collideRadius: number,
): GraphNode[] {
  if (nodes.length === 0) return [];

  const simNodes: SimNode[] = nodes.map((n, i) => ({
    index: i,
    x: n.x,
    y: n.y,
    z: n.z,
  }));

  const simulation = forceSimulation(simNodes, 3)
    .force("collide", forceCollide(collideRadius).iterations(3))
    .velocityDecay(0.6)
    .stop();

  for (let i = 0; i < 50; i++) {
    simulation.tick();
  }

  return nodes.map((n, i) => ({
    ...n,
    x: simNodes[i].x,
    y: simNodes[i].y,
    z: simNodes[i].z,
  }));
}
