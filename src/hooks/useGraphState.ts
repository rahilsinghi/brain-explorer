import { create } from "zustand";
import type { LayerMode } from "@/lib/types";

interface GraphState {
  focusedNodeId: string | null;
  hoveredNodeId: string | null;
  isDragging: boolean;
  filterCategory: string | null;
  filterQuery: string;
  activeLayer: LayerMode;
  drillInRepo: string | null;
  drillInNodeIds: Set<string>;
  setFocusedNode: (id: string | null) => void;
  clearFocus: () => void;
  setHoveredNode: (id: string | null) => void;
  setIsDragging: (dragging: boolean) => void;
  setFilterCategory: (category: string | null) => void;
  setFilterQuery: (query: string) => void;
  setActiveLayer: (layer: LayerMode) => void;
  setDrillInRepo: (repo: string | null) => void;
  setDrillInNodeIds: (ids: Set<string>) => void;
}

export const useGraphState = create<GraphState>((set) => ({
  focusedNodeId: null,
  hoveredNodeId: null,
  isDragging: false,
  filterCategory: null,
  filterQuery: "",
  activeLayer: "wiki",
  drillInRepo: null,
  drillInNodeIds: new Set(),
  setFocusedNode: (id) => set({ focusedNodeId: id }),
  clearFocus: () =>
    set({
      focusedNodeId: null,
      drillInRepo: null,
      drillInNodeIds: new Set(),
    }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setIsDragging: (dragging) => set({ isDragging: dragging }),
  setFilterCategory: (category) => set({ filterCategory: category }),
  setFilterQuery: (query) => set({ filterQuery: query }),
  setActiveLayer: (layer) => set({ activeLayer: layer }),
  setDrillInRepo: (repo) => set({ drillInRepo: repo }),
  setDrillInNodeIds: (ids) => set({ drillInNodeIds: ids }),
}));
