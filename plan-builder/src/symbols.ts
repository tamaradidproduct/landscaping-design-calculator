// The plant and object symbols of the Landscaping symbols library (Figma 0B2UpvIGBFOE1ZEDx8rXPR): plan art, a photo for plants, and a
// researched real-world size. Data comes from scripts/symbol-sources.mjs (names), scripts/symbol-sizes.mjs (sizes and their sources)
// and the assets built by scripts/build-symbols.mjs.
import { SYMBOL_SOURCES } from '../scripts/symbol-sources.mjs';
import { SYMBOL_SIZES } from '../scripts/symbol-sizes.mjs';
import aspects from './assets/symbols/symbols.json';

/** Figma px per foot: the Figma library draws a 72 px stepping stone, which is 2 ft. Sizes read off Figma (stones, markers, line widths) use it. */
export const FIGMA_PX_PER_FT = 36;
/** A utility marker is drawn at least this long on screen, so a 1 ft marker stays visible and tappable at plan zoom. */
const MARKER_MIN_PX = 20;

export interface LibrarySymbol {
  id: string; name: string; kind: 'plant' | 'object' | 'marker'; family: string; category: string;
  /** Plan-view art (transparent, its shadow included). */
  art: string;
  /** Small version of the art for the picker and the Layers rows. */
  thumb: string;
  /** Minimum on-screen long side in px (markers only). */
  minPx?: number;
  /** Reference photo (plants only). */
  photo?: string;
  /** Feet. A plant is a circle (w = d = its mature spread); an object keeps its researched long side and the art's proportions. */
  size: { w: number; d: number };
  /** The art's width ÷ height. */
  artAspect: number;
  sizeSource: { url: string; note: string; approximate?: true };
}

const art = import.meta.glob<string>('./assets/symbols/*.webp', { eager: true, query: '?url', import: 'default' });
const thumbs = import.meta.glob<string>('./assets/symbols/thumbs/*.webp', { eager: true, query: '?url', import: 'default' });
const photos = import.meta.glob<string>('./assets/symbols/photos/*.webp', { eager: true, query: '?url', import: 'default' });

export const SYMBOLS: readonly LibrarySymbol[] = SYMBOL_SOURCES.map(s => {
  const z = SYMBOL_SIZES[s.id], a = (aspects as Record<string, { w: number; h: number }>)[s.id], artAspect = a.w / a.h;
  const long = Math.max(z.w, z.d);
  const size = s.kind === 'plant' ? { w: z.w, d: z.w } : artAspect >= 1 ? { w: long, d: long / artAspect } : { w: long * artAspect, d: long };
  return {
    id: s.id, name: s.name, kind: s.kind, family: s.family, category: s.category,
    art: art[`./assets/symbols/${s.id}.webp`], thumb: thumbs[`./assets/symbols/thumbs/${s.id}.webp`],
    ...(s.kind === 'plant' ? { photo: photos[`./assets/symbols/photos/${s.id}.webp`] } : {}),
    ...(s.kind === 'marker' ? { minPx: MARKER_MIN_PX } : {}),
    size, artAspect, sizeSource: { url: z.url, note: z.note, ...(z.approximate ? { approximate: true as const } : {}) },
  };
});

const TREE_FAMILIES = new Set(['Evergreen trees', 'Deciduous trees', 'Accent trees']);
const SHRUB_FAMILIES = new Set(['Accent shrubs', 'Privacy shrubs', 'Large shrubs']);
/**
 * Where a symbol sits in the stacking on the plan, bottom to top: 1 utility marker, 2 object, 3 perennial / ground cover / grass /
 * other plant, 4 shrub, 5 tree. Taller things are drawn (and tapped) above lower ones.
 */
export function tierOf(s: Pick<LibrarySymbol, 'kind' | 'family'>): 1 | 2 | 3 | 4 | 5 {
  if (s.kind === 'marker') return 1;
  if (s.kind === 'object') return 2;
  return TREE_FAMILIES.has(s.family) ? 5 : SHRUB_FAMILIES.has(s.family) ? 4 : 3;
}

export const symbolById = (id: string): LibrarySymbol | undefined => SYMBOLS.find(s => s.id === id);

/** The symbols grouped by family, in library order (all of them, or only plants, objects or markers). */
export function symbolFamilies(kind?: LibrarySymbol['kind']): { family: string; symbols: LibrarySymbol[] }[] {
  const groups: { family: string; symbols: LibrarySymbol[] }[] = [];
  for (const s of SYMBOLS) {
    if (kind && s.kind !== kind) continue;
    const g = groups.find(x => x.family === s.family);
    if (g) g.symbols.push(s); else groups.push({ family: s.family, symbols: [s] });
  }
  return groups;
}

/** Symbols whose name, category or family contains the query (case-insensitive); an empty query returns all. */
export function searchSymbols(query: string): LibrarySymbol[] {
  const q = query.trim().toLowerCase();
  return q ? SYMBOLS.filter(s => `${s.name} ${s.category} ${s.family}`.toLowerCase().includes(q)) : [...SYMBOLS];
}
