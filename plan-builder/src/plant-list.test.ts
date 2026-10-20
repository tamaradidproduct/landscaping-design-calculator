import { describe, expect, test } from 'vitest';
import { plantList } from './plant-list';
import type { MaterialId } from './materials';
import type { Outline } from './outline';
import type { PlacedLine, PlacedSymbol } from './plan-model';

const sym = (id: string, symbol: string): PlacedSymbol => ({ id, symbol, x: 0, y: 0 });
const placed = (...pairs: [string, string][]) => Object.fromEntries(pairs.map(([id, s]) => [id, sym(id, s)]));
const out = (id: string, kind: Outline['kind'], material?: string): Outline => ({ id, kind, name: id, pts: [], closed: true, ...(material ? { material } : {}) });

describe('plantList', () => {
  test('nothing placed or drawn: empty lists', () => expect(plantList({}, {})).toEqual({ surfaces: [], lines: [], plants: [], objects: [], markers: [] }));
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
  test('each surface row carries the area given for its material; none when the plan has no scale', () => {
    const outlines = { s1: out('s1', 'surface', 'sand'), s2: out('s2', 'surface', 'deck-wood') };
    expect(plantList({}, outlines, {}, 0.1, new Map<string, number>([['sand', 1240.4]])).surfaces.map(r => [r.material.id, r.sqft])).toEqual([['sand', 1240.4], ['deck-wood', 0]]);
    expect(plantList({}, outlines).surfaces.map(r => r.sqft)).toEqual([null, null]);
    expect(plantList({}, outlines, {}, null, null).surfaces.map(r => r.sqft)).toEqual([null, null]);
  });
  test('a zone still being drawn (not closed) is not listed, so it never shows as 0 sq ft', () => {
    const drawing = { ...out('s2', 'surface', 'deck-wood'), closed: false };
    expect(plantList({}, { s1: out('s1', 'surface', 'sand'), s2: drawing }, {}, 0.1, new Map([['sand', 10]])).surfaces.map(r => r.material.id)).toEqual(['sand']);
  });
  test('surfaces: the distinct materials the zones use, in library order; boundary, features and material-less zones are ignored', () => {
    const l = plantList({}, { b: out('b', 'boundary'), f1: out('f1', 'feature'), s1: out('s1', 'surface', 'deck-wood'), s2: out('s2', 'surface', 'sand'), s3: out('s3', 'surface', 'sand'), s4: out('s4', 'surface') });
    expect(l.surfaces.map(s => s.material.id)).toEqual(['sand', 'deck-wood']);
    expect(l.surfaces.map(s => s.material.name)).toEqual(['Sand', 'Deck wood']);
  });
  test('an unknown symbol id is skipped', () => expect(plantList(placed(['y1', 'nope']), {}).plants).toEqual([]));
  test('stepping stones are objects, utility markers are listed apart with their quantity', () => {
    const l = plantList(placed(['y1', 'porcelain-pavers'], ['y2', 'gas-line'], ['y3', 'gas-line'], ['y4', 'drainage-line']), {});
    expect(l.objects.map(o => [o.symbol.id, o.quantity])).toEqual([['porcelain-pavers', 1]]);
    expect(l.markers.map(m => [m.symbol.id, m.quantity])).toEqual([['gas-line', 2], ['drainage-line', 1]]);
    expect(l.plants).toEqual([]);
  });
});

describe('plantList lines', () => {
  const run = (id: string, item: string, len: number): PlacedLine => ({ id, item, points: [{ x: 0, y: 0 }, { x: len, y: 0 }], widthFt: 1 });
  const lines = (...ls: PlacedLine[]) => Object.fromEntries(ls.map(l => [l.id, l]));
  test('runs of one item add up: two 100 pt fences at 0.1 ft/pt are 20 ft in 2 runs', () => {
    const l = plantList({}, {}, lines(run('l1', 'wood-privacy-fence', 100), run('l2', 'wood-privacy-fence', 100)), 0.1);
    expect(l.lines).toHaveLength(1);
    expect(l.lines[0].item.id).toBe('wood-privacy-fence'); expect(l.lines[0].feet).toBeCloseTo(20, 6); expect(l.lines[0].runs).toBe(2); expect(l.lines[0].ptLength).toBeCloseTo(200, 6);
  });
  test('with no plan scale the feet are null and the page-point length is kept', () => {
    const l = plantList({}, {}, lines(run('l1', 'dry-river', 100), run('l2', 'dry-river', 50)), null);
    expect(l.lines[0].feet).toBeNull(); expect(l.lines[0].ptLength).toBeCloseTo(150, 6);
  });
  test('items come in library order, not drawing order', () => {
    const ids = plantList({}, {}, lines(run('l1', 'dry-river', 10), run('l2', 'wood-privacy-fence', 10), run('l3', 'retaining-wall', 10)), 0.1).lines.map(x => x.item.id);
    expect(ids).toEqual(['wood-privacy-fence', 'retaining-wall', 'dry-river']);
  });
  test('an unknown line item is skipped', () => {
    expect(plantList({}, {}, lines(run('l1', 'nope', 10)), 0.1).lines).toEqual([]);
  });
});
