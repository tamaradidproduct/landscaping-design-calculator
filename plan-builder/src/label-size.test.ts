import { describe, expect, test } from 'vitest';
import { LABEL } from './overlay-tokens';
import { labelFontPx, labelHaloPx } from './label-size';

describe('outline label size', () => {
  test('scales with the plan: 8 page points of text at 1 px per point is 8 px', () => {
    expect(LABEL).toEqual({ pt: 8, min: 7, max: 24, halo: 0.28 });
    expect(labelFontPx(1)).toBe(8); expect(labelFontPx(1.5)).toBe(12); expect(labelFontPx(2)).toBe(16);
  });
  test('stays readable when zoomed far out (never below 7 px) and sane when zoomed far in (never above 24 px)', () => {
    expect(labelFontPx(0.2)).toBe(7); expect(labelFontPx(0.8)).toBe(7); expect(labelFontPx(8)).toBe(24);
  });
  test('garbage in, a usable size out', () => {
    expect(labelFontPx(Number.NaN)).toBe(8); expect(labelFontPx(0)).toBe(7); expect(labelFontPx(-3)).toBe(7);
  });
  test('the halo is a fixed share of the text size', () => {
    expect(labelHaloPx(8)).toBeCloseTo(2.24, 5); expect(labelHaloPx(24)).toBeCloseTo(6.72, 5);
  });
});
