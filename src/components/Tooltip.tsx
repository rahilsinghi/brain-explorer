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
  const connectionCount =
    neighborMap.get(node.id)?.size ?? node.connection_count;

  return (
    <Html
      position={[node.x, node.y + 2, node.z]}
      center
      style={{ pointerEvents: "none" }}
    >
      <div
        className="animate-fade-in"
        style={{
          background: "rgba(15, 15, 30, 0.6)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          padding: "10px 14px",
          maxWidth: "280px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        {/* Title */}
        <p
          style={{
            color: "#e8eaf0",
            fontSize: "13px",
            fontWeight: 600,
            lineHeight: 1.3,
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.title}
        </p>

        {/* Category pill + connection count */}
        <div
          style={{
            marginTop: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              display: "inline-block",
              background: `${color}28`,
              color: color,
              border: `1px solid ${color}55`,
              borderRadius: "9999px",
              padding: "2px 8px",
              fontSize: "10px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {node.category}
          </span>
          {connectionCount > 0 && (
            <span style={{ fontSize: "10px", color: "#6b7280" }}>
              {connectionCount} connection
              {connectionCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Tags */}
        {node.tags.length > 0 && (
          <div
            style={{
              marginTop: "8px",
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
            }}
          >
            {node.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "#9ca3af",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontSize: "10px",
                }}
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
