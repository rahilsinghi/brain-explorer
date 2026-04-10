"use client";

import { GraphCanvas } from "@/components/GraphCanvas";
import { useGraphData } from "@/hooks/useGraphData";

export default function Home() {
  const { nodes, loading, error } = useGraphData();

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
        <mesh>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial
            color="#8b5cf6"
            emissive="#8b5cf6"
            emissiveIntensity={2}
          />
        </mesh>
      </GraphCanvas>
    </main>
  );
}
