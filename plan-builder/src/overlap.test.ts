import { describe, expect, test } from 'vitest';
import { containers, insideShape, shapeArea, shapeLabelPoint, visibleShapes } from './overlap';
import { rectCorners, type Outline } from './outline';

const rect = (id: string, kind: Outline['kind'], x0: number, y0: number, x1: number, y1: number): Outline =>
  ({ id, kind, name: id, pts: rectCorners({ x: x0, y: y0 }, { x: x1, y: y1 }), closed: true });

describe('visibleShapes', () => {
  // The screenshot: a porch rectangle drawn after the house runs into it.
  const house = rect('house', 'feature', 0, 0, 100, 60), porch = rect('porch', 'feature', 80, 40, 140, 80);
  test('a feature higher in Layers cuts the ones below', () => {
    const v = visibleShapes([house, porch]);
    expect(shapeArea(v.get('house')!)).toBeCloseTo(100 * 60, 6);           // the house is whole
    expect(shapeArea(v.get('porch')!)).toBeCloseTo(60 * 40 - 20 * 20, 6);   // the porch loses the 20×20 under the house
    expect(insideShape(v.get('porch')!, { x: 90, y: 50 })).toBe(false);
    expect(insideShape(v.get('porch')!, { x: 120, y: 70 })).toBe(true);
  });
  test('reordering flips which one is cut', () => {
    const v = visibleShapes([porch, house]);
    expect(shapeArea(v.get('porch')!)).toBeCloseTo(60 * 40, 6);
    expect(shapeArea(v.get('house')!)).toBeCloseTo(100 * 60 - 20 * 20, 6);
  });
  test('the plot boundary clips every feature, and is never cut itself', () => {
    const lot = rect('boundary', 'boundary', 0, 0, 120, 100);
    const v = visibleShapes([lot, house, porch]);
    expect(v.has('boundary')).toBe(false);
    expect(shapeArea(v.get('porch')!)).toBeCloseTo(40 * 40 - 20 * 20, 6); // also cut at x = 120
  });
  test('a feature entirely under another has nothing visible', () => {
    const v = visibleShapes([house, rect('shed', 'feature', 10, 10, 20, 20)]);
    expect(shapeArea(v.get('shed')!)).toBe(0);
  });
  test('open outlines (still being drawn) take no part', () => {
    const v = visibleShapes([{ ...house, closed: false }, porch]);
    expect(v.has('house')).toBe(false);
    expect(shapeArea(v.get('porch')!)).toBeCloseTo(60 * 40, 6);
  });
  test('the label sits inside the biggest visible piece', () => {
    const v = visibleShapes([rect('wall', 'feature', 45, -10, 55, 70), rect('deck', 'feature', 0, 0, 100, 60)]);
    const p = shapeLabelPoint(v.get('deck')!)!;
    expect(insideShape(v.get('deck')!, p)).toBe(true);
  });
});

describe('containers', () => {
  const house = rect('house', 'feature', 0, 0, 100, 60), lot = rect('boundary', 'boundary', -50, -50, 200, 200);
  test('a porch drawn wholly inside the house is contained by it (never by the boundary)', () => {
    expect(containers(rect('porch', 'feature', 10, 10, 30, 30), [lot, house])).toEqual(['house']);
  });
  test('a porch running out of the house is not', () => {
    expect(containers(rect('porch', 'feature', 80, 40, 140, 80), [lot, house])).toEqual([]);
  });
});
