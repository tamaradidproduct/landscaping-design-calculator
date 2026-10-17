import { describe, expect, test } from 'vitest';
import { edgeMid } from './outline';
import { IDENTITY, type Correction } from './scale';
import { cornerAngle } from './square';
import { boxSize, resizeBox, stretchEdge, trueEdgeLength } from './stretch';

const P = (x: number, y: number) => ({ x, y });
const close = (a: { x: number; y: number }, b: { x: number; y: number }, d = 9) => {
  expect(a.x).toBeCloseTo(b.x, d); expect(a.y).toBeCloseTo(b.y, d);
};
const patio = [P(0, 0), P(12, 0), P(12, 20), P(0, 20)];

describe('stretchEdge', () => {
  test('a 12 × 20 rectangle typed to 16 keeps the first corner', () => {
    const r = stretchEdge(patio, undefined, 0, 0, 16, IDENTITY);
    [P(0, 0), P(16, 0), P(16, 20), P(0, 20)].forEach((p, k) => close(r.pts[k], p));
  });
  test('…or the other corner, growing the other way', () => {
    const r = stretchEdge(patio, undefined, 0, 1, 16, IDENTITY);
    [P(-4, 0), P(12, 0), P(12, 20), P(-4, 20)].forEach((p, k) => close(r.pts[k], p));
  });
  test('a rectangle stays square', () => {
    const r = stretchEdge(patio, undefined, 0, 0, 16, IDENTITY);
    for (let i = 0; i < 4; i++) expect(cornerAngle(r.pts, r.bulges, i, IDENTITY)).toBeCloseTo(90, 9);
  });
  test('on a stretched plan the typed length is the true length', () => {
    const m: Correction = { a: 1, b: 0, c: 0, d: 1.1 };
    const r = stretchEdge(patio, undefined, 1, 0, 22, m); // edge 1 runs down: 20 page pt = 22 true
    expect(trueEdgeLength(r.pts, r.bulges, 1, m)).toBeCloseTo(22, 9);
    const plain = stretchEdge(patio, undefined, 1, 0, 22, IDENTITY);
    expect(r.pts[2].y).not.toBeCloseTo(plain.pts[2].y, 3);
  });
  test('a curved edge reaches the typed arc length; other bends follow their stretched middles', () => {
    const bulges = [3, 0, -2, 0];
    const r = stretchEdge(patio, bulges, 0, 0, 20, IDENTITY);
    expect(trueEdgeLength(r.pts, r.bulges, 0, IDENTITY)).toBeCloseTo(20, 6);
    const k = r.pts[1].x / 12, mid = edgeMid(patio, 2, bulges);
    close(edgeMid(r.pts, 2, r.bulges), P(mid.x * k, mid.y), 6);
    expect(r.bulges![1]).toBe(0);
  });
  test('a very large curved edge still converges', () => {
    const bulges = [3, 0, -2, 0];
    const r = stretchEdge(patio, bulges, 0, 0, 24000, IDENTITY);
    expect(trueEdgeLength(r.pts, r.bulges, 0, IDENTITY)).toBeCloseTo(24000, 3);
  });
  test('a slanted edge: the fixed corner stays, the rest move along the edge away from it or toward it', () => {
    const shape = [P(0, 0), P(30, 40), P(10, 60), P(-20, 20)];
    const r = stretchEdge(shape, undefined, 0, 0, 100, IDENTITY); // edge 0 is 50 long → doubles along (0.6, 0.8)
    close(r.pts[0], P(0, 0));
    expect(trueEdgeLength(r.pts, r.bulges, 0, IDENTITY)).toBeCloseTo(100, 9);
    const along = (p: { x: number; y: number }) => p.x * 0.6 + p.y * 0.8;
    shape.forEach((p, k) => expect(along(r.pts[k])).toBeCloseTo(2 * along(p), 9));
    shape.forEach((p, k) => expect(-0.8 * r.pts[k].x + 0.6 * r.pts[k].y).toBeCloseTo(-0.8 * p.x + 0.6 * p.y, 9));
  });
  test('a zero-length edge is left alone (no NaN)', () => {
    const pts = [P(0, 0), P(0, 0), P(10, 10)];
    const r = stretchEdge(pts, undefined, 0, 0, 5, IDENTITY);
    expect(r.pts).toEqual(pts);
  });
});

describe('boxSize and resizeBox', () => {
  const lShape = [P(0, 0), P(20, 0), P(20, 8), P(8, 8), P(8, 30), P(0, 30)];
  test('boxSize reports the axis-aligned extent and center in true shape', () => {
    const b = boxSize(lShape, undefined, IDENTITY);
    expect([b.w, b.h, b.cx, b.cy]).toEqual([20, 30, 10, 15]);
    const m: Correction = { a: 1, b: 0, c: 0, d: 1.1 };
    expect(boxSize(patio, undefined, m).h).toBeCloseTo(22, 9);
  });
  test('boxSize includes the bulge of a curved edge', () => {
    expect(boxSize(patio, [-3, 0, 0, 0], IDENTITY).h).toBeGreaterThan(20);
    expect(boxSize(patio, [3, 0, 0, 0], IDENTITY).h).toBeCloseTo(20, 9); // bent inward: the box is unchanged
  });
  test('Width scales about the center and leaves Depth alone', () => {
    const r = resizeBox(patio, undefined, 'w', 16, false, IDENTITY);
    [P(-2, 0), P(14, 0), P(14, 20), P(-2, 20)].forEach((p, k) => close(r.pts[k], p));
  });
  test('Depth scales about the center and leaves Width alone', () => {
    const r = resizeBox(patio, undefined, 'h', 10, false, IDENTITY);
    [P(0, 5), P(12, 5), P(12, 15), P(0, 15)].forEach((p, k) => close(r.pts[k], p));
  });
  test('locked: typing Width scales both axes by the same factor, center fixed', () => {
    const r = resizeBox(patio, undefined, 'w', 24, true, IDENTITY);
    const b = boxSize(r.pts, r.bulges, IDENTITY);
    expect([b.w, b.h, b.cx, b.cy]).toEqual([24, 40, 6, 10]);
  });
  test('locked: typing Depth scales Width in proportion', () => {
    const r = resizeBox(lShape, undefined, 'h', 15, true, IDENTITY), b = boxSize(r.pts, r.bulges, IDENTITY);
    expect(b.w).toBeCloseTo(10, 9); expect(b.h).toBeCloseTo(15, 9);
  });
  test('an L-shape reaches the typed box and keeps its center', () => {
    const r = resizeBox(lShape, undefined, 'w', 30, false, IDENTITY), b = boxSize(r.pts, r.bulges, IDENTITY);
    expect([b.w, b.h, b.cx, b.cy]).toEqual([30, 30, 10, 15]);
  });
  test('a curved edge: the typed size is the box including the bulge', () => {
    const bulges = [3, 0, -2, 0];
    const r = resizeBox(patio, bulges, 'h', 30, false, IDENTITY);
    expect(boxSize(r.pts, r.bulges, IDENTITY).h).toBeCloseTo(30, 6);
  });
  test('under a stretched plan the typed size is the true size', () => {
    const m: Correction = { a: 1, b: 0, c: 0, d: 1.1 };
    const r = resizeBox(patio, undefined, 'h', 22, false, m);
    expect(boxSize(r.pts, r.bulges, m).h).toBeCloseTo(22, 9);
    close(r.pts[0], P(0, 0));
  });
  test('a collapsed box is left as it is', () => {
    const flat = [P(0, 0), P(10, 0), P(5, 0)];
    expect(resizeBox(flat, undefined, 'h', 5, false, IDENTITY).pts).toEqual(flat);
  });
});
