"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";
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
import { lastFocusClickTime } from "@/hooks/useDrag";
import { useDrillIn } from "@/hooks/useDrillIn";
import { SphereConsumer } from "@/components/SphereConsumer";
import { readLayerParam, readFocusParam, readDepthParam, updateUrlParams } from "@/lib/url-params";
import { filterByNeighborhood, buildNeighborMap } from "@/lib/graph-data";

export function GraphView() {
  const { nodes, links, allNodes, generatedAt, loading, error, hasCodeNodes } =
    useGraphData();
  const clearFocus = useGraphState((s) => s.clearFocus);
  const setFocusedNode = useGraphState((s) => s.setFocusedNode);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const prevFocusRef = useRef<string | null>(null);
  const setActiveLayer = useGraphState((s) => s.setActiveLayer);
  const { drillIn, exitDrillIn } = useDrillIn(allNodes);

  // Track previous focus to detect click-then-miss race condition.
  // pointerup sets focus, then click fires onPointerMissed in the same tick.
  // If focus changed between our last render and onPointerMissed, a node
  // was just clicked — don't clear it.
  useEffect(() => {
    prevFocusRef.current = focusedNodeId;
  }, [focusedNodeId]);

  const handlePointerMissed = useCallback(() => {
    // useDrag sets focus on pointerup; R3F fires onPointerMissed on click
    // (same event loop, ~0-2ms apart). Suppress if focus was just set.
    if (performance.now() - lastFocusClickTime < 100) return;
    clearFocus();
  }, [clearFocus]);

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

  // Deep-link: read ?focus= on initial load only (not on subsequent node changes)
  const initialFocusRead = useRef(false);
  useEffect(() => {
    if (initialFocusRead.current) return;
    if (nodes.length === 0) return;
    initialFocusRead.current = true;
    const focusParam = readFocusParam();
    if (focusParam) {
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

  const { displayNodes, displayLinks } = useMemo(() => {
    const focusParam = readFocusParam();
    if (focusParam && focusParam.startsWith("project:")) {
      const depth = readDepthParam();
      const neighborhood = filterByNeighborhood(nodes, links, focusParam, depth);
      return { displayNodes: neighborhood.nodes, displayLinks: neighborhood.links };
    }
    return { displayNodes: nodes, displayLinks: links };
  }, [nodes, links]);

  const displayNeighborMap = useMemo(
    () => buildNeighborMap(displayLinks),
    [displayLinks],
  );

  const wikiCount = useMemo(
    () => displayNodes.filter((n) => n.layer !== "code").length,
    [displayNodes],
  );
  const codeCount = useMemo(
    () => displayNodes.filter((n) => n.layer === "code").length,
    [displayNodes],
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
      <GraphCanvas onPointerMissed={handlePointerMissed}>
        <SphereConsumer nodes={displayNodes} links={displayLinks} neighborMap={displayNeighborMap} />
        <CameraController nodes={displayNodes} />
        <Tooltip nodes={displayNodes} neighborMap={displayNeighborMap} />
      </GraphCanvas>

      {hasCodeNodes && <LayerToggle />}
      <CommandPalette nodes={displayNodes} />
      <ArticlePanel
        nodes={displayNodes}
        neighborMap={displayNeighborMap}
        allNodes={allNodes}
        onDrillIn={drillIn}
        onExitDrillIn={exitDrillIn}
      />
      <GraphMeta
        nodeCount={displayNodes.length}
        generatedAt={generatedAt}
        wikiCount={wikiCount}
        codeCount={codeCount}
      />
      <AdminRefresh />
    </main>
  );
}
