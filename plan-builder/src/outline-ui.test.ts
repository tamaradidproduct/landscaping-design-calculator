import { describe, expect, test } from 'vitest';
import { OutlineTool } from './outline-ui';
import { GESTURE } from './overlay-tokens';
import { History } from './history';
import { SymbolLayer } from './symbol-layer';
import { LineLayer } from './line-layer';
import { plantDiameter } from './plant-size';
import { symbolById } from './symbols';
import type { PlanState } from './plan-model';

describe('corner and bend pointer movement', () => {
  test.each(['corner', 'bend'] as const)('%s movement within hold slop remains a tap', type => {
    const tool = Object.create(OutlineTool.prototype) as OutlineTool;
    const internals = tool as unknown as {
      drag: { type: 'corner' | 'bend'; id: string; i: number; grab: { x: number; y: number }; moved: boolean; inserted?: boolean };
      downFinger: { x: number; y: number };
      bypassHold: boolean;
      holdTimer: number;
      applyDrag: () => void;
    };
    let applied = 0;
    internals.drag = { type, id: 'outline', i: 0, grab: { x: 0, y: 0 }, moved: false, inserted: type === 'corner' };
    internals.downFinger = { x: 10, y: 10 };
    internals.bypassHold = false;
    internals.holdTimer = 0;
    internals.applyDrag = () => { applied++; };

    tool.pointerMove({ x: 10 + GESTURE.holdSlop / 2, y: 10 });
    expect(internals.drag.moved).toBe(false);
    expect(applied).toBe(0);

    tool.pointerMove({ x: 10 + GESTURE.holdSlop + 1, y: 10 });
    expect(internals.drag.moved).toBe(true);
    expect(applied).toBe(1);
  });
});

describe('plant size view', () => {
  // No DOM here, so build the tool without its constructor and give it just what these paths touch.
  function tool(): OutlineTool {
    const t = Object.create(OutlineTool.prototype) as OutlineTool;
    Object.assign(t, {
      host: { toPage: (p: { x: number; y: number }) => p, historyChanged: () => {} }, history: new History(), symbols: new SymbolLayer(), lines: new LineLayer(),
      outlines: {}, refs: [], hiddenLayers: new Set(), hiddenSections: new Set(), magnifier: {}, revision: 0, update: () => {}, placing: null,
    });
    return t;
  }
  const withPlants: PlanState = { outlines: {}, refs: [], symbols: { y1: { id: 'y1', symbol: 'lavender', x: 0, y: 0 } } };
  const place = (t: OutlineTool, id: string) => { t.placing = id; (t as unknown as { placeSymbolAt(p: { x: number; y: number }): void }).placeSymbolAt({ x: 1, y: 1 }); };

  test('an empty plan shows Install; a loaded plan with plants and no choice shows Mature', () => {
    const t = tool(); expect(t.plantView).toBe('install');
    t.load(withPlants); expect(t.plantView).toBe('mature');
  });
  test('setPlantView is one undo step, and a no-op when unchanged', () => {
    const t = tool(); t.load(withPlants);
    expect(t.state().plantSizeView).toBeUndefined();
    t.setPlantView('mature'); expect(t.state().plantSizeView).toBe('mature');
    t.undo(); expect(t.state().plantSizeView).toBeUndefined(); expect(t.plantView).toBe('mature');
    const t2 = tool(); t2.setPlantView('install'); t2.setPlantView('install'); t2.setPlantView('mature');
    expect(t2.state().plantSizeView).toBe('mature');
    t2.undo(); expect(t2.plantView).toBe('install'); expect(t2.state().plantSizeView).toBe('install');
    t2.undo(); expect(t2.state().plantSizeView).toBeUndefined();
  });
  test('the first plant on an empty plan settles the view as Install; later plants and chosen views are left alone', () => {
    const t = tool(); place(t, 'lavender'); expect(t.state().plantSizeView).toBe('install');
    t.setPlantView('mature'); place(t, 'lavender'); expect(t.state().plantSizeView).toBe('mature');
    const u = tool(); u.setPlantView('mature'); place(u, 'lavender'); expect(u.state().plantSizeView).toBe('mature');
    t.undo(); t.undo(); t.undo(); expect(t.state().plantSizeView).toBeUndefined();
  });
  test('an object placed first does not decide the view; the first plant after it still stores Install', () => {
    const t = tool(); place(t, 'hot-tub');
    expect(t.state().plantSizeView).toBeUndefined(); expect(t.plantView).toBe('install');
    place(t, 'lavender'); expect(t.state().plantSizeView).toBe('install');
    const o = tool(); o.load({ outlines: {}, refs: [], symbols: { y1: { id: 'y1', symbol: 'hot-tub', x: 0, y: 0 } } });
    expect(o.plantView).toBe('install');
  });
  test('symbolSizeFt: a plant is a circle of its install or mature diameter; an object keeps its library size', () => {
    const t = tool(); t.load(withPlants);
    const lav = { id: 'y1', symbol: 'lavender', x: 0, y: 0 };
    t.setPlantView('install');
    const d = plantDiameter('lavender', {}, 'install');
    expect(t.symbolSizeFt(lav)).toEqual({ w: d, d });
    t.setPlantView('mature');
    expect(t.symbolSizeFt(lav)).toEqual({ w: symbolById('lavender')!.size.w, d: symbolById('lavender')!.size.w });
    expect(t.symbolSizeFt({ id: 'y2', symbol: 'hot-tub', x: 0, y: 0 })).toEqual(symbolById('hot-tub')!.size);
  });
});

describe('plant container choice', () => {
  function tool(): OutlineTool {
    const t = Object.create(OutlineTool.prototype) as OutlineTool;
    Object.assign(t, {
      host: { toPage: (p: { x: number; y: number }) => p, historyChanged: () => {} }, history: new History(), symbols: new SymbolLayer(), lines: new LineLayer(),
      outlines: {}, refs: [], hiddenLayers: new Set(), hiddenSections: new Set(), magnifier: {}, revision: 0, update: () => {}, placing: null,
    });
    return t;
  }
  const put = (t: OutlineTool, symbol: string) => t.symbols.place(symbol, { x: 0, y: 0 });
  const spruces = (t: OutlineTool) => [put(t, 'blue-diamond-spruce'), put(t, 'blue-diamond-spruce'), put(t, 'blue-diamond-spruce')];

  test('setContainer stores the label, undo restores', () => {
    const t = tool(), id = put(t, 'blue-diamond-spruce');
    t.setContainer(id, '5 gal'); expect(t.symbols.placed[id].container).toBe('5 gal');
    t.undo(); expect(t.symbols.placed[id].container).toBeUndefined();
  });
  test('setContainer after setCustomInstall leaves only container', () => {
    const t = tool(), id = put(t, 'blue-diamond-spruce');
    t.setCustomInstall(id, 3); expect(t.symbols.placed[id].customInstall).toBe(3);
    t.setContainer(id, '5 gal');
    expect(t.symbols.placed[id].container).toBe('5 gal'); expect(t.symbols.placed[id].customInstall).toBeUndefined();
  });
  test('setCustomInstall clamps, drops container, and ignores plants without containers', () => {
    const t = tool(), id = put(t, 'blue-diamond-spruce'), corn = put(t, 'corn');
    t.setContainer(id, '5 gal'); t.setCustomInstall(id, 999);
    expect(t.symbols.placed[id].customInstall).toBe(symbolById('blue-diamond-spruce')!.size.w);
    expect(t.symbols.placed[id].container).toBeUndefined();
    t.setCustomInstall(corn, 2); expect(t.symbols.placed[corn].customInstall).toBeUndefined();
  });
  test('setCustomInstall records no undo step of its own', () => {
    const t = tool(), id = put(t, 'blue-diamond-spruce');
    t.setCustomInstall(id, 3); t.undo(); expect(t.symbols.placed[id]).toBeDefined();
    expect((t as unknown as { history: History<unknown> }).history.canUndo).toBe(false);
  });
  test('applyToSpecies copies the container to the others, leaves other species, one undo', () => {
    const t = tool(), [a, b, c] = spruces(t), lav = put(t, 'lavender');
    t.setContainer(a, '5 gal');
    expect(t.applyToSpecies(a)).toBe(2);
    expect(t.symbols.placed[b].container).toBe('5 gal'); expect(t.symbols.placed[c].container).toBe('5 gal');
    expect(t.symbols.placed[lav].container).toBeUndefined();
    t.undo(); expect(t.symbols.placed[b].container).toBeUndefined(); expect(t.symbols.placed[c].container).toBeUndefined();
    expect(t.symbols.placed[a].container).toBe('5 gal');
  });
  test('applyToSpecies on a lone plant returns 0 and records nothing', () => {
    const t = tool(), id = put(t, 'blue-diamond-spruce');
    expect(t.applyToSpecies(id)).toBe(0); expect((t as unknown as { history: History<unknown> }).history.canUndo).toBe(false);
  });
  test('applyToSpecies carries a custom size, and clears both when the source has neither', () => {
    const t = tool(), [a, b, c] = spruces(t);
    t.setContainer(b, '5 gal'); t.setCustomInstall(a, 3); t.applyToSpecies(a);
    expect(t.symbols.placed[b]).toMatchObject({ customInstall: 3 }); expect(t.symbols.placed[b].container).toBeUndefined();
    t.setContainer(a, '5 gal'); t.setContainer(a, '6 ft B&B'); delete t.symbols.placed[a].container;
    expect(t.applyToSpecies(a)).toBe(2);
    expect(t.symbols.placed[c].customInstall).toBeUndefined(); expect(t.symbols.placed[c].container).toBeUndefined();
  });
});
