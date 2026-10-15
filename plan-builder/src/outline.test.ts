import { describe, expect, test } from 'vitest';
import { areaPt2, bulgeToward, constrain45, edgeLengthPt, edgeMid, formatFeet, formatScale, guides, nearestEdge, outlinePath, parseFeet, labelPoint, insidePolygon, outlineSuggestions, rectCorners, cutOrder, moveInSection, sectionPosition, type Outline } from './outline';

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
});

describe('guides', () => {
  const a = { x: 0, y: 0 }, b = { x: 100, y: 0 };
  test('right angle at the previous corner, within 1.5°', () => {
    expect(guides(a, b, { x: 100, y: 80 }, [], 2).rightAngle).toBe(true);
    expect(guides(a, b, { x: 101.5, y: 80 }, [], 2).rightAngle).toBe(true);   // ~1.07°
    expect(guides(a, b, { x: 104, y: 80 }, [], 2).rightAngle).toBe(false);    // ~2.9°
  });
  test('straight continuation of the previous edge', () => {
    expect(guides(a, b, { x: 180, y: 1 }, [], 2).straight).toBe(true);
    expect(guides(a, b, { x: 180, y: 9 }, [], 2).straight).toBe(false);
  });
  test('aligned with another corner horizontally or vertically', () => {
    const g = guides(null, null, { x: 51, y: 300 }, [{ x: 50, y: 10 }, { x: 400, y: 299 }], 2);
    expect(g.alignX).toEqual({ x: 50, y: 10 });
    expect(g.alignY).toEqual({ x: 400, y: 299 });
  });
});

describe('curved edges (bend)', () => {
  test('arc length through 3 points: a half circle', () => {
    const pts = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 5 }];
    expect(edgeLengthPt(pts, 0, [1, 0, 0])).toBeCloseTo(Math.PI, 9);
    expect(edgeLengthPt(pts, 0, [-1, 0, 0])).toBeCloseTo(Math.PI, 9);
  });
  test('a tiny bulge is nearly the chord', () => expect(edgeLengthPt([{ x: 0, y: 0 }, { x: 100, y: 0 }], 0, [0.001])).toBeCloseTo(100, 4));
  test('bending an edge outward adds the circular segment to the area', () => {
    const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    // bottom edge (10,10)→(0,10) bulges down (away from the square) into a half circle of radius 5
    const out = areaPt2(sq, [0, 0, bulgeToward(sq[2], sq[3], { x: 5, y: 15 }), 0]);
    expect(out).toBeCloseTo(100 + Math.PI * 25 / 2, 1);
    const inward = areaPt2(sq, [0, 0, bulgeToward(sq[2], sq[3], { x: 5, y: 5 }), 0]);
    expect(inward).toBeCloseTo(100 - Math.PI * 25 / 2, 1);
  });
  test('bulgeToward measures how far a point sits off the chord, with side', () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
    expect(Math.abs(bulgeToward(a, b, { x: 5, y: 3 }))).toBeCloseTo(3, 9);
    expect(Math.sign(bulgeToward(a, b, { x: 5, y: 3 }))).toBe(-Math.sign(bulgeToward(a, b, { x: 5, y: -3 })));
  });
  test('edge midpoint sits on the arc', () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 0 }, h = bulgeToward(a, b, { x: 5, y: 4 });
    const m = edgeMid([a, b], 0, [h]);
    expect(m.x).toBeCloseTo(5, 9); expect(m.y).toBeCloseTo(4, 9);
  });
  test('nearest edge follows the curve', () => {
    const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const b = [0, 0, bulgeToward(sq[2], sq[3], { x: 5, y: 15 }), 0];
    expect(nearestEdge(sq, { x: 5, y: 14.8 }, 0.5, b)).toBe(2);
    expect(nearestEdge(sq, { x: 5, y: 10 }, 0.5, b)).toBeNull();
  });
  test('sampled outline path includes the arc', () => {
    const p = outlinePath([{ x: 0, y: 0 }, { x: 2, y: 0 }], [1], false);
    expect(p[0].x).toBeCloseTo(0, 9); expect(p[0].y).toBeCloseTo(0, 9);
    expect(p.at(-1)!.x).toBeCloseTo(2, 9);
    expect(Math.max(...p.map(q => Math.abs(q.y)))).toBeCloseTo(1, 2);
  });
});

describe('constrain45 (Shift)', () => {
  const a = { x: 100, y: 100 };
  test('locks to the nearest of 0°, 45°, 90°… keeping the distance along that direction', () => {
    const h = constrain45(a, { x: 200, y: 108 });
    expect(h.point.y).toBeCloseTo(100, 9); expect(h.point.x).toBeCloseTo(200, 9); expect(h.angle).toBe(0);
    const d = constrain45(a, { x: 160, y: 50 }); // up and to the right on screen
    expect(d.point.x - a.x).toBeCloseTo(a.y - d.point.y, 9); expect(d.angle).toBe(45);
    expect(constrain45(a, { x: 160, y: 150 }).angle).toBe(315); // down and to the right
    const v = constrain45(a, { x: 96, y: 20 });
    expect(v.point.x).toBeCloseTo(100, 9); expect(v.angle).toBe(90);
    expect(constrain45(a, { x: 40, y: 103 }).angle).toBe(180);
  });
});

describe('labelPoint / insidePolygon', () => {
  const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  test('label sits at the centre of a convex shape', () => {
    expect(labelPoint(sq)).toEqual({ x: 5, y: 5 });
  });
  test('label stays inside an L-shape even when the centroid falls outside', () => {
    const L = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 10 }, { x: 0, y: 10 }];
    expect(insidePolygon(L, labelPoint(L))).toBe(true);
  });
  test('inside / outside', () => {
    expect(insidePolygon(sq, { x: 3, y: 4 })).toBe(true);
    expect(insidePolygon(sq, { x: 11, y: 4 })).toBe(false);
    expect(insidePolygon(sq, { x: -1, y: -1 })).toBe(false);
  });
});

describe('outlineSuggestions', () => {
  const o = (id: string, kind: Outline['kind'], name: string): Outline => ({ id, kind, name, pts: [], closed: true });
  test('empty plan: suggest the boundary and House; every other preset is a quick pick', () => {
    const s = outlineSuggestions([]);
    expect(s.boundary).toBe(true);
    expect(s.features).toEqual(['House']);
    expect(s.picks).toContain('Driveway');
    expect(s.picks).not.toContain('House');
  });
  test('boundary drawn (or being drawn): no boundary suggestion', () => {
    expect(outlineSuggestions([{ ...o('boundary', 'boundary', 'Plot boundary'), closed: false }]).boundary).toBe(false);
  });
  test('a feature named house (any case or spacing) removes the House suggestion', () => {
    expect(outlineSuggestions([o('f1', 'feature', '  house ')]).features).toEqual([]);
  });
  test('names already used drop out of the quick picks', () => {
    const s = outlineSuggestions([o('f1', 'feature', 'Driveway')]);
    expect(s.picks).not.toContain('Driveway');
    expect(s.picks).toContain('Patio');
  });
});

describe('rectCorners', () => {
  test('opposite corners → four corners square to the axes, starting at the first', () => {
    expect(rectCorners({ x: 10, y: 20 }, { x: 40, y: 5 })).toEqual([{ x: 10, y: 20 }, { x: 40, y: 20 }, { x: 40, y: 5 }, { x: 10, y: 5 }]);
  });
  test('area is width × height', () => expect(areaPt2(rectCorners({ x: 0, y: 0 }, { x: 30, y: 12 }))).toBe(360));
});

describe('sections', () => {
  const o = (id: string, kind: Outline['kind']): Outline => ({ id, kind, name: id, pts: [], closed: true });
  const all = Object.fromEntries([o('s1', 'surface'), o('f1', 'feature'), o('boundary', 'boundary'), o('s2', 'surface'), o('f2', 'feature')].map(x => [x.id, x]));
  const ids = Object.keys(all);
  test('cutting order: boundary, then outlines, then surfaces', () => {
    expect(cutOrder(Object.values(all)).map(x => x.id)).toEqual(['boundary', 'f1', 'f2', 's1', 's2']);
  });
  test('layer order moves only within a section', () => {
    expect(moveInSection(ids, all, 's2', -1)).toEqual(['s2', 'f1', 'boundary', 's1', 'f2']);
    expect(moveInSection(ids, all, 's1', -1)).toBeNull();
    expect(moveInSection(ids, all, 'f2', 1)).toBeNull();
    expect(moveInSection(ids, all, 'boundary', 1)).toBeNull();
  });
  test('position within the section', () => {
    expect(sectionPosition(ids, all, 'f1')).toEqual({ first: true, last: false });
    expect(sectionPosition(['boundary', 'f1', 's1'], all, 'f1')).toEqual({ first: true, last: true });
  });
});
