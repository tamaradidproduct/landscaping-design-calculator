// What the plan contains, for the Plant list: the surfaces used, and the plants and objects placed with how many of each. Pure.
import type { Outline } from './outline';
import type { PlacedSymbol } from './plan-model';
import { MATERIALS, type Material } from './materials';
import { SYMBOLS, symbolById, type LibrarySymbol } from './symbols';

export interface PlantList {
  surfaces: Material[];
  plants: { symbol: LibrarySymbol; quantity: number }[];
  objects: { symbol: LibrarySymbol; quantity: number }[];
}

export function plantList(symbols: Record<string, PlacedSymbol>, outlines: Record<string, Outline>): PlantList {
  const used = new Set(Object.values(outlines).filter(o => o.kind === 'surface' && o.material).map(o => o.material));
  const counts = new Map<string, number>();
  for (const s of Object.values(symbols)) if (symbolById(s.symbol)) counts.set(s.symbol, (counts.get(s.symbol) ?? 0) + 1);
  // Library order is family by family; within a family, by name.
  const entries = SYMBOLS.filter(s => counts.has(s.id)).map(symbol => ({ symbol, quantity: counts.get(symbol.id)! }));
  const familyIndex = (f: string) => SYMBOLS.findIndex(s => s.family === f);
  entries.sort((a, b) => familyIndex(a.symbol.family) - familyIndex(b.symbol.family) || a.symbol.name.localeCompare(b.symbol.name));
  return {
    surfaces: MATERIALS.filter(m => used.has(m.id)),
    plants: entries.filter(e => e.symbol.kind === 'plant'),
    objects: entries.filter(e => e.symbol.kind === 'object'),
  };
}
