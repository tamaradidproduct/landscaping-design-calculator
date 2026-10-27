import { describe, expect, test } from 'vitest';
import { MATERIALS, material } from './materials';
import { MIN_TILE_PX, SWATCH_TILE_PX, UNASSIGNED_FILL, UNASSIGNED_HATCH_ID, UNSCALED_TILE_PT, patternDefs, scalePatterns, swatchFill, tileSizePx, zoneFill, zonePatternDefs } from './patterns';

describe('tileSizePx', () => {
  test('tile feet × texture scale ÷ feet per point × screen px per point', () => {
    expect(tileSizePx(2, 0.05, 10)).toBe(400);
    expect(tileSizePx(2, 0.05, 10, 2)).toBe(800);
  });
  test('never smaller than MIN_TILE_PX', () => expect(tileSizePx(2, 0.05, 0.01)).toBe(MIN_TILE_PX));
  test('without a usable scale the tile is UNSCALED_TILE_PT page points, still following zoom and the texture scale', () => {
    for (const ft of [null, 0, NaN, Infinity, -1]) {
      expect(tileSizePx(10, ft, 2)).toBe(UNSCALED_TILE_PT * 2);
      expect(tileSizePx(10, ft, 2, 3)).toBe(UNSCALED_TILE_PT * 2 * 3);
      expect(tileSizePx(10, ft, 4)).toBe(UNSCALED_TILE_PT * 4);
    }
  });
});

describe('unassigned hatch', () => {
  test('is one static pattern in the swatch defs, coloured by tokens only', () => {
    const defs = patternDefs();
    expect(defs).toContain(`id="${UNASSIGNED_HATCH_ID}"`); expect(defs).toContain('var(--color-');
    expect(defs).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    const hatch = defs.slice(defs.indexOf(`id="${UNASSIGNED_HATCH_ID}"`));
    expect(hatch).not.toContain('--color-feature'); // neutral canvas tokens, not the existing-feature greys
    expect(hatch).toMatch(/stroke-width:var\(--stroke-/);
    expect(UNASSIGNED_FILL).toBe(`url(#${UNASSIGNED_HATCH_ID})`);
  });
});

describe('patternDefs (swatches)', () => {
  test('a fixed-size pattern per material showing its thumbnail', () => {
    const defs = patternDefs();
    for (const m of MATERIALS) { expect(defs).toContain(`id="swatch-${m.id}"`); expect(defs).toContain(m.thumb); }
    expect(defs).not.toContain(MATERIALS[0].tile); // swatches use small thumbnails, so the big tiles load only for zones
    expect(defs).toContain(`width="${SWATCH_TILE_PX}"`);
    expect(defs).not.toContain('id="material-');
  });
  test('fill reference', () => expect(swatchFill('sand')).toBe('url(#swatch-sand)'));
});

describe('zone patterns', () => {
  test('one pattern per zone, showing its material tile', () => {
    const defs = zonePatternDefs([{ id: 's1', material: 'sand' }, { id: 's2', material: 'deck-wood' }]);
    expect(defs).toContain('id="zone-s1"'); expect(defs).toContain('id="zone-s2"');
    expect(defs).toContain(material('sand').tile); expect(defs).toContain(material('deck-wood').tile);
  });
  test('fill reference', () => expect(zoneFill('s1')).toBe('url(#zone-s1)'));
});

describe('scalePatterns', () => {
  const fake = () => {
    const el = (id: string) => {
      const attrs: Record<string, string> = {}, img = { attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } };
      return { id, attrs, img, setAttribute(k: string, v: string) { attrs[k] = v; }, querySelector: () => img };
    };
    const els = [el('zone-s1'), el('zone-gone')];
    return { els, root: { querySelectorAll: () => els } as unknown as ParentNode };
  };
  test('sizes each zone pattern to real-world scale and anchors it at the plan origin', () => {
    const { root, els } = fake();
    scalePatterns(root, new Map([['s1', { tileFt: 10, texScale: 1 }]]), 0.05, 10, { x: 30, y: 40 });
    expect(els[0].attrs).toEqual({ width: '2000', height: '2000', x: '30', y: '40' });
    expect(els[0].img.attrs).toEqual({ width: '2000', height: '2000' });
  });
  test('a pattern with no zone left is skipped', () => {
    const { root, els } = fake();
    scalePatterns(root, new Map([['s1', { tileFt: 10, texScale: 1 }]]), 0.05, 10, { x: 0, y: 0 });
    expect(els[1].attrs).toEqual({});
  });
});
