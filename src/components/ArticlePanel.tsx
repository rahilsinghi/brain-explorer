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
      <div className="h-full glass rounded-l-2xl flex flex-col overflow-hidden">
        {/* Close button */}
        <button
          onClick={clearFocus}
          className="absolute top-3 right-3 z-50 flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Close panel"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M1 1L13 13M13 1L1 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-white/10 flex-shrink-0">
          <span
            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium text-white/90 uppercase tracking-wider"
            style={{ backgroundColor: color }}
          >
            {focusedNode.category}
          </span>

          <h2 className="mt-2 text-white text-lg font-semibold leading-tight">
            {focusedNode.title}
          </h2>

          <p className="mt-1 text-[11px] text-slate-500">
            {new Date(focusedNode.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>

          {focusedNode.tags.length > 0 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {focusedNode.tags.map((tag) => (
                <span
                  key={tag}
                  className="flex-shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4"
          onClick={handleClick}
        >
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-3/4 rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-white/5 animate-pulse" />
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
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
                  Node Details
                </h3>
                <dl className="space-y-2.5">
                  <div className="flex justify-between">
                    <dt className="text-xs text-slate-500">Category</dt>
                    <dd className="text-xs text-slate-300">
                      {focusedNode.category}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-xs text-slate-500">Source</dt>
                    <dd className="text-xs text-slate-300">
                      {focusedNode.source_type}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-xs text-slate-500">Connections</dt>
                    <dd className="text-xs text-slate-300">
                      {connectionCount}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-xs text-slate-500">Created</dt>
                    <dd className="text-xs text-slate-300">
                      {new Date(focusedNode.created_at).toLocaleDateString(
                        "en-US",
                        { year: "numeric", month: "short", day: "numeric" },
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              {focusedNode.tags.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {focusedNode.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400"
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
