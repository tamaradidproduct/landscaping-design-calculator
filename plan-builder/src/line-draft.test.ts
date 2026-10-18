import { describe, expect, test } from 'vitest';
import { DRAFT_MIN_GAP_PX, draftReady, draftWithPoint } from './line-draft';

const P = (x: number, y: number) => ({ x, y });

describe('line draft', () => {
  test('a tap appends a page point', () => {
    expect(draftWithPoint([], P(5, 5), 1)).toEqual([P(5, 5)]);
    expect(draftWithPoint([P(0, 0)], P(30, 0), 1)).toEqual([P(0, 0), P(30, 0)]);
  });
  test('a tap within 4 px of the last point is ignored (null), measured in screen px', () => {
    expect(DRAFT_MIN_GAP_PX).toBe(4);
    expect(draftWithPoint([P(0, 0)], P(3, 0), 1)).toBeNull();
    expect(draftWithPoint([P(0, 0)], P(4.1, 0), 1)).not.toBeNull();
    expect(draftWithPoint([P(0, 0)], P(1.9, 0), 2)).toBeNull();   // 3.8 px at 2 px per pt
  });
  test('the draft is not changed in place', () => {
    const pts = [P(0, 0)]; draftWithPoint(pts, P(50, 0), 1); expect(pts).toEqual([P(0, 0)]);
  });
  test('a draft is ready to save with two distinct points, not with one or two on the same spot', () => {
    expect(draftReady([])).toBe(false); expect(draftReady([P(1, 1)])).toBe(false); expect(draftReady([P(1, 1), P(1, 1)])).toBe(false);
    expect(draftReady([P(1, 1), P(9, 1)])).toBe(true);
  });
});
