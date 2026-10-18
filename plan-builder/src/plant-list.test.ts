import { describe, expect, test } from 'vitest';
import { plantList } from './plant-list';
import type { Outline } from './outline';
import type { PlacedSymbol } from './plan-model';

const sym = (id: string, symbol: string): PlacedSymbol => ({ id, symbol, x: 0, y: 0 });
const placed = (...pairs: [string, string][]) => Object.fromEntries(pairs.map(([id, s]) => [id, sym(id, s)]));
const out = (id: string, kind: Outline['kind'], material?: string): Outline => ({ id, kind, name: id, pts: [], closed: true, ...(material ? { material } : {}) });

describe('plantList', () => {
  test('nothing placed or drawn: empty lists', () => expect(plantList({}, {})).toEqual({ surfaces: [], plants: [], objects: [] }));
  test('the same plant placed twice is one entry with quantity 2', () => {
    const l = plantList(placed(['y1', 'oak'], ['y2', 'oak']), {});
    expect(l.plants).toHaveLength(1); expect(l.plants[0].symbol.id).toBe('oak'); expect(l.plants[0].quantity).toBe(2);
  });
  test('plants sort by family, then name', () => {
    const ids = plantList(placed(['y1', 'oak'], ['y2', 'blue-diamond-spruce'], ['y3', 'austrian-pine'], ['y4', 'creeping-phlox']), {}).plants.map(p => p.symbol.id);
    expect(ids).toEqual(['austrian-pine', 'blue-diamond-spruce', 'oak', 'creeping-phlox']); // Evergreen trees, Deciduous trees, Perennials
  });
  test('objects are listed apart from plants, with their quantity', () => {
    const l = plantList(placed(['y1', 'hot-tub'], ['y2', 'oak'], ['y3', 'hot-tub']), {});
    expect(l.plants.map(p => p.symbol.id)).toEqual(['oak']);
    expect(l.objects.map(o => [o.symbol.id, o.quantity])).toEqual([['hot-tub', 2]]);
  });
  test('surfaces: the distinct materials the zones use, in library order; boundary, features and material-less zones are ignored', () => {
    const l = plantList({}, { b: out('b', 'boundary'), f1: out('f1', 'feature'), s1: out('s1', 'surface', 'deck-wood'), s2: out('s2', 'surface', 'sand'), s3: out('s3', 'surface', 'sand'), s4: out('s4', 'surface') });
    expect(l.surfaces.map(s => s.id)).toEqual(['sand', 'deck-wood']);
    expect(l.surfaces.map(s => s.name)).toEqual(['Sand', 'Deck wood']);
  });
  test('an unknown symbol id is skipped', () => expect(plantList(placed(['y1', 'nope']), {}).plants).toEqual([]));
});
