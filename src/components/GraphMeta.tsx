"use client";

import { useMemo } from "react";

interface GraphMetaProps {
  nodeCount: number;
  generatedAt: string;
}

export function GraphMeta({ nodeCount, generatedAt }: GraphMetaProps) {
  const timeAgo = useMemo(() => {
    if (!generatedAt) return "";
    const ms = Date.now() - new Date(generatedAt).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, [generatedAt]);

  return (
    <div className="fixed bottom-4 left-4 z-30 opacity-20 hover:opacity-60 transition-opacity">
      <div className="text-[11px] text-slate-500 space-y-0.5">
        <div>{nodeCount} nodes</div>
        {timeAgo && <div>Updated {timeAgo}</div>}
      </div>
    </div>
  );
}
