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
  test('a zone without a material says Not counted yet and shows the hatched swatch', () => {
    const bare = { ...zone, material: undefined } as unknown as Outline;
    const h = surfaceCard(tool([0, 0, 0, 0]), bare, { open: false, changing: false });
    expect(h).toContain('Not counted yet'); expect(h).toContain('url(#unassigned-hatch)');
    expect(html([0, 0, 0, 0], false)).not.toContain('Not counted yet');
  });
  test('uniform radius shows its value; mixed shows a Mixed placeholder', () => {
    expect(html([2, 2, 2, 2], true)).toContain('value="2"');
    expect(html([2, 0, 2, 2], true)).toContain('placeholder="Mixed"');
  });
  test('Width and Depth stay in the card; corner radius and texture sit under the closed disclosure', () => {
    const closed = html([0, 0, 0, 0], false), open = html([0, 0, 0, 0], true);
    expect(closed).toContain('data-disclosure="adjust"'); expect(closed).toContain('aria-expanded="false"'); expect(closed).toContain('Corners and texture');
    for (const id of ['zone-width', 'zone-depth']) { expect(closed).toContain(id); expect(open).toContain(id); }
    for (const id of ['round-all', 'tex-down']) { expect(closed).not.toContain(id); expect(open).toContain(id); }
  });
  test('the area is the quiet line under the name, not a meta beside it', () => {
    const h = html([0], false);
    expect(h).toMatch(/class="layer-sub">80 sq ft</); expect(h).not.toContain('layer-meta');
  });
  test('the swatch sits in the Material button, not in the header', () => {
    const h = html([0], false), head = h.slice(0, h.indexOf('layer-body'));
    expect(head).not.toContain('class="swatch');
    expect(h).toMatch(/<button[^>]*data-act="change-material"[^>]*aria-label="Change material"[^>]*><span class="swatch material">.*<\/span><span>Material<\/span><\/button>/);
  });
  test('actions are Change material and the edit icons', () => {
    const h = html([0], false);
    expect(h).toContain('aria-label="Change material"'); expect(h).toContain('data-act="redraw"'); expect(h).not.toContain('data-act="up"');
  });
});
