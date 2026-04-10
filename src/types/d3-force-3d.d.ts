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
    force(name: string, force?: Force<NodeDatum> | null): Simulation<NodeDatum>;
    velocityDecay(decay: number): Simulation<NodeDatum>;
    nodes(): NodeDatum[];
  }

  export function forceSimulation<NodeDatum extends SimulationNode>(
    nodes?: NodeDatum[],
    numDimensions?: number
  ): Simulation<NodeDatum>;

  export function forceCollide<NodeDatum extends SimulationNode>(
    radius?: number | ((node: NodeDatum) => number)
  ): Force<NodeDatum> & {
    iterations(iterations: number): ReturnType<typeof forceCollide>;
  };
}
