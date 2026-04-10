import { describe, it, expect } from "vitest";
import {
  getCategoryColor,
  getGlowColor,
  getNodeRadius,
  CATEGORY_COLORS,
  CATEGORY_GLOW_COLORS,
} from "./categories";

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
