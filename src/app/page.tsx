"use client";

import dynamic from "next/dynamic";

const GraphView = dynamic(
  () => import("@/components/GraphView").then((m) => m.GraphView),
  {
    ssr: false,
    loading: () => (
      <main className="h-screen w-screen flex items-center justify-center">
        <p className="text-slate-500 text-sm animate-pulse">
          Loading graph...
        </p>
      </main>
    ),
  },
);

export default function Home() {
  return <GraphView />;
}
