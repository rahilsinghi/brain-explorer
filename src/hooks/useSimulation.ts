"use client";

import { useRef, useEffect, useCallback } from "react";
import type { Simulation } from "d3-force-3d";
import type { GraphNode, GraphLink, SimNode } from "@/lib/types";
import { ALPHA_MIN } from "@/lib/types";
import { createForceSimulation, syncPositions } from "@/lib/force-simulation";

interface UseSimulationReturn {
  positionsRef: React.MutableRefObject<Float32Array>;
  simNodesRef: React.MutableRefObject<SimNode[]>;
  nodeIndexMap: React.MutableRefObject<Map<string, number>>;
  simulationRef: React.MutableRefObject<Simulation<SimNode>>;
  simulationActive: React.MutableRefObject<boolean>;
  tick: () => void;
  reheat: (alpha?: number) => void;
  pin: (index: number, x: number, y: number, z: number) => void;
  unpin: (index: number) => void;
  restoreDecay: () => void;
}

export function useSimulation(
  nodes: GraphNode[],
  links: GraphLink[],
): UseSimulationReturn {
  const positionsRef = useRef<Float32Array>(new Float32Array(0));
  const simNodesRef = useRef<SimNode[]>([]);
  const nodeIndexMapRef = useRef<Map<string, number>>(new Map());
  const simulationRef = useRef<Simulation<SimNode>>(null!);
  const simulationActive = useRef(true);

  useEffect(() => {
    if (nodes.length === 0) return;

    const { simulation, simNodes, positionsRef: positions, nodeIndexMap } =
      createForceSimulation(nodes, links);

    simulationRef.current = simulation;
    simNodesRef.current = simNodes;
    positionsRef.current = positions;
    nodeIndexMapRef.current = nodeIndexMap;
    simulationActive.current = true;

    return () => {
      simulation.stop();
    };
  }, [nodes, links]);

  const tick = useCallback(() => {
    if (!simulationRef.current || !simulationActive.current) return;

    simulationRef.current.tick();
    syncPositions(simNodesRef.current, positionsRef.current);

    if (simulationRef.current.alpha() < ALPHA_MIN) {
      simulationActive.current = false;
    }
  }, []);

  const reheat = useCallback((alpha = 0.15) => {
    if (!simulationRef.current) return;
    simulationRef.current.alpha(alpha);
    simulationActive.current = true;
  }, []);

  const pin = useCallback((index: number, x: number, y: number, z: number) => {
    const node = simNodesRef.current[index];
    if (!node) return;
    node.fx = x;
    node.fy = y;
    node.fz = z;
  }, []);

  const unpin = useCallback((index: number) => {
    const node = simNodesRef.current[index];
    if (!node) return;
    node.fx = null;
    node.fy = null;
    node.fz = null;
  }, []);

  const restoreDecay = useCallback(() => {
    if (!simulationRef.current) return;
    simulationRef.current.alphaDecay(0.02);
  }, []);

  return {
    positionsRef,
    simNodesRef,
    nodeIndexMap: nodeIndexMapRef,
    simulationRef,
    simulationActive,
    tick,
    reheat,
    pin,
    unpin,
    restoreDecay,
  };
}
