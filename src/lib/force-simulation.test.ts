import { describe, it, expect } from "vitest";
import { createForceSimulation, syncPositions } from "./force-simulation";
import type { GraphNode, GraphLink } from "./types";

function makeNode(id: string, x: number, y: number, z: number): GraphNode {
  return {
    id,
    title: id,
    tags: [],
    category: "concept",
    source_type: "wiki",
    created_at: "2026-01-01",
    connection_count: 1,
    x,
    y,
    z,
  };
}

describe("createForceSimulation", () => {
  it("returns simulation, simNodes, positionsRef, and nodeIndexMap", () => {
    const nodes = [makeNode("a", 1, 2, 3), makeNode("b", 4, 5, 6)];
    const links: GraphLink[] = [{ source: "a", target: "b" }];

    const result = createForceSimulation(nodes, links);

    expect(result.simulation).toBeDefined();
    expect(result.simNodes).toHaveLength(2);
    expect(result.positionsRef).toBeInstanceOf(Float32Array);
    expect(result.positionsRef.length).toBe(6); // 2 nodes * 3
    expect(result.nodeIndexMap.get("a")).toBe(0);
    expect(result.nodeIndexMap.get("b")).toBe(1);
  });

  it("seeds simNodes with input positions", () => {
    const nodes = [makeNode("a", 10, 20, 30)];
    const links: GraphLink[] = [];

    const { simNodes } = createForceSimulation(nodes, links);

    expect(simNodes[0].x).toBe(10);
    expect(simNodes[0].y).toBe(20);
    expect(simNodes[0].z).toBe(30);
  });

  it("initializes velocity and fix fields", () => {
    const nodes = [makeNode("a", 0, 0, 0)];
    const { simNodes } = createForceSimulation(nodes, []);

    expect(simNodes[0].vx).toBe(0);
    expect(simNodes[0].vy).toBe(0);
    expect(simNodes[0].vz).toBe(0);
    expect(simNodes[0].fx).toBeNull();
    expect(simNodes[0].fy).toBeNull();
    expect(simNodes[0].fz).toBeNull();
  });

  it("copies all GraphNode fields to SimNode", () => {
    const nodes = [makeNode("a", 1, 2, 3)];
    nodes[0].tags = ["test"];
    nodes[0].category = "project";

    const { simNodes } = createForceSimulation(nodes, []);

    expect(simNodes[0].id).toBe("a");
    expect(simNodes[0].title).toBe("a");
    expect(simNodes[0].tags).toEqual(["test"]);
    expect(simNodes[0].category).toBe("project");
  });
});

describe("syncPositions", () => {
  it("copies simNode positions into Float32Array", () => {
    const positions = new Float32Array(6);
    const simNodes = [
      { x: 10, y: 20, z: 30 },
      { x: 40, y: 50, z: 60 },
    ] as Array<{ x: number; y: number; z: number }>;

    syncPositions(simNodes, positions);

    expect(positions[0]).toBe(10);
    expect(positions[1]).toBe(20);
    expect(positions[2]).toBe(30);
    expect(positions[3]).toBe(40);
    expect(positions[4]).toBe(50);
    expect(positions[5]).toBe(60);
  });
});
