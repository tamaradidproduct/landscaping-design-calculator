import { describe, expect, test } from 'vitest';
import { areaPt2, outlinePath } from './outline';
import { cornerBisector, distToCorner, pushSide, radiusFromHandle, resizeCursor, roundHandleDistance, stepRadius, straightPart, translate } from './shape-edit';

const P = (x: number, y: number) => ({ x, y });
const sq = [P(0, 0), P(10, 0), P(10, 10), P(0, 10)];

describe('moving and pushing sides', () => {
  test('translate moves every corner', () => expect(translate(sq, 3, -2)).toEqual([P(3, -2), P(13, -2), P(13, 8), P(3, 8)]));
  test('pushing the right side out keeps a rectangle', () => {
    // Edge 1 runs (10,0)→(10,10); its outward normal is +x for this winding.
    const r = pushSide(sq, 1, P(4, 0));
    expect(r).toEqual([P(0, 0), P(14, 0), P(14, 10), P(0, 10)]);
  });
  test('only the movement across the side counts', () => expect(pushSide(sq, 1, P(4, 7))).toEqual(pushSide(sq, 1, P(4, 0))));
  test('neighbours that slant: the corners slide along them', () => {
    const trap = [P(0, 0), P(10, 0), P(12, 10), P(-2, 10)];
    const r = pushSide(trap, 2, P(0, 5)); // bottom side down by 5: corners follow the slanted sides
    expect(r[2].y).toBeCloseTo(15, 9); expect(r[3].y).toBeCloseTo(15, 9);
    expect(r[2].x).toBeCloseTo(13, 9); expect(r[3].x).toBeCloseTo(-3, 9);
  });
});

describe('rounded corners', () => {
  test('a radius cuts the corner with an arc: area loses r²(1 − π/4) per corner', () => {
    const path = outlinePath(sq, undefined, true, [2, 2, 2, 2]);
    expect(areaPt2(path)).toBeCloseTo(100 - 4 * 4 * (1 - Math.PI / 4), 1);
    expect(path.some(p => p.x === 0 && p.y === 0)).toBe(false);
  });
  test('radius 0 (or none) leaves the corner sharp', () => {
    expect(outlinePath(sq, undefined, true, [0, 0, 0, 0])).toEqual(outlinePath(sq, undefined, true));
  });
  test('a radius too big for the sides is clamped so arcs never overlap', () => {
    const path = outlinePath(sq, undefined, true, [50, 50, 50, 50]);
    expect(areaPt2(path)).toBeCloseTo(Math.PI * 25, 0); // a 10 × 10 square fully rounded is a circle of radius 5
  });
  test('the handle sits on the arc middle; dragging it back out gives the radius', () => {
    const b = cornerBisector(sq, 0);
    expect(b.dir.x).toBeCloseTo(Math.SQRT1_2, 9); expect(b.dir.y).toBeCloseTo(Math.SQRT1_2, 9);
    const d = roundHandleDistance(2, b.half);
    expect(d).toBeCloseTo(2 * (Math.SQRT2 - 1), 9);
    expect(radiusFromHandle(d, b.half)).toBeCloseTo(2, 9);
  });
});

describe('pointer and keyboard helpers', () => {
  test('a side shows a two-way arrow across it (screen y points down)', () => {
    expect(resizeCursor({ x: 1, y: 0 })).toBe('ew-resize');
    expect(resizeCursor({ x: 0, y: -1 })).toBe('ns-resize');
    expect(resizeCursor({ x: 1, y: 1 })).toBe('nwse-resize');
    expect(resizeCursor({ x: 1, y: -1 })).toBe('nesw-resize');
    expect(resizeCursor({ x: -0.95, y: 0.2 })).toBe('ew-resize');
  });
  test('arrow keys step a radius by 0.5′ (Shift: 2′), never below 0', () => {
    expect(stepRadius(2, 1, false)).toBe(2.5);
    expect(stepRadius(2, -1, true)).toBe(0);
    expect(stepRadius(0.2, -1, false)).toBe(0);
    expect(stepRadius(1.2, 1, false)).toBe(1.5); // snaps onto the 0.5′ grid
  });
});

describe('hover areas follow the drawn line', () => {
  test('a rounded corner trims the straight part of its sides', () => {
    const s = straightPart(sq, 0, [2, 0, 0, 0]); // side 0: (0,0)→(10,0), corner 0 rounded by 2
    expect(s[0].x).toBeCloseTo(2, 9); expect(s[1].x).toBeCloseTo(10, 9);
    expect(straightPart(sq, 3, [2, 0, 0, 0])[1].y).toBeCloseTo(2, 9); // side 3 ends 2 short of corner 0
  });
  test('distance to the line near a corner: the arc when rounded, the corner when sharp', () => {
    expect(distToCorner(sq, 0, undefined, P(-1, -1))).toBeCloseTo(Math.SQRT2, 9);
    // The arc's middle is at 2 − √2 from the corner along the diagonal: (0.586, 0.586).
    const m = 2 - Math.SQRT2;
    expect(distToCorner(sq, 0, [2, 0, 0, 0], P(m, m))).toBeCloseTo(0, 2);
    expect(distToCorner(sq, 0, [2, 0, 0, 0], P(0, 0))).toBeGreaterThan(0.8);
  });
});
