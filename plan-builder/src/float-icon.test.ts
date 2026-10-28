import { describe, expect, test } from 'vitest';
import { floatingIconPos } from './float-icon';

const view = { w: 800, h: 600 };
describe('floatingIconPos (the tap icon that floats beside a selected point)', () => {
  test('sits to the right of and above the point when there is room', () => {
    const p = floatingIconPos({ x: 400, y: 300 }, view, 44);
    expect(p.x).toBeGreaterThan(400); expect(p.y).toBeLessThan(300);
  });
  test('flips to the left near the right edge, and below near the top edge', () => {
    const p = floatingIconPos({ x: 790, y: 5 }, view, 44);
    expect(p.x).toBeLessThan(790); expect(p.y).toBeGreaterThan(5);
  });
  test('the whole 44 px target stays inside the view, and clear of the point itself', () => {
    for (const a of [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 0, y: 600 }, { x: 800, y: 600 }, { x: 400, y: 300 }]) {
      const p = floatingIconPos(a, view, 44);
      expect(p.x - 22).toBeGreaterThanOrEqual(0); expect(p.x + 22).toBeLessThanOrEqual(view.w);
      expect(p.y - 22).toBeGreaterThanOrEqual(0); expect(p.y + 22).toBeLessThanOrEqual(view.h);
      expect(Math.hypot(p.x - a.x, p.y - a.y)).toBeGreaterThanOrEqual(22);
    }
  });
});
