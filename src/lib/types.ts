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
  // --- fusion fields (all optional for backward compat) ---
  layer?: "wiki" | "code";
  file_type?: "code" | "document" | "rationale";
  source_file?: string;
  source_location?: string;
  community?: number;
  is_god_node?: boolean;
  confidential?: boolean;
  repo?: string;
}

export interface GraphLink {
  source: string;
  target: string;
  // --- fusion fields ---
  relation?: string;
  confidence?: "EXTRACTED" | "INFERRED" | "AMBIGUOUS";
  confidence_score?: number;
}

export type LayerMode = "wiki" | "code" | "combined";

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
