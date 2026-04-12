import { describe, it, expect } from "vitest";
import { tessellateArc, buildArcGeometryArrays } from "./arc-geometry";

describe("tessellateArc", () => {
  it("returns (segments + 1) points", () => {
    const a = { x: 35, y: 0, z: 0 };
    const b = { x: -35, y: 0, z: 0 };
    const points = tessellateArc(a, b, 35, 1.3, 16);
    expect(points.length).toBe(17);
  });

  it("first point matches source, last matches target", () => {
    const a = { x: 35, y: 0, z: 0 };
    const b = { x: 0, y: 35, z: 0 };
    const points = tessellateArc(a, b, 35, 1.3, 8);
    expect(points[0].x).toBeCloseTo(a.x, 5);
    expect(points[0].y).toBeCloseTo(a.y, 5);
    expect(points[0].z).toBeCloseTo(a.z, 5);
    const last = points[points.length - 1];
    expect(last.x).toBeCloseTo(b.x, 5);
    expect(last.y).toBeCloseTo(b.y, 5);
    expect(last.z).toBeCloseTo(b.z, 5);
  });

  it("control point pushes arc outward from center", () => {
    const a = { x: 35, y: 0, z: 0 };
    const b = { x: 0, y: 35, z: 0 };
    const points = tessellateArc(a, b, 35, 1.3, 16);
    const mid = points[8];
    const dist = Math.sqrt(mid.x ** 2 + mid.y ** 2 + mid.z ** 2);
    expect(dist).toBeGreaterThan(35);
  });
});

describe("buildArcGeometryArrays", () => {
  it("returns position and color arrays for line segments", () => {
    const positions = new Float32Array([35, 0, 0, 0, 35, 0, -35, 0, 0]);
    const nodeIndexMap = new Map([["a", 0], ["b", 1], ["c", 2]]);
    const links = [{ source: "a", target: "b" }];
    const categoryColors = new Map([["cat1", { r: 1, g: 0, b: 0 }], ["cat2", { r: 0, g: 1, b: 0 }]]);
    const nodeCategories = new Map([["a", "cat1"], ["b", "cat2"]]);

    const result = buildArcGeometryArrays(
      links, positions, nodeIndexMap, nodeCategories, categoryColors, 35, 1.3, 16,
    );

    expect(result.positions.length).toBe(16 * 2 * 3);
    expect(result.colors.length).toBe(16 * 2 * 4);
  });

  it("skips links with missing nodes", () => {
    const positions = new Float32Array([35, 0, 0]);
    const nodeIndexMap = new Map([["a", 0]]);
    const links = [{ source: "a", target: "missing" }];
    const categoryColors = new Map([["cat1", { r: 1, g: 0, b: 0 }]]);
    const nodeCategories = new Map([["a", "cat1"]]);

    const result = buildArcGeometryArrays(
      links, positions, nodeIndexMap, nodeCategories, categoryColors, 35, 1.3, 16,
    );

    expect(result.positions.length).toBe(0);
    expect(result.linkSourceTargets.length).toBe(0);
  });
});
