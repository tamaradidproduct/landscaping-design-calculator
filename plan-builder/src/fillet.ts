// Rounding a corner between two sides that may be straight or bent (a circular arc, as `bulges` describe). The
// rounding circle of radius r touches both sides on the inside, so its centre lies on each side's inward offset
// curve (a parallel line, or a concentric circle). Page points throughout.
import type { Point } from './view';

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (v: Point): Point => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
const leftNormal = (a: Point, b: Point): Point => { const l = dist(a, b) || 1; return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l }; };
const TAU = 2 * Math.PI;
const ARC_SAMPLES = 16;

/** The circle behind a bent side a→b with bulge h (the arc passes through the chord's middle + left normal · h). */
export function arcOf(a: Point, b: Point, h: number) {
  const c = dist(a, b) / 2, R = (c * c + h * h) / (2 * Math.abs(h)), n = leftNormal(a, b), s = Math.sign(h);
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const O = { x: m.x + n.x * s * (Math.abs(h) - R), y: m.y + n.y * s * (Math.abs(h) - R) };
  const theta = 4 * Math.atan(Math.abs(h) / c), a0 = Math.atan2(a.y - O.y, a.x - O.x);
  const mid = { x: m.x + n.x * h, y: m.y + n.y * h };
  const at = (dir: number) => { const ang = a0 + dir * theta / 2; return Math.hypot(O.x + R * Math.cos(ang) - mid.x, O.y + R * Math.sin(ang) - mid.y); };
  return { O, R, theta, a0, dir: at(1) < at(-1) ? 1 : -1 };
}

/** The point a fraction t (0 = a, 1 = b) of the way along side a→b. */
export function edgeAt(a: Point, b: Point, h: number, t: number): Point {
  if (Math.abs(h) < 1e-9) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const { O, R, theta, a0, dir } = arcOf(a, b, h), ang = a0 + dir * theta * t;
  return { x: O.x + R * Math.cos(ang), y: O.y + R * Math.sin(ang) };
}

/** The points strictly between fractions t0 and t1 of a bent side (none for a straight one): what's left of it between two roundings. */
export function edgeBetween(a: Point, b: Point, h: number, t0: number, t1: number): Point[] {
  if (Math.abs(h) < 1e-9 || t1 <= t0) return [];
  const n = Math.max(1, Math.ceil(32 * (t1 - t0))), out: Point[] = [];
  for (let k = 1; k < n; k++) out.push(edgeAt(a, b, h, t0 + (t1 - t0) * k / n));
  return out;
}

/** +1 when the sides' left normals point inside the shape, −1 when they point outside (from the corners' winding). */
function interiorSign(pts: Point[]): number {
  let s = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; s += p.x * q.y - q.x * p.y; });
  return s >= 0 ? 1 : -1;
}

type Offset = { line: { p: Point; d: Point } } | { circle: { c: Point; R: number } };

/** Where the centres of circles of radius r touching side a→b on the inside lie: a parallel line or a concentric circle. */
function offsetOf(a: Point, b: Point, h: number, r: number, inside: number): Offset | null {
  const n = leftNormal(a, b);
  if (Math.abs(h) < 1e-9) return { line: { p: { x: a.x + n.x * inside * r, y: a.y + n.y * inside * r }, d: unit({ x: b.x - a.x, y: b.y - a.y }) } };
  const { O, R } = arcOf(a, b, h);
  // The centre is on the inside; the arc bulges toward Math.sign(h) · n, so the inside is its centre side when that bulge points out.
  const Roff = Math.sign(h) * inside < 0 ? R - r : R + r;
  return Roff > 1e-9 ? { circle: { c: O, R: Roff } } : null;
}

function intersect(u: Offset, v: Offset): Point[] {
  if ('line' in u && 'line' in v) {
    const { p: p1, d: d1 } = u.line, { p: p2, d: d2 } = v.line, cross = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(cross) < 1e-9) return [];
    const s = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / cross;
    return [{ x: p1.x + d1.x * s, y: p1.y + d1.y * s }];
  }
  if ('circle' in u && 'circle' in v) {
    const { c: c0, R: R0 } = u.circle, { c: c1, R: R1 } = v.circle, dd = dist(c0, c1);
    if (dd < 1e-9 || dd > R0 + R1 || dd < Math.abs(R0 - R1)) return [];
    const a = (R0 * R0 - R1 * R1 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, R0 * R0 - a * a));
    const m = { x: c0.x + a * (c1.x - c0.x) / dd, y: c0.y + a * (c1.y - c0.y) / dd }, px = -(c1.y - c0.y) / dd, py = (c1.x - c0.x) / dd;
    return [{ x: m.x + px * h, y: m.y + py * h }, { x: m.x - px * h, y: m.y - py * h }];
  }
  const [line, circle] = 'line' in u ? [u.line, (v as { circle: { c: Point; R: number } }).circle] : [(v as { line: { p: Point; d: Point } }).line, u.circle];
  const f = { x: line.p.x - circle.c.x, y: line.p.y - circle.c.y }, b = line.d.x * f.x + line.d.y * f.y, disc = b * b - (f.x * f.x + f.y * f.y - circle.R * circle.R);
  if (disc < 0) return [];
  const q = Math.sqrt(disc);
  return [-b + q, -b - q].map(s => ({ x: line.p.x + line.d.x * s, y: line.p.y + line.d.y * s }));
}

/** Where on side a→b (fraction 0..1) the circle centred at c touches it, and that point. */
function touch(a: Point, b: Point, h: number, c: Point): { t: number; at: Point } {
  if (Math.abs(h) < 1e-9) {
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2, t = ((c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y)) / l2;
    return { t, at: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t } };
  }
  const { O, R, theta, a0, dir } = arcOf(a, b, h), phi = Math.atan2(c.y - O.y, c.x - O.x);
  let diff = (((phi - a0) * dir) % TAU + TAU) % TAU;
  if (diff > (theta + TAU) / 2) diff -= TAU; // just before the start counts as negative
  return { t: diff / theta, at: { x: O.x + R * Math.cos(phi), y: O.y + R * Math.sin(phi) } };
}

export interface Fillet {
  /** The rounding's points, from where it leaves the side coming in to where it joins the side going out. */
  arc: Point[];
  /** Fraction along the incoming side (0 = its start, 1 = the corner) where the rounding begins. */
  tIn: number;
  /** Fraction along the outgoing side (0 = the corner, 1 = its end) where the rounding ends. */
  tOut: number;
}

/**
 * Corner i rounded with radius r, its sides straight or bent (`bulges[i]` bends side i, corner i → i+1). r shrinks until the
 * rounding takes at most half of each side; null when the corner stays sharp.
 */
export function cornerFillet(pts: Point[], bulges: number[] | undefined, i: number, r: number): Fillet | null {
  const n = pts.length; if (!(r > 0) || n < 3) return null;
  const pi = (i - 1 + n) % n, ni = (i + 1) % n, P = pts[i], inside = interiorSign(pts);
  const hIn = bulges?.[pi] ?? 0, hOut = bulges?.[i] ?? 0;
  const at = (rr: number): Fillet | null => {
    const u = offsetOf(pts[pi], P, hIn, rr, inside), v = offsetOf(P, pts[ni], hOut, rr, inside);
    if (!u || !v) return null;
    let best: { f: Fillet; d: number } | null = null;
    for (const c of intersect(u, v)) {
      const tin = touch(pts[pi], P, hIn, c), tout = touch(P, pts[ni], hOut, c);
      if (tin.t < 0.5 - 1e-9 || tin.t >= 1 - 1e-9 || tout.t <= 1e-9 || tout.t > 0.5 + 1e-9) continue;
      const a0 = Math.atan2(tin.at.y - c.y, tin.at.x - c.x);
      let sweep = Math.atan2(tout.at.y - c.y, tout.at.x - c.x) - a0;
      while (sweep > Math.PI) sweep -= TAU;
      while (sweep < -Math.PI) sweep += TAU;
      const arc: Point[] = [];
      for (let k = 0; k <= ARC_SAMPLES; k++) { const ang = a0 + sweep * k / ARC_SAMPLES; arc.push({ x: c.x + rr * Math.cos(ang), y: c.y + rr * Math.sin(ang) }); }
      const d = dist(c, P);
      if (!best || d < best.d) best = { f: { arc, tIn: tin.t, tOut: tout.t }, d };
    }
    return best?.f ?? null;
  };
  const full = at(r);
  if (full) return full;
  let lo = 0, hi = r, found: Fillet | null = null;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2, f = at(mid);
    if (f) { lo = mid; found = f; } else hi = mid;
  }
  return found;
}
