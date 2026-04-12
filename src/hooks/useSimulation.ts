"use client";

import { useRef, useMemo, useEffect, useCallback } from "react";
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

  // Create simulation synchronously during render so refs are populated
  // BEFORE children (Edges, InstancedNodes) run their useMemos.
  // useEffect runs AFTER render — too late for children that read refs.
  const simData = useMemo(() => {
    if (nodes.length === 0) return null;
    return createForceSimulation(nodes, links);
  }, [nodes, links]);

  // Sync refs from useMemo result (runs during render, before children)
  if (simData) {
    simulationRef.current = simData.simulation;
    simNodesRef.current = simData.simNodes;
    positionsRef.current = simData.positionsRef;
    nodeIndexMapRef.current = simData.nodeIndexMap;
    simulationActive.current = true;
  }

  // Cleanup: stop simulation on unmount or when simData changes
  useEffect(() => {
    if (!simData) return;
    return () => {
      simData.simulation.stop();
    };
  }, [simData]);

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
