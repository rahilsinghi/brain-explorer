import { describe, it, expect } from "vitest";
import { computeSpherePositions } from "./sphere-layout";
import type { GraphNode } from "./types";

function makeNode(id: string, category: string): GraphNode {
  return {
    id, title: id, tags: [], category,
    source_type: "wiki", created_at: "2026-01-01",
    connection_count: 1, x: 0, y: 0, z: 0,
  };
}

describe("computeSpherePositions", () => {
  it("returns Float32Array of length nodes * 3", () => {
    const nodes = [makeNode("a", "projects"), makeNode("b", "skills")];
    const result = computeSpherePositions(nodes, 35);
    expect(result.positions).toBeInstanceOf(Float32Array);
    expect(result.positions.length).toBe(6);
  });

  it("returns nodeIndexMap with correct indices", () => {
    const nodes = [makeNode("a", "projects"), makeNode("b", "skills")];
    const result = computeSpherePositions(nodes, 35);
    expect(result.nodeIndexMap.size).toBe(2);
    expect(result.nodeIndexMap.has("a")).toBe(true);
    expect(result.nodeIndexMap.has("b")).toBe(true);
  });

  it("places all nodes on the sphere surface (within tolerance)", () => {
    const nodes = Array.from({ length: 50 }, (_, i) =>
      makeNode(`n${i}`, i % 3 === 0 ? "projects" : i % 3 === 1 ? "skills" : "decisions"),
    );
    const radius = 35;
    const result = computeSpherePositions(nodes, radius);

    for (let i = 0; i < nodes.length; i++) {
      const x = result.positions[i * 3];
      const y = result.positions[i * 3 + 1];
      const z = result.positions[i * 3 + 2];
      const dist = Math.sqrt(x * x + y * y + z * z);
      expect(dist).toBeCloseTo(radius, 1);
    }
  });

  it("groups same-category nodes contiguously in the spiral", () => {
    const nodes = [
      makeNode("a1", "projects"), makeNode("a2", "projects"),
      makeNode("b1", "skills"), makeNode("b2", "skills"),
      makeNode("c1", "decisions"),
    ];
    const result = computeSpherePositions(nodes, 35);
    const projIndices = nodes
      .filter((n) => n.category === "projects")
      .map((n) => result.nodeIndexMap.get(n.id)!);
    expect(projIndices[1] - projIndices[0]).toBe(1);
  });

  it("handles single node", () => {
    const nodes = [makeNode("solo", "projects")];
    const result = computeSpherePositions(nodes, 35);
    expect(result.positions.length).toBe(3);
    const dist = Math.sqrt(
      result.positions[0] ** 2 + result.positions[1] ** 2 + result.positions[2] ** 2,
    );
    expect(dist).toBeCloseTo(35, 1);
  });

  it("handles empty array", () => {
    const result = computeSpherePositions([], 35);
    expect(result.positions.length).toBe(0);
    expect(result.nodeIndexMap.size).toBe(0);
  });
});
