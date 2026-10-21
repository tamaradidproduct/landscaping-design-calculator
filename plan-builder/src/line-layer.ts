// Drawn lines (fence, walls, edging, dry river): their points, bends and widths, and what a tap on the plan hits. Pure (no DOM);
// OutlineTool holds one, so undo, saving and pointer routing stay in the tool. Page points throughout, except where a name says Px.
import { clampLineWidth, LINE_ITEMS } from './line-items';
import { dist, edgeLengthPt, outlinePath } from './outline';
import { HIT } from './overlay-tokens';
import type { PlacedLine } from './plan-model';
import { UNSCALED_FT_PT } from './symbol-layer';
import type { Point } from './view';

const SAME_POINT = 1e-6;

const validScale = (ftPerPt: number | null): ftPerPt is number => ftPerPt !== null && Number.isFinite(ftPerPt) && ftPerPt > 0;

/** A line's width in page points (at the unscaled default while the plan has no scale). */
export const lineWidthPt = (widthFt: number, ftPerPt: number | null): number => validScale(ftPerPt) ? widthFt / ftPerPt : widthFt * UNSCALED_FT_PT;

/** The run as a dense polyline: its points with each bent segment sampled along its arc. */
export const linePathPt = (l: PlacedLine): Point[] => outlinePath(l.points, l.bulges, false);

export function lineLengthPt(l: PlacedLine): number {
  let n = 0; for (let i = 0; i + 1 < l.points.length; i++) n += edgeLengthPt(l.points, i, l.bulges); return n;
}
/** Length in feet; null while the plan has no scale. */
export const lineLengthFt = (l: PlacedLine, ftPerPt: number | null): number | null => validScale(ftPerPt) ? lineLengthPt(l) * ftPerPt : null;

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy || 1e-12;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export class LineLayer {
  placed: Record<string, PlacedLine> = {};

  /** The lines bottom to top: by the number in their id (a saved map may come back in any key order). */
  ordered(): PlacedLine[] { return Object.values(this.placed).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))); }

  /** Store a run on top (l1, l2 …: one past the highest); repeated points are dropped, and fewer than two distinct points stores nothing (null). */
  add(item: string, points: Point[], widthFt: number): string | null {
    const pts = points.filter((p, i) => i === 0 || dist(p, points[i - 1]) > SAME_POINT).map(p => ({ x: p.x, y: p.y }));
    if (pts.length < 2) return null;
    const ids = Object.keys(this.placed).map(k => Number(k.slice(1))).filter(Number.isFinite);
    const n = Math.max(0, ...ids) + 1, id = `l${n}`;
    this.placed[id] = { id, item, points: pts, widthFt: clampLineWidth(widthFt) };
    return id;
  }
  /** Shift the whole run by an offset (page points). */
  move(id: string, dx: number, dy: number) { const l = this.placed[id]; if (l) l.points = l.points.map(p => ({ x: p.x + dx, y: p.y + dy })); }
  /** Put the run at `from` (its points when a drag began) plus an offset, so a drag that reports many moves never drifts. */
  moveFrom(id: string, from: readonly Point[], dx: number, dy: number) { const l = this.placed[id]; if (l) l.points = from.map(p => ({ x: p.x + dx, y: p.y + dy })); }
  movePoint(id: string, i: number, to: Point) { const l = this.placed[id]; if (l?.points[i]) l.points[i] = { x: to.x, y: to.y }; }
  /** Drop point i (never below two points). The bends stay one per segment: a point between two segments leaves one straight segment. */
  removePoint(id: string, i: number): boolean {
    const l = this.placed[id]; if (!l || l.points.length <= 2 || !l.points[i]) return false;
    l.points.splice(i, 1);
    if (l.bulges) {
      if (i === 0) l.bulges.splice(0, 1); else if (i === l.points.length) l.bulges.splice(i - 1, 1); else l.bulges.splice(i - 1, 2, 0);
      if (l.bulges.every(b => b === 0)) delete l.bulges;
    }
    return true;
  }
  /** Bend segment `seg` (the arc's rise over its chord, as an outline's bulge); 0 everywhere clears them. */
  setBulge(id: string, seg: number, h: number) {
    const l = this.placed[id]; if (!l || seg < 0 || seg >= l.points.length - 1) return;
    const b = l.bulges ?? new Array<number>(l.points.length - 1).fill(0); b[seg] = h;
    if (b.every(v => v === 0)) delete l.bulges; else l.bulges = b;
  }
  setWidth(id: string, ft: number) { const l = this.placed[id]; if (l) l.widthFt = clampLineWidth(ft); }
  remove(id: string) { delete this.placed[id]; }

  /** The topmost line under a page point among those `shown`, or null: within half its width of the run (and never smaller than 7 px). */
  hitTest(p: Point, shown: (l: PlacedLine) => boolean, ftPerPt: number | null, pxPerPt: number): string | null {
    const all = this.ordered(), minHalf = HIT.line / pxPerPt;
    for (let k = all.length - 1; k >= 0; k--) {
      const l = all[k]; if (!shown(l)) continue;
      const half = Math.max(lineWidthPt(l.widthFt, ftPerPt) / 2, minHalf), path = linePathPt(l);
      for (let i = 0; i + 1 < path.length; i++) if (distToSegment(p, path[i], path[i + 1]) <= half) return l.id;
    }
    return null;
  }

  /** The lines grouped by item, in library order (ids in drawing order). */
  groups(): { item: string; ids: string[] }[] {
    const by = new Map<string, string[]>();
    for (const l of this.ordered()) by.set(l.item, [...(by.get(l.item) ?? []), l.id]);
    return LINE_ITEMS.filter(i => by.has(i.id)).map(i => ({ item: i.id, ids: by.get(i.id)! }));
  }
}
