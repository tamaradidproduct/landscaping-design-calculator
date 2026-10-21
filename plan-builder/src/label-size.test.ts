import { describe, expect, test } from 'vitest';
import { LABEL } from './overlay-tokens';
import { labelFontPx, labelHaloPx } from './label-size';

describe('outline label size', () => {
  test('scales with the plan: 10 page points of text at 1 px per point is 10 px', () => {
    expect(LABEL).toEqual({ pt: 10, min: 8, max: 30, halo: 0.28 });
    expect(labelFontPx(1)).toBe(10); expect(labelFontPx(1.5)).toBe(15); expect(labelFontPx(2)).toBe(20);
  });
  test('stays readable when zoomed far out (never below 8 px) and sane when zoomed far in (never above 30 px)', () => {
    expect(labelFontPx(0.2)).toBe(8); expect(labelFontPx(0.7)).toBe(8); expect(labelFontPx(8)).toBe(30);
  });
  test('garbage in, a usable size out', () => {
    expect(labelFontPx(Number.NaN)).toBe(10); expect(labelFontPx(0)).toBe(8); expect(labelFontPx(-3)).toBe(8);
  });
  test('the halo is a fixed share of the text size', () => {
    expect(labelHaloPx(10)).toBeCloseTo(2.8, 5); expect(labelHaloPx(30)).toBeCloseTo(8.4, 5);
  });
});
