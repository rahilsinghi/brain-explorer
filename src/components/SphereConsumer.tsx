"use client";

import { useMemo } from "react";
import type { GraphNode, GraphLink } from "@/lib/types";
import { useSphereLayout } from "@/hooks/useSphereLayout";
import { useDrag } from "@/hooks/useDrag";
import { InstancedNodes } from "@/components/InstancedNodes";
import { CodeNodes } from "@/components/CodeNodes";
import { Edges } from "@/components/Edges";

interface SphereConsumerProps {
  nodes: GraphNode[];
  links: GraphLink[];
  neighborMap: Map<string, Set<string>>;
}

export function SphereConsumer({ nodes, links, neighborMap }: SphereConsumerProps) {
  const { positionsRef, restPositionsRef, nodeIndexMap } = useSphereLayout(nodes);
  const { onPointerDown, dragState, draggedIndex } = useDrag({
    positionsRef,
    restPositionsRef,
    nodeIndexMap,
  });

  const wikiNodes = useMemo(
    () => nodes.filter((n) => n.layer !== "code"),
    [nodes],
  );

  const hasCodeNodes = useMemo(
    () => nodes.some((n) => n.layer === "code"),
    [nodes],
  );

  if (nodes.length === 0) return null;

  return (
    <>
      <Edges
        nodes={nodes}
        links={links}
        positionsRef={positionsRef}
        nodeIndexMap={nodeIndexMap}
      />
      <InstancedNodes
        nodes={wikiNodes}
        neighborMap={neighborMap}
        positionsRef={positionsRef}
        nodeIndexMap={nodeIndexMap}
        onNodePointerDown={onPointerDown}
        dragState={dragState}
        draggedIndex={draggedIndex}
      />
      {hasCodeNodes && (
        <CodeNodes
          nodes={nodes}
          neighborMap={neighborMap}
          positionsRef={positionsRef}
          nodeIndexMap={nodeIndexMap}
          onNodePointerDown={onPointerDown}
          dragState={dragState}
          draggedIndex={draggedIndex}
        />
      )}
    </>
  );
}
