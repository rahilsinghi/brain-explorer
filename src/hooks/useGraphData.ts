"use client";

import { useEffect, useState } from "react";
import type { GraphCache, GraphNode, GraphLink } from "@/lib/types";
import { buildNeighborMap } from "@/lib/graph-data";

interface GraphDataResult {
  nodes: GraphNode[];
  links: GraphLink[];
  neighborMap: Map<string, Set<string>>;
  generatedAt: string;
  loading: boolean;
  error: string | null;
}

export function useGraphData(): GraphDataResult {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [neighborMap, setNeighborMap] = useState<Map<string, Set<string>>>(
    new Map(),
  );
  const [generatedAt, setGeneratedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/graph.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: GraphCache = await res.json();

        setNodes(data.nodes);
        setLinks(data.links);
        setNeighborMap(buildNeighborMap(data.links));
        setGeneratedAt(data.generated_at);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load graph");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { nodes, links, neighborMap, generatedAt, loading, error };
}
