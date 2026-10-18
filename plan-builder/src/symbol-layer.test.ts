import { describe, expect, test } from 'vitest';
import { SymbolLayer, UNSCALED_FT_PT, normalizeDeg, symbolSizePt, symbolSizePx } from './symbol-layer';

const all = () => true;

describe('symbol sizes', () => {
  test('feet ÷ feet per point gives page points; × px per point gives screen px', () => {
    expect(symbolSizePt({ w: 20, d: 10 }, 0.05)).toEqual({ w: 400, d: 200 });
    expect(symbolSizePx({ w: 20, d: 20 }, 0.05, 2)).toEqual({ w: 800, d: 800 });
  });
  test('without a scale a size is 2.4 page points per foot and still follows zoom', () => {
    expect(UNSCALED_FT_PT).toBe(2.4);
    for (const ft of [null, 0, NaN, -1]) expect(symbolSizePt({ w: 10, d: 5 }, ft)).toEqual({ w: 24, d: 12 });
    expect(symbolSizePx({ w: 10, d: 10 }, null, 3).w).toBeCloseTo(72, 5);
  });
  test('never smaller than 6 px on screen', () => expect(symbolSizePx({ w: 0.5, d: 0.5 }, 0.5, 1).w).toBe(6));
  test('normalizeDeg wraps into [0, 360)', () => {
    expect([normalizeDeg(-90), normalizeDeg(360), normalizeDeg(450), normalizeDeg(0), normalizeDeg(-720.5)]).toEqual([270, 0, 90, 0, 359.5]);
  });
});

describe('SymbolLayer', () => {
  test('place returns y1, y2 … and stores the point; ids are reused only when free', () => {
    const l = new SymbolLayer();
    expect(l.place('blue-diamond-spruce', { x: 1, y: 2 })).toBe('y1');
    expect(l.place('hot-tub', { x: 3, y: 4 })).toBe('y2');
    expect(l.placed.y1).toEqual({ id: 'y1', symbol: 'blue-diamond-spruce', x: 1, y: 2 });
    l.remove('y1');
    expect(l.place('firepit', { x: 0, y: 0 })).toBe('y1');
  });
  test('move, setRotation and remove', () => {
    const l = new SymbolLayer(); const id = l.place('hot-tub', { x: 10, y: 10 });
    l.move(id, 5, -3); expect(l.placed[id]).toMatchObject({ x: 15, y: 7 });
    l.setRotation(id, -90); expect(l.placed[id].rot).toBe(270);
    l.setRotation(id, 0); expect(l.placed[id].rot).toBeUndefined();
    l.remove(id); expect(l.placed[id]).toBeUndefined();
    expect(() => { l.move('nope', 1, 1); l.setRotation('nope', 1); l.remove('nope'); }).not.toThrow();
  });
  describe('hitTest (page points; 20 ft plant = 400 pt at 0.05 ft/pt)', () => {
    test('a plant is a circle of its spread', () => {
      const l = new SymbolLayer(); const id = l.place('austrian-pine', { x: 100, y: 100 }); // 30 ft spread = 600 pt
      expect(l.hitTest({ x: 100 + 290, y: 100 }, all, 0.05, 1)).toBe(id);
      expect(l.hitTest({ x: 100 + 310, y: 100 }, all, 0.05, 1)).toBeNull();
      expect(l.hitTest({ x: 100 + 220, y: 100 + 220 }, all, 0.05, 1)).toBeNull(); // 311 pt from the centre: in the bounding square, outside the circle
    });
    test('an object is its rectangle, turned with it', () => {
      const l = new SymbolLayer(); const id = l.place('planter-box', { x: 0, y: 0 }); // about 4 × 1.7 ft = 80 × 34 pt
      expect(l.hitTest({ x: 35, y: 0 }, all, 0.05, 1)).toBe(id);
      expect(l.hitTest({ x: 0, y: 25 }, all, 0.05, 1)).toBeNull();
      l.setRotation(id, 90);
      expect(l.hitTest({ x: 0, y: 35 }, all, 0.05, 1)).toBe(id);
      expect(l.hitTest({ x: 35, y: 0 }, all, 0.05, 1)).toBeNull();
    });
    test('the later one wins where symbols overlap', () => {
      const l = new SymbolLayer(); l.place('hot-tub', { x: 0, y: 0 }); const top = l.place('hot-tub', { x: 10, y: 0 });
      expect(l.hitTest({ x: 5, y: 0 }, all, 0.05, 1)).toBe(top);
    });
    test('a hidden symbol is not hit', () => {
      const l = new SymbolLayer(); const a = l.place('hot-tub', { x: 0, y: 0 }); l.place('hot-tub', { x: 0, y: 0 });
      expect(l.hitTest({ x: 0, y: 0 }, p => p.id === a, 0.05, 1)).toBe(a);
      expect(l.hitTest({ x: 0, y: 0 }, () => false, 0.05, 1)).toBeNull();
    });
    test('a tiny symbol still has a finger-sized target (14 px)', () => {
      const l = new SymbolLayer(); const id = l.place('spigot', { x: 0, y: 0 }); // 0.5 ft = 10 pt
      expect(l.hitTest({ x: 6, y: 0 }, all, 0.05, 2)).toBe(id); // 12 px from the centre at 2 px/pt
      expect(l.hitTest({ x: 20, y: 0 }, all, 0.05, 2)).toBeNull();
    });
    test('without a scale it uses the default size', () => {
      const l = new SymbolLayer(); const id = l.place('oak', { x: 0, y: 0 }); // 60 ft × 2.4 = 144 pt
      expect(l.hitTest({ x: 70, y: 0 }, all, null, 1)).toBe(id);
      expect(l.hitTest({ x: 80, y: 0 }, all, null, 1)).toBeNull();
    });
  });
  test('counts and groups follow the library order, not placing order', () => {
    const l = new SymbolLayer(); l.place('hot-tub', { x: 0, y: 0 }); const a = l.place('blue-diamond-spruce', { x: 0, y: 0 }); const b = l.place('blue-diamond-spruce', { x: 1, y: 1 });
    expect(l.counts().get('blue-diamond-spruce')).toBe(2);
    expect(l.groups()).toEqual([{ symbol: 'blue-diamond-spruce', ids: [a, b] }, { symbol: 'hot-tub', ids: ['y1'] }]);
  });
});
