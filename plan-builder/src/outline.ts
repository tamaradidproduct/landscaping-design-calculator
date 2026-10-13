// Pure geometry and parsing for outlines. Coordinates are PDF points (1/72 in) on the plan page.
import type { Point } from './view';

/** The plot boundary is special (one per plan, sets the lot area); everything else is an existing feature. */
export type OutlineKind = 'boundary' | 'feature';
/** Quick-pick names for existing features; the contractor can type any name. */
export const FEATURE_PRESETS = ['House', 'Driveway', 'Patio', 'Walk', 'Deck'];

/**
 * pts are corners; edge i runs from pts[i] to pts[i+1] (wrapping when closed).
 * bulges[i] bends edge i into a circular arc: the arc's midpoint sits bulges[i] PDF points off the
 * chord's midpoint, along the chord's left normal. 0 or missing = straight.
 */
export interface Outline { id: string; kind: OutlineKind; name: string; pts: Point[]; closed: boolean; bulges?: number[]; }

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

const leftNormal = (a: Point, b: Point): Point => { const l = dist(a, b) || 1; return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l }; };

/** Signed distance of p from the chord a→b's midpoint, along the chord's left normal: the bulge that puts the arc through p. */
export function bulgeToward(a: Point, b: Point, p: Point): number {
  const n = leftNormal(a, b);
  return (p.x - (a.x + b.x) / 2) * n.x + (p.y - (a.y + b.y) / 2) * n.y;
}

/** Midpoint of edge i (on the arc when bent). */
export function edgeMid(pts: Point[], i: number, bulges?: number[]): Point {
  const a = pts[i], b = pts[(i + 1) % pts.length], h = bulges?.[i] ?? 0, n = leftNormal(a, b);
  return { x: (a.x + b.x) / 2 + n.x * h, y: (a.y + b.y) / 2 + n.y * h };
}

/** Points along edge a→b with bulge h: includes a, excludes b. */
export function edgePoints(a: Point, b: Point, h: number, samples = 32): Point[] {
  if (Math.abs(h) < 1e-9) return [a];
  const c = dist(a, b) / 2;
  if (c === 0) return [a];
  const r = (c * c + h * h) / (2 * Math.abs(h)), n = leftNormal(a, b);
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const s = Math.sign(h), center = { x: m.x + n.x * s * (Math.abs(h) - r), y: m.y + n.y * s * (Math.abs(h) - r) };
  const theta = 4 * Math.atan(Math.abs(h) / c);
  const a0 = Math.atan2(a.y - center.y, a.x - center.x);
  // Sweep direction: whichever way passes through the arc's midpoint.
  const mid = { x: m.x + n.x * h, y: m.y + n.y * h };
  const tryDir = (dir: number) => { const ang = a0 + dir * theta / 2; return Math.hypot(center.x + r * Math.cos(ang) - mid.x, center.y + r * Math.sin(ang) - mid.y); };
  const dir = tryDir(1) < tryDir(-1) ? 1 : -1;
  const out: Point[] = [];
  for (let k = 0; k < samples; k++) { const ang = a0 + dir * theta * k / samples; out.push({ x: center.x + r * Math.cos(ang), y: center.y + r * Math.sin(ang) }); }
  return out;
}

/** The outline as a dense polyline (arcs sampled). */
export function outlinePath(pts: Point[], bulges: number[] | undefined, closed: boolean): Point[] {
  const out: Point[] = [], edges = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < edges; i++) out.push(...edgePoints(pts[i], pts[(i + 1) % pts.length], bulges?.[i] ?? 0));
  if (!closed && pts.length) out.push(pts[pts.length - 1]);
  return out;
}

export function edgeLengthPt(pts: Point[], i: number, bulges?: number[]): number {
  const a = pts[i], b = pts[(i + 1) % pts.length], h = Math.abs(bulges?.[i] ?? 0), c = dist(a, b) / 2;
  if (h < 1e-9 || c === 0) return dist(a, b);
  const r = (c * c + h * h) / (2 * h);
  return r * 4 * Math.atan(h / c);
}

/** Area of a closed outline: the corner polygon plus (or minus) the circular segment of each bent edge. */
export function areaPt2(pts: Point[], bulges?: number[]): number {
  let signed = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; signed += p.x * q.y - q.x * p.y; }
  signed /= 2;
  let area = Math.abs(signed);
  pts.forEach((a, i) => {
    const h = bulges?.[i] ?? 0, c = dist(a, pts[(i + 1) % pts.length]) / 2;
    if (Math.abs(h) < 1e-9 || c === 0) return;
    const r = (c * c + h * h) / (2 * Math.abs(h)), theta = 4 * Math.atan(Math.abs(h) / c);
    const segment = r * r / 2 * (theta - Math.sin(theta));
    // The left normal points inside when the corners run with positive signed area.
    area += Math.sign(h) === Math.sign(signed) ? -segment : segment;
  });
  return area;
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Index of the closed outline's edge nearest to p, if within tol. */
export function nearestEdge(pts: Point[], p: Point, tol: number, bulges?: number[]): number | null {
  let best: number | null = null, bd = tol;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], line = [...edgePoints(a, b, bulges?.[i] ?? 0), b];
    for (let k = 0; k + 1 < line.length; k++) { const d = distToSegment(p, line[k], line[k + 1]); if (d <= bd) { bd = d; best = i; } }
  }
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

/**
 * Shift-drawing: the point constrained to the nearest 45° direction from the anchor (screen px,
 * angles measured on screen, y up), keeping its distance along that direction.
 */
export function constrain45(anchor: Point, p: Point): { point: Point; angle: number } {
  const dx = p.x - anchor.x, dy = p.y - anchor.y;
  const step = Math.PI / 4, ang = Math.round(Math.atan2(-dy, dx) / step) * step;
  const ux = Math.cos(ang), uy = -Math.sin(ang), len = Math.max(0, dx * ux + dy * uy);
  return { point: { x: anchor.x + ux * len, y: anchor.y + uy * len }, angle: ((Math.round(ang / step) * 45) % 360 + 360) % 360 };
}

/** Even-odd test: is p inside the polygon through pts? */
export function insidePolygon(pts: Point[], p: Point): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < a.x + (p.y - a.y) * (b.x - a.x) / (b.y - a.y)) inside = !inside;
  }
  return inside;
}

/** Where to put a shape's name: its centroid, or — when that falls outside (L-shapes) — the middle of the widest span across the shape at that height. */
export function labelPoint(pts: Point[]): Point {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], k = p.x * q.y - q.x * p.y;
    a += k; cx += (p.x + q.x) * k; cy += (p.y + q.y) * k;
  }
  const c = a ? { x: cx / (3 * a), y: cy / (3 * a) } : pts[0];
  if (!c || insidePolygon(pts, c)) return c;
  const xs: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    if ((p.y > c.y) !== (q.y > c.y)) xs.push(p.x + (c.y - p.y) * (q.x - p.x) / (q.y - p.y));
  }
  xs.sort((m, n) => m - n);
  let best = c, w = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > w) { w = xs[i + 1] - xs[i]; best = { x: (xs[i] + xs[i + 1]) / 2, y: c.y }; }
  return best;
}
