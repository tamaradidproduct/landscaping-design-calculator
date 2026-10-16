// Editing a finished surface: moving it, pushing a side in or out, and rounding corners. Page points throughout.
import type { Point } from './view';

const unit = (v: Point): Point => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;

export const translate = (pts: Point[], dx: number, dy: number): Point[] => pts.map(p => ({ x: p.x + dx, y: p.y + dy }));

/**
 * Push side i (corner i → i+1) by the part of `delta` across it. Its two corners slide along their other sides,
 * so the neighbouring sides keep their direction and a rectangle stays a rectangle.
 */
export function pushSide(pts: Point[], i: number, delta: Point): Point[] {
  const n = pts.length, j = (i + 1) % n, e = unit(sub(pts[j], pts[i])), normal = { x: -e.y, y: e.x };
  const d = dot(delta, normal);
  const slide = (corner: number, from: number): Point => {
    const u = unit(sub(pts[corner], pts[from])), k = dot(u, normal);
    // A neighbour (nearly) parallel to the side can't carry it: move straight across instead.
    const step = Math.abs(k) < 0.1 ? { x: normal.x * d, y: normal.y * d } : { x: u.x * d / k, y: u.y * d / k };
    return { x: pts[corner].x + step.x, y: pts[corner].y + step.y };
  };
  return pts.map((p, k) => k === i ? slide(i, (i - 1 + n) % n) : k === j ? slide(j, (j + 1) % n) : p);
}

/** Corner i's inward bisector and half its angle (radians). */
export function cornerBisector(pts: Point[], i: number): { dir: Point; half: number } {
  const n = pts.length, toPrev = unit(sub(pts[(i - 1 + n) % n], pts[i])), toNext = unit(sub(pts[(i + 1) % n], pts[i]));
  const half = Math.acos(Math.max(-1, Math.min(1, dot(toPrev, toNext)))) / 2;
  return { dir: unit({ x: toPrev.x + toNext.x, y: toPrev.y + toNext.y }), half };
}
/** How far the middle of a corner's arc sits from the corner, for radius r. */
export const roundHandleDistance = (r: number, half: number) => r / Math.sin(half) - r;
/** The radius whose arc middle sits `d` from the corner. */
export const radiusFromHandle = (d: number, half: number) => Math.max(0, d / (1 / Math.sin(half) - 1));

const ARC_SAMPLES = 16;
/**
 * Corner i rounded with radius r (clamped so it takes at most half of each side): the arc's points from the side
 * coming in to the side going out, or null when the corner stays sharp.
 */
export function cornerArc(pts: Point[], i: number, r: number): Point[] | null {
  const n = pts.length; if (!(r > 0) || n < 3) return null;
  const p = pts[i], prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
  const { dir, half } = cornerBisector(pts, i); if (half < 1e-3 || half > Math.PI / 2 - 1e-3) return null;
  const lenIn = Math.hypot(prev.x - p.x, prev.y - p.y), lenOut = Math.hypot(next.x - p.x, next.y - p.y);
  const t = Math.min(r / Math.tan(half), lenIn / 2, lenOut / 2), rr = t * Math.tan(half);
  const uIn = unit(sub(prev, p)), uOut = unit(sub(next, p)), dc = rr / Math.sin(half);
  const c = { x: p.x + dir.x * dc, y: p.y + dir.y * dc };
  const a = { x: p.x + uIn.x * t, y: p.y + uIn.y * t }, b = { x: p.x + uOut.x * t, y: p.y + uOut.y * t };
  const a0 = Math.atan2(a.y - c.y, a.x - c.x);
  let sweep = Math.atan2(b.y - c.y, b.x - c.x) - a0;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  const out: Point[] = [];
  for (let k = 0; k <= ARC_SAMPLES; k++) { const ang = a0 + sweep * k / ARC_SAMPLES; out.push({ x: c.x + rr * Math.cos(ang), y: c.y + rr * Math.sin(ang) }); }
  return out;
}

/** The two-way arrow pointer for pushing a side whose (screen) normal is `n`: the nearest of the four CSS ones. */
export function resizeCursor(n: Point): string {
  const deg = ((Math.atan2(n.y, n.x) * 180 / Math.PI) % 180 + 180) % 180;
  return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][Math.round(deg / 45) % 4];
}
/** One arrow-key step of a corner radius in feet: 0.5′ (Shift: 2′), onto that grid, never below 0. */
export function stepRadius(ft: number, dir: 1 | -1, big: boolean): number {
  const step = big ? 2 : 0.5;
  const next = dir > 0 ? Math.floor(ft / step + 1e-9) * step + step : Math.ceil(ft / step - 1e-9) * step - step;
  return Math.max(0, Math.round(next * 100) / 100);
}
