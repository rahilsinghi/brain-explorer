"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { GraphNode, GraphLink } from "@/lib/types";
import { useGraphState } from "@/hooks/useGraphState";
import { getCategoryColor } from "@/lib/categories";

interface EdgesProps {
  nodes: GraphNode[];
  links: GraphLink[];
}

const DEFAULT_ALPHA = 0.5;
const FOCUS_ALPHA = 0.8;
const DIMMED_ALPHA = 0.05;
const PARTICLE_SPEED = 0.4;

export function Edges({ nodes, links }: EdgesProps) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const particleRef = useRef<THREE.Points>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const { geometry, linkSourceTargets, edgeColors } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (links.length === 0)
      return { geometry: geo, linkSourceTargets: [], edgeColors: [] };

    const positions: number[] = [];
    const colors: number[] = [];
    const sourceTargets: Array<{ source: string; target: string }> = [];
    const edgeColorList: THREE.Color[] = [];

    for (const link of links) {
      const source = nodeMap.get(link.source);
      const target = nodeMap.get(link.target);
      if (!source || !target) continue;

      const color = new THREE.Color(getCategoryColor(source.category));
      edgeColorList.push(color);

      positions.push(source.x, source.y, source.z);
      positions.push(target.x, target.y, target.z);
      colors.push(color.r, color.g, color.b, DEFAULT_ALPHA);
      colors.push(color.r, color.g, color.b, DEFAULT_ALPHA);
      sourceTargets.push({ source: link.source, target: link.target });
    }

    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));

    return {
      geometry: geo,
      linkSourceTargets: sourceTargets,
      edgeColors: edgeColorList,
    };
  }, [links, nodes, nodeMap]);

  const { particleGeometry, particleProgress } = useMemo(() => {
    const count = linkSourceTargets.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const progress = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      progress[i] = Math.random();
      if (edgeColors[i]) {
        colors[i * 3] = edgeColors[i].r;
        colors[i * 3 + 1] = edgeColors[i].g;
        colors[i * 3 + 2] = edgeColors[i].b;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return { particleGeometry: geo, particleProgress: progress };
  }, [linkSourceTargets, edgeColors]);

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

  useFrame((_, delta) => {
    if (!particleRef.current || linkSourceTargets.length === 0) return;
    const posAttr = particleGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;

    for (let i = 0; i < linkSourceTargets.length; i++) {
      const { source, target } = linkSourceTargets[i];
      const sNode = nodeMap.get(source);
      const tNode = nodeMap.get(target);
      if (!sNode || !tNode) continue;

      particleProgress[i] = (particleProgress[i] + delta * PARTICLE_SPEED) % 1;
      const t = particleProgress[i];

      posAttr.setXYZ(
        i,
        sNode.x + (tNode.x - sNode.x) * t,
        sNode.y + (tNode.y - sNode.y) * t,
        sNode.z + (tNode.z - sNode.z) * t,
      );
    }
    posAttr.needsUpdate = true;
  });

  if (links.length === 0) return null;

  return (
    <>
      <lineSegments ref={lineRef} geometry={geometry}>
        <lineBasicMaterial vertexColors transparent />
      </lineSegments>
      <points ref={particleRef} geometry={particleGeometry}>
        <pointsMaterial
          vertexColors
          size={3}
          transparent
          opacity={0.9}
          sizeAttenuation={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}
