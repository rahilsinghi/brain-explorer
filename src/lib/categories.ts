import type { GraphNode } from "./types";

export const CATEGORY_COLORS: Record<string, string> = {
  projects: "#a78bfa",    // Brighter violet (was #8b5cf6)
  skills: "#06b6d4",      // Cyan
  companies: "#ec4899",   // Pink
  experience: "#f59e0b",  // Amber
  decisions: "#22c55e",   // Green
  people: "#f4723b",      // Orange
  concepts: "#e2e8f0",    // Slate-200
  synthesis: "#14b8a6",   // Teal
  tracking: "#06b6d4",    // Cyan
};

export const CATEGORY_GLOW_COLORS: Record<string, string> = {
  projects: "#c4b5fd",    // Light violet
  skills: "#22d3ee",      // Bright cyan
  companies: "#f472b6",   // Light pink
  experience: "#fbbf24",  // Bright amber
  decisions: "#4ade80",   // Light green
  people: "#fb923c",      // Light orange
  concepts: "#f1f5f9",    // Slate-100
  synthesis: "#2dd4bf",   // Light teal
  tracking: "#22d3ee",    // Bright cyan
};

const DEFAULT_COLOR = "#e2e8f0";

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR;
}

export function getGlowColor(category: string): string {
  return CATEGORY_GLOW_COLORS[category] ?? DEFAULT_COLOR;
}

const MIN_RADIUS = 0.3;
const MAX_RADIUS = 1.5;
const MAX_CONNECTIONS = 40;

export function getNodeRadius(connectionCount: number): number {
  const t = Math.min(connectionCount / MAX_CONNECTIONS, 1);
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}

export function getCodeNodeColor(community?: number): string {
  const hue = (120 + (community ?? 0) * 37) % 360;
  return `hsl(${hue}, 100%, 50%)`;
}

export function getNodeColor(node: GraphNode): string {
  if (node.layer === "code") return getCodeNodeColor(node.community);
  return getCategoryColor(node.category);
}

export function getNodeLabel(node: GraphNode): string {
  if (node.layer === "code" && node.source_file) {
    return node.source_file.split("/").pop() ?? node.title;
  }
  return node.title;
}
