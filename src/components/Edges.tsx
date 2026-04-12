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
  positionsRef: React.MutableRefObject<Float32Array>;
  nodeIndexMap: React.MutableRefObject<Map<string, number>>;
  simulationActive: React.MutableRefObject<boolean>;
}

const DEFAULT_ALPHA = 0.5;
const FOCUS_ALPHA = 0.8;
const DIMMED_ALPHA = 0.05;
const PARTICLE_SPEED = 0.4;

export function Edges({
  nodes,
  links,
  positionsRef,
  nodeIndexMap,
  simulationActive,
}: EdgesProps) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const particleRef = useRef<THREE.Points>(null);
  const focusedNodeId = useGraphState((s) => s.focusedNodeId);

  // Node map for category color lookup only
  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  // Edge positions Float32Array — rebuilt when link count changes
  const edgePositionsRef = useRef<Float32Array>(new Float32Array(0));

  // Build geometry with initial positions and colors
  const { geometry, linkSourceTargets, edgeColors } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    if (links.length === 0)
      return { geometry: geo, linkSourceTargets: [], edgeColors: [] };

    const positions = new Float32Array(links.length * 6);
    const colors: number[] = [];
    const sourceTargets: Array<{ source: string; target: string }> = [];
    const edgeColorList: THREE.Color[] = [];
    const indexMap = nodeIndexMap.current;
    const nodePositions = positionsRef.current;

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const source = nodeMap.get(link.source);
      if (!source) continue;

      const color = new THREE.Color(getCategoryColor(source.category));
      edgeColorList.push(color);

      // Initial positions from positionsRef
      const si = indexMap.get(link.source);
      const ti = indexMap.get(link.target);
      if (si !== undefined && ti !== undefined) {
        const offset = i * 6;
        positions[offset] = nodePositions[si * 3];
        positions[offset + 1] = nodePositions[si * 3 + 1];
        positions[offset + 2] = nodePositions[si * 3 + 2];
        positions[offset + 3] = nodePositions[ti * 3];
        positions[offset + 4] = nodePositions[ti * 3 + 1];
        positions[offset + 5] = nodePositions[ti * 3 + 2];
      }

      colors.push(color.r, color.g, color.b, DEFAULT_ALPHA);
      colors.push(color.r, color.g, color.b, DEFAULT_ALPHA);
      sourceTargets.push({ source: link.source, target: link.target });
    }

    edgePositionsRef.current = positions;

    // Use BufferAttribute (not Float32BufferAttribute) so the geometry
    // shares the same Float32Array reference as edgePositionsRef.
    // Float32BufferAttribute copies the data, breaking dynamic updates.
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));

    return {
      geometry: geo,
      linkSourceTargets: sourceTargets,
      edgeColors: edgeColorList,
    };
  }, [links, nodes, nodeMap, nodeIndexMap, positionsRef]);

  // Particle system
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

  // Focus-alpha: mutate color attribute on focus change
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

  // Frame loop: update edge positions + particle interpolation
  useFrame((_, delta) => {
    // Update edge line positions when simulation is active
    if (simulationActive.current) {
      const positions = positionsRef.current;
      const indexMap = nodeIndexMap.current;
      const edgePositions = edgePositionsRef.current;

      for (let i = 0; i < linkSourceTargets.length; i++) {
        const si = indexMap.get(linkSourceTargets[i].source);
        const ti = indexMap.get(linkSourceTargets[i].target);
        if (si === undefined || ti === undefined) continue;
        const offset = i * 6;

        edgePositions[offset] = positions[si * 3];
        edgePositions[offset + 1] = positions[si * 3 + 1];
        edgePositions[offset + 2] = positions[si * 3 + 2];
        edgePositions[offset + 3] = positions[ti * 3];
        edgePositions[offset + 4] = positions[ti * 3 + 1];
        edgePositions[offset + 5] = positions[ti * 3 + 2];
      }

      const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
      posAttr.needsUpdate = true;
    }

    // Particle interpolation — always runs (particles animate even when settled)
    if (!particleRef.current || linkSourceTargets.length === 0) return;
    const particlePosAttr = particleGeometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const positions = positionsRef.current;
    const indexMap = nodeIndexMap.current;

    for (let i = 0; i < linkSourceTargets.length; i++) {
      const si = indexMap.get(linkSourceTargets[i].source);
      const ti = indexMap.get(linkSourceTargets[i].target);
      if (si === undefined || ti === undefined) continue;

      particleProgress[i] = (particleProgress[i] + delta * PARTICLE_SPEED) % 1;
      const t = particleProgress[i];

      const sx = positions[si * 3];
      const sy = positions[si * 3 + 1];
      const sz = positions[si * 3 + 2];
      const tx = positions[ti * 3];
      const ty = positions[ti * 3 + 1];
      const tz = positions[ti * 3 + 2];

      particlePosAttr.setXYZ(
        i,
        sx + (tx - sx) * t,
        sy + (ty - sy) * t,
        sz + (tz - sz) * t,
      );
    }
    particlePosAttr.needsUpdate = true;
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
