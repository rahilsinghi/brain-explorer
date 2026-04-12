export interface GraphNode {
  id: string;
  title: string;
  tags: string[];
  category: string;
  source_type: string;
  created_at: string;
  connection_count: number;
  x: number;
  y: number;
  z: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export type DragState = "IDLE" | "DRAGGING" | "SNAPPING";

export interface GraphCache {
  generated_at: string;
  node_count: number;
  nodes: GraphNode[];
  links: GraphLink[];
}

export type FocusState = {
  focusedNodeId: string | null;
  hoveredNodeId: string | null;
  filterCategory: string | null;
  filterQuery: string;
};
