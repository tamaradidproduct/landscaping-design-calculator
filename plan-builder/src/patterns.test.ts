import { describe, expect, test } from 'vitest';
import { MATERIALS, material } from './materials';
import { FALLBACK_TILE_PX, MIN_TILE_PX, SWATCH_TILE_PX, patternDefs, scalePatterns, swatchFill, tileSizePx, zoneFill, zonePatternDefs, zoneTileFt } from './patterns';

describe('tileSizePx', () => {
  test('tile feet ÷ feet per point × screen px per point', () => expect(tileSizePx(2, 0.05, 10)).toBe(400));
  test('never smaller than MIN_TILE_PX', () => expect(tileSizePx(2, 0.05, 0.01)).toBe(MIN_TILE_PX));
  test('without a usable scale it uses FALLBACK_TILE_PX', () => {
    for (const ft of [null, 0, NaN, Infinity, -1]) expect(tileSizePx(2, ft, 10)).toBe(FALLBACK_TILE_PX);
  });
});

describe('zoneTileFt', () => {
  test('the material repeat times the zone scale (1 when unset)', () => {
    expect(zoneTileFt('sand')).toBe(material('sand').tileFt);
    expect(zoneTileFt('sand', 2)).toBe(material('sand').tileFt * 2);
  });
});

describe('patternDefs (swatches)', () => {
  test('a fixed-size pattern per material showing its tile', () => {
    const defs = patternDefs();
    for (const m of MATERIALS) { expect(defs).toContain(`id="swatch-${m.id}"`); expect(defs).toContain(m.tile); }
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
    scalePatterns(root, new Map([['s1', 10]]), 0.05, 10, { x: 30, y: 40 });
    expect(els[0].attrs).toEqual({ width: '2000', height: '2000', x: '30', y: '40' });
    expect(els[0].img.attrs).toEqual({ width: '2000', height: '2000' });
  });
  test('a pattern with no zone left is skipped', () => {
    const { root, els } = fake();
    scalePatterns(root, new Map([['s1', 10]]), 0.05, 10, { x: 0, y: 0 });
    expect(els[1].attrs).toEqual({});
  });
});
