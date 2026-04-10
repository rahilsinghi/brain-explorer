"use client";

import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import type { GraphNode, GraphLink } from "@/lib/types";
import { useGraphState } from "@/hooks/useGraphState";

interface EdgesProps {
  nodes: GraphNode[];
  links: GraphLink[];
}

const DEFAULT_ALPHA = 0.15;
const FOCUS_ALPHA = 0.75;
const DIMMED_ALPHA = 0.03;

export function Edges({ nodes, links }: EdgesProps) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  // Build geometry ONCE with position + color attributes
  const { geometry, linkSourceTargets } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (links.length === 0) return { geometry: geo, linkSourceTargets: [] };

    const positions: number[] = [];
    const colors: number[] = [];
    const sourceTargets: Array<{ source: string; target: string }> = [];

    for (const link of links) {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) continue;

      positions.push(source.x, source.y, source.z);
      positions.push(target.x, target.y, target.z);
      colors.push(1, 1, 1, DEFAULT_ALPHA);
      colors.push(1, 1, 1, DEFAULT_ALPHA);
      sourceTargets.push({ source: link.source, target: link.target });
    }

    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));

    return { geometry: geo, linkSourceTargets: sourceTargets };
  }, [links, nodes, nodeMap]);

  // Mutate color attribute on focus change -- no geometry rebuild
  useEffect(() => {
    const colorAttr = geometry.getAttribute(
      "color",
    ) as THREE.BufferAttribute | null;
    if (!colorAttr || linkSourceTargets.length === 0) return;

    for (let i = 0; i < linkSourceTargets.length; i++) {
      const { source, target } = linkSourceTargets[i];
      let alpha: number;

      if (focusedNodeId) {
        const isFocusEdge =
          source === focusedNodeId || target === focusedNodeId;
        alpha = isFocusEdge ? FOCUS_ALPHA : DIMMED_ALPHA;
      } else {
        alpha = DEFAULT_ALPHA;
      }

      const idx = i * 2;
      colorAttr.setW(idx, alpha);
      colorAttr.setW(idx + 1, alpha);
    }

    colorAttr.needsUpdate = true;
  }, [focusedNodeId, geometry, linkSourceTargets]);

  if (links.length === 0) return null;

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineBasicMaterial vertexColors transparent />
    </lineSegments>
  );
}
