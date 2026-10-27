// Placed plants and objects: where each is, how it is turned, and what a tap on the plan hits. Pure (no DOM); OutlineTool holds one,
// so undo, saving and pointer routing stay in the tool. Page points throughout, except where a name says Px (screen).
import type { PlacedSymbol } from './plan-model';
import { SYMBOLS, symbolById } from './symbols';
import type { Point } from './view';

/** Page points per foot while the plan has no scale yet (24 pt for 10 ft, about 1″ = 30′ on a letter sheet). */
export const UNSCALED_FT_PT = 2.4;
const MIN_SIZE_PX = 6;
const MIN_HIT_PX = 14;

export const normalizeDeg = (d: number): number => ((d % 360) + 360) % 360;

/** One press of − (-1) or + (+1) on a symbol's rotation: onto the next multiple of 15° in that direction. */
export const stepRotation = (deg: number, dir: 1 | -1): number => {
  const d = normalizeDeg(deg), k = d / 15;
  return normalizeDeg((dir > 0 ? Math.floor(k + 1e-9) + 1 : Math.ceil(k - 1e-9) - 1) * 15);
};

const validScale = (ftPerPt: number | null): ftPerPt is number => ftPerPt !== null && Number.isFinite(ftPerPt) && ftPerPt > 0;

/** A symbol's footprint in page points. */
export const symbolSizePt = (size: { w: number; d: number }, ftPerPt: number | null): { w: number; d: number } =>
  validScale(ftPerPt) ? { w: size.w / ftPerPt, d: size.d / ftPerPt } : { w: size.w * UNSCALED_FT_PT, d: size.d * UNSCALED_FT_PT };

/** A symbol's footprint on screen; a tiny one is scaled up (keeping its proportions) until its long side is `minPx` (6 px; a marker's is 20). */
export function symbolSizePx(size: { w: number; d: number }, ftPerPt: number | null, pxPerPt: number, minPx = MIN_SIZE_PX): { w: number; d: number } {
  const pt = symbolSizePt(size, ftPerPt), w = pt.w * pxPerPt, d = pt.d * pxPerPt, k = Math.max(w, d) < minPx ? minPx / Math.max(w, d) : 1;
  return { w: w * k, d: d * k };
}

export class SymbolLayer {
  placed: Record<string, PlacedSymbol> = {};

  /** The symbols bottom to top: by the number in their id (a saved map may come back in any key order). */
  ordered(): PlacedSymbol[] { return Object.values(this.placed).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1))); }

  /** Drop a symbol on top at a page point; returns its new id (y1, y2 …: one past the highest, so it is always on top). */
  place(symbol: string, at: Point): string {
    const n = Math.max(0, ...Object.keys(this.placed).map(k => Number(k.slice(1)))) + 1;
    const id = `y${n}`; this.placed[id] = { id, symbol, x: at.x, y: at.y };
    return id;
  }
  move(id: string, dx: number, dy: number) { const p = this.placed[id]; if (p) { p.x += dx; p.y += dy; } }
  /** Turn a symbol to an angle in degrees; 0 clears it. */
  setRotation(id: string, deg: number) {
    const p = this.placed[id]; if (!p) return;
    const r = normalizeDeg(deg); if (r === 0) delete p.rot; else p.rot = r;
  }
  remove(id: string) { delete this.placed[id]; }

  /**
   * The topmost (last placed) symbol under a page point among those `shown`, or null: a plant is a circle of its spread, an
   * object its rectangle turned with it (`sizeOf` gives a symbol's footprint in feet; default the library size). A target is never smaller than 14 px, so a tiny symbol can still be tapped.
   */
  hitTest(p: Point, shown: (s: PlacedSymbol) => boolean, ftPerPt: number | null, pxPerPt: number,
    sizeOf?: (s: PlacedSymbol) => { w: number; d: number }): string | null {
    const minHalf = MIN_HIT_PX / pxPerPt, all = this.ordered();
    for (let k = all.length - 1; k >= 0; k--) {
      const s = all[k], lib = symbolById(s.symbol); if (!lib || !shown(s)) continue;
      const size = symbolSizePt(sizeOf ? sizeOf(s) : lib.size, ftPerPt), hw = Math.max(size.w / 2, minHalf), hd = Math.max(size.d / 2, minHalf);
      const a = -normalizeDeg(s.rot ?? 0) * Math.PI / 180, dx = p.x - s.x, dy = p.y - s.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (lib.kind === 'plant' ? Math.hypot(lx, ly) <= hw : Math.abs(lx) <= hw && Math.abs(ly) <= hd) return s.id;
    }
    return null;
  }

  /** The placed symbols grouped by library symbol, in library order (ids in placing order). */
  groups(): { symbol: string; ids: string[] }[] {
    const by = new Map<string, string[]>();
    for (const s of this.ordered()) by.set(s.symbol, [...(by.get(s.symbol) ?? []), s.id]);
    return SYMBOLS.filter(l => by.has(l.id)).map(l => ({ symbol: l.id, ids: by.get(l.id)! }));
  }
  counts(): Map<string, number> { return new Map(this.groups().map(g => [g.symbol, g.ids.length])); }
}
