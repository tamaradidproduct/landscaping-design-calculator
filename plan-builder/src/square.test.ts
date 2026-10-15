import { describe, expect, test } from 'vitest';
import { alignAll, alignCorner, cornerAngle, outlineFrame } from './square';
import { edgePoints } from './outline';
import { IDENTITY, type Correction } from './scale';
import type { Point } from './view';

const rot = (p: Point, deg: number): Point => {
  const r = deg * Math.PI / 180;
  return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
};
const allSquare = (pts: Point[], bulges: number[] | undefined, m: Correction = IDENTITY) =>
  pts.map((_, i) => cornerAngle(pts, bulges, i, m));

describe('cornerAngle', () => {
  test('right angle', () => expect(cornerAngle([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], undefined, 1, IDENTITY)).toBeCloseTo(90, 9));
  test('measured in true shape (stretched plan)', () => {
    // 45° on the page becomes atan(2) ≈ 63.4° once the plan is stretched 2× down.
    expect(cornerAngle([{ x: 10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 10 }], undefined, 1, { a: 1, b: 0, c: 0, d: 2 })).toBeCloseTo(63.435, 2);
  });
  test.each([2, -2, 4])('bent edges: matches the drawn arc (bulge %d)', h => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 1.5 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    for (const bulges of [[0, h, 0, 0], [h, 0, 0, 0]]) {
      const out = bulges[1] ? edgePoints(pts[1], pts[2], bulges[1], 4096)[1] : pts[2];
      const back = edgePoints(pts[0], pts[1], bulges[0], 4096);
      const into = bulges[0] ? back[back.length - 1] : pts[0];
      const u = { x: out.x - pts[1].x, y: out.y - pts[1].y }, v = { x: into.x - pts[1].x, y: into.y - pts[1].y };
      const numeric = Math.abs(Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y)) * 180 / Math.PI;
      expect(cornerAngle(pts, bulges, 1, IDENTITY)).toBeCloseTo(numeric, 1);
    }
  });
});

describe('outlineFrame', () => {
  test('square to the page', () => expect(outlineFrame([{ x: 0, y: 0 }, { x: 40, y: 0.3 }, { x: 40, y: 20 }, { x: 0, y: 20 }], undefined, IDENTITY)).toBeCloseTo(0, 1));
  test('a slanted lot line does not tilt it', () => {
    // Riesberg-like lot: top and left square to the page, the right side 16° off vertical.
    const lot = [{ x: 0, y: 0 }, { x: 280, y: 0 }, { x: 196, y: 300 }, { x: 0, y: 300 }];
    expect(outlineFrame(lot, undefined, IDENTITY)).toBeCloseTo(0, 9);
    const out = alignAll(lot, undefined, IDENTITY);
    expect(out.pts[2].x).toBeCloseTo(196, 9); // the slanted side stays slanted
  });
  test('a house drawn at 30° on the page', () => {
    const house = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }].map(p => rot(p, 30));
    expect(outlineFrame(house, undefined, IDENTITY) * 180 / Math.PI).toBeCloseTo(30, 6);
  });
});

describe('alignCorner (only the corner moves)', () => {
  // The screenshot: corner 3 sits a little off; it should take corner 1's height and corner 2's left–right position.
  const c1 = { x: 445, y: 190 }, c3 = { x: 104, y: 187 }, c2 = { x: 100, y: 1035 };
  const house = [c1, c3, c2, { x: 360, y: 1035 }, { x: 360, y: 955 }, { x: 465, y: 955 }, { x: 465, y: 1140 }, { x: 900, y: 1140 }, { x: 900, y: 190 }];
  test('lines up with both neighbours, so the corner is square', () => {
    const out = alignCorner(house, undefined, 1, IDENTITY);
    expect(out.pts[1].x).toBeCloseTo(c2.x, 9); expect(out.pts[1].y).toBeCloseTo(c1.y, 9);
    expect(cornerAngle(out.pts, undefined, 1, IDENTITY)).toBeCloseTo(90, 9);
    out.pts.forEach((p, k) => { if (k !== 1) expect(p).toEqual(house[k]); });
  });
  test('a house at 30° lines up with its own walls', () => {
    const square = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 20 }, { x: 0, y: 20 }].map(p => rot(p, 30));
    const off = square.map((p, k) => k === 2 ? { x: p.x + 0.6, y: p.y - 0.4 } : p);
    const out = alignCorner(off, undefined, 2, IDENTITY);
    expect(out.pts[2].x).toBeCloseTo(square[2].x, 6); expect(out.pts[2].y).toBeCloseTo(square[2].y, 6);
  });
  test('a 45° edge is left alone; only the edge near an axis lines up', () => {
    const pts = [{ x: 0, y: 0 }, { x: 20, y: 0.8 }, { x: 30, y: 10 }, { x: 0, y: 10 }];
    const out = alignCorner(pts, undefined, 1, IDENTITY);
    expect(out.pts[1].y).toBeCloseTo(0, 9); // lined up with corner 0 across
    expect(out.pts[1].x).toBeCloseTo(20, 9); // not pulled toward corner 2 along the 45° edge
  });
  test('bent edges give no direction and stay bent', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 1 }, { x: 10.5, y: 10 }, { x: 0, y: 10 }], bulges = [0, 2, 0, 0];
    const out = alignCorner(pts, bulges, 1, IDENTITY);
    expect(out.pts[1].x).toBeCloseTo(10, 9); expect(out.pts[1].y).toBeCloseTo(0, 9); // across to corner 0 only
    const half = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) / 2;
    expect(out.bulges![1] / half(out.pts[1], out.pts[2])).toBeCloseTo(2 / half(pts[1], pts[2]), 9);
  });
  test('stretched plan: lines up in true shape', () => {
    const m = { a: 1, b: 0, c: 0, d: 1.3 };
    const out = alignCorner([{ x: 0, y: 0 }, { x: 10, y: 0.5 }, { x: 10.2, y: 10 }, { x: 0, y: 10 }], undefined, 1, m);
    expect(cornerAngle(out.pts, undefined, 1, m)).toBeCloseTo(90, 6);
  });
});

describe('alignAll', () => {
  test('a hand-drawn L-shaped house comes out with every corner square', () => {
    const pts = [{ x: 0, y: 0.4 }, { x: 40.3, y: 0 }, { x: 40, y: 15.2 }, { x: 25.4, y: 15 }, { x: 25, y: 30.3 }, { x: 0.2, y: 30 }];
    const out = alignAll(pts, undefined, IDENTITY);
    for (const a of allSquare(out.pts, undefined)) expect(a).toBeCloseTo(90, 6);
  });
  test('a 45° bay keeps its diagonals', () => {
    const pts = [{ x: 0, y: 0.3 }, { x: 30, y: 0 }, { x: 30.2, y: 10 }, { x: 25, y: 15 }, { x: 15, y: 15 }, { x: 10, y: 10.4 }, { x: 0, y: 10 }];
    const out = alignAll(pts, undefined, IDENTITY);
    const angles = allSquare(out.pts, undefined);
    expect(angles[0]).toBeCloseTo(90, 6); expect(angles[1]).toBeCloseTo(90, 6);
    expect(angles[3]).toBeGreaterThan(130); // the bay's diagonal corners stay diagonal
  });
});
