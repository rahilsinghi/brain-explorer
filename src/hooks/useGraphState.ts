import { create } from "zustand";

interface GraphState {
  focusedNodeId: string | null;
  hoveredNodeId: string | null;
  isDragging: boolean;
  filterCategory: string | null;
  filterQuery: string;
  setFocusedNode: (id: string | null) => void;
  clearFocus: () => void;
  setHoveredNode: (id: string | null) => void;
  setIsDragging: (dragging: boolean) => void;
  setFilterCategory: (category: string | null) => void;
  setFilterQuery: (query: string) => void;
}

export const useGraphState = create<GraphState>((set) => ({
  focusedNodeId: null,
  hoveredNodeId: null,
  isDragging: false,
  filterCategory: null,
  filterQuery: "",
  setFocusedNode: (id) => set({ focusedNodeId: id }),
  clearFocus: () => set({ focusedNodeId: null }),
  setHoveredNode: (id) => set({ hoveredNodeId: id }),
  setIsDragging: (dragging) => set({ isDragging: dragging }),
  setFilterCategory: (category) => set({ filterCategory: category }),
  setFilterQuery: (query) => set({ filterQuery: query }),
}));
