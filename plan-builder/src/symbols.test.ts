import { describe, expect, test } from 'vitest';
import { SYMBOL_SIZES } from '../scripts/symbol-sizes.mjs';
import { FIGMA_PX_PER_FT } from './figma-scale';
import { SYMBOLS, tierOf, searchSymbols, symbolById, symbolFamilies } from './symbols';

describe('symbol library', () => {
  test('72 symbols: 51 plants, 18 objects and 3 markers', () => {
    expect(SYMBOLS).toHaveLength(72);
    expect(SYMBOLS.filter(s => s.kind === 'plant')).toHaveLength(51);
    expect(SYMBOLS.filter(s => s.kind === 'object')).toHaveLength(18);
    expect(SYMBOLS.filter(s => s.kind === 'marker')).toHaveLength(3);
  });
  test('every symbol has art and a thumbnail; plants have a photo, others none', () => {
    for (const s of SYMBOLS) {
      expect(s.art, s.id).toBeTruthy(); expect(s.thumb, s.id).toBeTruthy();
      if (s.kind === 'plant') expect(s.photo, s.id).toBeTruthy(); else expect(s.photo, s.id).toBeUndefined();
    }
  });
  test('a plant is a circle of its researched spread', () => {
    for (const s of SYMBOLS.filter(x => x.kind === 'plant')) { expect(s.size.w, s.id).toBe(SYMBOL_SIZES[s.id].w); expect(s.size.d, s.id).toBe(s.size.w); }
  });
  test('an object keeps its researched long side and takes its other side from the art\'s proportions', () => {
    for (const s of SYMBOLS.filter(x => x.kind !== 'plant')) {
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
    expect(symbolFamilies('object').map(f => f.family)).toEqual(['Objects', 'Stepping stones']);
    expect(symbolFamilies('marker').map(f => f.family)).toEqual(['Utility markers']);
    expect(symbolFamilies().reduce((n, f) => n + f.symbols.length, 0)).toBe(72);
  });
  test('searchSymbols matches name, category and family, case-insensitively', () => {
    const names = (q: string) => searchSymbols(q).map(s => s.name);
    expect(names('spruce').sort()).toEqual(['Blue Diamond Spruce', 'Fat Albert Spruce']);
    expect(searchSymbols('EVERGREEN').map(s => s.id)).toEqual(['blue-diamond-spruce', 'austrian-pine', 'fat-albert-spruce']);
    expect(searchSymbols('grasses').length).toBe(5);
    expect(searchSymbols('')).toHaveLength(72);
    expect(searchSymbols('zzzz')).toEqual([]);
  });
  test('stepping stone and marker footprints come from Figma at 36 px per ft', () => {
    const sz = (id: string) => symbolById(id)!.size;
    for (const id of ['porcelain-pavers', 'concrete-pavers', 'flagstone-pavers']) { expect(sz(id).w, id).toBeCloseTo(2, 1); expect(sz(id).d, id).toBeCloseTo(2, 1); }
    expect(sz('colorado-buff-stone').w).toBeCloseTo(3.56, 1); expect(sz('colorado-buff-stone').d).toBeCloseTo(2, 1);
    expect(sz('gas-line').w).toBeCloseTo(0.42, 1); expect(sz('gas-line').d).toBeCloseTo(1.03, 1);
    expect(sz('electric-line').d).toBeCloseTo(1.03, 1);
    expect(sz('drainage-line').w).toBeCloseTo(3.78, 1); expect(sz('drainage-line').d).toBeCloseTo(3.03, 1);
  });
  test('only markers have a 20 px minimum on-screen size', () => {
    expect(FIGMA_PX_PER_FT).toBe(36);
    for (const s of SYMBOLS) { if (s.kind === 'marker') expect(s.minPx, s.id).toBe(20); else expect(s.minPx, s.id).toBeUndefined(); }
  });
  test('tierOf: trees 5, shrubs 4, perennials/ground covers/grasses/other 3, objects 2, markers 1', () => {
    const tiers = (family: string) => [...new Set(SYMBOLS.filter(s => s.family === family).map(tierOf))];
    for (const f of ['Evergreen trees', 'Deciduous trees', 'Accent trees']) expect(tiers(f), f).toEqual([5]);
    for (const f of ['Accent shrubs', 'Privacy shrubs', 'Large shrubs']) expect(tiers(f), f).toEqual([4]);
    for (const f of ['Perennials', 'Ground covers', 'Ornamental grasses', 'Other']) expect(tiers(f), f).toEqual([3]);
    for (const f of ['Objects', 'Stepping stones']) expect(tiers(f), f).toEqual([2]);
    expect(tiers('Utility markers')).toEqual([1]);
  });
  test('every library symbol has a tier from 1 to 5', () => {
    for (const s of SYMBOLS) expect([1, 2, 3, 4, 5], s.id).toContain(tierOf(s));
  });
});
