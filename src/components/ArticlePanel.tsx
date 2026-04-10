"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { remarkWikilinks } from "@/lib/wikilink-plugin";
import type { GraphNode } from "@/lib/types";
import { getCategoryColor } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";

interface ArticlePanelProps {
  nodes: GraphNode[];
  neighborMap: Map<string, Set<string>>;
}

export function ArticlePanel({ nodes, neighborMap }: ArticlePanelProps) {
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
  const clearFocus = useGraphState((s) => s.clearFocus);
  const [articleContent, setArticleContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const focusedNode = focusedNodeId ? nodeMap.get(focusedNodeId) : null;

  useEffect(() => {
    if (!focusedNodeId) {
      setArticleContent(null);
      return;
    }
    setLoading(true);
    fetch(`http://localhost:3577/wiki/${focusedNodeId}`)
      .then((res) => {
        if (!res.ok) return null;
        return res.text();
      })
      .then((text) => {
        setArticleContent(text);
        setLoading(false);
      })
      .catch(() => {
        setArticleContent(null);
        setLoading(false);
      });
  }, [focusedNodeId]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains("wikilink")) {
      const slug = target.dataset.slug;
      if (slug)
        window.dispatchEvent(new CustomEvent("brain:focus", { detail: slug }));
    }
  }, []);

  if (!focusedNode) return null;

  const color = getCategoryColor(focusedNode.category);
  const connectionCount =
    neighborMap.get(focusedNode.id)?.size ?? focusedNode.connection_count;

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] z-40 animate-slide-in">
      <div
        className="h-full flex flex-col overflow-hidden rounded-l-2xl"
        style={{
          background: "#0c0c1d",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Close button */}
        <button
          onClick={clearFocus}
          className="absolute top-4 right-4 z-50 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          style={{ background: "rgba(255,255,255,0.06)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
          }}
          aria-label="Close panel"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M1 1L11 11M11 1L1 11"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Colored accent line at top */}
        <div
          className="h-[3px] w-full flex-shrink-0"
          style={{ background: color }}
        />

        {/* Header */}
        <div
          className="px-6 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Category pill */}
          <span
            className="inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest"
            style={{
              background: `${color}22`,
              color: color,
              border: `1px solid ${color}44`,
            }}
          >
            {focusedNode.category}
          </span>

          {/* Title */}
          <h2
            className="mt-3 text-[17px] font-bold leading-snug"
            style={{ color: "#e8eaf0" }}
          >
            {focusedNode.title}
          </h2>

          {/* Date */}
          <p className="mt-1.5 text-[11px]" style={{ color: "#6b7280" }}>
            {new Date(focusedNode.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>

          {/* Tags */}
          {focusedNode.tags.length > 0 && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {focusedNode.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex-shrink-0 rounded px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "#9ca3af",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5"
          onClick={handleClick}
        >
          {loading ? (
            <div className="space-y-3">
              <div
                className="h-4 w-3/4 rounded animate-pulse"
                style={{ background: "rgba(255,255,255,0.06)" }}
              />
              <div
                className="h-4 w-full rounded animate-pulse"
                style={{ background: "rgba(255,255,255,0.06)" }}
              />
              <div
                className="h-4 w-2/3 rounded animate-pulse"
                style={{ background: "rgba(255,255,255,0.06)" }}
              />
            </div>
          ) : articleContent ? (
            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-200 prose-p:text-slate-400 prose-a:text-cyan-400 prose-strong:text-slate-300 prose-code:text-cyan-300">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks, remarkWikilinks]}
              >
                {articleContent}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Node Details card */}
              <div
                className="rounded-lg p-4"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <h3
                  className="text-[10px] font-semibold uppercase tracking-widest mb-4"
                  style={{ color: "#6b7280" }}
                >
                  Node Details
                </h3>
                <dl className="space-y-3">
                  {[
                    ["Category", focusedNode.category],
                    ["Source", focusedNode.source_type],
                    ["Connections", String(connectionCount)],
                    [
                      "Created",
                      new Date(focusedNode.created_at).toLocaleDateString(
                        "en-US",
                        { year: "numeric", month: "short", day: "numeric" },
                      ),
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center">
                      <dt
                        className="text-[11px]"
                        style={{ color: "#6b7280" }}
                      >
                        {label}
                      </dt>
                      <dd
                        className="text-[11px] font-medium"
                        style={{ color: "#d1d5db" }}
                      >
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Tags card */}
              {focusedNode.tags.length > 0 && (
                <div
                  className="rounded-lg p-4"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <h3
                    className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                    style={{ color: "#6b7280" }}
                  >
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {focusedNode.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded px-2 py-0.5 text-[11px]"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          color: "#9ca3af",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
