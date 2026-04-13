import type { GraphLink } from "./types";

const CROSS_LAYER_COLOR = { r: 1.0, g: 1.0, b: 1.0 };
const CROSS_LAYER_ALPHA = 0.08;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function tessellateArc(
  a: Vec3,
  b: Vec3,
  sphereRadius: number,
  arcLift: number,
  segments: number,
): Vec3[] {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const mz = (a.z + b.z) / 2;

  const mLen = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
  const cpDist = sphereRadius * arcLift;
  const cpx = (mx / mLen) * cpDist;
  const cpy = (my / mLen) * cpDist;
  const cpz = (mz / mLen) * cpDist;

  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const t1 = 1 - t;
    points.push({
      x: t1 * t1 * a.x + 2 * t1 * t * cpx + t * t * b.x,
      y: t1 * t1 * a.y + 2 * t1 * t * cpy + t * t * b.y,
      z: t1 * t1 * a.z + 2 * t1 * t * cpz + t * t * b.z,
    });
  }

  return points;
}

export function buildArcGeometryArrays(
  links: GraphLink[],
  nodePositions: Float32Array,
  nodeIndexMap: Map<string, number>,
  nodeCategories: Map<string, string>,
  categoryColors: Map<string, { r: number; g: number; b: number }>,
  sphereRadius: number,
  arcLift: number,
  segments: number,
): {
  positions: Float32Array;
  colors: Float32Array;
  linkSourceTargets: Array<{ source: string; target: string }>;
} {
  const DEFAULT_COLOR = { r: 0.886, g: 0.910, b: 0.941 };
  const DEFAULT_ALPHA = 0.15;

  const validLinks: Array<{
    source: string;
    target: string;
    si: number;
    ti: number;
    relation?: string;
  }> = [];

  for (const link of links) {
    const si = nodeIndexMap.get(link.source);
    const ti = nodeIndexMap.get(link.target);
    if (si === undefined || ti === undefined) continue;
    validLinks.push({ source: link.source, target: link.target, si, ti, relation: link.relation });
  }

  const vertexCount = validLinks.length * segments * 2;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 4);
  const linkSourceTargets: Array<{ source: string; target: string }> = [];

  let vertexOffset = 0;

  for (const { source, target, si, ti, relation } of validLinks) {
    const a: Vec3 = {
      x: nodePositions[si * 3],
      y: nodePositions[si * 3 + 1],
      z: nodePositions[si * 3 + 2],
    };
    const b: Vec3 = {
      x: nodePositions[ti * 3],
      y: nodePositions[ti * 3 + 1],
      z: nodePositions[ti * 3 + 2],
    };

    const points = tessellateArc(a, b, sphereRadius, arcLift, segments);
    const srcCat = nodeCategories.get(source) ?? "";
    const tgtCat = nodeCategories.get(target) ?? "";

    const isCrossLayer = relation === "cross_layer";
    const srcCol = isCrossLayer ? CROSS_LAYER_COLOR : (categoryColors.get(srcCat) ?? DEFAULT_COLOR);
    const tgtCol = isCrossLayer ? CROSS_LAYER_COLOR : (categoryColors.get(tgtCat) ?? DEFAULT_COLOR);
    const edgeAlpha = isCrossLayer ? CROSS_LAYER_ALPHA : DEFAULT_ALPHA;

    for (let s = 0; s < segments; s++) {
      const p0 = points[s];
      const p1 = points[s + 1];
      const t0 = s / segments;
      const t1 = (s + 1) / segments;

      positions[vertexOffset * 3] = p0.x;
      positions[vertexOffset * 3 + 1] = p0.y;
      positions[vertexOffset * 3 + 2] = p0.z;
      colors[vertexOffset * 4] = srcCol.r + (tgtCol.r - srcCol.r) * t0;
      colors[vertexOffset * 4 + 1] = srcCol.g + (tgtCol.g - srcCol.g) * t0;
      colors[vertexOffset * 4 + 2] = srcCol.b + (tgtCol.b - srcCol.b) * t0;
      colors[vertexOffset * 4 + 3] = edgeAlpha;
      vertexOffset++;

      positions[vertexOffset * 3] = p1.x;
      positions[vertexOffset * 3 + 1] = p1.y;
      positions[vertexOffset * 3 + 2] = p1.z;
      colors[vertexOffset * 4] = srcCol.r + (tgtCol.r - srcCol.r) * t1;
      colors[vertexOffset * 4 + 1] = srcCol.g + (tgtCol.g - srcCol.g) * t1;
      colors[vertexOffset * 4 + 2] = srcCol.b + (tgtCol.b - srcCol.b) * t1;
      colors[vertexOffset * 4 + 3] = edgeAlpha;
      vertexOffset++;
    }

    linkSourceTargets.push({ source, target });
  }

  return { positions, colors, linkSourceTargets };
}
