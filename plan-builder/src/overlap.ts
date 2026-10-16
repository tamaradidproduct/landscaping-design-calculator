// Overlapping layers: what each one covers once the others are taken into account. A layer higher in Layers
// cuts the ones below it, and the plot boundary clips every layer to the lot — existing features today,
// hardscape and softscape later. Shapes are kept as drawn; only what is shown, tapped and measured uses the
// visible part. Coordinates are PDF points (cutting commutes with the stretch correction, which is linear).
import type * as Clip from 'polygon-clipping';
// The package ships a default export; its types only declare the named functions, so cast once here.
import clipDefault from 'polygon-clipping';
import { areaPt2, cutOrder, insidePolygon, labelPoint, outlinePath, sectionOf, type Outline } from './outline';
import type { Point } from './view';

const clip = clipDefault as typeof Clip;

/** A visible region: polygons, each an outer ring followed by any holes. */
export type Shape = Clip.MultiPolygon;

const ring = (o: Outline): Clip.Ring => {
  const pts = outlinePath(o.pts, o.bulges, true, o.radii).map((p): Clip.Pair => [p.x, p.y]);
  return [...pts, pts[0]];
};
const toPoints = (r: Clip.Ring): Point[] => r.slice(0, -1).map(([x, y]) => ({ x, y }));

/**
 * The visible part of every closed layer but the boundary, by id, in cutting order: existing features (Outlines)
 * cut every surface; within a section, a layer listed earlier (higher) cuts later ones.
 */
export function visibleShapes(outlines: Outline[]): Map<string, Shape> {
  const closed = cutOrder(outlines).filter(o => o.closed && o.pts.length >= 3);
  const lot = closed.find(o => o.kind === 'boundary');
  const out = new Map<string, Shape>(), above: Clip.Polygon[] = [];
  for (const o of closed) {
    if (o.kind === 'boundary') continue; // the lot itself: it clips, it is never cut
    const drawn: Clip.Polygon = [ring(o)];
    try {
      let shape: Shape = lot ? clip.intersection(drawn, [ring(lot)]) : [drawn];
      if (above.length && shape.length) shape = clip.difference(shape, ...above);
      out.set(o.id, shape);
      above.push(drawn);
    } catch {
      out.set(o.id, [drawn]); // a shape the clipper can't read (e.g. badly self-crossing): show it as drawn
    }
  }
  return out;
}

/**
 * The ids of the layers of `o`'s own section whose drawn shape wholly contains `o`'s, in layer order. A new layer
 * drawn inside one of these goes above it, so it isn't hidden the moment it's finished.
 */
export function containers(o: Outline, outlines: Outline[]): string[] {
  const inner: Clip.Polygon = [ring(o)];
  return outlines.filter(c => c.id !== o.id && c.kind !== 'boundary' && sectionOf(c.kind) === sectionOf(o.kind) && c.closed && c.pts.length >= 3).filter(c => {
    try { return shapeArea(clip.difference(inner, [ring(c)])) < 1e-6 * Math.max(1, shapeArea([inner])); } catch { return false; }
  }).map(c => c.id);
}

/** Area in square points: outer rings minus holes. */
export function shapeArea(shape: Shape): number {
  return shape.reduce((n, poly) => n + poly.reduce((m, r, k) => m + (k ? -1 : 1) * areaPt2(toPoints(r)), 0), 0);
}

export function insideShape(shape: Shape, p: Point): boolean {
  return shape.some(poly => insidePolygon(toPoints(poly[0]), p) && !poly.slice(1).some(h => insidePolygon(toPoints(h), p)));
}

/** Where to put the name: inside the biggest visible piece (null when nothing is visible). */
export function shapeLabelPoint(shape: Shape): Point | null {
  const biggest = [...shape].sort((a, b) => areaPt2(toPoints(b[0])) - areaPt2(toPoints(a[0])))[0];
  if (!biggest) return null;
  const c = labelPoint(toPoints(biggest[0]));
  if (insideShape([biggest], c)) return c;
  // The centroid of an L or a ring can fall outside: use the middle of the widest run across the piece.
  const pts = toPoints(biggest[0]), ys = pts.map(p => p.y), y = (Math.min(...ys) + Math.max(...ys)) / 2;
  const xs: number[] = [];
  for (const r of biggest) {
    const q = toPoints(r);
    q.forEach((a, i) => { const b = q[(i + 1) % q.length]; if ((a.y > y) !== (b.y > y)) xs.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y)); });
  }
  xs.sort((a, b) => a - b);
  let best: Point | null = null, w = -1;
  for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] - xs[k] > w) { w = xs[k + 1] - xs[k]; best = { x: (xs[k] + xs[k + 1]) / 2, y }; }
  return best ?? c;
}

/** SVG path data for a shape (use with fill-rule: evenodd so holes stay open). */
export function shapePath(shape: Shape, toScreen: (p: Point) => Point): string {
  return shape.flatMap(poly => poly.map(r => toPoints(r).map((p, i) => {
    const s = toScreen(p); return `${i ? 'L' : 'M'}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
  }).join(' ') + ' Z')).join(' ');
}
