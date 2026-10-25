import { describe, expect, test } from 'vitest';
import { planBounds } from './plan-bounds';
import type { Outline } from './outline';

const o = (pts: { x: number; y: number }[]): Outline => ({ id: 'a', kind: 'boundary', name: 'a', pts, closed: true });

describe('planBounds', () => {
  const outlines = { a: o([{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 70 }]) };
  test('bounds one outline', () => {
    expect(planBounds({ outlines })).toEqual({ x: 10, y: 20, w: 100, h: 50 });
  });
  test('includes symbols and lines', () => {
    expect(planBounds({ outlines, symbols: { s: { id: 's', symbol: 'x', x: 200, y: 300 } } })).toEqual({ x: 10, y: 20, w: 190, h: 280 });
    expect(planBounds({ outlines, lines: { l: { id: 'l', item: 'f', points: [{ x: 0, y: 0 }], widthFt: 1 } } })).toEqual({ x: 0, y: 0, w: 110, h: 70 });
  });
  test('empty is null', () => { expect(planBounds({ outlines: {} })).toBeNull(); });
});
