// Scale from printed lengths. One typed length sets one scale; two or more on edges running different
// ways also correct a plan stretched unevenly across and down. Pure math; coordinates are PDF points.
import type { Point } from './view';

/**
 * Takes page points to true-shape points: (x, y) → (a·x + b·y, c·x + d·y). For now only a stretch down
 * the page (a = 1, b = c = 0); skew later fills in b and c without changing this shape.
 */
export interface Correction { a: number; b: number; c: number; d: number }
export const IDENTITY: Correction = { a: 1, b: 0, c: 0, d: 1 };
export const applyCorrection = (m: Correction, p: Point): Point => ({ x: m.a * p.x + m.b * p.y, y: m.c * p.x + m.d * p.y });
export function invertCorrection(m: Correction): Correction {
  const det = m.a * m.d - m.b * m.c;
  return { a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det };
}
export const sameCorrection = (m: Correction, n: Correction) => m.a === n.a && m.b === n.b && m.c === n.c && m.d === n.d;

/** A printed length the contractor typed for one outline edge. */
export interface Reference { id: string; i: number; feet: number }

export interface Calibration {
  /** Feet per true-shape point (= per page point across the page). */
  ftPerPt: number;
  correction: Correction;
  /** Across and down scales differ (the correction stretches the plan). */
  stretched: boolean;
  /** Two or more references, but all running the same way: they can't tell across from down. */
  needsOtherDirection: boolean;
}

/** References whose horizontal shares differ by less than this can't separate the two scales. */
const MIN_SPREAD = 0.4;

/** Length in feet of a polyline (page points) under a calibration. */
export function lineFeet(line: Point[], cal: Calibration): number {
  let L = 0;
  for (let k = 0; k + 1 < line.length; k++) {
    const a = applyCorrection(cal.correction, line[k]), b = applyCorrection(cal.correction, line[k + 1]);
    L += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return L * cal.ftPerPt;
}

/** Feet along a polyline with sx ft/pt across and sy ft/pt down, and the derivatives by sx and sy. */
function measure(line: Point[], sx: number, sy: number) {
  let L = 0, dsx = 0, dsy = 0;
  for (let k = 0; k + 1 < line.length; k++) {
    const dx = line[k + 1].x - line[k].x, dy = line[k + 1].y - line[k].y, seg = Math.hypot(sx * dx, sy * dy);
    if (seg === 0) continue;
    L += seg; dsx += sx * dx * dx / seg; dsy += sy * dy * dy / seg;
  }
  return { L, dsx, dsy };
}

/**
 * Best fit to the typed lengths (each line is the edge as page points, arcs sampled). Errors are weighed
 * relative to each length, so a short edge counts as much as a long one.
 */
export function calibrate(refs: { line: Point[]; feet: number }[]): Calibration | null {
  if (!refs.length) return null;
  // One scale: minimise Σ ((s·P − L) / L)².
  const pts = refs.map(r => measure(r.line, 1, 1).L);
  const uniform = refs.reduce((n, r, k) => n + pts[k] / r.feet, 0) / refs.reduce((n, r, k) => n + (pts[k] / r.feet) ** 2, 0);
  // How much of each edge runs across the page (1 = horizontal, 0 = vertical).
  const across = refs.map((r, k) => measure(r.line, 1, 0).L / (pts[k] || 1));
  const spread = Math.max(...across) - Math.min(...across);
  if (refs.length < 2 || spread < MIN_SPREAD) {
    return { ftPerPt: uniform, correction: IDENTITY, stretched: false, needsOtherDirection: refs.length >= 2 };
  }
  // Two scales: Gauss–Newton on the relative errors, starting from the single scale.
  let sx = uniform, sy = uniform;
  for (let it = 0; it < 30; it++) {
    let jxx = 0, jxy = 0, jyy = 0, gx = 0, gy = 0;
    for (const r of refs) {
      const m = measure(r.line, sx, sy), res = (m.L - r.feet) / r.feet, jx = m.dsx / r.feet, jy = m.dsy / r.feet;
      jxx += jx * jx; jxy += jx * jy; jyy += jy * jy; gx += jx * res; gy += jy * res;
    }
    const det = jxx * jyy - jxy * jxy;
    if (!det) break;
    const stepX = (jyy * gx - jxy * gy) / det, stepY = (jxx * gy - jxy * gx) / det;
    sx -= stepX; sy -= stepY;
    if (Math.abs(stepX) < 1e-12 * sx && Math.abs(stepY) < 1e-12 * sy) break;
  }
  return { ftPerPt: sx, correction: { a: 1, b: 0, c: 0, d: sy / sx }, stretched: true, needsOtherDirection: false };
}
