// What the plan contains, for the Plant list: the surfaces used, the lines drawn (length per item), and the plants, objects (stepping
// stones among them) and utility markers placed with how many of each. Pure.
import type { Outline } from './outline';
import type { PlacedLine, PlacedSymbol } from './plan-model';
import { MATERIALS, type Material } from './materials';
import { LINE_ITEMS, lineItemById, type LineItem } from './line-items';
import { lineLengthPt } from './line-layer';
import { SYMBOLS, symbolById, type LibrarySymbol } from './symbols';

export interface PlantList {
  /** Each material the zones use, with its visible area in square feet (null until the plan has a scale). */
  surfaces: { material: Material; sqft: number | null }[];
  /** Each line item drawn: its runs, their total length in page points, and in feet (null until the plan has a scale). */
  lines: { item: LineItem; feet: number | null; ptLength: number; runs: number }[];
  plants: { symbol: LibrarySymbol; quantity: number }[];
  objects: { symbol: LibrarySymbol; quantity: number }[];
  markers: { symbol: LibrarySymbol; quantity: number }[];
}

export function plantList(symbols: Record<string, PlacedSymbol>, outlines: Record<string, Outline>, lines: Record<string, PlacedLine> = {}, ftPerPt: number | null = null, areas: ReadonlyMap<string, number> | null = null): PlantList {
  const used = new Set(Object.values(outlines).filter(o => o.kind === 'surface' && o.material).map(o => o.material));
  const counts = new Map<string, number>();
  for (const s of Object.values(symbols)) if (symbolById(s.symbol)) counts.set(s.symbol, (counts.get(s.symbol) ?? 0) + 1);
  // Library order is family by family; within a family, by name (markers stay in library order: gas, electric, drainage).
  const entries = SYMBOLS.filter(s => counts.has(s.id)).map(symbol => ({ symbol, quantity: counts.get(symbol.id)! }));
  const markers = entries.filter(e => e.symbol.kind === 'marker');
  const familyIndex = (f: string) => SYMBOLS.findIndex(s => s.family === f);
  entries.sort((a, b) => familyIndex(a.symbol.family) - familyIndex(b.symbol.family) || a.symbol.name.localeCompare(b.symbol.name));
  const runs = new Map<string, { pt: number; n: number }>();
  for (const l of Object.values(lines)) if (lineItemById(l.item)) { const r = runs.get(l.item) ?? { pt: 0, n: 0 }; r.pt += lineLengthPt(l); r.n++; runs.set(l.item, r); }
  const valid = ftPerPt !== null && Number.isFinite(ftPerPt) && ftPerPt > 0;
  return {
    surfaces: MATERIALS.filter(m => used.has(m.id)).map(material => ({ material, sqft: areas ? areas.get(material.id) ?? 0 : null })),
    lines: LINE_ITEMS.filter(i => runs.has(i.id)).map(item => ({ item, ptLength: runs.get(item.id)!.pt, runs: runs.get(item.id)!.n, feet: valid ? runs.get(item.id)!.pt * ftPerPt : null })),
    plants: entries.filter(e => e.symbol.kind === 'plant'),
    objects: entries.filter(e => e.symbol.kind === 'object'),
    markers,
  };
}
