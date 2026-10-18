import { describe, expect, test } from 'vitest';
import { symbolsSvg } from './symbols-render';
import { symbolById } from './symbols';

const base = { toScreen: (p: { x: number; y: number }) => ({ x: p.x * 2, y: p.y * 2 }), ftPerPt: 0.05, pxPerPt: 2, selected: null as string | null, shown: () => true };
const tub = { id: 'y1', symbol: 'hot-tub', x: 100, y: 50 }, spruce = { id: 'y2', symbol: 'blue-diamond-spruce', x: 10, y: 10, rot: 30 };

describe('symbolsSvg', () => {
  test('nothing placed, nothing drawn', () => expect(symbolsSvg({ ...base, placed: [] })).toBe(''));
  test('one image per shown symbol, centred on its screen point at true size', () => {
    const svg = symbolsSvg({ ...base, placed: [tub] });
    expect(svg.match(/<image /g)).toHaveLength(1);
    expect(svg).toContain(symbolById('hot-tub')!.art);
    // 7 ft ÷ 0.05 ft/pt × 2 px/pt = 280 px wide, centred on (200, 100)
    expect(svg).toContain('width="280.0"'); expect(svg).toContain('x="60.0"'); expect(svg).toContain('y="-40.0"');
    expect(svg).toContain('data-id="y1"');
  });
  test('a turned symbol carries its rotation about its centre', () => {
    expect(symbolsSvg({ ...base, placed: [spruce] })).toContain('rotate(30 20.0 20.0)');
    expect(symbolsSvg({ ...base, placed: [tub] })).not.toContain('rotate');
  });
  test('a hidden symbol is not drawn', () => {
    const svg = symbolsSvg({ ...base, placed: [tub, spruce], shown: p => p.id === 'y2' });
    expect(svg.match(/<image /g)).toHaveLength(1); expect(svg).not.toContain('data-id="y1"');
  });
  test('only the selected symbol has a halo', () => {
    expect(symbolsSvg({ ...base, placed: [tub, spruce] })).not.toContain('symbol-halo');
    const svg = symbolsSvg({ ...base, placed: [tub, spruce], selected: 'y1' });
    expect(svg.match(/symbol-halo/g)).toHaveLength(1);
  });
  test('a ghost shows the armed symbol at the pointer, see-through', () => {
    const svg = symbolsSvg({ ...base, placed: [], ghost: { symbol: 'hot-tub', at: { x: 300, y: 300 } } });
    expect(svg).toContain('class="symbol ghost"'); expect(svg).toContain('x="160.0"');
  });
  test('without a scale it uses the default size and follows zoom', () => {
    const svg = symbolsSvg({ ...base, ftPerPt: null, placed: [tub] }); // 7 ft × 2.4 pt/ft × 2 px/pt = 33.6 px
    expect(svg).toContain('width="33.6"');
  });
  test('a utility marker is drawn at least 20 px long and turns to show its direction', () => {
    const gas = { id: 'y3', symbol: 'gas-line', x: 10, y: 10, rot: 90 };
    const svg = symbolsSvg({ ...base, ftPerPt: 0.5, pxPerPt: 1, toScreen: p => p, placed: [gas] }); // 1.03 ft is 2 pt: far under 20 px
    expect(svg).toContain('height="20.0"'); expect(svg).toContain('rotate(90 10.0 10.0)');
    expect(symbolsSvg({ ...base, ftPerPt: 0.5, pxPerPt: 1, toScreen: p => p, placed: [{ ...gas, symbol: 'hot-tub' }] })).toContain('width="14.0"'); // an object keeps the 6 px floor: 7 ft is 14 px
  });
  test('a stepping stone draws like an object at its Figma size (2 ft)', () => {
    const svg = symbolsSvg({ ...base, ftPerPt: 0.05, pxPerPt: 2, placed: [{ id: 'y4', symbol: 'porcelain-pavers', x: 0, y: 0 }] });
    expect(svg).toContain('width="80.0"'); // 2 ft ÷ 0.05 × 2 px/pt
  });
});
