import { describe, expect, test } from 'vitest';
import { chipPosition, edgeMenuItems, instanceLabel, radiusDisplay } from './card-helpers';

describe('instanceLabel', () => {
  test('1-based position of the selection', () => expect(instanceLabel('b', ['a', 'b', 'c'])).toBe('2 of 3'));
  test('null for a lone instance, no selection, or an unknown id', () => {
    expect(instanceLabel('a', ['a'])).toBeNull();
    expect(instanceLabel(null, ['a', 'b'])).toBeNull();
    expect(instanceLabel('z', ['a', 'b'])).toBeNull();
  });
});

describe('radiusDisplay', () => {
  test('all equal and above 0 shows the value', () => expect(radiusDisplay([2, 2, 2, 2])).toEqual({ value: '2', placeholder: '0′' }));
  test('empty or all zero is blank', () => {
    expect(radiusDisplay([])).toEqual({ value: '', placeholder: '0′' });
    expect(radiusDisplay([0, 0])).toEqual({ value: '', placeholder: '0′' });
  });
  test('differing radii read Mixed', () => {
    expect(radiusDisplay([2, 0, 2, 2])).toEqual({ value: '', placeholder: 'Mixed' });
    expect(radiusDisplay([2, 3])).toEqual({ value: '', placeholder: 'Mixed' });
  });
});

describe('edgeMenuItems', () => {
  test('curved feature edge with a reference', () =>
    expect(edgeMenuItems({ kind: 'feature', curved: true, hasRef: true }).map(i => i.act)).toEqual(['straighten', 'unref']));
  test('straight boundary edge with nothing to offer', () =>
    expect(edgeMenuItems({ kind: 'boundary', curved: false, hasRef: false })).toEqual([]));
  test('surface edges offer swap, never unref', () => {
    expect(edgeMenuItems({ kind: 'surface', curved: true, hasRef: true }).map(i => i.act)).toEqual(['straighten', 'swap']);
    expect(edgeMenuItems({ kind: 'surface', curved: false, hasRef: true }).map(i => i.act)).toEqual(['swap']);
  });
  test('labels', () =>
    expect(edgeMenuItems({ kind: 'surface', curved: true, hasRef: false }).map(i => i.label)).toEqual(['Make straight', 'Swap fixed end']));
});

describe('chipPosition', () => {
  const chip = { w: 120, h: 34 }, stage = { w: 400, h: 300 };
  test('centred below the midpoint', () => expect(chipPosition({ x: 100, y: 50 }, chip, stage, 8, 6)).toEqual({ left: 40, top: 58 }));
  test('flips above near the bottom', () => expect(chipPosition({ x: 100, y: 290 }, chip, stage, 8, 6).top).toBe(290 - 8 - 34));
  test('clamped to the margin on the left and right', () => {
    expect(chipPosition({ x: 10, y: 50 }, chip, stage, 8, 6).left).toBe(6);
    expect(chipPosition({ x: 395, y: 50 }, chip, stage, 8, 6).left).toBeLessThanOrEqual(400 - 120 - 6);
  });
});
