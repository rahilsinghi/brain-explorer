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

export interface SimNode {
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
  vx: number;
  vy: number;
  vz: number;
  fx: number | null;
  fy: number | null;
  fz: number | null;
}

export type DragState = "IDLE" | "DRAGGING" | "RELEASING";

export const ALPHA_MIN = 0.001;

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
