import { describe, expect, test } from 'vitest';
import { LABEL } from './overlay-tokens';
import { labelFontPx, labelHaloPx } from './label-size';

describe('outline label size', () => {
  test('scales with the plan: 14 page points of text at 1 px per point is 14 px', () => {
    expect(LABEL).toEqual({ pt: 14, min: 10, max: 40, halo: 0.28 });
    expect(labelFontPx(1)).toBe(14); expect(labelFontPx(1.5)).toBe(21); expect(labelFontPx(2)).toBe(28);
  });
  test('stays readable when zoomed far out (never below 10 px) and sane when zoomed far in (never above 40 px)', () => {
    expect(labelFontPx(0.2)).toBe(10); expect(labelFontPx(0.7)).toBe(10); expect(labelFontPx(8)).toBe(40);
  });
  test('garbage in, a usable size out', () => {
    expect(labelFontPx(Number.NaN)).toBe(14); expect(labelFontPx(0)).toBe(10); expect(labelFontPx(-3)).toBe(10);
  });
  test('the halo is a fixed share of the text size', () => {
    expect(labelHaloPx(14)).toBeCloseTo(3.92, 5); expect(labelHaloPx(40)).toBeCloseTo(11.2, 5);
  });
});
