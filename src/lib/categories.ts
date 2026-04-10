export const CATEGORY_COLORS: Record<string, string> = {
  projects: "#8b5cf6",
  skills: "#06b6d4",
  companies: "#ec4899",
  experience: "#f59e0b",
  decisions: "#22c55e",
  people: "#f4723b",
  concepts: "#e2e8f0",
  synthesis: "#14b8a6",
  tracking: "#06b6d4",
};

const DEFAULT_COLOR = "#e2e8f0";

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? DEFAULT_COLOR;
}

const MIN_RADIUS = 0.3;
const MAX_RADIUS = 1.5;
const MAX_CONNECTIONS = 40;

export function getNodeRadius(connectionCount: number): number {
  const t = Math.min(connectionCount / MAX_CONNECTIONS, 1);
  return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
}
