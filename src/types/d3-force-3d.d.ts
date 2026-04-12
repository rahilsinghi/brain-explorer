declare module "d3-force-3d" {
  export interface SimulationNode {
    index?: number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
  }

  export interface Force<NodeDatum extends SimulationNode> {
    (alpha: number): void;
  }

  export interface Simulation<NodeDatum extends SimulationNode> {
    tick(): void;
    stop(): Simulation<NodeDatum>;
    restart(): Simulation<NodeDatum>;
    force(name: string): Force<NodeDatum> | undefined;
    force(name: string, force: Force<NodeDatum> | null): Simulation<NodeDatum>;
    velocityDecay(decay: number): Simulation<NodeDatum>;
    nodes(): NodeDatum[];
    nodes(nodes: NodeDatum[]): Simulation<NodeDatum>;
    alpha(): number;
    alpha(alpha: number): Simulation<NodeDatum>;
    alphaDecay(): number;
    alphaDecay(decay: number): Simulation<NodeDatum>;
    alphaMin(): number;
    alphaMin(min: number): Simulation<NodeDatum>;
  }

  export function forceSimulation<NodeDatum extends SimulationNode>(
    nodes?: NodeDatum[],
    numDimensions?: number,
  ): Simulation<NodeDatum>;

  export function forceLink<
    NodeDatum extends SimulationNode,
    LinkDatum extends { source: string; target: string },
  >(
    links?: LinkDatum[],
  ): Force<NodeDatum> & {
    id(fn: (node: NodeDatum) => string): ReturnType<typeof forceLink>;
    strength(s: number): ReturnType<typeof forceLink>;
    distance(d: number): ReturnType<typeof forceLink>;
  };

  export function forceManyBody<
    NodeDatum extends SimulationNode,
  >(): Force<NodeDatum> & {
    strength(s: number): ReturnType<typeof forceManyBody>;
  };

  export function forceCenter<NodeDatum extends SimulationNode>(
    x?: number,
    y?: number,
    z?: number,
  ): Force<NodeDatum> & {
    strength(s: number): ReturnType<typeof forceCenter>;
  };

  export function forceCollide<NodeDatum extends SimulationNode>(
    radius?: number | ((node: NodeDatum) => number),
  ): Force<NodeDatum> & {
    iterations(iterations: number): ReturnType<typeof forceCollide>;
  };
}
