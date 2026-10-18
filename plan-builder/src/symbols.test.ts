import { describe, expect, test } from 'vitest';
import { SYMBOL_SIZES } from '../scripts/symbol-sizes.mjs';
import { SYMBOLS, searchSymbols, symbolById, symbolFamilies } from './symbols';

describe('symbol library', () => {
  test('65 symbols: 51 plants and 14 objects', () => {
    expect(SYMBOLS).toHaveLength(65);
    expect(SYMBOLS.filter(s => s.kind === 'plant')).toHaveLength(51);
    expect(SYMBOLS.filter(s => s.kind === 'object')).toHaveLength(14);
  });
  test('every symbol has art and a thumbnail; plants have a photo, objects none', () => {
    for (const s of SYMBOLS) {
      expect(s.art, s.id).toBeTruthy(); expect(s.thumb, s.id).toBeTruthy();
      if (s.kind === 'plant') expect(s.photo, s.id).toBeTruthy(); else expect(s.photo, s.id).toBeUndefined();
    }
  });
  test('a plant is a circle of its researched spread', () => {
    for (const s of SYMBOLS.filter(x => x.kind === 'plant')) { expect(s.size.w, s.id).toBe(SYMBOL_SIZES[s.id].w); expect(s.size.d, s.id).toBe(s.size.w); }
  });
  test('an object keeps its researched long side and takes its other side from the art\'s proportions', () => {
    for (const s of SYMBOLS.filter(x => x.kind === 'object')) {
      const long = Math.max(SYMBOL_SIZES[s.id].w, SYMBOL_SIZES[s.id].d);
      expect(Math.max(s.size.w, s.size.d), s.id).toBeCloseTo(long, 5);
      expect(s.size.w / s.size.d, s.id).toBeCloseTo(s.artAspect, 2);
    }
  });
  test('every symbol cites its size source', () => {
    for (const s of SYMBOLS) { expect(s.sizeSource.url, s.id).toMatch(/^https:\/\//); expect(s.sizeSource.note.length, s.id).toBeGreaterThan(5); }
  });
  test('symbolById finds one and misses unknown ids', () => {
    expect(symbolById('hot-tub')?.name).toBe('Hot tub');
    expect(symbolById('nope')).toBeUndefined();
  });
  test('symbolFamilies lists plant families in library order', () => {
    expect(symbolFamilies('plant').map(f => f.family)).toEqual(['Evergreen trees', 'Deciduous trees', 'Accent trees', 'Accent shrubs', 'Privacy shrubs', 'Large shrubs', 'Perennials', 'Ground covers', 'Ornamental grasses', 'Other']);
    expect(symbolFamilies('object').map(f => f.family)).toEqual(['Objects']);
    expect(symbolFamilies().reduce((n, f) => n + f.symbols.length, 0)).toBe(65);
  });
  test('searchSymbols matches name, category and family, case-insensitively', () => {
    const names = (q: string) => searchSymbols(q).map(s => s.name);
    expect(names('spruce').sort()).toEqual(['Blue Diamond Spruce', 'Fat Albert Spruce']);
    expect(searchSymbols('EVERGREEN').map(s => s.id)).toEqual(['blue-diamond-spruce', 'austrian-pine', 'fat-albert-spruce']);
    expect(searchSymbols('grasses').length).toBe(5);
    expect(searchSymbols('')).toHaveLength(65);
    expect(searchSymbols('zzzz')).toEqual([]);
  });
});
