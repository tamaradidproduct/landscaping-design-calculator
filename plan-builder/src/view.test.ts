import { describe, expect, test } from 'vitest';
import { fitPage, panBy, zoomAt, MIN_ZOOM, MAX_ZOOM } from './view';

const stage = { w: 800, h: 1000 };
const page = { w: 612, h: 1008 }; // legal portrait, in PDF points

describe('fitPage', () => {
  test('fits the whole page and centers it', () => {
    const { fitScale, view } = fitPage(stage, page, 16);
    // height-limited: (1000 - 32) / 1008
    expect(fitScale).toBeCloseTo(968 / 1008, 6);
    expect(view.scale).toBe(1);
    expect(view.y).toBeCloseTo(16, 6);
    expect(view.x).toBeCloseTo((800 - 612 * fitScale) / 2, 6);
  });
});

describe('zoomAt', () => {
  test('keeps the point under the fingers fixed', () => {
    const v = { scale: 1, x: 100, y: 50 };
    const p = { x: 300, y: 400 };
    const z = zoomAt(v, 2.5, p);
    // content point under p before == after
    const before = { x: (p.x - v.x) / v.scale, y: (p.y - v.y) / v.scale };
    const after = { x: (p.x - z.x) / z.scale, y: (p.y - z.y) / z.scale };
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    expect(z.scale).toBe(2.5);
  });
  test('clamps to the zoom limits', () => {
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, 0.1, { x: 0, y: 0 }).scale).toBe(MIN_ZOOM);
    expect(zoomAt({ scale: 10, x: 0, y: 0 }, 100, { x: 0, y: 0 }).scale).toBe(MAX_ZOOM);
  });
});

describe('panBy', () => {
  test('moves by the finger delta', () => {
    expect(panBy({ scale: 2, x: 10, y: 20 }, 5, -7)).toEqual({ scale: 2, x: 15, y: 13 });
  });
});
