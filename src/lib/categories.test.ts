import { describe, it, expect } from "vitest";
import {
  getCategoryColor,
  getCodeNodeColor,
  getGlowColor,
  getNodeColor,
  getNodeLabel,
  getNodeRadius,
  CATEGORY_COLORS,
  CATEGORY_GLOW_COLORS,
} from "./categories";
import type { GraphNode } from "./types";

describe("getCategoryColor", () => {
  it("returns correct hex for known categories", () => {
    expect(getCategoryColor("projects")).toBe("#a78bfa");
    expect(getCategoryColor("skills")).toBe("#06b6d4");
    expect(getCategoryColor("companies")).toBe("#ec4899");
    expect(getCategoryColor("experience")).toBe("#f59e0b");
    expect(getCategoryColor("decisions")).toBe("#22c55e");
    expect(getCategoryColor("people")).toBe("#f4723b");
    expect(getCategoryColor("concepts")).toBe("#e2e8f0");
    expect(getCategoryColor("synthesis")).toBe("#14b8a6");
  });

  it("returns default white for unknown category", () => {
    expect(getCategoryColor("unknown")).toBe("#e2e8f0");
  });
});

describe("CATEGORY_COLORS", () => {
  it("projects color is brighter violet (#a78bfa)", () => {
    expect(CATEGORY_COLORS.projects).toBe("#a78bfa");
  });
});

describe("getGlowColor", () => {
  it("returns glow color for known category", () => {
    expect(getGlowColor("projects")).toBe("#c4b5fd");
  });
  it("returns default glow for unknown category", () => {
    expect(getGlowColor("nonexistent")).toBe("#e2e8f0");
  });
});

describe("getNodeRadius", () => {
  it("returns min radius for 0 connections", () => {
    expect(getNodeRadius(0)).toBe(0.3);
  });

  it("returns max radius for high connections", () => {
    expect(getNodeRadius(40)).toBe(1.5);
  });

  it("scales linearly between min and max", () => {
    const r = getNodeRadius(20);
    expect(r).toBeGreaterThan(0.3);
    expect(r).toBeLessThan(1.5);
  });
});

describe("getCodeNodeColor", () => {
  it("returns green-family color for community 0", () => {
    const color = getCodeNodeColor(0);
    expect(color).toMatch(/^hsl\(/);
  });

  it("different communities produce different hues", () => {
    expect(getCodeNodeColor(0)).not.toBe(getCodeNodeColor(1));
  });
});

describe("getNodeColor", () => {
  it("returns category color for wiki nodes", () => {
    const node = { layer: "wiki", category: "projects", community: undefined } as unknown as GraphNode;
    const color = getNodeColor(node);
    expect(color).toBe("#a78bfa");
  });

  it("returns community hue for code nodes", () => {
    const node = { layer: "code", category: "karen", community: 3 } as unknown as GraphNode;
    const color = getNodeColor(node);
    expect(color).toMatch(/^hsl\(/);
  });
});

describe("getNodeLabel", () => {
  it("returns title for wiki nodes", () => {
    const node = { layer: "wiki", title: "My Article", source_file: undefined } as unknown as GraphNode;
    expect(getNodeLabel(node)).toBe("My Article");
  });

  it("returns file basename for code nodes", () => {
    const node = { layer: "code", title: "code://karen/src/auth/service.ts", source_file: "/Users/r/Desktop/karen/src/auth/service.ts" } as unknown as GraphNode;
    expect(getNodeLabel(node)).toBe("service.ts");
  });

  it("falls back to title if no source_file", () => {
    const node = { layer: "code", title: "service.ts", source_file: undefined } as unknown as GraphNode;
    expect(getNodeLabel(node)).toBe("service.ts");
  });
});
