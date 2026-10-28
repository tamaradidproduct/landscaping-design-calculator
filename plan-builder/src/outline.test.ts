import { describe, expect, test } from 'vitest';
import { areaPt2, avgPoint, bulgeToward, closesOnRepeatTap, constrain45, edgeLengthPt, edgeMid, formatFeet, formatScale, guides, insertCorner, removeCorner, nearestEdge, offHandle, outlinePath, parseFeet, labelPoint, insidePolygon, outlineSuggestions, rectCorners, parseRadius, cutOrder, nearestOnRing, edgeTapOrder, snapSources, moveInSection, moveInSectionTo, sectionPosition, splitEdge, stepTexScale, isAssigned, omittedInPreview, type Outline } from './outline';
import { edgeAt } from './fillet';
import { MARK } from './overlay-tokens';

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

describe('splitEdge / insertCorner (inserting a new corner on an edge)', () => {
  test('a straight edge splits into two straight edges at the lerp point', () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
    const { point, h1, h2 } = splitEdge(a, b, 0, 0.3);
    expect(point).toEqual({ x: 3, y: 0 }); expect(h1).toBe(0); expect(h2).toBe(0);
  });
  test('a bent edge splits into two arcs that together trace the original curve, with no kink at the split', () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 0 }, h = bulgeToward(a, b, { x: 5, y: 4 }), t = 0.35;
    const { point, h1, h2 } = splitEdge(a, b, h, t);
    // Every point of the first sub-edge (reparametrised 0..1) matches the corresponding point of the original arc up to t…
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
      const onOriginal = edgeAt(a, b, h, t * s), onSub = edgeAt(a, point, h1, s);
      expect(onSub.x).toBeCloseTo(onOriginal.x, 9); expect(onSub.y).toBeCloseTo(onOriginal.y, 9);
    }
    // …and the second sub-edge matches the rest of it, so the join at `point` shows no kink.
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
      const onOriginal = edgeAt(a, b, h, t + (1 - t) * s), onSub = edgeAt(point, b, h2, s);
      expect(onSub.x).toBeCloseTo(onOriginal.x, 9); expect(onSub.y).toBeCloseTo(onOriginal.y, 9);
    }
  });
  test('insertCorner splits a closed outline\'s edge, dropping its own bulge in two and shifting later edges along', () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    const { pts, bulges } = insertCorner(square, [0, 0, 5, 0], 0, 0.5); // edge 0 (straight) splits; edge 2 is bent
    expect(pts).toEqual([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
    expect(bulges).toEqual([0, 0, 0, 5, 0]); // edge 2's bulge is now at index 3
  });
  test('insertCorner works the same on an open run (a line): the edge never wraps', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const { pts: np, bulges } = insertCorner(pts, undefined, 1, 0.5);
    expect(np).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 10, y: 10 }]);
    expect(bulges).toBeUndefined();
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
  test('moveInSectionTo places a layer before another in its section, or at the end', () => {
    const three = ['boundary', 'f1', 'f2', 'f3'];
    const set = Object.fromEntries([o('boundary', 'boundary'), o('f1', 'feature'), o('f2', 'feature'), o('f3', 'feature')].map(x => [x.id, x]));
    expect(moveInSectionTo(three, set, 'f3', 'f1')).toEqual(['boundary', 'f3', 'f1', 'f2']);
    expect(moveInSectionTo(three, set, 'f1', null)).toEqual(['boundary', 'f2', 'f3', 'f1']);
    expect(moveInSectionTo(three, set, 'boundary', 'f1')).toBeNull();
    expect(moveInSectionTo(ids, all, 'f1', 's2')).toBeNull();
    expect(moveInSectionTo(three, set, 'f2', 'f3')).toBeNull();
    expect(moveInSectionTo(three, set, 'f3', null)).toBeNull();
  });
});

describe('nearestOnRing', () => {
  const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  test('the closest point on any edge, including the closing one', () => {
    expect(nearestOnRing(sq, { x: 4, y: 2 })).toEqual({ point: { x: 4, y: 0 }, d: 2 });
    expect(nearestOnRing(sq, { x: -3, y: 6 })).toEqual({ point: { x: 0, y: 6 }, d: 3 });
  });
  test('past an end, the corner', () => expect(nearestOnRing(sq, { x: 13, y: -4 })).toEqual({ point: { x: 10, y: 0 }, d: 5 }));
});

describe('review fixes', () => {
  const o = (id: string, kind: Outline['kind']): Outline => ({ id, kind, name: id, pts: [], closed: true });
  const all = [o('boundary', 'boundary'), o('s1', 'surface'), o('f1', 'feature'), o('s2', 'surface')];
  test('edge taps: the selected layer, then outlines, then surfaces from the top, then the boundary', () => {
    expect(edgeTapOrder(all, 's2').map(x => x.id)).toEqual(['s2', 'f1', 's1', 'boundary']);
    expect(edgeTapOrder(all, null).map(x => x.id)).toEqual(['f1', 's1', 's2', 'boundary']);
  });
  test('tracing the boundary or a feature never snaps to designed surfaces; a surface snaps to everything', () => {
    expect(snapSources(all, 'feature').map(x => x.id)).toEqual(['boundary', 'f1']);
    expect(snapSources(all, 'boundary').map(x => x.id)).toEqual(['boundary', 'f1']);
    expect(snapSources(all, 'surface').map(x => x.id)).toEqual(['boundary', 's1', 'f1', 's2']);
    expect(snapSources(all, null).map(x => x.id)).toEqual(['boundary', 's1', 'f1', 's2']);
  });
});

describe('parseRadius', () => {
  test.each([['', 0], ['0', 0], ["0'", 0], ['2', 2], ["2' 6\"", 2.5]])('%s → %d ft', (v, ft) => expect(parseRadius(v)).toBe(ft));
  test('rejects nonsense', () => expect(parseRadius('abc')).toBeNull());
});

describe('closesOnRepeatTap (double-tap closing, #22/#24)', () => {
  test('not a repeat tap: never closes, however many points', () => {
    expect(closesOnRepeatTap(5, false, false)).toEqual({ close: false, popLast: false });
    expect(closesOnRepeatTap(5, false, true)).toEqual({ close: false, popLast: false });
  });
  test('a repeat tap on a point the first tap only placed to signal it: closes and drops that point', () => {
    // 4 points include the spurious one from tap 1 of the pair; 3 real corners remain once it's dropped.
    expect(closesOnRepeatTap(4, true, true)).toEqual({ close: true, popLast: true });
  });
  test('too few real corners once the spurious point is dropped: does not close', () => {
    // Only 3 points total — 2 real corners once the spurious one is dropped — can't make a closed shape.
    expect(closesOnRepeatTap(3, true, true)).toEqual({ close: false, popLast: false });
  });
  test('a repeat tap directly on an already-placed corner (nothing spurious to drop): closes as-is', () => {
    expect(closesOnRepeatTap(3, true, false)).toEqual({ close: true, popLast: false });
  });
  test('fewer than 3 points and nothing spurious: does not close', () => {
    expect(closesOnRepeatTap(2, true, false)).toEqual({ close: false, popLast: false });
  });
});

describe('stepTexScale', () => {
  test('one press multiplies or divides by 1.25', () => {
    expect(stepTexScale(1, 1)).toBe(1.25);
    expect(stepTexScale(1.25, -1)).toBe(1);
  });
  test('stays within 0.25–4', () => {
    expect(stepTexScale(4, 1)).toBe(4);
    expect(stepTexScale(3.5, 1)).toBe(4);
    expect(stepTexScale(0.25, -1)).toBe(0.25);
  });
  test('does not drift over repeated presses', () => {
    let s = 1; for (let i = 0; i < 5; i++) s = stepTexScale(s, 1); for (let i = 0; i < 5; i++) s = stepTexScale(s, -1);
    expect(s).toBe(1);
  });
});

describe('avgPoint', () => {
  test('returns origin for empty points', () => {
    expect(avgPoint([])).toEqual({ x: 0, y: 0 });
  });

  test('single point returns that point', () => {
    expect(avgPoint([{ x: 12, y: 34 }])).toEqual({ x: 12, y: 34 });
  });

  test('average of multiple points computes centroid', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(avgPoint(pts)).toEqual({ x: 5, y: 5 });
  });

  test('average of a triangle', () => {
    const triangle = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 9 }];
    expect(avgPoint(triangle)).toEqual({ x: 2, y: 3 });
  });
});

describe('offHandle', () => {
  test('offsets outward away from the reference point for a horizontal edge', () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 0 }, mid = { x: 5, y: 0 };
    // Reference point below the edge (y = -10): offset pushes handle upward (+y) away from ref
    const posAbove = offHandle(a, b, mid, { x: 5, y: -10 }, 20);
    expect(posAbove.x).toBeCloseTo(5);
    expect(posAbove.y).toBeCloseTo(20);

    // Reference point above the edge (y = 10): offset pushes handle downward (-y) away from ref
    const posBelow = offHandle(a, b, mid, { x: 5, y: 10 }, 20);
    expect(posBelow.x).toBeCloseTo(5);
    expect(posBelow.y).toBeCloseTo(-20);
  });

  test('offsets outward away from reference point for a vertical edge', () => {
    const a = { x: 0, y: 0 }, b = { x: 0, y: 10 }, mid = { x: 0, y: 5 };
    // Reference point to the right (x = 10): offset pushes handle leftward (-x) away from ref
    const posLeft = offHandle(a, b, mid, { x: 10, y: 5 }, 15);
    expect(posLeft.x).toBeCloseTo(-15);
    expect(posLeft.y).toBeCloseTo(5);

    // Reference point to the left (x = -10): offset pushes handle rightward (+x) away from ref
    const posRight = offHandle(a, b, mid, { x: -10, y: 5 }, 15);
    expect(posRight.x).toBeCloseTo(15);
    expect(posRight.y).toBeCloseTo(5);
  });

  test('uses MARK.insertOffset by default', () => {
    const a = { x: 0, y: 0 }, b = { x: 10, y: 0 }, mid = { x: 5, y: 0 };
    const pos = offHandle(a, b, mid, { x: 5, y: -10 });
    expect(pos.x).toBeCloseTo(5);
    expect(pos.y).toBeCloseTo(MARK.insertOffset);
  });

  test('handles zero-length edge without NaN', () => {
    const a = { x: 5, y: 5 }, b = { x: 5, y: 5 }, mid = { x: 5, y: 5 };
    const pos = offHandle(a, b, mid, { x: 0, y: 0 });
    expect(Number.isNaN(pos.x)).toBe(false);
    expect(Number.isNaN(pos.y)).toBe(false);
  });
});

describe('the plot fill in layer order', () => {
  const fill: Outline = { id: 'fill', kind: 'surface', name: 'Plot fill', pts: [], closed: true, base: true };
  const o = (id: string, kind: Outline['kind']): Outline => ({ id, kind, name: id, pts: [], closed: true });
  const all = Object.fromEntries([o('boundary', 'boundary'), o('s1', 'surface'), o('s2', 'surface'), fill].map(x => [x.id, x]));
  const ids = ['boundary', 's1', 's2', 'fill'];
  test('the fill cannot be moved, and no zone can be swapped with it', () => {
    expect(moveInSection(ids, all, 'fill', -1)).toBeNull(); expect(moveInSection(ids, all, 'fill', 1)).toBeNull();
    expect(moveInSection(ids, all, 's2', 1)).toBeNull();
    expect(moveInSection(ids, all, 's2', -1)).toEqual(['boundary', 's2', 's1', 'fill']);
  });
  test('positions ignore the fill: the zone above it is last; the fill itself is first and last', () => {
    expect(sectionPosition(ids, all, 's2')).toEqual({ first: false, last: true });
    expect(sectionPosition(ids, all, 's1')).toEqual({ first: true, last: false });
    expect(sectionPosition(ids, all, 'fill')).toEqual({ first: true, last: true });
  });
});

describe('isAssigned', () => {
  const o = (kind: Outline['kind'], material?: string): Outline => ({ id: 'x', kind, name: 'x', pts: [], closed: true, ...(material ? { material } : {}) });
  test('a surface needs a known material', () => {
    expect(isAssigned(o('surface', 'sand'))).toBe(true);
    expect(isAssigned(o('surface'))).toBe(false);
    expect(isAssigned(o('surface', 'no-such-material'))).toBe(false);
  });
  test('features and the boundary are always assigned', () => { expect(isAssigned(o('feature'))).toBe(true); expect(isAssigned(o('boundary'))).toBe(true); });
});

describe('omittedInPreview', () => {
  const s: Outline = { id: 's', kind: 'surface', name: 's', pts: [], closed: true };
  test('an unassigned surface is omitted in Preview only', () => {
    expect(omittedInPreview(s, true)).toBe(true); expect(omittedInPreview(s, false)).toBe(false);
    expect(omittedInPreview({ ...s, material: 'sand' }, true)).toBe(false);
    expect(omittedInPreview({ ...s, kind: 'feature' }, true)).toBe(false);
  });
});

describe('removeCorner (#64)', () => {
  const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  test('drops the point; its two edges become one straight edge', () => {
    const r = removeCorner(sq, [0.1, 0.2, 0.3, 0.4], 1);
    expect(r.pts).toEqual([sq[0], sq[2], sq[3]]);
    expect(r.bulges).toEqual([0, 0.3, 0.4]);
  });
  test('removing the last point wraps: the edge from the one before to the first is straight', () => {
    const r = removeCorner(sq, [0.1, 0.2, 0.3, 0.4], 3);
    expect(r.pts).toEqual([sq[0], sq[1], sq[2]]);
    expect(r.bulges).toEqual([0.1, 0.2, 0]);
  });
  test('removing the first point keeps the edge before it straight', () => {
    const r = removeCorner(sq, [0.1, 0.2, 0.3, 0.4], 0);
    expect(r.pts).toEqual([sq[1], sq[2], sq[3]]);
    expect(r.bulges).toEqual([0.2, 0.3, 0]);
  });
  test('leaves undefined bulges undefined', () => {
    expect(removeCorner(sq, undefined, 2).bulges).toBeUndefined();
  });
  test.each([0, 1, 2])('leaves an outline with %i points unchanged', n => {
    const pts = sq.slice(0, n);
    const bulges = [0.1, 0.2].slice(0, n);
    expect(removeCorner(pts, bulges, 0)).toEqual({ pts, bulges });
  });
  test('is the inverse of insertCorner for straight edges', () => {
    const ins = insertCorner(sq, undefined, 1, 0.5);
    expect(removeCorner(ins.pts, ins.bulges, 2).pts).toEqual(sq);
  });
});
