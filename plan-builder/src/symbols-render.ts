// The SVG for the plants and objects on the plan (screen px): their art at true size, turned, with a halo on the selected one and a
// see-through ghost of the armed symbol at the pointer. Pure string building, used by OutlineTool.render.
import type { PlacedSymbol } from './plan-model';
import { containersFor } from './plant-size';
import { MARK } from './overlay-tokens';
import { symbolSizePx } from './symbol-layer';
import { symbolById } from './symbols';
import type { Point } from './view';

/** A plant's art is a little wider than its canopy (the shadow), so it is drawn this much bigger than the spread. */
const PLANT_ART_OVERSIZE = 1.08;
/** The selection halo sits this far (screen px) outside the symbol's footprint. */
const HALO_PAD = 3;
const f = (n: number) => n.toFixed(1);

export interface SymbolsSvgOptions {
  placed: PlacedSymbol[];
  shown: (p: PlacedSymbol) => boolean;
  toScreen: (p: Point) => Point;
  ftPerPt: number | null;
  pxPerPt: number;
  selected: string | null;
  /** The armed symbol and where the pointer is (screen), drawn see-through. */
  ghost?: { symbol: string; at: Point };
  /** A placed symbol's footprint in feet (a plant follows the Install | Mature view); default the library size. A ghost is asked with a bare symbol. */
  sizeOf?: (p: PlacedSymbol) => { w: number; d: number };
  /** Offer the size handle on the selected plant (one with install containers). The tool sets it only in the Install view, outside Preview. */
  handle?: boolean;
}

/** Where the size handle of a placed plant sits (screen): on its halo's right edge. Null for an object or marker, or a plant without containers. */
export function sizeHandlePos(placed: PlacedSymbol, o: Pick<SymbolsSvgOptions, 'toScreen' | 'ftPerPt' | 'pxPerPt' | 'sizeOf'>): Point | null {
  const lib = symbolById(placed.symbol);
  if (lib?.kind !== 'plant' || !containersFor(placed.symbol).length) return null;
  const fp = symbolSizePx(o.sizeOf ? o.sizeOf(placed) : lib.size, o.ftPerPt, o.pxPerPt, lib.minPx), at = o.toScreen({ x: placed.x, y: placed.y });
  return { x: at.x + fp.w / 2 + HALO_PAD, y: at.y };
}

function one(placed: PlacedSymbol, at: Point, rot: number, o: SymbolsSvgOptions, extra: string, cls: string): { image: string; halo: string } | null {
  const lib = symbolById(placed.symbol); if (!lib) return null;
  const fp = symbolSizePx(o.sizeOf ? o.sizeOf(placed) : lib.size, o.ftPerPt, o.pxPerPt, lib.minPx);
  const w = lib.kind === 'plant' ? fp.w * PLANT_ART_OVERSIZE : fp.w, h = lib.kind === 'plant' ? w / lib.artAspect : fp.d;
  const turn = rot ? ` transform="rotate(${rot} ${f(at.x)} ${f(at.y)})"` : '';
  const image = `<image href="${lib.art}" x="${f(at.x - w / 2)}" y="${f(at.y - h / 2)}" width="${f(w)}" height="${f(h)}" preserveAspectRatio="none"${turn} class="${cls}"${extra}/>`;
  const halo = lib.kind === 'plant'
    ? `<circle cx="${f(at.x)}" cy="${f(at.y)}" r="${f(fp.w / 2 + HALO_PAD)}" class="symbol-halo"/>`
    : `<rect x="${f(at.x - fp.w / 2 - HALO_PAD)}" y="${f(at.y - fp.d / 2 - HALO_PAD)}" width="${f(fp.w + 2 * HALO_PAD)}" height="${f(fp.d + 2 * HALO_PAD)}" class="symbol-halo"${turn}/>`;
  return { image, halo };
}

export function symbolsSvg(o: SymbolsSvgOptions): string {
  let svg = '';
  for (const p of o.placed) {
    if (!o.shown(p)) continue;
    const r = one(p, o.toScreen({ x: p.x, y: p.y }), p.rot ?? 0, o, ` data-id="${p.id}"`, 'symbol');
    if (!r) continue;
    svg += r.image;
    if (o.selected !== p.id) continue;
    svg += r.halo;
    const h = o.handle ? sizeHandlePos(p, o) : null;
    if (h) svg += `<circle cx="${f(h.x)}" cy="${f(h.y)}" r="${MARK.sizeHandle}" class="symbol-handle" data-handle="size"/>`;
  }
  if (o.ghost) svg += one({ id: '', symbol: o.ghost.symbol, x: o.ghost.at.x, y: o.ghost.at.y }, o.ghost.at, 0, o, '', 'symbol ghost')?.image ?? '';
  return svg;
}
