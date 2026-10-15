// Tidy a shape by lining corners up with each other. Every straight edge running close to "across" or "down"
// — in the outline's own direction, so a house drawn at an angle lines up with its own walls — is made exactly
// so; steeper edges (a 45° bay, a slanted lot line) and bent edges are left alone. Works in true shape (after
// any stretch correction), and bent edges keep their bulge per unit of chord.
import { dist } from './outline';
import { applyCorrection, invertCorrection, type Correction } from './scale';
import type { Point } from './view';

/**
 * Edges within this many degrees of across or down get lined up. Hand-traced walls are off by a degree or
 * two; real slants (Riesberg's side lot line runs 16° off vertical) must be left alone.
 */
const AXIS_TOLERANCE = 8;

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const angleBetween = (u: Point, v: Point) => Math.abs(Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y)) * 180 / Math.PI;
const rotate = (v: Point, rad: number): Point => ({ x: v.x * Math.cos(rad) - v.y * Math.sin(rad), y: v.x * Math.sin(rad) + v.y * Math.cos(rad) });

/**
 * Direction an edge leaves corner `from` toward `to` (page space): the chord, turned by the arc's
 * tangent–chord angle when bent. `h` is the edge's bulge as stored for the edge running from→to
 * (pass −h for an edge stored the other way round).
 */
function leaving(from: Point, to: Point, h: number): Point {
  const chord = sub(to, from), c = dist(from, to) / 2;
  if (!h || !c) return chord;
  return rotate(chord, 2 * Math.atan(h / c)); // a positive bulge (on the chord's left normal) turns the start toward it
}

/** The corner's angle in degrees (0–180) between its two edges where they leave it, in true shape. */
export function cornerAngle(pts: Point[], bulges: number[] | undefined, i: number, m: Correction): number {
  const n = pts.length, prev = (i - 1 + n) % n, next = (i + 1) % n;
  const toNext = leaving(pts[i], pts[next], bulges?.[i] ?? 0);
  const toPrev = leaving(pts[i], pts[prev], -(bulges?.[prev] ?? 0));
  return angleBetween(applyCorrection(m, toNext), applyCorrection(m, toPrev));
}

/**
 * The outline's own "across" direction (radians, true shape, mod 90°): the direction most of its straight-edge
 * length agrees with (within AXIS_TOLERANCE), so a long slanted lot line can't tilt it, then averaged over
 * those agreeing edges. Edges listed in `skip` (a corner being squared) only vote; they don't tilt the average
 * unless nothing else agrees.
 */
export function outlineFrame(pts: Point[], bulges: number[] | undefined, m: Correction, skip: number[] = []): number {
  const edges = pts.flatMap((a, i) => {
    if (bulges?.[i]) return [];
    const v = sub(applyCorrection(m, pts[(i + 1) % pts.length]), applyCorrection(m, a)), L = Math.hypot(v.x, v.y);
    return L ? [{ L, phi: Math.atan2(v.y, v.x), skipped: skip.includes(i) }] : [];
  });
  if (!edges.length) return 0;
  // Degrees between an edge and the nearest across/down of frame theta.
  const off = (phi: number, theta: number) => { const d = Math.abs(((phi - theta) * 180 / Math.PI) % 90); return Math.min(d, 90 - d); };
  const agreeing = (theta: number) => edges.filter(e => off(e.phi, theta) <= AXIS_TOLERANCE);
  const length = (es: typeof edges) => es.reduce((n, e) => n + e.L, 0);
  const best = edges.map(e => e.phi).reduce((t, phi) => length(agreeing(phi)) > length(agreeing(t)) ? phi : t);
  const inliers = agreeing(best), settled = inliers.filter(e => !e.skipped);
  let c = 0, s = 0;
  for (const e of settled.length ? settled : inliers) { c += e.L * Math.cos(4 * e.phi); s += e.L * Math.sin(4 * e.phi); }
  return Math.atan2(s, c) / 4;
}

type Axis = 'across' | 'down' | null;
/** Which way a straight edge runs in the frame, or null when it's slanted or bent. */
function axisOf(a: Point, b: Point, h: number): Axis {
  if (h) return null;
  const deg = Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180 / Math.PI;
  return deg <= AXIS_TOLERANCE ? 'across' : deg >= 90 - AXIS_TOLERANCE ? 'down' : null;
}

/** Page points ⇄ frame points (true shape, turned so the outline's own across runs along x). */
function frame(m: Correction, theta: number) {
  const inv = invertCorrection(m);
  return { to: (p: Point) => rotate(applyCorrection(m, p), -theta), from: (q: Point) => applyCorrection(inv, rotate(q, theta)) };
}

/** Keep each bent edge's bulge per unit of chord when its corners move. */
function rebend(before: Point[], after: Point[], bulges: number[] | undefined): number[] | undefined {
  return bulges?.map((h, i) => {
    const j = (i + 1) % before.length, was = dist(before[i], before[j]);
    return h && was ? h * dist(after[i], after[j]) / was : h;
  });
}

export interface Tidied { pts: Point[]; bulges?: number[] }

/**
 * Line corner i up with its neighbours: along an edge running across it takes that neighbour's height, along
 * one running down its left–right position. Only corner i moves. When both edges run the same way, the
 * nearer neighbour wins. The direction comes from the outline's other edges, so the off corner can't tilt it.
 */
export function alignCorner(pts: Point[], bulges: number[] | undefined, i: number, m: Correction): Tidied {
  const n = pts.length, prev = (i - 1 + n) % n, next = (i + 1) % n, f = frame(m, outlineFrame(pts, bulges, m, [prev, i]));
  const F = pts.map(f.to), c = { ...F[i] };
  const sides = [{ k: prev, axis: axisOf(F[prev], F[i], bulges?.[prev] ?? 0) }, { k: next, axis: axisOf(F[i], F[next], bulges?.[i] ?? 0) }]
    .sort((a, b) => dist(F[a.k], F[i]) - dist(F[b.k], F[i]));
  const across = sides.find(s => s.axis === 'across'), down = sides.find(s => s.axis === 'down');
  if (across) c.y = F[across.k].y;
  if (down) c.x = F[down.k].x;
  const out = [...pts]; out[i] = f.from(c);
  return { pts: out, bulges: rebend(pts, out, bulges) };
}

/** Line every corner up at once: corners joined by an across edge share a height, by a down edge a left–right position. */
export function alignAll(pts: Point[], bulges: number[] | undefined, m: Correction): Tidied {
  const n = pts.length, f = frame(m, outlineFrame(pts, bulges, m)), F = pts.map(f.to);
  const groups = (axis: Exclude<Axis, null>) => {
    const parent = pts.map((_, k) => k), root = (k: number): number => parent[k] === k ? k : (parent[k] = root(parent[k]));
    for (let i = 0; i < n; i++) if (axisOf(F[i], F[(i + 1) % n], bulges?.[i] ?? 0) === axis) parent[root(i)] = root((i + 1) % n);
    return pts.map((_, k) => root(k));
  };
  const mean = (g: number[], k: number, key: 'x' | 'y') => {
    const members = F.filter((_, j) => g[j] === g[k]);
    return members.reduce((s, p) => s + p[key], 0) / members.length;
  };
  const gy = groups('across'), gx = groups('down');
  const out = F.map((_, k) => f.from({ x: mean(gx, k, 'x'), y: mean(gy, k, 'y') }));
  return { pts: out, bulges: rebend(pts, out, bulges) };
}
