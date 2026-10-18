import { describe, expect, test } from 'vitest';
import { lineItemById } from './line-items';
import { LineLayer } from './line-layer';
import { linesSvg, type LinesSvgOptions } from './lines-render';

const P = (x: number, y: number) => ({ x, y });
const base = (placed: ReturnType<LineLayer['ordered']>, over: Partial<LinesSvgOptions> = {}): LinesSvgOptions =>
  ({ placed, shown: () => true, toScreen: p => p, ftPerPt: 0.1, pxPerPt: 1, selected: null, selectedPoint: null, ...over });
const make = (item: string, pts: { x: number; y: number }[], widthFt: number, bulge?: number) => {
  const L = new LineLayer(); const id = L.add(item, pts, widthFt)!; if (bulge) L.setBulge(id, 0, bulge); return L.placed[id];
};
const polys = (svg: string) => [...svg.matchAll(/<polygon points="([^"]+)"/g)].map(m => m[1].split(' ').map(p => p.split(',').map(Number)));

describe('linesSvg', () => {
  test('a run is drawn at its true width: 1 ft at 0.1 ft/pt, 1 px/pt is 10 px across', () => {
    const svg = linesSvg(base([make('wood-privacy-fence', [P(0, 0), P(100, 0)], 1)]));
    const ys = polys(svg).flat().map(p => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(10, 1);
  });
  test('the width follows calibration: a different ftPerPt gives a different pixel width', () => {
    const line = make('wood-privacy-fence', [P(0, 0), P(100, 0)], 1);
    const wide = polys(linesSvg(base([line], { ftPerPt: 0.05 }))).flat().map(p => p[1]);
    expect(Math.max(...wide) - Math.min(...wide)).toBeCloseTo(20, 1);
  });
  test('a bent run is one <g data-id> of many segments', () => {
    const svg = linesSvg(base([make('dry-river', [P(0, 0), P(100, 0)], 4, 20)]));
    expect(svg.match(/<g data-id="l1"/g)).toHaveLength(1); expect(polys(svg).length).toBeGreaterThan(10);
  });
  test('round-cap items get two circles of half the width in the tile colour; the dry river gets none', () => {
    const fence = linesSvg(base([make('wood-privacy-fence', [P(0, 0), P(100, 0)], 1)]));
    const circles = [...fence.matchAll(/<circle [^>]*r="([\d.]+)"[^>]*fill="(#[0-9a-f]{6})"/g)];
    expect(circles).toHaveLength(2); expect(Number(circles[0][1])).toBeCloseTo(5, 1); expect(circles[0][2]).toBe(lineItemById('wood-privacy-fence')!.color);
    expect(linesSvg(base([make('dry-river', [P(0, 0), P(100, 0)], 4)]))).not.toContain('<circle');
  });
  test('the texture tile is the stroke wide and turned to the run (a vertical run: art lengthwise along y)', () => {
    const item = lineItemById('wood-privacy-fence')!;
    const down = linesSvg(base([make('wood-privacy-fence', [P(0, 0), P(0, 100)], 1)])), right = linesSvg(base([make('wood-privacy-fence', [P(0, 0), P(100, 0)], 1)]));
    const w = (s: string) => Number(/<pattern [^>]*width="([\d.]+)"/.exec(s)![1]), h = (s: string) => Number(/<pattern [^>]*height="([\d.]+)"/.exec(s)![1]);
    expect(w(right)).toBeCloseTo(10, 1); expect(h(right)).toBeCloseTo(10 * item.artLengthPx / item.artWidthPx, 1);
    const rot = (s: string) => Number(/rotate\((-?[\d.]+)/.exec(s)![1]);
    expect(rot(right)).toBeCloseTo(-90, 1); expect(rot(down)).toBeCloseTo(0, 1);
  });
  test('the dry river tile is a square of 2.2 widths', () => {
    const svg = linesSvg(base([make('dry-river', [P(0, 0), P(100, 0)], 4)]));
    expect(Number(/<pattern [^>]*width="([\d.]+)"/.exec(svg)![1])).toBeCloseTo(40 * 2.2, 1);
    expect(Number(/<pattern [^>]*height="([\d.]+)"/.exec(svg)![1])).toBeCloseTo(40 * 2.2, 1);
  });
  test('hidden lines are not drawn', () => {
    expect(linesSvg(base([make('wood-privacy-fence', [P(0, 0), P(100, 0)], 1)], { shown: () => false }))).toBe('');
  });
  test('selected: a halo, point handles and bend handles; unselected draws none of them', () => {
    const line = make('wood-privacy-fence', [P(0, 0), P(100, 0), P(100, 50)], 1);
    const plain = linesSvg(base([line])), sel = linesSvg(base([line], { selected: 'l1', selectedPoint: 1 }));
    expect(plain).not.toContain('line-halo'); expect(plain).not.toContain('data-point');
    expect(sel).toContain('line-halo'); expect(sel.match(/data-point="/g)).toHaveLength(3); expect(sel.match(/data-bend="/g)).toHaveLength(2);
    expect(sel.match(/line-point selected/g)).toHaveLength(1);
  });
  test('a draft is drawn dashed with a rubber band to the pointer', () => {
    const svg = linesSvg(base([], { draft: { item: 'wood-privacy-fence', points: [P(0, 0), P(50, 0)], widthFt: 1, hover: P(50, 40) } }));
    expect(svg).toContain('line-draft'); expect(svg).toMatch(/50\.0 40\.0/);
  });
  test('the screen transform is applied', () => {
    const svg = linesSvg(base([make('wood-privacy-fence', [P(0, 0), P(100, 0)], 1)], { toScreen: p => ({ x: p.x + 200, y: p.y + 300 }) }));
    const xs = polys(svg).flat().map(p => p[0]); expect(Math.min(...xs)).toBeGreaterThan(190);
  });
});
