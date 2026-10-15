import { describe, expect, test } from 'vitest';
import { applyCorrection, calibrate, invertCorrection, lineFeet } from './scale';

// A plan stretched unevenly: 0.5 ft per point across, 0.6 ft per point down.
const SX = 0.5, SY = 0.6;
const truth = (line: { x: number; y: number }[]) => {
  let L = 0;
  for (let k = 0; k + 1 < line.length; k++) L += Math.hypot((line[k + 1].x - line[k].x) * SX, (line[k + 1].y - line[k].y) * SY);
  return L;
};
const top = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
const left = [{ x: 0, y: 0 }, { x: 0, y: 50 }];
const diagonal = [{ x: 0, y: 0 }, { x: 30, y: 40 }];
const arc = Array.from({ length: 33 }, (_, k) => ({ x: 20 * Math.cos(k * Math.PI / 64), y: 20 * Math.sin(k * Math.PI / 64) }));

describe('calibrate', () => {
  test('no references: no scale', () => expect(calibrate([])).toBeNull());
  test('one reference: one scale, no correction', () => {
    const c = calibrate([{ line: top, feet: 50 }])!;
    expect(c.ftPerPt).toBeCloseTo(0.5, 9);
    expect(c.correction).toEqual({ a: 1, b: 0, c: 0, d: 1 });
    expect(c.stretched).toBe(false);
  });
  test('across + down recover both scales exactly', () => {
    const c = calibrate([{ line: top, feet: truth(top) }, { line: left, feet: truth(left) }])!;
    expect(c.stretched).toBe(true);
    expect(c.ftPerPt).toBeCloseTo(SX, 9);
    expect(c.correction.d).toBeCloseTo(SY / SX, 9);
    expect(lineFeet(diagonal, c)).toBeCloseTo(truth(diagonal), 6);
  });
  test('slanted and curved references work too', () => {
    const c = calibrate([{ line: diagonal, feet: truth(diagonal) }, { line: arc, feet: truth(arc) }, { line: top, feet: truth(top) }])!;
    expect(c.ftPerPt).toBeCloseTo(SX, 6);
    expect(c.correction.d).toBeCloseTo(SY / SX, 6);
  });
  test('references all running the same way: one best-fit scale, asks for the other direction', () => {
    const c = calibrate([{ line: top, feet: 50 }, { line: [{ x: 0, y: 10 }, { x: 80, y: 12 }], feet: 40.5 }])!;
    expect(c.stretched).toBe(false);
    expect(c.needsOtherDirection).toBe(true);
    expect(c.ftPerPt).toBeGreaterThan(0.49);
    expect(c.ftPerPt).toBeLessThan(0.51);
  });
});

describe('correction', () => {
  test('inverse undoes it', () => {
    const m = { a: 1, b: 0, c: 0, d: 1.2 }, p = { x: 3, y: 7 };
    const back = applyCorrection(invertCorrection(m), applyCorrection(m, p));
    expect(back.x).toBeCloseTo(3, 12); expect(back.y).toBeCloseTo(7, 12);
  });
});
