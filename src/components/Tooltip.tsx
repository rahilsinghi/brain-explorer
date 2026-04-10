"use client";

import { useMemo } from "react";
import { Html } from "@react-three/drei";
import type { GraphNode } from "@/lib/types";
import { getCategoryColor } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";

interface TooltipProps {
  nodes: GraphNode[];
  neighborMap: Map<string, Set<string>>;
}

export function Tooltip({ nodes, neighborMap }: TooltipProps) {
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
  const connectionCount = neighborMap.get(node.id)?.size ?? node.connection_count;

  return (
    <Html
      position={[node.x, node.y + 2, node.z]}
      center
      style={{ pointerEvents: "none" }}
    >
      <div className="glass rounded-lg px-3 py-2.5 max-w-[260px] shadow-xl animate-fade-in">
        <p className="truncate text-sm font-semibold text-slate-200 leading-tight">
          {node.title}
        </p>

        <div className="mt-1.5 flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white/90"
            style={{ backgroundColor: color }}
          >
            {node.category}
          </span>
          {connectionCount > 0 && (
            <span className="text-[10px] text-slate-500">
              {connectionCount} connection{connectionCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {node.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {node.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400"
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
