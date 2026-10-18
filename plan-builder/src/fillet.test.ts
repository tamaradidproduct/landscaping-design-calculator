import { describe, expect, test } from 'vitest';
import { cornerFillet } from './fillet';
import { outlinePath } from './outline';

// A 100 × 100 square, corners 0..3 going around (CCW on screen-less maths axes), side i = corner i → i+1.
const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
/** Centre and radius of the arc a→b with bulge h (same convention as edgePoints: the arc passes through mid + leftNormal·h). */
const arcCircle = (a: { x: number; y: number }, b: { x: number; y: number }, h: number) => {
  const c = d(a, b) / 2, R = (c * c + h * h) / (2 * Math.abs(h)), l = d(a, b);
  const n = { x: -(b.y - a.y) / l, y: (b.x - a.x) / l }, m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const s = Math.sign(h);
  return { O: { x: m.x + n.x * s * (Math.abs(h) - R), y: m.y + n.y * s * (Math.abs(h) - R) }, R };
};

describe('cornerFillet next to a bent side', () => {
  test('rounds corner 1 when side 0 (corner 0 → 1) bulges outward', () => {
    const bulges = [-10, 0, 0, 0]; // bottom side bulging outward (−y)
    const f = cornerFillet(square, bulges, 1, 8)!;
    expect(f).not.toBeNull();
    const { O, R } = arcCircle(square[0], square[1], -10);
    // The fillet leaves the bent side on its circle, and the side next to it on its line (x = 100).
    expect(d(f.arc[0], O)).toBeCloseTo(R, 4);
    expect(f.arc[f.arc.length - 1].x).toBeCloseTo(100, 4);
    // …and every point of it is 8 from the fillet's centre.
    const c = { x: (f.arc[0].x + f.arc[f.arc.length - 1].x) / 2, y: 0 };
    expect(f.tIn).toBeGreaterThanOrEqual(0.5); expect(f.tIn).toBeLessThan(1);
    expect(f.tOut).toBeGreaterThan(0); expect(f.tOut).toBeLessThanOrEqual(0.5);
    expect(c).toBeDefined();
  });
  test('rounds corner 1 when side 0 bulges inward (a concave side)', () => {
    const f = cornerFillet(square, [10, 0, 0, 0], 1, 8)!;
    expect(f).not.toBeNull();
    const { O, R } = arcCircle(square[0], square[1], 10);
    expect(d(f.arc[0], O)).toBeCloseTo(R, 4);
  });
  test('rounds a corner between two bent sides', () => {
    const f = cornerFillet(square, [-10, -10, 0, 0], 1, 6)!;
    expect(f).not.toBeNull();
    expect(d(f.arc[0], arcCircle(square[0], square[1], -10).O)).toBeCloseTo(arcCircle(square[0], square[1], -10).R, 4);
    expect(d(f.arc[f.arc.length - 1], arcCircle(square[1], square[2], -10).O)).toBeCloseTo(arcCircle(square[1], square[2], -10).R, 4);
  });
  test('a radius too big for the sides shrinks to fit (never past half a side)', () => {
    const f = cornerFillet(square, [-10, 0, 0, 0], 1, 500)!;
    expect(f.tIn).toBeGreaterThanOrEqual(0.5 - 1e-6);
    expect(f.tOut).toBeLessThanOrEqual(0.5 + 1e-6);
  });
  test('no radius, no fillet', () => expect(cornerFillet(square, [-10, 0, 0, 0], 1, 0)).toBeNull());
});

describe('outlinePath with rounded corners next to bent sides', () => {
  const bulges = [-10, 0, 0, 0], radii = [8, 8, 8, 8];
  const path = outlinePath(square, bulges, true, radii);
  test('every corner is cut: no point sits on a sharp corner', () => {
    for (const p of square) expect(Math.min(...path.map(q => d(p, q)))).toBeGreaterThan(1);
  });
  test('the bend itself is kept: the arc still peaks 10 out', () => {
    const peak = Math.min(...path.map(q => q.y));
    expect(peak).toBeLessThan(-9.9); expect(peak).toBeGreaterThan(-10.001);
  });
  test('straight sides still round as before (no bulges)', () => {
    const straight = outlinePath(square, [0, 0, 0, 0], true, radii);
    expect(Math.min(...straight.map(q => d(square[1], q)))).toBeGreaterThan(3); // 8 · (√2 − 1) from the corner
  });
});
