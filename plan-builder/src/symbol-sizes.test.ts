import { describe, expect, test } from 'vitest';
import { SYMBOL_SOURCES } from '../scripts/symbol-sources.mjs';
import { FAMILY_TYPICAL, SYMBOL_SIZES } from '../scripts/symbol-sizes.mjs';

describe('symbol sizes', () => {
  test('every symbol has a size entry and no entry is orphaned', () => {
    expect(Object.keys(SYMBOL_SIZES).sort()).toEqual(SYMBOL_SOURCES.map(s => s.id).sort());
  });
  test('sizes are finite feet between 0.25 and 60', () => {
    for (const [id, s] of Object.entries(SYMBOL_SIZES)) {
      for (const v of [s.w, s.d]) { expect(Number.isFinite(v), id).toBe(true); expect(v, id).toBeGreaterThanOrEqual(0.25); expect(v, id).toBeLessThanOrEqual(60); }
    }
  });
  test('a sourced size has an https url and a note giving the range', () => {
    for (const [id, s] of Object.entries(SYMBOL_SIZES)) {
      if (s.approximate) continue;
      expect(s.url, id).toMatch(/^https:\/\//); expect(s.note, id).toMatch(/\d/);
    }
  });
  test('an approximate size is flagged and still has a note saying why', () => {
    for (const [id, s] of Object.entries(SYMBOL_SIZES)) if (s.approximate) expect(s.note.length, id).toBeGreaterThan(10);
  });
  test('plants are round: width equals depth', () => {
    for (const s of SYMBOL_SOURCES.filter(x => x.kind === 'plant')) expect(SYMBOL_SIZES[s.id].w, s.id).toBe(SYMBOL_SIZES[s.id].d);
  });
  test('every family has a typical spread', () => {
    for (const f of new Set(SYMBOL_SOURCES.map(s => s.family))) expect(FAMILY_TYPICAL[f], f).toBeGreaterThan(0);
  });
});
