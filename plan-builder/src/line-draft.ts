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
