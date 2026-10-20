import { describe, expect, test } from 'vitest';
import { FILL_ID, fillOutline, keepFillLast, syncFill } from './plot-fill';
import type { Outline } from './outline';

const P = (x: number, y: number) => ({ x, y });
const boundary = (over: Partial<Outline> = {}): Outline => ({ id: 'boundary', kind: 'boundary', name: 'Plot boundary', pts: [P(0, 0), P(100, 0), P(100, 100), P(0, 100)], closed: true, bulges: [0, 0, 0, 0], ...over });
const zone = (id: string): Outline => ({ id, kind: 'surface', name: id, pts: [P(10, 10), P(20, 10), P(20, 20)], closed: true, material: 'sand' });
const house: Outline = { id: 'f1', kind: 'feature', name: 'House', pts: [P(40, 40), P(60, 40), P(60, 60)], closed: true };
const map = (...os: Outline[]) => Object.fromEntries(os.map(o => [o.id, o]));

describe('fillOutline', () => {
  test('is a closed Plot fill surface with the boundary\'s shape and the chosen material', () => {
    const b = boundary({ bulges: [0, 5, 0, 0], radii: [0, 0, 3, 0] }), f = fillOutline(b, 'premium-sod');
    expect(f).toMatchObject({ id: FILL_ID, kind: 'surface', name: 'Plot fill', base: true, closed: true, material: 'premium-sod' });
    expect(f.pts).toEqual(b.pts); expect(f.bulges).toEqual([0, 5, 0, 0]); expect(f.radii).toEqual([0, 0, 3, 0]);
  });
  test('shares no arrays with the boundary', () => {
    const b = boundary({ radii: [1, 1, 1, 1] }), f = fillOutline(b, 'premium-sod');
    expect(f.pts).not.toBe(b.pts); expect(f.pts[0]).not.toBe(b.pts[0]); expect(f.bulges).not.toBe(b.bulges); expect(f.radii).not.toBe(b.radii);
  });
});

describe('syncFill', () => {
  test('without a fill the map comes back unchanged', () => {
    const m = map(boundary(), zone('s1')); expect(syncFill(m, false)).toBe(m);
  });
  test('follows a moved corner, a new bend and a corner radius', () => {
    const b = boundary(), m = map(b, fillOutline(b, 'premium-sod'));
    m.boundary = boundary({ pts: [P(0, 0), P(120, 0), P(100, 100), P(0, 100)], bulges: [0, 7, 0, 0], radii: [0, 0, 4, 0] });
    const next = syncFill(m, false);
    expect(next[FILL_ID].pts[1]).toEqual(P(120, 0)); expect(next[FILL_ID].bulges).toEqual([0, 7, 0, 0]); expect(next[FILL_ID].radii).toEqual([0, 0, 4, 0]);
    expect(next[FILL_ID].material).toBe('premium-sod'); // only the shape follows
  });
  test('a boundary without bulges or radii clears the fill\'s', () => {
    const b = boundary({ radii: [1, 1, 1, 1] }), m = map(b, fillOutline(b, 'sand'));
    m.boundary = boundary({ bulges: undefined, radii: undefined });
    const next = syncFill(m, false);
    expect(next[FILL_ID].bulges).toBeUndefined(); expect(next[FILL_ID].radii).toBeUndefined();
  });
  test('while the boundary is being redrawn the fill keeps its last shape', () => {
    const b = boundary(), m = map(b, fillOutline(b, 'sand'));
    m.boundary = boundary({ pts: [P(5, 5)], closed: false });
    expect(syncFill(m, true)[FILL_ID].pts).toEqual(b.pts);
    expect(syncFill(m, false)[FILL_ID].pts).toEqual(b.pts); // an unclosed boundary is the same
  });
  test('with no boundary the fill is removed', () => {
    const m = map(fillOutline(boundary(), 'sand'), zone('s1'));
    expect(Object.keys(syncFill(m, false))).toEqual(['s1']);
  });
  test('the fill ends up last, the other keys keeping their order', () => {
    const b = boundary(), m = map(b, house, fillOutline(b, 'sand'), zone('s1'), zone('s2'));
    expect(Object.keys(syncFill(m, false))).toEqual(['boundary', 'f1', 's1', 's2', FILL_ID]);
  });
  test('a fill already in step with the boundary (and last) comes back as the same map', () => {
    const b = boundary({ bulges: [0, 3, 0, 0], radii: [1, 1, 1, 1] }), m = map(b, zone('s1'), fillOutline(b, 'sand'));
    expect(syncFill(m, false)).toBe(m);
  });
  test('does not change its input', () => {
    const b = boundary(), m = map(b, fillOutline(b, 'sand')); m.boundary = boundary({ pts: [P(0, 0), P(9, 0), P(9, 9)] });
    const before = JSON.stringify(m); syncFill(m, false); expect(JSON.stringify(m)).toBe(before);
  });
});

describe('keepFillLast', () => {
  test('moves the fill to the end after a surface was added', () => {
    const b = boundary(), m = map(b, fillOutline(b, 'sand'), zone('s1'));
    expect(Object.keys(keepFillLast(m))).toEqual(['boundary', 's1', FILL_ID]);
  });
  test('no fill: unchanged', () => { const m = map(boundary(), zone('s1')); expect(keepFillLast(m)).toBe(m); });
});
