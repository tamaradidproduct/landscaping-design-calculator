import type { Point } from './view';

/** Gap (screen px) from an anchor point to the middle of its floating icon on each axis: clear of the point's own hit area. */
const GAP = 34;

/**
 * Where the middle of a floating icon (a square tap target of `size` px) sits beside `anchor` (screen px): up and to the
 * right by default, flipping to the other side of the point near the view's edge, then kept wholly inside the view.
 * Shared by every "tap this selected point's icon" control (remove a corner now, a line point later).
 */
export function floatingIconPos(anchor: Point, view: { w: number; h: number }, size: number): Point {
  const half = size / 2;
  const dx = anchor.x + GAP + half > view.w ? -GAP : GAP;
  const dy = anchor.y - GAP - half < 0 ? GAP : -GAP;
  const clamp = (v: number, max: number) => Math.min(Math.max(v, half), Math.max(half, max - half));
  return { x: clamp(anchor.x + dx, view.w), y: clamp(anchor.y + dy, view.h) };
}
