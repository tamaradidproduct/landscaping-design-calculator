// Resizing a surface to a typed edge length: the zone stretches along that edge, from the end that stays put.
// Everything happens in true shape (the plan's stretch correction applied), so typed sizes are real sizes.
import { bulgeToward, edgeMid, edgePoints } from './outline';
import { applyCorrection, invertCorrection, type Correction } from './scale';
import type { Tidied } from './square';
import type { Point } from './view';

/** Length of edge i in true-shape points (arcs sampled as the app measures them). */
export function trueEdgeLength(pts: Point[], bulges: number[] | undefined, i: number, m: Correction): number {
  const b = pts[(i + 1) % pts.length], line = [...edgePoints(pts[i], b, bulges?.[i] ?? 0), b].map(p => applyCorrection(m, p));
  let L = 0;
  for (let k = 0; k + 1 < line.length; k++) L += Math.hypot(line[k + 1].x - line[k].x, line[k + 1].y - line[k].y);
  return L;
}

/**
 * Stretch the shape along edge i so that edge measures `length` (true-shape points). `fixed` 0 keeps corner i,
 * 1 keeps corner i+1; every corner moves by (k − 1)·((P − F)·u)·u in true shape, so a rectangle stays square.
 * Bent edges keep passing through their stretched middles; on a bent edge i, `length` is its arc length.
 */
export function stretchEdge(pts: Point[], bulges: number[] | undefined, i: number, fixed: 0 | 1, length: number, m: Correction): Tidied {
  const n = pts.length, T = (p: Point) => applyCorrection(m, p), inv = invertCorrection(m), B = (p: Point) => applyCorrection(inv, p);
  const q = pts.map(T), a = q[i], b = q[(i + 1) % n], F = fixed ? b : a;
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  if (chord < 1e-9) return { pts, bulges }; // a collapsed edge has no direction to stretch along
  const u = { x: (b.x - a.x) / chord, y: (b.y - a.y) / chord };
  const mids = pts.map((_, j) => T(edgeMid(pts, j, bulges)));
  const at = (k: number): Tidied => {
    const move = (P: Point) => { const t = (k - 1) * ((P.x - F.x) * u.x + (P.y - F.y) * u.y); return B({ x: P.x + t * u.x, y: P.y + t * u.y }); };
    const out = q.map(move);
    return { pts: out, bulges: bulges && out.map((p, j) => bulges[j] ? bulgeToward(p, out[(j + 1) % n], move(mids[j])) : 0) };
  };
  if (!bulges?.[i]) return at(length / chord);
  // Bent edge: its arc length grows with k, so bisect for the k that gives the typed length.
  const lo = 1e-3, hi0 = length / chord;
  let hi = Math.max(lo * 2, hi0), low = lo;
  for (let step = 0; step < 200 && hi - low > 1e-12 * hi; step++) {
    const mid = (low + hi) / 2, r = at(mid);
    if (trueEdgeLength(r.pts, r.bulges, i, m) < length) low = mid; else hi = mid;
  }
  return at((low + hi) / 2);
}

/** The shape's bounding box in true shape (arcs sampled as the app measures them): width, depth and center. */
export function boxSize(pts: Point[], bulges: number[] | undefined, m: Correction): { w: number; h: number; cx: number; cy: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach((a, i) => {
    for (const p of edgePoints(a, pts[(i + 1) % pts.length], bulges?.[i] ?? 0)) {
      const t = applyCorrection(m, p);
      x0 = Math.min(x0, t.x); x1 = Math.max(x1, t.x); y0 = Math.min(y0, t.y); y1 = Math.max(y1, t.y);
    }
  });
  return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/**
 * Resize the shape so its bounding box is `size` wide ('w') or deep ('h') in true-shape points, scaling about the
 * box center. `lock` scales the other axis by the same factor. Bent edges keep passing through their scaled middles,
 * so with bends the factor is solved numerically until the box (bulges included) measures `size`.
 */
export function resizeBox(pts: Point[], bulges: number[] | undefined, axis: 'w' | 'h', size: number, lock: boolean, m: Correction): Tidied {
  const n = pts.length, T = (p: Point) => applyCorrection(m, p), inv = invertCorrection(m), B = (p: Point) => applyCorrection(inv, p);
  const box = boxSize(pts, bulges, m), now = box[axis];
  if (now < 1e-9) return { pts, bulges }; // a flat shape has no extent on this axis to scale
  const q = pts.map(T), mids = pts.map((_, j) => T(edgeMid(pts, j, bulges)));
  const at = (k: number): Tidied => {
    const kx = axis === 'w' || lock ? k : 1, ky = axis === 'h' || lock ? k : 1;
    const move = (P: Point) => B({ x: box.cx + kx * (P.x - box.cx), y: box.cy + ky * (P.y - box.cy) });
    const out = q.map(move);
    return { pts: out, bulges: bulges && out.map((p, j) => bulges[j] ? bulgeToward(p, out[(j + 1) % n], move(mids[j])) : 0) };
  };
  const k0 = size / now;
  if (!bulges?.some(Boolean)) return at(k0);
  const width = (k: number) => { const r = at(k); return boxSize(r.pts, r.bulges, m)[axis]; };
  let low = 1e-3, hi = Math.max(low * 2, k0 * 2);
  while (width(hi) < size && hi < 1e9) hi *= 2;
  for (let step = 0; step < 200 && hi - low > 1e-12 * hi; step++) {
    const mid = (low + hi) / 2;
    if (width(mid) < size) low = mid; else hi = mid;
  }
  return at((low + hi) / 2);
}
