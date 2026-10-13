// Snapping to what is drawn on the plan, using only its pixels — works the same for vector PDFs
// and scanned images. The input is a small luminance window (1 sample per screen px) around the
// point being placed. We find the strongest long lines with a Hough transform, refine each with a
// least-squares fit, then snap to their intersection (a corner) or onto the nearest line.
import type { Point } from './view';

export const SNAP_WINDOW = 64;      // window side, screen px (wide enough to pull from ~26 px away)
const DARK = 140;                   // luminance below this counts as ink
const MIN_VOTES = 19;               // ink pixels a line needs: rejects letters and digits
const CORNER_RADIUS = 26;           // screen px from the point: corners pull from this far
const LINE_RADIUS = 14;
const INLIER = 2.5;
const MAX_GAP = 2.5;                // a solid line: gaps longer than this end its stretch
const DASH_GAP = 8;                 // a dashed line (property lines often are): gaps up to this
const MAX_LINES = 6;                // lettering can produce line-like runs; leave room for the real lines
const LONG_RUN = 40;                // screen px of unbroken ink: certainly a drawn line
const MIN_RUN = 14.4;               // and runs at least this far (screen px) without a gap (rejects lettering that happens to line up)
let PURITY = 0.8, LOOSE = 3.5;   // purity test for lettering vs. drawn lines (see strongestLine)
/** For tuning only. */
export function tuneSnap(purity: number, loose: number) { PURITY = purity; LOOSE = loose; }

export interface ImageSnap { x: number; y: number; kind: 'corner' | 'line'; }
interface Line { px: number; py: number; ux: number; uy: number; votes: number; t0: number; t1: number; ink: number; }

/** The few strongest long lines in the window, each with the stretch where it is actually drawn. */
function detectLines(gray: Float32Array, n: number): Line[] {
  let pts: Point[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (gray[y * n + x] < DARK) pts.push({ x: x + 0.5, y: y + 0.5 });
  if (pts.length < MIN_VOTES) return [];
  const ink = pts, lines: Line[] = [];
  for (let k = 0; k < MAX_LINES; k++) {
    const l = strongestLine(pts, ink, n); if (!l) break;
    lines.push(l);
    pts = pts.filter(p => distToLine(p, l) > INLIER);
  }
  return lines;
}

export interface Ray { x: number; y: number; ux: number; uy: number; }
/**
 * Snapping while Shift holds the edge on a ray: the result always stays on the ray. Prefers a drawn
 * corner lying on the ray (within 6 px) or the point where the ray crosses a drawn line — whichever
 * is nearest the pointer, corners slightly favoured.
 */
export function findSnapOnRay(gray: Float32Array, at: Point, ray: Ray, n = SNAP_WINDOW): ImageSnap | null {
  const lines = detectLines(gray, n);
  const onRay = (p: Point) => { const t = (p.x - ray.x) * ray.ux + (p.y - ray.y) * ray.uy; return { x: ray.x + t * ray.ux, y: ray.y + t * ray.uy, off: Math.abs((p.x - ray.x) * ray.uy - (p.y - ray.y) * ray.ux) }; };
  const asLine: Line = { px: ray.x, py: ray.y, ux: ray.ux, uy: ray.uy, votes: 0, t0: -1e9, t1: 1e9, ink: 0 };
  let best: ImageSnap & { d: number } | null = null;
  const consider = (p: Point, kind: 'corner' | 'line') => {
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d > CORNER_RADIUS) return;
    const score = d - (kind === 'corner' ? 4 : 0); // nearest wins; a corner gets a small edge over a plain crossing
    if (!best || score < best.d) best = { x: p.x, y: p.y, kind, d: score };
  };
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i], b = lines[j];
    if (Math.abs(a.ux * b.ux + a.uy * b.uy) > Math.cos(20 * Math.PI / 180)) continue;
    const hit = intersect(a, b);
    if (!hit || !onStretch(a, hit) || !onStretch(b, hit)) continue;
    const q = onRay(hit);
    if (q.off <= 6) consider(q, 'corner');
  }
  for (const l of lines) {
    if (Math.abs(l.ux * ray.ux + l.uy * ray.uy) > Math.cos(10 * Math.PI / 180)) continue; // parallel to the ray
    const hit = intersect(asLine, l);
    if (hit && onStretch(l, hit)) consider(hit, 'line');
  }
  return best ? { x: (best as ImageSnap).x, y: (best as ImageSnap).y, kind: (best as ImageSnap).kind } : null;
}

export function findImageSnap(gray: Float32Array, at: Point, n = SNAP_WINDOW): ImageSnap | null {
  const lines = detectLines(gray, n);
  if (!lines.length) return null;

  // Corner: where two non-parallel lines meet on (or right at the end of) both drawn stretches.
  let corner: (Point & { score: number }) | null = null;
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const a = lines[i], b = lines[j];
    if (Math.abs(a.ux * b.ux + a.uy * b.uy) > Math.cos(20 * Math.PI / 180)) continue;
    const hit = intersect(a, b);
    if (!hit || Math.hypot(hit.x - at.x, hit.y - at.y) > CORNER_RADIUS || !onStretch(a, hit) || !onStretch(b, hit)) continue;
    // Prefer corners between heavy lines (outlines are drawn heavier than dimension and hatch lines),
    // then between long lines.
    const score = Math.min(weight(a), weight(b)) * 100 + Math.min(a.t1 - a.t0, b.t1 - b.t0);
    if (!corner || score > corner.score) corner = { ...hit, score };
  }
  if (corner) return { x: corner.x, y: corner.y, kind: 'corner' };

  // Otherwise onto the nearest drawn line.
  let best: (Point & { d: number }) | null = null;
  for (const l of lines) {
    const t = (at.x - l.px) * l.ux + (at.y - l.py) * l.uy;
    if (t < l.t0 - 2 || t > l.t1 + 2) continue;
    const p = { x: l.px + t * l.ux, y: l.py + t * l.uy }, d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d <= LINE_RADIUS && (!best || d < best.d)) best = { ...p, d };
  }
  return best ? { x: best.x, y: best.y, kind: 'line' } : null;
}

/** Ink per px of length, i.e. drawn thickness. */
const weight = (l: Line) => l.ink / Math.max(1, l.t1 - l.t0);
const onStretch = (l: Line, p: Point) => { const t = (p.x - l.px) * l.ux + (p.y - l.py) * l.uy; return t >= l.t0 - 2.5 && t <= l.t1 + 2.5; };

/** Strongest line among `pts` (Hough), refined against all `ink` so its drawn stretch is complete. */
function strongestLine(pts: Point[], ink: Point[], n: number): Line | null {
  const thetas = 180, rMax = Math.ceil(n * Math.SQRT2), acc = new Uint16Array(thetas * (2 * rMax + 1));
  const cos = new Float32Array(thetas), sin = new Float32Array(thetas);
  for (let t = 0; t < thetas; t++) { cos[t] = Math.cos(t * Math.PI / thetas); sin[t] = Math.sin(t * Math.PI / thetas); }
  for (const p of pts) for (let t = 0; t < thetas; t++) acc[t * (2 * rMax + 1) + Math.round(p.x * cos[t] + p.y * sin[t]) + rMax]++;
  // Try the strongest Hough peaks in turn; keep the first that is a continuous drawn line.
  for (let attempt = 0; attempt < 12; attempt++) {
    // Score each bin with its stronger neighbour: a 2–3 px thick line splits its votes across bins.
    let best = 0, bi = -1;
    const W = 2 * rMax + 1;
    for (let i = 0; i < acc.length; i++) {
      const r = i % W, score = acc[i] + Math.max(r > 0 ? acc[i - 1] : 0, r < W - 1 ? acc[i + 1] : 0);
      if (score > best) { best = score; bi = i; }
    }
    if (best < MIN_VOTES) return null;
    acc[bi] = 0; if (bi % W > 0) acc[bi - 1] = 0; if (bi % W < W - 1) acc[bi + 1] = 0;
    const t = Math.floor(bi / (2 * rMax + 1)), rho = (bi % (2 * rMax + 1)) - rMax;
    const coarse: Line = { px: rho * cos[t], py: rho * sin[t], ux: -sin[t], uy: cos[t], votes: best, t0: 0, t1: 0, ink: 0 };
    // Refine twice: fit through nearby ink, then refit through ink tight to that fit, so text touching
    // the line doesn't tilt or shift it.
    let l = fit(ink.filter(p => distToLine(p, coarse) <= 1.5)) ?? coarse;
    l = fit(ink.filter(p => distToLine(p, l) <= 1.5)) ?? l;
    const ts = ink.filter(p => distToLine(p, l) <= 1.5).map(p => (p.x - l.px) * l.ux + (p.y - l.py) * l.uy);
    // Solid stretch first; failing that, a dashed one: long, mostly inked, made of long dashes
    // (scattered lettering strokes are short).
    let run = longestRun(ts, MAX_GAP), dashed = false;
    if (run.t1 - run.t0 < MIN_RUN) {
      const d = longestRun(ts, DASH_GAP), bins = [...new Set(ts.filter(t => t >= d.t0 && t <= d.t1).map(Math.floor))].sort((x, y) => x - y);
      let pieces = 1; for (let i = 1; i < bins.length; i++) if (bins[i] - bins[i - 1] > 2) pieces++;
      if (d.t1 - d.t0 < 30 || bins.length / Math.max(1, d.t1 - d.t0) < 0.6 || bins.length / pieces < 8) continue;
      run = d; dashed = true;
    }
    const span = run.t1 - run.t0;
    // A drawn line is thin: along its stretch, nearly all nearby ink sits right on it. A row of
    // lettering also lines up, but its glyphs spread to both sides. (A label written alongside a real
    // line sits on one side only, so only the less-inked side counts against the line.)
    const along = (p: Point) => { const u = (p.x - l.px) * l.ux + (p.y - l.py) * l.uy; return u >= run.t0 && u <= run.t1; };
    let tight = 0, sideA = 0, sideB = 0;
    for (const p of ink) {
      if (!along(p)) continue;
      const d = (p.x - l.px) * l.uy - (p.y - l.py) * l.ux;
      if (Math.abs(d) <= 1.5) tight++; else if (d > 0 && d <= LOOSE) sideA++; else if (d < 0 && d >= -LOOSE) sideB++;
    }
    // A long, solid run is a drawn line even with labels crowding both sides; lettering never runs this long.
    if ((!dashed && span >= LONG_RUN) || tight >= PURITY * (tight + Math.min(sideA, sideB))) return { ...l, ...run, votes: best, ink: tight };
  }
  return null;
}

/** The longest gap-free stretch among positions along a line. */
function longestRun(ts: number[], maxGap: number): { t0: number; t1: number } {
  ts.sort((a, b) => a - b);
  let best = { t0: 0, t1: -1 }, start = ts[0];
  for (let i = 1; i <= ts.length; i++) {
    if (i === ts.length || ts[i] - ts[i - 1] > maxGap) {
      if (ts[i - 1] - start > best.t1 - best.t0) best = { t0: start, t1: ts[i - 1] };
      start = ts[i];
    }
  }
  return best;
}

function fit(pts: Point[]): Line | null {
  if (pts.length < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length, my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) { const a = p.x - mx, b = p.y - my; sxx += a * a; sxy += a * b; syy += b * b; }
  const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ux = Math.cos(ang), uy = Math.sin(ang);
  const ts = pts.map(p => (p.x - mx) * ux + (p.y - my) * uy);
  return { px: mx, py: my, ux, uy, votes: pts.length, t0: Math.min(...ts), t1: Math.max(...ts), ink: pts.length };
}

const distToLine = (p: Point, l: Line) => Math.abs((p.x - l.px) * l.uy - (p.y - l.py) * l.ux);

function intersect(a: Line, b: Line): Point | null {
  const d = a.ux * b.uy - a.uy * b.ux;
  if (Math.abs(d) < 1e-6) return null;
  const t = ((b.px - a.px) * b.uy - (b.py - a.py) * b.ux) / d;
  return { x: a.px + t * a.ux, y: a.py + t * a.uy };
}
