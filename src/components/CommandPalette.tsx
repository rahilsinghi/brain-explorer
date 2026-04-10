"use client";

import { useState, useEffect, useMemo } from "react";
import { Command } from "cmdk";
import type { GraphNode } from "@/lib/types";
import { getCategoryColor, CATEGORY_COLORS } from "@/lib/categories";
import { useGraphState } from "@/hooks/useGraphState";

interface CommandPaletteProps {
  nodes: GraphNode[];
}

export function CommandPalette({ nodes }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const setFocusedNode = useGraphState((s) => s.setFocusedNode);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !open &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const { filterCategory } = useMemo(() => {
    const catMatch = search.match(/^cat:(\w+)\s*(.*)/);
    if (catMatch)
      return { filterCategory: catMatch[1], cleanSearch: catMatch[2] };
    return { filterCategory: null, cleanSearch: search };
  }, [search]);

  const filteredNodes = useMemo(() => {
    let filtered = nodes;
    if (filterCategory)
      filtered = filtered.filter((n) => n.category === filterCategory);
    return filtered;
  }, [nodes, filterCategory]);

  const handleSelect = (nodeId: string) => {
    setFocusedNode(nodeId);
    setOpen(false);
    setSearch("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          setOpen(false);
          setSearch("");
        }}
      />
      <Command
        className="glass rounded-xl w-[560px] max-h-[400px] overflow-hidden shadow-2xl relative z-10"
        shouldFilter={true}
      >
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Search nodes... (cat:projects, from:github)"
          className="w-full px-4 py-3 bg-transparent text-white text-sm outline-none border-b border-white/10 placeholder:text-slate-500"
          autoFocus
        />
        <Command.List className="max-h-[320px] overflow-y-auto p-2">
          <Command.Empty className="px-4 py-8 text-center text-slate-500 text-sm">
            No nodes found.
          </Command.Empty>
          {Object.keys(CATEGORY_COLORS).map((category) => {
            const categoryNodes = filteredNodes.filter(
              (n) => n.category === category,
            );
            if (categoryNodes.length === 0) return null;
            return (
              <Command.Group
                key={category}
                heading={category}
                className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-slate-500 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1"
              >
                {categoryNodes.map((node) => (
                  <Command.Item
                    key={node.id}
                    value={`${node.title} ${node.tags.join(" ")}`}
                    onSelect={() => handleSelect(node.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm text-slate-300 data-[selected=true]:bg-white/10 data-[selected=true]:text-white"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: getCategoryColor(node.category),
                      }}
                    />
                    <span className="truncate">{node.title}</span>
                    <span className="ml-auto text-[10px] text-slate-600">
                      {node.category}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            );
          })}
        </Command.List>
      </Command>
    </div>
  );
}
