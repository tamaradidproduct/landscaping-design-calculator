import { describe, expect, test } from 'vitest';
import { SYMBOL_SOURCES } from '../scripts/symbol-sources.mjs';

const plants = SYMBOL_SOURCES.filter(s => s.kind === 'plant'), objects = SYMBOL_SOURCES.filter(s => s.kind === 'object'), markers = SYMBOL_SOURCES.filter(s => s.kind === 'marker');
const FAMILIES = ['Evergreen trees', 'Deciduous trees', 'Accent trees', 'Accent shrubs', 'Privacy shrubs', 'Large shrubs', 'Perennials', 'Ground covers', 'Ornamental grasses', 'Other'];

describe('symbol library inventory', () => {
  test('51 plants, 18 objects (14 + 4 stepping stones) and 3 utility markers', () => { expect(plants).toHaveLength(51); expect(objects).toHaveLength(18); expect(markers).toHaveLength(3); });
  test('ids are unique kebab-case, names and Figma ids unique', () => {
    expect(new Set(SYMBOL_SOURCES.map(s => s.id)).size).toBe(72);
    expect(new Set(SYMBOL_SOURCES.map(s => s.name)).size).toBe(72);
    expect(new Set(SYMBOL_SOURCES.map(s => s.figma)).size).toBe(72);
    for (const s of SYMBOL_SOURCES) expect(s.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  test('every plant has a category and one of the families; objects are in Objects', () => {
    for (const p of plants) { expect(p.category).not.toBe(''); expect(FAMILIES).toContain(p.family); }
    for (const o of objects) { expect(['Objects', 'Stepping stones']).toContain(o.family); expect(o.category).toBe(''); }
    for (const m of markers) { expect(m.family).toBe('Utility markers'); expect(m.category).toBe(''); }
    expect(objects.filter(o => o.family === 'Stepping stones').map(o => o.id)).toEqual(['porcelain-pavers', 'concrete-pavers', 'flagstone-pavers', 'colorado-buff-stone']);
  });
  test('family sizes: 3, 3, 6, 4, 4, 8, 14, 1, 5, 3', () => {
    expect(FAMILIES.map(f => plants.filter(p => p.family === f).length)).toEqual([3, 3, 6, 4, 4, 8, 14, 1, 5, 3]);
  });
  test('Figma name drift is resolved to one canonical name each', () => {
    const name = (id: string) => SYMBOL_SOURCES.find(s => s.id === id)?.name;
    expect(name('blue-diamond-spruce')).toBe('Blue Diamond Spruce');
    expect(name('coneflower')).not.toBe(name('purple-coneflower'));
    expect(name('seating-wall')).toBe('Seating wall');
    expect(name('inground-trampoline')).toBe('Inground trampoline');
    expect(name('colorado-buff-stone')).not.toBe(name('colorado-buff-boulder'));
    expect(markers.map(m => m.id)).toEqual(['gas-line', 'electric-line', 'drainage-line']);
  });
});
