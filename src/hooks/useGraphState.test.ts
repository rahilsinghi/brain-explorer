import { describe, it, expect, beforeEach } from "vitest";
import { useGraphState } from "./useGraphState";

describe("useGraphState", () => {
  beforeEach(() => {
    useGraphState.setState({
      focusedNodeId: null,
      hoveredNodeId: null,
      filterCategory: null,
      filterQuery: "",
    });
  });

  it("starts with null focus", () => {
    expect(useGraphState.getState().focusedNodeId).toBeNull();
  });

  it("sets focused node", () => {
    useGraphState.getState().setFocusedNode("projects/karen.md");
    expect(useGraphState.getState().focusedNodeId).toBe("projects/karen.md");
  });

  it("clears focus", () => {
    useGraphState.getState().setFocusedNode("projects/karen.md");
    useGraphState.getState().clearFocus();
    expect(useGraphState.getState().focusedNodeId).toBeNull();
  });

  it("sets hovered node", () => {
    useGraphState.getState().setHoveredNode("companies/maison.md");
    expect(useGraphState.getState().hoveredNodeId).toBe(
      "companies/maison.md",
    );
  });

  it("sets filter category", () => {
    useGraphState.getState().setFilterCategory("projects");
    expect(useGraphState.getState().filterCategory).toBe("projects");
  });

  it("sets filter query", () => {
    useGraphState.getState().setFilterQuery("karen");
    expect(useGraphState.getState().filterQuery).toBe("karen");
  });
});
