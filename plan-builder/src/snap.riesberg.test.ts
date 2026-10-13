// Regression check against real plan pixels: windows captured around the Riesberg property corners
// (scripts/capture-snap-windows.mjs). The fixture comes from a client document, so it is kept out of
// git; the test skips when it's missing.
import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import { findImageSnap } from './snap';

const FIXTURE = 'test-fixtures/riesberg-snap-windows.json';
const has = fs.existsSync(FIXTURE);

describe.skipIf(!has)('snapping on the Riesberg plot plan', () => {
  test('most taps 6–10 px off a property corner land on it (within 2.5 px)', () => {
    const windows: { name: string; corner: [number, number]; lum: number[] }[] = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const hits = windows.filter(w => {
      const s = findImageSnap(Float32Array.from(w.lum), { x: 24, y: 24 });
      return s?.kind === 'corner' && Math.hypot(s.x - w.corner[0], s.y - w.corner[1]) < 2.5;
    });
    expect(hits.length / windows.length).toBeGreaterThanOrEqual(0.75);
  });
});
