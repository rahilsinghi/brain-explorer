import { describe, it, expect, beforeEach } from "vitest";
import { useGraphState } from "./useGraphState";

describe("useGraphState", () => {
  beforeEach(() => {
    useGraphState.setState({
      focusedNodeId: null,
      hoveredNodeId: null,
      isDragging: false,
      filterCategory: null,
      filterQuery: "",
      activeLayer: "wiki",
      drillInRepo: null,
      drillInNodeIds: new Set(),
    });
  });

  it("starts with null focus", () => {
    expect(useGraphState.getState().focusedNodeId).toBeNull();
  });

  it("sets focused node", () => {
    useGraphState.getState().setFocusedNode("projects/karen.md");
    expect(useGraphState.getState().focusedNodeId).toBe("projects/karen.md");
  });

  it("clears focus and resets drill-in state", () => {
    useGraphState.getState().setFocusedNode("projects/karen.md");
    useGraphState.getState().setDrillInRepo("brain");
    useGraphState.getState().setDrillInNodeIds(new Set(["a", "b"]));
    useGraphState.getState().clearFocus();
    expect(useGraphState.getState().focusedNodeId).toBeNull();
    expect(useGraphState.getState().drillInRepo).toBeNull();
    expect(useGraphState.getState().drillInNodeIds.size).toBe(0);
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

  it("defaults activeLayer to wiki", () => {
    expect(useGraphState.getState().activeLayer).toBe("wiki");
  });

  it("sets active layer", () => {
    useGraphState.getState().setActiveLayer("code");
    expect(useGraphState.getState().activeLayer).toBe("code");
  });

  it("sets drill-in repo", () => {
    useGraphState.getState().setDrillInRepo("brain");
    expect(useGraphState.getState().drillInRepo).toBe("brain");
  });

  it("sets drill-in node IDs", () => {
    const ids = new Set(["node-1", "node-2"]);
    useGraphState.getState().setDrillInNodeIds(ids);
    expect(useGraphState.getState().drillInNodeIds).toEqual(ids);
  });
});
