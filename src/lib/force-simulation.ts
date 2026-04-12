import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from "d3-force-3d";
import type { Simulation } from "d3-force-3d";
import type { GraphNode, GraphLink, SimNode } from "./types";

export function createForceSimulation(
  nodes: GraphNode[],
  links: GraphLink[],
): {
  simulation: Simulation<SimNode>;
  simNodes: SimNode[];
  positionsRef: Float32Array;
  nodeIndexMap: Map<string, number>;
} {
  const simNodes: SimNode[] = nodes.map((n) => ({
    id: n.id,
    title: n.title,
    tags: n.tags,
    category: n.category,
    source_type: n.source_type,
    created_at: n.created_at,
    connection_count: n.connection_count,
    x: n.x,
    y: n.y,
    z: n.z,
    vx: 0,
    vy: 0,
    vz: 0,
    fx: null,
    fy: null,
    fz: null,
  }));

  const simulation = forceSimulation(simNodes, 3)
    .force(
      "link",
      forceLink<SimNode, GraphLink>(links)
        .id((d: SimNode) => d.id)
        .strength(0.3)
        .distance(15),
    )
    .force("charge", forceManyBody<SimNode>().strength(-30))
    .force("center", forceCenter<SimNode>(0, 0, 0).strength(0.01))
    .force("collide", forceCollide<SimNode>(2.0))
    .alphaDecay(0.02)
    .velocityDecay(0.4);

  // Critical: stop d3's internal RAF timer immediately.
  // We tick manually in useFrame to avoid double-ticking and jitter.
  simulation.stop();

  const positionsRef = new Float32Array(nodes.length * 3);
  syncPositions(simNodes, positionsRef);

  const nodeIndexMap = new Map<string, number>();
  for (let i = 0; i < simNodes.length; i++) {
    nodeIndexMap.set(simNodes[i].id, i);
  }

  return { simulation, simNodes, positionsRef, nodeIndexMap };
}

export function syncPositions(
  simNodes: Array<{ x: number; y: number; z: number }>,
  positions: Float32Array,
): void {
  for (let i = 0; i < simNodes.length; i++) {
    const offset = i * 3;
    positions[offset] = simNodes[i].x;
    positions[offset + 1] = simNodes[i].y;
    positions[offset + 2] = simNodes[i].z;
  }
}
