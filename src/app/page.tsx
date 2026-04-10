"use client";

import { GraphCanvas } from "@/components/GraphCanvas";
import { InstancedNodes } from "@/components/InstancedNodes";
import { Edges } from "@/components/Edges";
import { useGraphData } from "@/hooks/useGraphData";

export default function Home() {
  const { nodes, links, neighborMap, loading, error } = useGraphData();

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
      <GraphCanvas>
        <Edges nodes={nodes} links={links} />
        <InstancedNodes nodes={nodes} neighborMap={neighborMap} />
      </GraphCanvas>
    </main>
  );
}
