import { describe, it, expect } from "vitest";
import { applyCollisionLayout } from "./force-layout";
import type { GraphNode } from "./types";

function makeNode(id: string, x: number, y: number, z: number): GraphNode {
  return {
    id,
    title: id,
    tags: [],
    category: "projects",
    source_type: "ai",
    created_at: "2026-01-01T00:00:00Z",
    connection_count: 0,
    x,
    y,
    z,
  };
}

describe("applyCollisionLayout", () => {
  it("separates overlapping nodes", () => {
    const nodes = [makeNode("a.md", 0, 0, 0), makeNode("b.md", 0, 0, 0)];
    const result = applyCollisionLayout(nodes, 2.0);
    const dist = Math.sqrt(
      (result[0].x - result[1].x) ** 2 +
        (result[0].y - result[1].y) ** 2 +
        (result[0].z - result[1].z) ** 2,
    );
    expect(dist).toBeGreaterThan(0.5);
  });

  it("does not significantly move already-separated nodes", () => {
    const nodes = [makeNode("a.md", 0, 0, 0), makeNode("b.md", 50, 50, 50)];
    const result = applyCollisionLayout(nodes, 2.0);
    expect(Math.abs(result[0].x)).toBeLessThan(3);
    expect(Math.abs(result[1].x - 50)).toBeLessThan(3);
  });

  it("returns empty array for empty input", () => {
    expect(applyCollisionLayout([], 2.0)).toEqual([]);
  });
});
