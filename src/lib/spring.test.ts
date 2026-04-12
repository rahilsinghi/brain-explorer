import { describe, it, expect } from "vitest";
import { stepSpring, isSpringSettled } from "./spring";

describe("stepSpring", () => {
  it("moves position toward rest when displaced", () => {
    const state = { position: 10, velocity: 0 };
    const result = stepSpring(state, 0, 180, 0.85, 1 / 60);
    expect(result.position).toBeLessThan(10);
    expect(result.position).toBeGreaterThan(0);
  });

  it("builds velocity in opposite direction of displacement", () => {
    const state = { position: 10, velocity: 0 };
    const result = stepSpring(state, 0, 180, 0.85, 1 / 60);
    expect(result.velocity).toBeLessThan(0);
  });

  it("converges to rest position over many steps", () => {
    let state = { position: 50, velocity: 0 };
    for (let i = 0; i < 300; i++) {
      state = stepSpring(state, 0, 180, 0.85, 1 / 60);
    }
    expect(state.position).toBeCloseTo(0, 1);
    expect(state.velocity).toBeCloseTo(0, 1);
  });

  it("overshoots slightly with these spring constants", () => {
    let state = { position: 50, velocity: 0 };
    let crossedZero = false;
    for (let i = 0; i < 300; i++) {
      state = stepSpring(state, 0, 180, 0.85, 1 / 60);
      if (state.position < 0) crossedZero = true;
    }
    expect(crossedZero).toBe(true);
  });
});

describe("isSpringSettled", () => {
  it("returns false when displaced", () => {
    expect(isSpringSettled(5, 0)).toBe(false);
  });

  it("returns false when moving fast", () => {
    expect(isSpringSettled(0.005, 1)).toBe(false);
  });

  it("returns true when close and slow", () => {
    expect(isSpringSettled(0.005, 0.005)).toBe(true);
  });
});
