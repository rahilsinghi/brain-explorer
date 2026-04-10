"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { GraphNode } from "@/lib/types";
import { getCategoryColor } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";

interface ArticlePanelProps {
  nodes: GraphNode[];
}

export function ArticlePanel({ nodes }: ArticlePanelProps) {
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);
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

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] z-40 animate-slide-in">
      <div className="h-full glass rounded-l-2xl flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] uppercase tracking-wider text-slate-400">
              {focusedNode.category}
            </span>
          </div>
          <h2 className="text-white text-lg font-semibold leading-tight">
            {focusedNode.title}
          </h2>
          <div className="mt-2 text-[11px] text-slate-500">
            {new Date(focusedNode.created_at).toLocaleDateString()}
          </div>
          {focusedNode.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {focusedNode.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div
          className="flex-1 overflow-y-auto px-5 py-4"
          onClick={handleClick}
        >
          {loading ? (
            <p className="text-slate-500 text-sm animate-pulse">
              Loading article...
            </p>
          ) : articleContent ? (
            <div className="prose prose-invert prose-sm max-w-none prose-headings:text-slate-200 prose-p:text-slate-400 prose-a:text-cyan-400 prose-strong:text-slate-300 prose-code:text-cyan-300">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                {articleContent}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="text-slate-500 text-sm">
              <p className="mb-2">Article preview unavailable.</p>
              <p className="text-[11px]">
                Start the brain daemon locally to view full articles.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
