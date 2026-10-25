import { describe, expect, test } from 'vitest';
import { surfaceAreasPt2 } from './surface-area';
import { visibleShapes } from './overlap';
import { fillOutline } from './plot-fill';
import type { Outline } from './outline';

const P = (x: number, y: number) => ({ x, y });
const rect = (x0: number, y0: number, x1: number, y1: number) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
const boundary: Outline = { id: 'boundary', kind: 'boundary', name: 'Plot boundary', pts: rect(0, 0, 100, 100), closed: true };
const house: Outline = { id: 'f1', kind: 'feature', name: 'House', pts: rect(40, 40, 60, 60), closed: true };
const zone = (id: string, pts: Outline['pts'], material: Outline['material']): Outline => ({ id, kind: 'surface', name: id, pts, closed: true, material });
const areas = (...os: Outline[]) => surfaceAreasPt2(os, visibleShapes(os));

describe('surface areas by visible part', () => {
  test('a fill with nothing on it is the lot', () => {
    expect(areas(boundary, fillOutline(boundary, 'premium-sod')).get('premium-sod')).toBeCloseTo(10000, 3);
  });
  test('the house and a zone on top are cut out of the fill; the zone counts its own area', () => {
    const m = areas(boundary, house, zone('s1', rect(10, 10, 20, 20), 'sand'), fillOutline(boundary, 'premium-sod'));
    expect(m.get('premium-sod')).toBeCloseTo(10000 - 400 - 100, 3); expect(m.get('sand')).toBeCloseTo(100, 3);
  });
  test('a zone half outside the lot counts only its inside half, and takes only that from the fill', () => {
    const m = areas(boundary, zone('s1', rect(-5, 10, 5, 20), 'sand'), fillOutline(boundary, 'premium-sod'));
    expect(m.get('sand')).toBeCloseTo(50, 3); expect(m.get('premium-sod')).toBeCloseTo(9950, 3);
  });
  test('a zone covering everything leaves the fill 0 (and it is still listed)', () => {
    const m = areas(boundary, zone('s1', rect(0, 0, 100, 100), 'sand'), fillOutline(boundary, 'premium-sod'));
    expect(m.get('premium-sod')).toBeCloseTo(0, 3); expect(m.has('premium-sod')).toBe(true);
  });
  test('zones of one material add up', () => {
    const m = areas(boundary, zone('s1', rect(0, 0, 10, 10), 'sand'), zone('s2', rect(20, 20, 30, 30), 'sand'));
    expect(m.get('sand')).toBeCloseTo(200, 3);
  });
  test('a zone higher in the list cuts the one below it', () => {
    const m = areas(boundary, zone('s1', rect(0, 0, 50, 50), 'sand'), zone('s2', rect(25, 25, 75, 75), 'deck-wood'));
    expect(m.get('sand')).toBeCloseTo(2500, 3); expect(m.get('deck-wood')).toBeCloseTo(2500 - 625, 3);
  });
  test('features and the boundary are not surfaces; a zone without a material is ignored', () => {
    const m = areas(boundary, house, { ...zone('s1', rect(0, 0, 10, 10), undefined) });
    expect([...m.keys()]).toEqual([]);
  });
});
