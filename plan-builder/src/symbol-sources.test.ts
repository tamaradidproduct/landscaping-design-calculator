import { describe, expect, test } from 'vitest';
import { SYMBOL_SOURCES } from '../scripts/symbol-sources.mjs';

const plants = SYMBOL_SOURCES.filter(s => s.kind === 'plant'), objects = SYMBOL_SOURCES.filter(s => s.kind === 'object');
const FAMILIES = ['Evergreen trees', 'Deciduous trees', 'Accent trees', 'Accent shrubs', 'Privacy shrubs', 'Large shrubs', 'Perennials', 'Ground covers', 'Ornamental grasses', 'Other'];

describe('symbol library inventory', () => {
  test('51 plants and 14 objects', () => { expect(plants).toHaveLength(51); expect(objects).toHaveLength(14); });
  test('ids are unique kebab-case, names and Figma ids unique', () => {
    expect(new Set(SYMBOL_SOURCES.map(s => s.id)).size).toBe(65);
    expect(new Set(SYMBOL_SOURCES.map(s => s.name)).size).toBe(65);
    expect(new Set(SYMBOL_SOURCES.map(s => s.figma)).size).toBe(65);
    for (const s of SYMBOL_SOURCES) expect(s.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  test('every plant has a category and one of the families; objects are in Objects', () => {
    for (const p of plants) { expect(p.category).not.toBe(''); expect(FAMILIES).toContain(p.family); }
    for (const o of objects) { expect(o.family).toBe('Objects'); expect(o.category).toBe(''); }
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
  });
});
