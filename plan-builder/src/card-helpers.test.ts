import { describe, expect, test } from 'vitest';
import { chipPosition, chipPositionAvoiding, nudgePadVisible, edgeMenuItems, instanceLabel, radiusDisplay, roundAllRequest } from './card-helpers';

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

describe('roundAllRequest', () => {
  test('a blank field (mixed radii) applies nothing; 0 squares; a value rounds', () => {
    expect(roundAllRequest('')).toBeNull(); expect(roundAllRequest('  ')).toBeNull();
    expect(roundAllRequest('0')).toBe(0); expect(roundAllRequest("2'")).toBe(2);
  });
});

describe('nudgePadVisible', () => {
  test('shown only for something nudgeable on a touch (coarse) pointer', () => expect(nudgePadVisible(true, true)).toBe(true));
  test('never on a fine pointer', () => expect(nudgePadVisible(true, false)).toBe(false));
  test('hidden when nothing is nudgeable', () => {
    expect(nudgePadVisible(false, true)).toBe(false);
    expect(nudgePadVisible(false, false)).toBe(false);
  });
});

describe('chipPositionAvoiding', () => {
  const chip = { w: 120, h: 34 }, stage = { w: 400, h: 300 };
  const hits = (p: { left: number; top: number }, z: { left: number; top: number; right: number; bottom: number }) =>
    p.left < z.right && p.left + chip.w > z.left && p.top < z.bottom && p.top + chip.h > z.top;
  test('no zone: same as chipPosition', () =>
    expect(chipPositionAvoiding({ x: 100, y: 50 }, chip, stage, 8, 6, null)).toEqual(chipPosition({ x: 100, y: 50 }, chip, stage, 8, 6)));
  test('flips to the other side of the edge when the zone sits under the chip', () => {
    const z = { left: 60, top: 55, right: 200, bottom: 100 };
    const p = chipPositionAvoiding({ x: 100, y: 120 }, chip, stage, 8, 6, z);
    expect(hits(p, z)).toBe(false);
  });
  test('shifts sideways when both sides are covered, staying inside the stage', () => {
    const z = { left: 40, top: 0, right: 160, bottom: 300 };
    const p = chipPositionAvoiding({ x: 100, y: 150 }, chip, stage, 8, 6, z);
    expect(hits(p, z)).toBe(false);
    expect(p.left).toBeGreaterThanOrEqual(6); expect(p.left + chip.w).toBeLessThanOrEqual(394);
  });
});
