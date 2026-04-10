"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import type { GraphNode } from "@/lib/types";
import { getCategoryColor } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";

interface TooltipProps {
  nodes: GraphNode[];
}

export function Tooltip({ nodes }: TooltipProps) {
  const hoveredNodeId = useGraphState((s) => s.hoveredNodeId);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  if (focusedNodeId || !hoveredNodeId) return null;

  const node = nodeMap.get(hoveredNodeId);
  if (!node) return null;

  const color = getCategoryColor(node.category);

  return (
    <Html
      position={[node.x, node.y + 2, node.z]}
      center
      style={{ pointerEvents: "none" }}
    >
      <div className="glass rounded-lg px-3 py-2 max-w-[240px] shadow-xl">
        <div className="mb-1 flex items-center gap-2">
          <div
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="truncate text-sm font-medium text-white">
            {node.title}
          </span>
        </div>
        {node.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {node.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Html>
  );
}
