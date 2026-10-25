import { describe, expect, test } from 'vitest';
import { materialsByFamily } from './materials';
import { surfaceCard } from './surfaces-ui';
import type { OutlineTool } from './outline-ui';
import type { Outline } from './outline';

const zone = { id: 'z1', kind: 'surface', name: 'Patio', material: materialsByFamily()[0]!.materials[0]!.id, closed: true, pts: [], texScale: 1 } as unknown as Outline;
const tool = (radii: number[]) => ({
  drawing: null, cal: { ftPerPt: 1 }, aspectLock: false,
  zoneBox: () => ({ w: 10, h: 8 }), areaSqft: () => 80, cornerRadiiFt: () => radii,
}) as unknown as OutlineTool;
const html = (radii: number[], open: boolean) => surfaceCard(tool(radii), zone, { open, changing: false });

describe('surface card', () => {
  test('uniform radius shows its value; mixed shows a Mixed placeholder', () => {
    expect(html([2, 2, 2, 2], true)).toContain('value="2"');
    expect(html([2, 0, 2, 2], true)).toContain('placeholder="Mixed"');
  });
  test('shape and texture controls are absent while closed, present when open', () => {
    const closed = html([0, 0, 0, 0], false), open = html([0, 0, 0, 0], true);
    expect(closed).toContain('data-disclosure="adjust"'); expect(closed).toContain('aria-expanded="false"');
    for (const id of ['zone-width', 'round-all', 'tex-down']) { expect(closed).not.toContain(id); expect(open).toContain(id); }
  });
  test('header shows the area in its meta; actions are Change material and the edit icons', () => {
    const h = html([0], false);
    expect(h).toContain('80 sq ft'); expect(h).toContain('Change material'); expect(h).toContain('data-act="redraw"'); expect(h).not.toContain('data-act="up"');
  });
});
