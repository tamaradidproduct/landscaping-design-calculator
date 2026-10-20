import { describe, expect, test } from 'vitest';
import { LineLayer, lineLengthFt, lineLengthPt, linePathPt, lineWidthPt } from './line-layer';
import { UNSCALED_FT_PT } from './symbol-layer';

const P = (x: number, y: number) => ({ x, y });
const always = () => true;

describe('LineLayer', () => {
  test('add numbers lines l1, l2 … one past the highest', () => {
    const L = new LineLayer();
    expect(L.add('wood-privacy-fence', [P(0, 0), P(10, 0)], 0.33)).toBe('l1');
    expect(L.add('dry-river', [P(0, 5), P(10, 5)], 4)).toBe('l2');
    L.remove('l1');
    expect(L.add('dry-river', [P(0, 9), P(10, 9)], 4)).toBe('l3');
  });
  test('add drops repeated points; fewer than two distinct points stores nothing', () => {
    const L = new LineLayer();
    expect(L.add('dry-river', [P(3, 3), P(3, 3), P(3, 3)], 4)).toBeNull();
    expect(L.add('dry-river', [P(3, 3)], 4)).toBeNull();
    expect(Object.keys(L.placed)).toEqual([]);
    const id = L.add('dry-river', [P(0, 0), P(0, 0), P(8, 0)], 4)!;
    expect(L.placed[id].points).toEqual([P(0, 0), P(8, 0)]);
  });
  test('width is clamped to 0.25–12 on add and on setWidth, and kept as given inside that range', () => {
    const L = new LineLayer();
    const id = L.add('wood-privacy-fence', [P(0, 0), P(9, 0)], 0.1)!;
    expect(L.placed[id].widthFt).toBe(0.25);
    L.setWidth(id, 40); expect(L.placed[id].widthFt).toBe(12);
    L.setWidth(id, 1.13); expect(L.placed[id].widthFt).toBe(1.13);
    expect(L.placed[L.add('wood-privacy-fence', [P(0, 1), P(9, 1)], 0.33)!].widthFt).toBe(0.33); // the fence's default is stored as drawn
    expect(L.placed[L.add('dry-river', [P(0, 2), P(9, 2)], 0.55)!].widthFt).toBe(0.55);
  });
  test('movePoint moves one point', () => {
    const L = new LineLayer(); const id = L.add('wood-privacy-fence', [P(0, 0), P(9, 0), P(9, 9)], 1)!;
    L.movePoint(id, 1, P(12, 3)); expect(L.placed[id].points[1]).toEqual(P(12, 3));
  });
  test('move shifts every point and keeps the bends, width and item', () => {
    const L = new LineLayer(); const id = L.add('dry-river', [P(0, 0), P(10, 0), P(10, 10)], 3)!; L.setBulge(id, 0, 2);
    L.move(id, 5, -4);
    expect(L.placed[id].points).toEqual([P(5, -4), P(15, -4), P(15, 6)]); expect(L.placed[id].bulges).toEqual([2, 0]); expect(L.placed[id].widthFt).toBe(3); expect(L.placed[id].item).toBe('dry-river');
    L.move('l99', 1, 1); // unknown id: nothing happens
  });
  test('moveFrom puts every point at its starting place plus the offset (a drag, however many moves)', () => {
    const L = new LineLayer(); const id = L.add('dry-river', [P(0, 0), P(10, 0)], 3)!;
    const start = L.placed[id].points.map(p => ({ ...p }));
    L.moveFrom(id, start, 4, 4); L.moveFrom(id, start, 7, 1);
    expect(L.placed[id].points).toEqual([P(7, 1), P(17, 1)]);
  });
  test('removePoint refuses at two points, and keeps bulges one per segment', () => {
    const L = new LineLayer(); const id = L.add('wood-privacy-fence', [P(0, 0), P(10, 0), P(10, 10), P(20, 10)], 1)!;
    L.setBulge(id, 0, 2); L.setBulge(id, 2, -3);
    expect(L.removePoint(id, 1)).toBe(true);
    expect(L.placed[id].points).toHaveLength(3); expect(L.placed[id].bulges).toEqual([0, -3]);
    expect(L.removePoint(id, 0)).toBe(true); expect(L.placed[id].bulges).toEqual([-3]);
    expect(L.removePoint(id, 0)).toBe(false); expect(L.placed[id].points).toHaveLength(2);
  });
  test('setBulge clears bulges when every one is 0', () => {
    const L = new LineLayer(); const id = L.add('dry-river', [P(0, 0), P(10, 0)], 4)!;
    L.setBulge(id, 0, 3); expect(L.placed[id].bulges).toEqual([3]);
    L.setBulge(id, 0, 0); expect(L.placed[id].bulges).toBeUndefined();
  });
  test('groups lists placed items in library order with their ids', () => {
    const L = new LineLayer(); L.add('dry-river', [P(0, 0), P(5, 0)], 4); L.add('wood-privacy-fence', [P(0, 1), P(5, 1)], 1); L.add('dry-river', [P(0, 2), P(5, 2)], 4);
    expect(L.groups()).toEqual([{ item: 'wood-privacy-fence', ids: ['l2'] }, { item: 'dry-river', ids: ['l1', 'l3'] }]);
  });
});

describe('line measures', () => {
  test('width in page points: feet ÷ ftPerPt, or at the unscaled default', () => {
    expect(lineWidthPt(2, 0.5)).toBe(4); expect(lineWidthPt(2, null)).toBeCloseTo(2 * UNSCALED_FT_PT, 9);
  });
  test('length: 100 pt at 0.1 ft per pt is 10 ft; no scale gives null; a bent segment is longer than its chord', () => {
    const L = new LineLayer(); const id = L.add('wood-privacy-fence', [P(0, 0), P(100, 0)], 1)!;
    expect(lineLengthPt(L.placed[id])).toBeCloseTo(100, 6); expect(lineLengthFt(L.placed[id], 0.1)).toBeCloseTo(10, 6);
    expect(lineLengthFt(L.placed[id], null)).toBeNull();
    L.setBulge(id, 0, 20); expect(lineLengthPt(L.placed[id])).toBeGreaterThan(100);
  });
  test('the sampled path starts and ends on the end points and is denser on a bend', () => {
    const L = new LineLayer(); const id = L.add('dry-river', [P(0, 0), P(100, 0), P(100, 50)], 4)!;
    const straight = linePathPt(L.placed[id]); expect(straight[0]).toEqual(P(0, 0)); expect(straight[straight.length - 1]).toEqual(P(100, 50)); expect(straight).toHaveLength(3);
    L.setBulge(id, 0, 15); expect(linePathPt(L.placed[id]).length).toBeGreaterThan(10);
  });
});

describe('line hit test', () => {
  const make = () => { const L = new LineLayer(); const id = L.add('wood-privacy-fence', [P(0, 0), P(100, 0)], 10)!; return { L, id }; };
  test('inside the half width hits, outside misses (10 ft at 0.5 ft/pt is 20 pt wide)', () => {
    const { L, id } = make();
    expect(L.hitTest(P(50, 9), always, 0.5, 4)).toBe(id); expect(L.hitTest(P(50, 11), always, 0.5, 4)).toBeNull();
  });
  test('a thin line is still hit within 7 px', () => {
    const L = new LineLayer(); const id = L.add('wood-privacy-fence', [P(0, 0), P(100, 0)], 0.25)!;
    expect(L.hitTest(P(50, 3.4), always, 0.5, 2)).toBe(id); expect(L.hitTest(P(50, 3.6), always, 0.5, 2)).toBeNull();
  });
  test('hidden lines are skipped; the topmost wins on overlap', () => {
    const L = new LineLayer(); const a = L.add('wood-privacy-fence', [P(0, 0), P(100, 0)], 4)!, b = L.add('dry-river', [P(0, 0), P(100, 0)], 4)!;
    expect(L.hitTest(P(50, 0), always, 0.5, 4)).toBe(b);
    expect(L.hitTest(P(50, 0), l => l.id !== b, 0.5, 4)).toBe(a);
    expect(L.hitTest(P(50, 0), () => false, 0.5, 4)).toBeNull();
  });
  test('past the ends misses', () => { const { L } = make(); expect(L.hitTest(P(130, 0), always, 0.5, 4)).toBeNull(); });
});
