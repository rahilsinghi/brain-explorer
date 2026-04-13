"use client";

import { useEffect, useMemo } from "react";
import { GraphCanvas } from "@/components/GraphCanvas";
import { CameraController } from "@/components/CameraController";
import { Tooltip } from "@/components/Tooltip";
import { CommandPalette } from "@/components/CommandPalette";
import { ArticlePanel } from "@/components/ArticlePanel";
import { AdminRefresh } from "@/components/AdminRefresh";
import { GraphMeta } from "@/components/GraphMeta";
import { LayerToggle } from "@/components/LayerToggle";
import { useGraphData } from "@/hooks/useGraphData";
import { useGraphState } from "@/hooks/useGraphState";
import { useDrillIn } from "@/hooks/useDrillIn";
import { SphereConsumer } from "@/components/SphereConsumer";
import { readLayerParam, readFocusParam, updateUrlParams } from "@/lib/url-params";

export function GraphView() {
  const { nodes, links, allNodes, neighborMap, generatedAt, loading, error, hasCodeNodes } =
    useGraphData();
  const clearFocus = useGraphState((s) => s.clearFocus);
  const setFocusedNode = useGraphState((s) => s.setFocusedNode);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const setActiveLayer = useGraphState((s) => s.setActiveLayer);
  const { drillIn, exitDrillIn } = useDrillIn(allNodes);

  // Read ?layer= on mount and set initial layer
  useEffect(() => {
    const layerParam = readLayerParam();
    if (layerParam) {
      setActiveLayer(layerParam);
    } else if (hasCodeNodes) {
      setActiveLayer("combined");
    }
  }, [hasCodeNodes, setActiveLayer]);

  // Esc to clear focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearFocus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearFocus]);

  // Listen for wikilink CustomEvent from ArticlePanel
  useEffect(() => {
    const handler = (e: Event) => {
      const slug = (e as CustomEvent<string>).detail;
      if (slug) setFocusedNode(slug);
    };
    window.addEventListener("brain:focus", handler);
    return () => window.removeEventListener("brain:focus", handler);
  }, [setFocusedNode]);

  // Deep-link: read ?focus= on load (supports URI-encoded code:// IDs)
  useEffect(() => {
    const focusParam = readFocusParam();
    if (focusParam && nodes.length > 0) {
      const match = nodes.find((n) => n.id === focusParam);
      if (match) setFocusedNode(match.id);
    }
  }, [nodes, setFocusedNode]);

  // Deep-link: update URL on focus change
  useEffect(() => {
    updateUrlParams({
      focus: focusedNodeId,
    });
  }, [focusedNodeId]);

  const wikiCount = useMemo(
    () => nodes.filter((n) => n.layer !== "code").length,
    [nodes],
  );
  const codeCount = useMemo(
    () => nodes.filter((n) => n.layer === "code").length,
    [nodes],
  );

  if (loading) {
    return (
      <main className="h-screen w-screen flex items-center justify-center">
        <p className="text-slate-500 text-sm animate-pulse">
          Loading graph...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="h-screen w-screen flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen relative">
      <GraphCanvas onPointerMissed={clearFocus}>
        <SphereConsumer nodes={nodes} links={links} neighborMap={neighborMap} />
        <CameraController nodes={nodes} />
        <Tooltip nodes={nodes} neighborMap={neighborMap} />
      </GraphCanvas>

      {hasCodeNodes && <LayerToggle />}
      <CommandPalette nodes={nodes} />
      <ArticlePanel
        nodes={nodes}
        neighborMap={neighborMap}
        allNodes={allNodes}
        onDrillIn={drillIn}
        onExitDrillIn={exitDrillIn}
      />
      <GraphMeta
        nodeCount={nodes.length}
        generatedAt={generatedAt}
        wikiCount={wikiCount}
        codeCount={codeCount}
      />
      <AdminRefresh />
    </main>
  );
}
