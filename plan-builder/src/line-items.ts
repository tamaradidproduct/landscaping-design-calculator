// The linear items of the Landscaping symbols library (Figma 0B2UpvIGBFOE1ZEDx8rXPR): a fence, walls, edging and a dry river drawn as a
// run with a width. Names and Figma ids come from scripts/line-sources.mjs; the tiles that texture a run are built by
// scripts/build-lines.mjs. A default width is the Figma stroke weight at 36 px per ft.
import { LINE_SOURCES } from '../scripts/line-sources.mjs';
import tiles from './assets/lines/lines.json';
import { FIGMA_PX_PER_FT } from './symbols';

export interface LineItem {
  id: string; name: string; family: string;
  /** The tile a run is textured with (a strip along the run, or the dry river's square stone texture). */
  art: string;
  /** Small picture for the picker and the Layers rows. */
  thumb: string;
  /** The tile's size in px. */
  artWidthPx: number; artLengthPx: number;
  /** The tile's edge across the run, in stroke widths (1 for a strip; the dry river's square texture repeats every 2.2). */
  tileWidths: number;
  defaultWidthFt: number;
  roundCaps: boolean;
  /** The tile's mean colour (the round caps). */
  color: string;
}

export const LINE_WIDTH_FT = { min: 0.25, max: 12, step: 0.25 } as const;
/** A width in feet, kept within 0.25–12 and to the cent (a default of 0.33 ft stays 0.33; the − / + steps are what move on 0.25 ft steps). */
export const clampLineWidth = (ft: number): number => {
  if (!Number.isFinite(ft)) return LINE_WIDTH_FT.min;
  return Math.min(LINE_WIDTH_FT.max, Math.max(LINE_WIDTH_FT.min, Math.round(ft * 100) / 100));
};

/** One press of − (-1) or + (+1) on a width: onto the next 0.25 ft step in that direction. */
export const stepLineWidth = (ft: number, dir: 1 | -1): number => {
  const k = ft / LINE_WIDTH_FT.step;
  return clampLineWidth((dir > 0 ? Math.floor(k + 1e-9) + 1 : Math.ceil(k - 1e-9) - 1) * LINE_WIDTH_FT.step);
};

const art = import.meta.glob<string>('./assets/lines/*.webp', { eager: true, query: '?url', import: 'default' });
const thumbs = import.meta.glob<string>('./assets/lines/thumbs/*.webp', { eager: true, query: '?url', import: 'default' });

// A default width is the stroke weight in feet cut to 2 decimals (12 px → 0.33 ft, 20 px → 0.55 ft).
export const LINE_ITEMS: readonly LineItem[] = LINE_SOURCES.map(s => {
  const t = (tiles as Record<string, { w: number; h: number; color: string }>)[s.id] ?? { w: 1, h: 1, color: '#000000' };
  return {
    id: s.id, name: s.name, family: s.family,
    art: art[`./assets/lines/${s.id}.webp`], thumb: thumbs[`./assets/lines/thumbs/${s.id}.webp`],
    artWidthPx: t.w, artLengthPx: t.h, tileWidths: s.tileWidths,
    defaultWidthFt: Math.floor(s.strokePx / FIGMA_PX_PER_FT * 100) / 100, roundCaps: s.roundCaps, color: t.color,
  };
});

export const lineItemById = (id: string): LineItem | undefined => LINE_ITEMS.find(i => i.id === id);
