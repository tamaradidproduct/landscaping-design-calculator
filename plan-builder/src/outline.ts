// Pure geometry and parsing for outlines. Coordinates are PDF points (1/72 in) on the plan page.
import type { Point } from './view';
import type { MaterialId } from './materials';
import { cornerRound } from './shape-edit';
import { edgeAt, edgeBetween } from './fillet';
import { MARK } from './overlay-tokens';

/** The plot boundary is special (one per plan, sets the lot area); everything else is an existing feature. */
export type OutlineKind = 'boundary' | 'feature' | 'surface';
/** Common existing features, offered as one-tap names; the contractor can type any name. */
export const FEATURE_PRESETS = ['House', 'Driveway', 'Patio', 'Porch', 'Walk', 'Deck', 'Garage', 'Shed', 'Pool'];
/** Presets suggested on their own row in the Layers panel (the rest are quick picks behind "Custom outline…"). */
const SUGGESTED_FEATURES = ['House'];

/**
 * pts are corners; edge i runs from pts[i] to pts[i+1] (wrapping when closed).
 * bulges[i] bends edge i into a circular arc: the arc's midpoint sits bulges[i] PDF points off the
 * chord's midpoint, along the chord's left normal. 0 or missing = straight.
 */
export interface Outline {
  id: string; kind: OutlineKind; name: string; pts: Point[]; closed: boolean; bulges?: number[]; material?: MaterialId;
  /** Corner radii in page points (surfaces only; 0 or missing = sharp). */
  radii?: number[];
  /** A surface's texture scale: 1 = the material's own repeat (see TEX_SCALE for the range). */
  texScale?: number;
}

/** Layers sections: the lot (the plot boundary), Outlines (existing features) and Surfaces (new work). */
export type Section = 'lot' | 'outlines' | 'surfaces';
/** A zone's texture scale: smallest, largest, and the factor one press of − or + applies. */
export const TEX_SCALE = { min: 0.25, max: 4, step: 1.25 } as const;
/** One press of − (-1) or + (+1) on a zone's texture scale, kept within TEX_SCALE and free of rounding drift. */
export const stepTexScale = (scale: number, dir: 1 | -1): number =>
  Math.min(TEX_SCALE.max, Math.max(TEX_SCALE.min, Math.round(scale * TEX_SCALE.step ** dir * 1000) / 1000));
export const sectionOf = (kind: OutlineKind): Section => kind === 'boundary' ? 'lot' : kind === 'feature' ? 'outlines' : 'surfaces';
const SECTION_RANK: Record<Section, number> = { lot: 0, outlines: 1, surfaces: 2 };

/** The order layers cut each other in: the boundary, then every outline, then every surface (each in its own order). */
export const cutOrder = (outlines: Outline[]): Outline[] =>
  outlines.map((o, k) => ({ o, k })).sort((a, b) => SECTION_RANK[sectionOf(a.o.kind)] - SECTION_RANK[sectionOf(b.o.kind)] || a.k - b.k).map(x => x.o);

/** `ids` with `id` swapped with its nearest neighbour of the same section (dir −1 = up); null at the section's end. */
export function moveInSection(ids: string[], outlines: Record<string, Outline>, id: string, dir: -1 | 1): string[] | null {
  const o = outlines[id]; if (!o || o.kind === 'boundary') return null;
  const same = ids.filter(k => outlines[k] && sectionOf(outlines[k]!.kind) === sectionOf(o.kind));
  const at = same.indexOf(id), other = same[at + dir]; if (at < 0 || !other) return null;
  return ids.map(k => k === id ? other : k === other ? id : k);
}
/** Where a layer sits within its section (for disabling Move up / Move down at the ends). */
export function sectionPosition(ids: string[], outlines: Record<string, Outline>, id: string) {
  const o = outlines[id], same = o ? ids.filter(k => outlines[k] && sectionOf(outlines[k]!.kind) === sectionOf(o.kind)) : [];
  return { first: same[0] === id, last: same[same.length - 1] === id };
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** What the Layers panel offers to outline next: the boundary until there is one, House until a feature has that name,
 * and quick-pick names not used yet. */
export function outlineSuggestions(outlines: Outline[]): { boundary: boolean; features: string[]; picks: string[] } {
  const used = (name: string) => outlines.some(o => o.kind === 'feature' && sameName(o.name, name));
  return {
    boundary: !outlines.some(o => o.kind === 'boundary'),
    features: SUGGESTED_FEATURES.filter(n => !used(n)),
    picks: FEATURE_PRESETS.filter(n => !SUGGESTED_FEATURES.includes(n) && !used(n)),
  };
}

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

/** How an outline is drawn: freehand (corner by corner), or a rectangle dragged from one corner to the opposite one. */
export type OutlineShape = 'freehand' | 'rect';
/** The four corners of the rectangle with opposite corners a and b, square to the axes, in drawing order from a. */
export const rectCorners = (a: Point, b: Point): Point[] => [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];

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

/**
 * Splitting edge a→b (bulge h) at fraction t (0 < t < 1) into two: the new corner, and the two edges' bulges,
 * chosen so each sub-edge's own arc is part of the original circle — the split shows no kink. A straight edge
 * (h ≈ 0) splits into two straight edges at the lerp point.
 */
export function splitEdge(a: Point, b: Point, h: number, t: number): { point: Point; h1: number; h2: number } {
  if (Math.abs(h) < 1e-9) return { point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, h1: 0, h2: 0 };
  const point = edgeAt(a, b, h, t);
  // Each sub-edge's own arc midpoint (at half its own fraction of the original arc) sits exactly on the original
  // circle, so the bulge that reconstructs it from the sub-chord is exact: no visible kink at `point`.
  const mid1 = edgeAt(a, b, h, t / 2), mid2 = edgeAt(a, b, h, t + (1 - t) / 2);
  return { point, h1: bulgeToward(a, point, mid1), h2: bulgeToward(point, b, mid2) };
}

/**
 * Insert a corner splitting edge i (pts[i] → pts[(i+1) % n], bulge bulges[i]) at fraction t (0 < t < 1): works on
 * an open run (a line) or a closed ring (an outline/zone) alike, since edge i never wraps for an open run's last
 * point. A bent edge splits into two edges whose combined shape still matches the original curve.
 */
export function insertCorner(pts: Point[], bulges: number[] | undefined, i: number, t: number): { pts: Point[]; bulges: number[] | undefined } {
  const n = pts.length, a = pts[i], b = pts[(i + 1) % n], h = bulges?.[i] ?? 0;
  const { point, h1, h2 } = splitEdge(a, b, h, t);
  const newPts = [...pts.slice(0, i + 1), point, ...pts.slice(i + 1)];
  if (!bulges) return { pts: newPts, bulges: undefined };
  const newBulges = [...bulges]; newBulges.splice(i, 1, h1, h2);
  return { pts: newPts, bulges: newBulges };
}

/** A rough "inside" reference point for offHandle: the average of a shape's (or run's) own points. */
export function avgPoint(pts: Point[]): Point {
  if (!pts.length) return { x: 0, y: 0 };
  return pts.reduce((s, p) => ({ x: s.x + p.x / pts.length, y: s.y + p.y / pts.length }), { x: 0, y: 0 });
}

/**
 * An insert-point "+" handle position off edge a→b at its midpoint `mid`: away from reference point
 * `ref` (the shape's or run's own average point), so it never sits on the edge itself (where the bend handle is).
 */
export function offHandle(a: Point, b: Point, mid: Point, ref: Point, offset: number = MARK.insertOffset): Point {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const sign = (mid.x - ref.x) * nx + (mid.y - ref.y) * ny >= 0 ? 1 : -1;
  return { x: mid.x + nx * offset * sign, y: mid.y + ny * offset * sign };
}

/**
 * The outline as a dense polyline (arcs sampled). `radii` rounds corners of a closed outline (page points), also next to
 * a bent edge: the rounding then trims the arc.
 */
export function outlinePath(pts: Point[], bulges: number[] | undefined, closed: boolean, radii?: number[]): Point[] {
  const out: Point[] = [], n = pts.length, edges = closed ? n : n - 1;
  const rounds = pts.map((_, i) => closed && radii?.[i] ? cornerRound(pts, bulges, i, radii[i]) : null);
  for (let i = 0; i < edges; i++) {
    const j = (i + 1) % n;
    out.push(...(rounds[i]?.arc ?? [pts[i]]), ...edgeBetween(pts[i], pts[j], bulges?.[i] ?? 0, rounds[i]?.tOut ?? 0, rounds[j]?.tIn ?? 1));
  }
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

/** The closest point to p on a closed ring of points (its closing edge included), and how far it is. */
export function nearestOnRing(ring: Point[], p: Point): { point: Point; d: number } {
  let best = { point: ring[0], d: Infinity };
  ring.forEach((a, k) => {
    const b = ring[(k + 1) % ring.length], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
    const q = { x: a.x + t * dx, y: a.y + t * dy }, d = dist(q, p);
    if (d < best.d) best = { point: q, d };
  });
  return best;
}

/**
 * The order an edge tap tries layers in: the selected layer first, then outlines (they sit on top), then
 * surfaces from the top, then the plot boundary — so a zone edge lying on the lot line opens the zone's edge.
 */
export function edgeTapOrder(outlines: Outline[], selected: string | null): Outline[] {
  const order = cutOrder(outlines), lot = order.filter(o => o.kind === 'boundary');
  const rest = [...order.filter(o => o.kind !== 'boundary'), ...lot];
  return [...rest.filter(o => o.id === selected), ...rest.filter(o => o.id !== selected)];
}
/** What a point being placed may snap to: tracing the boundary or a feature ignores designed surfaces. */
export const snapSources = (outlines: Outline[], editing: OutlineKind | null): Outline[] =>
  editing === 'boundary' || editing === 'feature' ? outlines.filter(o => o.kind !== 'surface') : outlines;
/** A corner radius typed in feet: empty or zero means a sharp corner (0); null when it can't be read. */
export const parseRadius = (v: string): number | null => /^\s*0*\.?0*\s*['′]?\s*$/.test(v) ? 0 : parseFeet(v);
