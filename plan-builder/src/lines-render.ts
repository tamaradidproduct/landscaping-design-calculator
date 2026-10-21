// The SVG for the drawn lines on the plan (screen px): each run as short segments textured with its item's tile (turned to the run so
// grain follows it, and continuing along bends), round caps where the item has them, handles and a halo on the selected line, and the
// draft being drawn. Pure string building, used by OutlineTool.render.
import { lineItemById } from './line-items';
import { linePathPt, lineWidthPt } from './line-layer';
import { edgeMid } from './outline';
import type { PlacedLine } from './plan-model';
import { MARK } from './overlay-tokens';
import type { Point } from './view';

/** Narrowest a run is drawn, so a 4-inch fence is still a line at yard zoom. */
const MIN_WIDTH_PX = 2;
const f = (n: number) => n.toFixed(1);
const pt = (p: Point) => `${f(p.x)},${f(p.y)}`;

export interface LinesSvgOptions {
  placed: PlacedLine[];
  shown: (l: PlacedLine) => boolean;
  toScreen: (p: Point) => Point;
  ftPerPt: number | null;
  pxPerPt: number;
  selected: string | null;
  /** The selected line's selected point. */
  selectedPoint: number | null;
  /** The line being drawn: its points so far, and the pointer (screen) for the rubber band. */
  draft?: { item: string; points: Point[]; widthFt: number; hover: Point | null };
}

const widthPx = (widthFt: number, o: LinesSvgOptions) => Math.max(MIN_WIDTH_PX, lineWidthPt(widthFt, o.ftPerPt) * o.pxPerPt);

function run(l: PlacedLine, o: LinesSvgOptions): string {
  const item = lineItemById(l.item); if (!item) return '';
  const path = linePathPt(l).map(o.toScreen), w = widthPx(l.widthFt, o);
  const across = w * item.tileWidths, along = across * item.artLengthPx / item.artWidthPx;
  let svg = '', cum = 0;
  for (let k = 0; k + 1 < path.length; k++) {
    const a = path[k], b = path[k + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) continue;
    const dx = (b.x - a.x) / len, dy = (b.y - a.y) / len, nx = -dy * w / 2, ny = dx * w / 2;
    // Interior joins reach half a width past the segment so a bend stays filled; the ends of the run stay square (a cap goes there).
    const e0 = k > 0 ? w / 2 : 0, e1 = k + 2 < path.length ? w / 2 : 0;
    const A = { x: a.x - dx * e0, y: a.y - dy * e0 }, B = { x: b.x + dx * e1, y: b.y + dy * e1 };
    const id = `ln-${l.id}-${k}`, turn = Math.atan2(dy, dx) * 180 / Math.PI - 90;
    svg += `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${f(across)}" height="${f(along)}" x="${f(-w / 2)}" y="${f(-cum)}" patternTransform="translate(${f(a.x)} ${f(a.y)}) rotate(${f(turn)})">`
      + `<image href="${item.art}" width="${f(across)}" height="${f(along)}" preserveAspectRatio="none"/></pattern>`
      + `<polygon points="${pt({ x: A.x + nx, y: A.y + ny })} ${pt({ x: B.x + nx, y: B.y + ny })} ${pt({ x: B.x - nx, y: B.y - ny })} ${pt({ x: A.x - nx, y: A.y - ny })}" fill="url(#${id})"/>`;
    cum += len;
  }
  if (item.roundCaps) for (const p of [path[0], path[path.length - 1]]) svg += `<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(w / 2)}" fill="${item.color}"/>`;
  return `<g data-id="${l.id}" class="line">${svg}</g>`;
}

const polyline = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join(' ');

/** A rough "inside" reference point for offHandle: the average of the run's own points. */
const avgPoint = (pts: Point[]): Point => pts.reduce((s, p) => ({ x: s.x + p.x / pts.length, y: s.y + p.y / pts.length }), { x: 0, y: 0 });
/** An insert-point "+" off segment a→b at its midpoint `mid`, away from reference point `ref`, so it never
 * sits on top of the bend handle (which sits on the segment itself — see outline-ui.ts's own copy of this). */
function offHandle(a: Point, b: Point, mid: Point, ref: Point): Point {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const sign = (mid.x - ref.x) * nx + (mid.y - ref.y) * ny >= 0 ? 1 : -1;
  return { x: mid.x + nx * MARK.insertOffset * sign, y: mid.y + ny * MARK.insertOffset * sign };
}

function handles(l: PlacedLine, o: LinesSvgOptions): string {
  let svg = `<path d="${polyline(linePathPt(l).map(o.toScreen))}" class="line-halo" style="stroke-width:${f(widthPx(l.widthFt, o) + 8)}px"/>`;
  const ref = o.toScreen(avgPoint(l.points));
  for (let i = 0; i + 1 < l.points.length; i++) {
    const m = o.toScreen(edgeMid(l.points, i, l.bulges)), bent = !!l.bulges?.[i];
    svg += `<rect data-bend="${i}" x="${f(m.x - MARK.bendHandle / 2)}" y="${f(m.y - MARK.bendHandle / 2)}" width="${MARK.bendHandle}" height="${MARK.bendHandle}" rx="${MARK.bendHandleRadius}" class="bend-handle line-bend${bent ? ' bent' : ''}" style="--c:var(--color-accent)"/>`;
    // The segment's own "+": tap to insert a point there.
    const ip = offHandle(o.toScreen(l.points[i]), o.toScreen(l.points[i + 1]), m, ref), k = MARK.insertHandle * 0.6;
    svg += `<g data-insert="${i}" class="insert-handle" style="--c:var(--color-accent)"><circle cx="${f(ip.x)}" cy="${f(ip.y)}" r="${MARK.insertHandle}"/><path d="M${f(ip.x - k)} ${f(ip.y)}H${f(ip.x + k)}M${f(ip.x)} ${f(ip.y - k)}V${f(ip.y + k)}"/></g>`;
  }
  l.points.forEach((p, i) => {
    const s = o.toScreen(p);
    svg += `<circle data-point="${i}" cx="${f(s.x)}" cy="${f(s.y)}" r="${MARK.corner}" class="corner line-point${o.selectedPoint === i ? ' selected' : ''}" style="--c:var(--color-accent)"/>`;
  });
  return svg;
}

/** The runs (drawn under the plants and objects) and the handles, halo and draft (drawn on top of everything), separately. */
export function linesSvgParts(o: LinesSvgOptions): { runs: string; top: string } {
  let svg = '', top = '';
  for (const l of o.placed) {
    if (!o.shown(l)) continue;
    svg += run(l, o);
    if (o.selected === l.id) top += handles(l, o);
  }
  if (o.draft && lineItemById(o.draft.item)) {
    const pts = o.draft.points.map(o.toScreen); if (o.draft.hover) pts.push(o.draft.hover);
    if (pts.length > 1) top += `<path d="${polyline(pts)}" class="line-draft" style="stroke-width:${f(widthPx(o.draft.widthFt, o))}px"/>`;
    o.draft.points.forEach(p => { const s = o.toScreen(p); top += `<circle cx="${f(s.x)}" cy="${f(s.y)}" r="${MARK.corner}" class="corner" style="--c:var(--color-accent)"/>`; });
  }
  return { runs: svg, top };
}

export function linesSvg(o: LinesSvgOptions): string { const { runs, top } = linesSvgParts(o); return runs + top; }
