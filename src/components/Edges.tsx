"use client";

import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import type { GraphNode, GraphLink } from "@/lib/types";
import { useGraphState } from "@/hooks/useGraphState";
import { getCategoryColor } from "@/lib/categories";
import { buildArcGeometryArrays } from "@/lib/arc-geometry";

interface EdgesProps {
  nodes: GraphNode[];
  links: GraphLink[];
  positionsRef: React.MutableRefObject<Float32Array>;
  nodeIndexMap: React.MutableRefObject<Map<string, number>>;
}

const FOCUS_ALPHA = 0.8;
const DIMMED_ALPHA = 0.05;
const DEFAULT_ALPHA = 0.4;
const SPHERE_RADIUS = 35;
const ARC_LIFT = 1.3;
const SEGMENTS_PER_EDGE = 16;

export function Edges({ nodes, links, positionsRef, nodeIndexMap }: EdgesProps) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);

  // Build category lookup maps
  const { nodeCategories, categoryColors } = useMemo(() => {
    const cats = new Map<string, string>();
    const colors = new Map<string, { r: number; g: number; b: number }>();
    for (const n of nodes) {
      cats.set(n.id, n.category);
      if (!colors.has(n.category)) {
        const c = new THREE.Color(getCategoryColor(n.category));
        colors.set(n.category, { r: c.r, g: c.g, b: c.b });
      }
    }
    return { nodeCategories: cats, categoryColors: colors };
  }, [nodes]);

  // Build arc geometry
  const { geometry, linkSourceTargets } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (links.length === 0) return { geometry: geo, linkSourceTargets: [] };

    const result = buildArcGeometryArrays(
      links,
      positionsRef.current,
      nodeIndexMap.current,
      nodeCategories,
      categoryColors,
      SPHERE_RADIUS,
      ARC_LIFT,
      SEGMENTS_PER_EDGE,
    );

    geo.setAttribute("position", new THREE.BufferAttribute(result.positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(result.colors, 4));

    return { geometry: geo, linkSourceTargets: result.linkSourceTargets };
  }, [links, positionsRef, nodeIndexMap, nodeCategories, categoryColors]);

  // Focus-alpha: mutate color attribute on focus change
  useEffect(() => {
    const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute | null;
    if (!colorAttr || linkSourceTargets.length === 0) return;

    for (let i = 0; i < linkSourceTargets.length; i++) {
      const { source, target } = linkSourceTargets[i];
      let alpha: number;

      if (focusedNodeId) {
        const isFocusEdge = source === focusedNodeId || target === focusedNodeId;
        alpha = isFocusEdge ? FOCUS_ALPHA : DIMMED_ALPHA;
      } else {
        alpha = DEFAULT_ALPHA;
      }

      // Each edge has SEGMENTS_PER_EDGE segments, each with 2 vertices
      const baseVertex = i * SEGMENTS_PER_EDGE * 2;
      for (let v = 0; v < SEGMENTS_PER_EDGE * 2; v++) {
        colorAttr.setW(baseVertex + v, alpha);
      }
    }

    colorAttr.needsUpdate = true;
  }, [focusedNodeId, geometry, linkSourceTargets]);

  useEffect(() => {
    if (lineRef.current) {
      lineRef.current.layers.enable(1);
    }
  }, []);

  if (links.length === 0) return null;

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  );
}
