"use client";

import type { GraphNode, GraphLink } from "@/lib/types";
import { useSimulation } from "@/hooks/useSimulation";
import { useDrag } from "@/hooks/useDrag";
import { InstancedNodes } from "@/components/InstancedNodes";
import { Edges } from "@/components/Edges";

interface SimulationConsumerProps {
  nodes: GraphNode[];
  links: GraphLink[];
  neighborMap: Map<string, Set<string>>;
}

export function SimulationConsumer({ nodes, links, neighborMap }: SimulationConsumerProps) {
  const {
    positionsRef,
    simNodesRef,
    nodeIndexMap,
    simulationRef,
    simulationActive,
    tick,
    reheat,
    pin,
    unpin,
    restoreDecay,
  } = useSimulation(nodes, links);

  const { onPointerDown, dragState, draggedIndex } = useDrag({
    simulationRef,
    simNodesRef,
    positionsRef,
    nodeIndexMap,
    reheat,
    pin,
    unpin,
    restoreDecay,
  });

  if (nodes.length === 0) return null;

  return (
    <>
      <Edges
        nodes={nodes}
        links={links}
        positionsRef={positionsRef}
        nodeIndexMap={nodeIndexMap}
        simulationActive={simulationActive}
      />
      <InstancedNodes
        nodes={nodes}
        neighborMap={neighborMap}
        positionsRef={positionsRef}
        simulationRef={simulationRef}
        simNodesRef={simNodesRef}
        simulationActive={simulationActive}
        tick={tick}
        restoreDecay={restoreDecay}
        dragState={dragState}
        draggedIndex={draggedIndex}
        onNodePointerDown={onPointerDown}
      />
    </>
  );
}
