import { describe, expect, test } from 'vitest';
import { findImageSnap, SNAP_WINDOW } from './snap';

const N = SNAP_WINDOW;
/** A white window with dark pixels where `ink` says so. */
function image(ink: (x: number, y: number) => boolean): Float32Array {
  const g = new Float32Array(N * N).fill(255);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (ink(x, y)) g[y * N + x] = 20;
  return g;
}
const c = N / 2;

describe('findImageSnap', () => {
  test('snaps to the corner where two drawn lines meet', () => {
    // horizontal line on rows 30-31, vertical line on columns 20-21, both 2 px thick
    const g = image((x, y) => (y >= 30 && y <= 31 && x >= 20) || (x >= 20 && x <= 21 && y <= 31));
    const s = findImageSnap(g, { x: c, y: c })!;
    expect(s.kind).toBe('corner');
    expect(s.x).toBeCloseTo(21, 0);
    expect(s.y).toBeCloseTo(31, 0);
  });

  test('snaps onto a single line when no corner is near', () => {
    const g = image((x, y) => y >= 27 && y <= 28); // 2 px horizontal line, centre y = 28 (pixel centres 27.5, 28.5)
    const s = findImageSnap(g, { x: c, y: c })!;
    expect(s.kind).toBe('line');
    expect(s.x).toBeCloseTo(c, 0);
    expect(s.y).toBeCloseTo(28, 0);
  });

  test('handles slanted lines', () => {
    const g = image((x, y) => Math.abs((y - 4) - (x - 4) * 0.5) < 1.2); // y = 0.5x + 2 through the window
    const s = findImageSnap(g, { x: 30, y: 17 })!;
    expect(s.kind).toBe('line');
    expect(Math.abs((s.y - 4) - (s.x - 4) * 0.5)).toBeLessThan(1);
  });

  test('ignores text-sized marks', () => {
    // scattered short strokes (like lettering), none longer than 6 px, at pseudo-random spots
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const strokes = Array.from({ length: 40 }, () => ({ x: rnd() * 44, y: rnd() * 44, dx: rnd() < 0.5 ? 1 : 0, len: 3 + Math.floor(rnd() * 4) }));
    const g = image((x, y) => strokes.some(s => s.dx ? (y === Math.floor(s.y) && x >= s.x && x < s.x + s.len) : (x === Math.floor(s.x) && y >= s.y && y < s.y + s.len)));
    expect(findImageSnap(g, { x: c, y: c })).toBeNull();
  });

  test('returns nothing on a blank area', () => {
    expect(findImageSnap(image(() => false), { x: c, y: c })).toBeNull();
  });

  test('does not snap to a line that is too far from the point', () => {
    const g = image((x, y) => y <= 1); // line at the very top edge, ~23 px away
    expect(findImageSnap(g, { x: c, y: c })).toBeNull();
  });
});

describe('findImageSnap on cluttered corners', () => {
  test('finds the corner even with a parallel line right next to one side', () => {
    // vertical line x=20-21 down to y=31, horizontal line y=30-31 to the left, plus a thin parallel line at y=35
    const g = image((x, y) => (x >= 20 && x <= 21 && y <= 31) || (y >= 30 && y <= 31 && x <= 21) || y === 35);
    const s = findImageSnap(g, { x: c, y: c })!;
    expect(s.kind).toBe('corner');
    expect(Math.hypot(s.x - 21, s.y - 31)).toBeLessThan(1.5);
  });
  test('text touching a line does not pull the corner off', () => {
    const digits = (x: number, y: number) => x >= 27 && x <= 40 && y >= 20 && y <= 28 && (x + y) % 3 === 0;
    const g = image((x, y) => (y >= 30 && y <= 31) || (x >= 20 && x <= 21 && y >= 30) || digits(x, y));
    const s = findImageSnap(g, { x: c, y: c })!;
    expect(s.kind).toBe('corner');
    expect(Math.hypot(s.x - 21, s.y - 31)).toBeLessThan(1.5);
  });
});
