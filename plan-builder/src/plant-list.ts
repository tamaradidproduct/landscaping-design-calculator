// What the plan contains, for the Plant list: the surfaces used, the lines drawn (length per item), and the plants, objects (stepping
// stones among them) and utility markers placed with how many of each. Pure.
import type { Outline } from './outline';
import type { PlacedLine, PlacedSymbol } from './plan-model';
import { MATERIALS, type Material } from './materials';
import { LINE_ITEMS, lineItemById, type LineItem } from './line-items';
import { lineLengthPt } from './line-layer';
import { SYMBOLS, symbolById, type LibrarySymbol } from './symbols';
import { plantDiameter, sizeLabel, type PlantSizeView } from './plant-size';

export interface PlantList {
  /** Each material the zones use, with its visible area in square feet (null until the plan has a scale). */
  surfaces: { material: Material; sqft: number | null }[];
  /** Each line item drawn: its runs, their total length in page points, and in feet (null until the plan has a scale). */
  lines: { item: LineItem; feet: number | null; ptLength: number; runs: number }[];
  /** One entry per species and size label (`size` is the active view's label); objects and markers carry no size. */
  plants: { symbol: LibrarySymbol; quantity: number; size?: string }[];
  objects: { symbol: LibrarySymbol; quantity: number; size?: string }[];
  markers: { symbol: LibrarySymbol; quantity: number; size?: string }[];
}

export function plantList(symbols: Record<string, PlacedSymbol>, outlines: Record<string, Outline>, lines: Record<string, PlacedLine> = {}, ftPerPt: number | null = null, areas: ReadonlyMap<string, number> | null = null, view: PlantSizeView = 'mature'): PlantList {
  const used = new Set(Object.values(outlines).filter(o => o.kind === 'surface' && o.closed && o.material).map(o => o.material));
  // One row per species and, for plants, per size label (key symbol + label); diameter is kept to order sizes within a species.
  const counts = new Map<string, { symbol: LibrarySymbol; quantity: number; size?: string; d: number }>();
  for (const s of Object.values(symbols)) {
    const symbol = symbolById(s.symbol);
    if (!symbol) continue;
    const size = symbol.kind === 'plant' ? sizeLabel(s.symbol, s, view) : undefined;
    const key = `${s.symbol}|${size ?? ''}`;
    const e = counts.get(key);
    if (e) e.quantity++;
    else counts.set(key, { symbol, quantity: 1, ...(size !== undefined ? { size } : {}), d: symbol.kind === 'plant' ? plantDiameter(s.symbol, s, view) : 0 });
  }
  // Library order is family by family; within a family, by name, then by diameter (markers stay in library order: gas, electric, drainage).
  const entries = [...counts.values()].sort((a, b) => SYMBOLS.indexOf(a.symbol) - SYMBOLS.indexOf(b.symbol));
  const markers = entries.filter(e => e.symbol.kind === 'marker');
  const familyIndex = (f: string) => SYMBOLS.findIndex(s => s.family === f);
  entries.sort((a, b) => familyIndex(a.symbol.family) - familyIndex(b.symbol.family) || a.symbol.name.localeCompare(b.symbol.name) || a.d - b.d);
  const out = ({ symbol, quantity, size }: (typeof entries)[number]) => ({ symbol, quantity, ...(size !== undefined ? { size } : {}) });
  const runs = new Map<string, { pt: number; n: number }>();
  for (const l of Object.values(lines)) if (lineItemById(l.item)) { const r = runs.get(l.item) ?? { pt: 0, n: 0 }; r.pt += lineLengthPt(l); r.n++; runs.set(l.item, r); }
  const valid = ftPerPt !== null && Number.isFinite(ftPerPt) && ftPerPt > 0;
  return {
    surfaces: MATERIALS.filter(m => used.has(m.id)).map(material => ({ material, sqft: areas ? areas.get(material.id) ?? 0 : null })),
    lines: LINE_ITEMS.filter(i => runs.has(i.id)).map(item => ({ item, ptLength: runs.get(item.id)!.pt, runs: runs.get(item.id)!.n, feet: valid ? runs.get(item.id)!.pt * ftPerPt : null })),
    plants: entries.filter(e => e.symbol.kind === 'plant').map(out),
    objects: entries.filter(e => e.symbol.kind === 'object').map(out),
    markers: markers.map(out),
  };
}
