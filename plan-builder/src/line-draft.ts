// A line being drawn, before it is saved: which taps add a point, and when it is long enough to keep. Pure.
import { dist } from './outline';
import type { Point } from './view';

/** A tap this close (screen px) to the last point is a double-tap's second half or a jitter, not a new point. */
export const DRAFT_MIN_GAP_PX = 4;

/** The draft with a tap (page point) added, or null when the tap is too near the last point to count. */
export function draftWithPoint(points: readonly Point[], tap: Point, pxPerPt: number): Point[] | null {
  const last = points[points.length - 1];
  if (last && dist(last, tap) * pxPerPt <= DRAFT_MIN_GAP_PX) return null;
  return [...points, tap];
}

/** Whether a draft can be saved: at least two points that are not all the same spot. */
export const draftReady = (points: readonly Point[]): boolean => points.length >= 2 && points.some(p => dist(p, points[0]) > 1e-6);

/** A tap this soon (ms) after the last one, and this near (screen px), is the second half of a double-tap. */
export const DRAFT_DOUBLE_TAP = { ms: 350, px: 30 } as const;

/**
 * What a tap does to a line being drawn: `finish` (the second half of a double-tap: the previous tap, placed or ignored, was a moment
 * ago and right here, and there are two points to keep), `ignore` (too near the last point to be a new one), or `add`. `last` is the
 * previous tap's time and its screen distance from this one; the caller stamps every tap, ignored ones too, so a double-tap on a point
 * placed earlier still finishes.
 */
export function draftTap(points: readonly Point[], tap: Point, pxPerPt: number, last: { t: number; screenDist: number } | null, now: number): 'add' | 'ignore' | 'finish' {
  if (last && now - last.t < DRAFT_DOUBLE_TAP.ms && last.screenDist < DRAFT_DOUBLE_TAP.px && points.length >= 2) return 'finish';
  return draftWithPoint(points, tap, pxPerPt) ? 'add' : 'ignore';
}
