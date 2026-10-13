// Pure geometry and parsing for outlines. Coordinates are PDF points (1/72 in) on the plan page.
import type { Point } from './view';

export type OutlineKind = 'boundary' | 'house';
export const OUTLINE_LABEL: Record<OutlineKind, string> = { boundary: 'Plot boundary', house: 'House' };

export interface Outline { kind: OutlineKind; pts: Point[]; closed: boolean; }

/** Feet from text like 116.45, 116.45', 116' 6", 116 ft 6 in, 6". Null if unreadable or not positive. */
export function parseFeet(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/[’′]/g, "'").replace(/[”″]/g, '"');
  if (!s) return null;
  const m = s.match(/^(?:(\d+(?:\.\d+)?)\s*(?:'|ft|feet)?)?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inches))?$/);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  const ft = m[1] ? Number(m[1]) : 0, inches = m[2] ? Number(m[2]) : 0;
  if (inches >= 12 && m[1]) return null;
  const total = ft + inches / 12;
  return Number.isFinite(total) && total > 0 ? total : null;
}

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function edgeLengthPt(pts: Point[], i: number): number {
  return dist(pts[i], pts[(i + 1) % pts.length]);
}

export function areaPt2(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a) / 2;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Index of the closed outline's edge nearest to p, if within tol. */
export function nearestEdge(pts: Point[], p: Point, tol: number): number | null {
  let best: number | null = null, bd = tol;
  for (let i = 0; i < pts.length; i++) { const d = distToSegment(p, pts[i], pts[(i + 1) % pts.length]); if (d <= bd) { bd = d; best = i; } }
  return best;
}

export const formatFeet = (ft: number) => `${ft.toFixed(2)}′`;
export const formatArea = (sqft: number) => `${Math.round(sqft).toLocaleString('en-US')} sq ft`;
/** ftPerPt → "1 in on paper = 40.3 ft". */
export const formatScale = (ftPerPt: number) => `1 in on paper = ${(ftPerPt * 72).toFixed(1)} ft`;
/** Signed % difference of measured vs printed. */
export const percentOff = (measured: number, printed: number) => (measured - printed) / printed * 100;

export interface Guides { rightAngle: boolean; straight: boolean; alignX: Point | null; alignY: Point | null; }
/**
 * Visual hints only (nothing is locked). Points are in screen px.
 * rightAngle/straight: the new edge prev→p turns 90° / continues straight from edge prevprev→prev.
 * alignX/alignY: another corner sits in the same column / row as p.
 */
export function guides(prevprev: Point | null, prev: Point | null, p: Point, others: Point[], tolPx: number, tolDeg = 1.5): Guides {
  let rightAngle = false, straight = false;
  if (prevprev && prev) {
    const ax = prev.x - prevprev.x, ay = prev.y - prevprev.y, bx = p.x - prev.x, by = p.y - prev.y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la > 0 && lb > 8) {
      const ang = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))) * 180 / Math.PI; // 0 = straight on
      rightAngle = Math.abs(ang - 90) <= tolDeg;
      straight = ang <= tolDeg;
    }
  }
  const near = (f: (o: Point) => number) => others.reduce<Point | null>((best, o) => (Math.abs(f(o)) <= tolPx && (!best || Math.abs(f(o)) < Math.abs(f(best))) ? o : best), null);
  return { rightAngle, straight, alignX: near(o => o.x - p.x), alignY: near(o => o.y - p.y) };
}
