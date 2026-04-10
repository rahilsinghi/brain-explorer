import { describe, it, expect } from "vitest";
import { normalizePositions, buildNeighborMap } from "./graph-data";
import type { GraphNode, GraphLink } from "./types";

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: "test.md",
    title: "Test",
    tags: [],
    category: "projects",
    source_type: "ai",
    created_at: "2026-01-01T00:00:00Z",
    connection_count: 0,
    x: 5,
    y: 3,
    z: 1,
    ...overrides,
  };
}

describe("normalizePositions", () => {
  it("centers positions around origin", () => {
    const nodes: GraphNode[] = [
      makeNode({ id: "a.md", x: 4, y: 2, z: 0 }),
      makeNode({ id: "b.md", x: 8, y: 6, z: 4 }),
    ];
    const result = normalizePositions(nodes, 50);
    const avgX = (result[0].x + result[1].x) / 2;
    const avgY = (result[0].y + result[1].y) / 2;
    const avgZ = (result[0].z + result[1].z) / 2;
    expect(Math.abs(avgX)).toBeLessThan(0.01);
    expect(Math.abs(avgY)).toBeLessThan(0.01);
    expect(Math.abs(avgZ)).toBeLessThan(0.01);
  });

  it("scales positions to fit within target radius", () => {
    const nodes: GraphNode[] = [
      makeNode({ id: "a.md", x: 0, y: 0, z: 0 }),
      makeNode({ id: "b.md", x: 100, y: 0, z: 0 }),
    ];
    const result = normalizePositions(nodes, 50);
    const maxDist = Math.max(
      ...result.map((n) => Math.sqrt(n.x ** 2 + n.y ** 2 + n.z ** 2)),
    );
    expect(maxDist).toBeLessThanOrEqual(50.01);
  });

  it("returns empty array for empty input", () => {
    expect(normalizePositions([], 50)).toEqual([]);
  });
});

describe("buildNeighborMap", () => {
  it("builds bidirectional neighbor sets", () => {
    const links: GraphLink[] = [
      { source: "a.md", target: "b.md" },
      { source: "a.md", target: "c.md" },
    ];
    const map = buildNeighborMap(links);
    expect(map.get("a.md")).toEqual(new Set(["b.md", "c.md"]));
    expect(map.get("b.md")).toEqual(new Set(["a.md"]));
    expect(map.get("c.md")).toEqual(new Set(["a.md"]));
  });

  it("returns empty map for no links", () => {
    const map = buildNeighborMap([]);
    expect(map.size).toBe(0);
  });
});
