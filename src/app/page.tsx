"use client";

import { useEffect } from "react";
import { GraphCanvas } from "@/components/GraphCanvas";
import { InstancedNodes } from "@/components/InstancedNodes";
import { Edges } from "@/components/Edges";
import { CameraController } from "@/components/CameraController";
import { Tooltip } from "@/components/Tooltip";
import { useGraphData } from "@/hooks/useGraphData";
import { useGraphState } from "@/hooks/useGraphState";

export default function Home() {
  const { nodes, links, neighborMap, loading, error } = useGraphData();
  const clearFocus = useGraphState((s) => s.clearFocus);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearFocus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearFocus]);

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
        <Edges nodes={nodes} links={links} />
        <InstancedNodes nodes={nodes} neighborMap={neighborMap} />
        <CameraController nodes={nodes} />
        <Tooltip nodes={nodes} />
      </GraphCanvas>
    </main>
  );
}
