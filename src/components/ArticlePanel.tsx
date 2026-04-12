"use client";

import { useMemo, useEffect, useState, useCallback, useRef } from "react";
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

function CollapsibleSection({
  title,
  defaultOpen = true,
  delay = 0,
  accentColor,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  delay?: number;
  accentColor: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(defaultOpen ? "auto" : 0);

  useEffect(() => {
    if (!contentRef.current) return;
    if (open) {
      const h = contentRef.current.scrollHeight;
      setHeight(h);
      const timer = setTimeout(() => setHeight("auto"), 300);
      return () => clearTimeout(timer);
    } else {
      setHeight(contentRef.current.scrollHeight);
      requestAnimationFrame(() => setHeight(0));
    }
  }, [open]);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        overflow: "hidden",
        animation: `card-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms both`,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          background: "none",
          border: "none",
          cursor: "pointer",
          borderBottom: open ? "1px solid rgba(255,255,255,0.04)" : "none",
          transition: "border-color 0.2s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "3px",
              height: "14px",
              borderRadius: "2px",
              background: accentColor,
              opacity: 0.7,
            }}
          />
          <span
            style={{
              color: "#94a3b8",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {title}
          </span>
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <path
            d="M3 5.5L7 9.5L11 5.5"
            stroke="#4b5563"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        ref={contentRef}
        style={{
          height: typeof height === "number" ? `${height}px` : "auto",
          transition: "height 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 18px" }}>{children}</div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
      }}
    >
      <span style={{ color: "#6b7280", fontSize: "13px" }}>{label}</span>
      <span style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
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
  const formattedDate = new Date(focusedNode.created_at).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" },
  );

  return (
    <div
      style={{
        position: "fixed",
        right: "20px",
        top: "20px",
        bottom: "20px",
        width: "380px",
        zIndex: 40,
        animation: "panel-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: "20px",
          background: "rgba(15, 15, 30, 0.6)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: `0 25px 60px rgba(0,0,0,0.5), 0 0 80px ${color}10`,
        }}
      >
        {/* Header — colored gradient top */}
        <div
          style={{
            flexShrink: 0,
            position: "relative",
            padding: "28px 24px 20px",
            background: `linear-gradient(180deg, ${color}15 0%, transparent 100%)`,
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {/* Close button */}
          <button
            onClick={clearFocus}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
            }}
            aria-label="Close panel"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5"
                stroke="#64748b"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* Category pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              borderRadius: "8px",
              padding: "5px 12px",
              background: `${color}18`,
              border: `1px solid ${color}30`,
              animation: "card-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1) 100ms both",
            }}
          >
            <div
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: color,
                boxShadow: `0 0 6px ${color}80`,
              }}
            />
            <span
              style={{
                color: color,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {focusedNode.category}
            </span>
          </div>

          {/* Title */}
          <h2
            style={{
              marginTop: "16px",
              fontSize: "22px",
              fontWeight: 700,
              lineHeight: 1.25,
              color: "#f1f5f9",
              letterSpacing: "-0.01em",
              animation: "card-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1) 150ms both",
            }}
          >
            {focusedNode.title}
          </h2>

          {/* Date + connection count */}
          <div
            style={{
              marginTop: "10px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              animation: "card-pop 0.4s cubic-bezier(0.16, 1, 0.3, 1) 200ms both",
            }}
          >
            <span style={{ color: "#64748b", fontSize: "13px" }}>
              {formattedDate}
            </span>
            {connectionCount > 0 && (
              <>
                <span style={{ color: "#334155", fontSize: "13px" }}>|</span>
                <span
                  style={{
                    color: color,
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {connectionCount} connection
                  {connectionCount !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Scrollable content area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
          className="scrollbar-hide"
          onClick={handleClick}
        >
          {loading ? (
            <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {[0.75, 1, 0.6, 0.85, 0.5].map((w, i) => (
                <div
                  key={i}
                  className="animate-pulse"
                  style={{
                    height: "16px",
                    width: `${w * 100}%`,
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.04)",
                  }}
                />
              ))}
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
            <>
              {/* Details section */}
              <CollapsibleSection
                title="Details"
                defaultOpen
                delay={250}
                accentColor={color}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <MetaRow label="Category" value={focusedNode.category} />
                  <div
                    style={{
                      height: "1px",
                      background: "rgba(255,255,255,0.04)",
                      margin: "2px 0",
                    }}
                  />
                  <MetaRow label="Source" value={focusedNode.source_type} />
                  <div
                    style={{
                      height: "1px",
                      background: "rgba(255,255,255,0.04)",
                      margin: "2px 0",
                    }}
                  />
                  <MetaRow
                    label="Connections"
                    value={String(connectionCount)}
                  />
                  <div
                    style={{
                      height: "1px",
                      background: "rgba(255,255,255,0.04)",
                      margin: "2px 0",
                    }}
                  />
                  <MetaRow label="Created" value={formattedDate} />
                </div>
              </CollapsibleSection>

              {/* Tags section */}
              {focusedNode.tags.length > 0 && (
                <CollapsibleSection
                  title={`Tags (${focusedNode.tags.length})`}
                  defaultOpen
                  delay={350}
                  accentColor={color}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    {focusedNode.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: "inline-block",
                          padding: "5px 12px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#c8cdd5",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          transition: "all 0.15s",
                          cursor: "default",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `${color}15`;
                          e.currentTarget.style.borderColor = `${color}30`;
                          e.currentTarget.style.color = color;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            "rgba(255,255,255,0.04)";
                          e.currentTarget.style.borderColor =
                            "rgba(255,255,255,0.06)";
                          e.currentTarget.style.color = "#c8cdd5";
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {/* ID section */}
              <CollapsibleSection
                title="File"
                defaultOpen={false}
                delay={450}
                accentColor={color}
              >
                <code
                  style={{
                    display: "block",
                    fontSize: "12px",
                    color: "#64748b",
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                    lineHeight: 1.6,
                  }}
                >
                  {focusedNode.id}
                </code>
              </CollapsibleSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
