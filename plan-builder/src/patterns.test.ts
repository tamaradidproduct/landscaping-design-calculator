import { describe, expect, test } from 'vitest';
import { MATERIALS } from './materials';
import { FALLBACK_TILE_PX, MIN_TILE_PX, SWATCH_TILE_PX, materialFill, patternDefs, scalePatterns, swatchFill, tileSizePx } from './patterns';

describe('tileSizePx', () => {
  test('tile feet ÷ feet per point × screen px per point', () => expect(tileSizePx(2, 0.05, 10)).toBe(400));
  test('never smaller than MIN_TILE_PX', () => expect(tileSizePx(2, 0.05, 0.01)).toBe(MIN_TILE_PX));
  test('without a usable scale it uses FALLBACK_TILE_PX', () => {
    for (const ft of [null, 0, NaN, Infinity, -1]) expect(tileSizePx(2, ft, 10)).toBe(FALLBACK_TILE_PX);
  });
});

describe('patternDefs', () => {
  test('a plan pattern and a swatch pattern per material, each showing its tile', () => {
    const defs = patternDefs();
    for (const m of MATERIALS) {
      expect(defs).toContain(`id="material-${m.id}"`);
      expect(defs).toContain(`id="swatch-${m.id}"`);
      expect(defs).toContain(m.tile);
    }
  });
  test('fill references', () => {
    expect(materialFill('sand')).toBe('url(#material-sand)');
    expect(swatchFill('sand')).toBe('url(#swatch-sand)');
  });
});

describe('scalePatterns', () => {
  const fake = () => {
    const el = (id: string) => {
      const attrs: Record<string, string> = {}, img = { attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v; } };
      return { id, attrs, img, setAttribute(k: string, v: string) { attrs[k] = v; }, querySelector: () => img };
    };
    const els = [el('material-sand'), el('swatch-sand')];
    return { els, root: { querySelectorAll: () => els.filter(e => e.id.startsWith('material-')) } as unknown as ParentNode };
  };
  test('sizes plan patterns to real-world scale and leaves swatches alone', () => {
    const { root, els } = fake();
    scalePatterns(root, 0.05, 10, { x: 30, y: 40 });
    expect(els[0].attrs).toMatchObject({ width: '400', height: '400' });
    expect(els[0].img.attrs).toMatchObject({ width: '400', height: '400' });
    expect(els[1].attrs).toEqual({});
  });
  test('anchors plan patterns at the plan origin so the texture moves with the zone', () => {
    const { root, els } = fake();
    scalePatterns(root, 0.05, 10, { x: 30, y: 40 });
    expect(els[0].attrs).toMatchObject({ x: '30', y: '40' });
  });
  test('swatches stay SWATCH_TILE_PX', () => expect(patternDefs()).toContain(`width="${SWATCH_TILE_PX}"`));
});
