"use client";

import { useEffect, useState, useMemo } from "react";
import type { GraphCache, GraphNode, GraphLink } from "@/lib/types";
import { buildNeighborMap, filterByLayer } from "@/lib/graph-data";
import { useGraphState } from "@/hooks/useGraphState";

interface GraphDataResult {
  nodes: GraphNode[];
  links: GraphLink[];
  allNodes: GraphNode[];
  neighborMap: Map<string, Set<string>>;
  generatedAt: string;
  loading: boolean;
  error: string | null;
  hasCodeNodes: boolean;
}

export function useGraphData(): GraphDataResult {
  const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
  const [allLinks, setAllLinks] = useState<GraphLink[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeLayer = useGraphState((s) => s.activeLayer);
  const drillInNodeIds = useGraphState((s) => s.drillInNodeIds);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/graph.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: GraphCache = await res.json();

        setAllNodes(data.nodes);
        setAllLinks(data.links);
        setGeneratedAt(data.generated_at);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load graph");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const hasCodeNodes = useMemo(
    () => allNodes.some((n) => n.layer === "code"),
    [allNodes],
  );

  const { nodes, links } = useMemo(
    () => filterByLayer(allNodes, allLinks, activeLayer, drillInNodeIds),
    [allNodes, allLinks, activeLayer, drillInNodeIds],
  );

  const neighborMap = useMemo(() => buildNeighborMap(links), [links]);

  return { nodes, links, allNodes, neighborMap, generatedAt, loading, error, hasCodeNodes };
}
