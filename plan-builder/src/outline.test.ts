import { describe, expect, test } from 'vitest';
import { areaPt2, edgeLengthPt, formatFeet, formatScale, nearestEdge, parseFeet, percentOff } from './outline';

describe('parseFeet', () => {
  test.each([
    ['116.45', 116.45],
    [' 116.45 ft', 116.45],
    ["116.45'", 116.45],
    ['116’', 116],
    [`116' 6"`, 116.5],
    [`116'6"`, 116.5],
    ['116 ft 6 in', 116.5],
    ['6"', 0.5],
  ])('%s → %d ft', (input, ft) => expect(parseFeet(input)).toBeCloseTo(ft, 9));
  test.each(['', 'abc', '0', '-3', "5' 13\""])('rejects %s', input => expect(parseFeet(input)).toBeNull());
});

describe('geometry', () => {
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  test('area of a closed outline in square points', () => expect(areaPt2(square)).toBe(100));
  test('area ignores winding direction', () => expect(areaPt2([...square].reverse())).toBe(100));
  test('edge i runs from point i to i+1, wrapping', () => {
    expect(edgeLengthPt(square, 0)).toBe(10);
    expect(edgeLengthPt([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 4 }], 2)).toBe(4);
  });
  test('nearest edge within tolerance', () => {
    expect(nearestEdge(square, { x: 5, y: 1 }, 2)).toBe(0);
    expect(nearestEdge(square, { x: 9.5, y: 5 }, 2)).toBe(1);
    expect(nearestEdge(square, { x: 5, y: 5 }, 2)).toBeNull();
  });
});

describe('formatting', () => {
  test('feet with two decimals', () => expect(formatFeet(138.314)).toBe("138.31′"));
  test('scale as feet per paper inch', () => expect(formatScale(116.45 / 207.8)).toBe('1 in on paper = 40.3 ft'));
  test('percent difference vs printed value', () => {
    expect(percentOff(13490, 13504)).toBeCloseTo(-0.1037, 3);
  });
});
