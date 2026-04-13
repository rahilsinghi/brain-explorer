"use client";

import { useCallback } from "react";
import type { GraphNode } from "@/lib/types";
import { useGraphState } from "@/hooks/useGraphState";

export function useDrillIn(allNodes: GraphNode[]) {
  const setDrillInRepo = useGraphState((s) => s.setDrillInRepo);
  const setDrillInNodeIds = useGraphState((s) => s.setDrillInNodeIds);

  const drillIn = useCallback(
    (repoName: string) => {
      const codeNodes = allNodes.filter(
        (n) => n.layer === "code" && n.repo === repoName,
      );

      if (codeNodes.length === 0) return;

      // Sort by centrality
      const sorted = [...codeNodes].sort(
        (a, b) => b.connection_count - a.connection_count,
      );

      // Top 20 animate in immediately
      const animated = sorted.slice(0, 20);
      const rest = sorted.slice(20);

      // Phase 1: show top 20
      const phase1Ids = new Set(animated.map((n) => n.id));
      setDrillInRepo(repoName);
      setDrillInNodeIds(phase1Ids);

      // Phase 2: fade in rest after 1.2s
      if (rest.length > 0) {
        setTimeout(() => {
          const allIds = new Set(codeNodes.map((n) => n.id));
          setDrillInNodeIds(allIds);
        }, 1200);
      }
    },
    [allNodes, setDrillInRepo, setDrillInNodeIds],
  );

  const exitDrillIn = useCallback(() => {
    setDrillInRepo(null);
    setDrillInNodeIds(new Set());
  }, [setDrillInRepo, setDrillInNodeIds]);

  return { drillIn, exitDrillIn };
}
