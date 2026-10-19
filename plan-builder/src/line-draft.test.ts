import { describe, expect, test } from 'vitest';
import { DRAFT_MIN_GAP_PX, draftReady, draftTap, draftWithPoint } from './line-draft';

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

describe('draftTap (what a tap does to a draft)', () => {
  const two = [P(0, 0), P(100, 0)];
  test('a tap on a new spot adds a point', () => expect(draftTap(two, P(150, 0), 1, null, 1000)).toBe('add'));
  test('a tap on the last point is ignored the first time', () => expect(draftTap(two, P(101, 0), 1, null, 1000)).toBe('ignore'));
  test('a second tap within 350 ms and 30 px of the last tap finishes a draft of two or more points', () => {
    expect(draftTap(two, P(150, 0), 1, { t: 900, screenDist: 5 }, 1000)).toBe('finish');
  });
  test('the second half of a double-tap finishes even when the first half was ignored, however long after the point was placed', () => {
    // point placed at t=0; the contractor pauses; taps the last point twice (500 ms later, then 100 ms after that)
    expect(draftTap(two, P(100, 0), 1, null, 5000)).toBe('ignore');
    expect(draftTap(two, P(100, 0), 1, { t: 5000, screenDist: 0 }, 5100)).toBe('finish');
  });
  test('too late (350 ms or more) or too far (30 px) is just another tap', () => {
    expect(draftTap(two, P(150, 0), 1, { t: 600, screenDist: 5 }, 1000)).toBe('add');
    expect(draftTap(two, P(150, 0), 1, { t: 900, screenDist: 31 }, 1000)).toBe('add');
  });
  test('one point cannot be finished by a double-tap', () => {
    expect(draftTap([P(0, 0)], P(0.5, 0), 1, { t: 900, screenDist: 0 }, 1000)).toBe('ignore');
  });
});
