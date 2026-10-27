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
  test('useCustomSize stores the current install diameter; undo restores the container', () => {
    const t = tool(), id = put(t, 'blue-diamond-spruce');
    t.setContainer(id, '5 gal'); t.useCustomSize(id);
    expect(t.symbols.placed[id].customInstall).toBe(plantDiameter('blue-diamond-spruce', { container: '5 gal' }, 'install'));
    expect(t.symbols.placed[id].container).toBeUndefined();
    t.undo(); expect(t.symbols.placed[id].container).toBe('5 gal'); expect(t.symbols.placed[id].customInstall).toBeUndefined();
  });
  test('useCustomSize is a no-op for corn and for an already-custom plant', () => {
    const t = tool(), corn = put(t, 'corn'), id = put(t, 'blue-diamond-spruce');
    t.useCustomSize(corn); expect(t.symbols.placed[corn].customInstall).toBeUndefined();
    expect((t as unknown as { history: History<unknown> }).history.canUndo).toBe(false);
    t.setCustomInstall(id, 3); t.useCustomSize(id); t.useCustomSize('nope');
    expect(t.symbols.placed[id].customInstall).toBe(3);
    expect((t as unknown as { history: History<unknown> }).history.canUndo).toBe(false);
  });
});

describe('plant size handle', () => {
  // 1 screen px = 1 page pt = 0.1 ft. The spruce sits at (100, 100); its default install size is the last container.
  const FT_PER_PT = 0.1;
  function tool(view: 'install' | 'mature' = 'install'): { t: OutlineTool; id: string; handle: { x: number; y: number } } {
    const t = Object.create(OutlineTool.prototype) as OutlineTool;
    const id_ = (p: { x: number; y: number }) => ({ x: p.x, y: p.y });
    Object.assign(t, {
      host: { toPage: id_, toScreen: id_, pxPerPt: () => 1, historyChanged: () => {}, changed: () => {} }, history: new History(), symbols: new SymbolLayer(), lines: new LineLayer(),
      outlines: {}, refs: [], hiddenLayers: new Set(), hiddenSections: new Set(), magnifier: {}, revision: 0, update: () => {}, render: () => {}, hideTip: () => {},
      placing: null, lineDraft: null, drawing: null, selected: null, selectedCorner: null, selectedEdge: null, selectedLine: null, selectedLinePoint: null,
      hoverCorner: null, drag: null, cal: { ftPerPt: FT_PER_PT }, plantSizeView: view, visible: new Map(), symbolShown: () => true, lineShown: () => true,
    });
    const id = t.symbols.place('blue-diamond-spruce', { x: 100, y: 100 });
    t.selectedSymbol = id;
    const r = plantDiameter('blue-diamond-spruce', {}, view) / FT_PER_PT / 2 + 3; // the halo's radius (px)
    return { t, id, handle: { x: 100 + r, y: 100 } };
  }
  const drag = (t: OutlineTool, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const took = t.pointerDown(from, 'mouse'); t.pointerMove(to); t.pointerUp(); return took;
  };
  const canUndo = (t: OutlineTool) => (t as unknown as { history: History<unknown> }).history.canUndo;

  test('dragging the handle out by 1 ft sets a custom diameter of twice the distance to the centre; one undo restores the container', () => {
    const { t, id, handle } = tool();
    t.setContainer(id, '5 gal'); (t as unknown as { history: History<unknown> }).history.clear();
    const to = { x: handle.x + 1 / FT_PER_PT, y: handle.y };
    expect(drag(t, handle, to)).toBe(true);
    expect(t.symbols.placed[id].customInstall).toBeCloseTo(2 * (to.x - 100) * FT_PER_PT);
    expect(t.symbols.placed[id].container).toBeUndefined();
    expect(t.symbols.placed[id]).toMatchObject({ x: 100, y: 100 }); // the plant itself did not move
    t.undo();
    expect(t.symbols.placed[id].container).toBe('5 gal'); expect(t.symbols.placed[id].customInstall).toBeUndefined();
    expect(canUndo(t)).toBe(false);
  });
  test('a drag of many moves is still one undo step', () => {
    const { t, id, handle } = tool();
    t.pointerDown(handle, 'mouse');
    for (let k = 1; k <= 5; k++) t.pointerMove({ x: handle.x + k * 4, y: handle.y });
    t.pointerUp();
    expect(t.symbols.placed[id].customInstall).toBeDefined();
    t.undo(); expect(t.symbols.placed[id].customInstall).toBeUndefined(); expect(canUndo(t)).toBe(false);
  });
  test('past mature the size clamps at the mature spread; below 0.25 ft it stops at 0.25', () => {
    const { t, id, handle } = tool();
    drag(t, handle, { x: 5000, y: 100 });
    expect(t.symbols.placed[id].customInstall).toBe(symbolById('blue-diamond-spruce')!.size.w);
    const u = tool();
    drag(u.t, u.handle, { x: 100.5, y: 100 });
    expect(u.t.symbols.placed[u.id].customInstall).toBe(0.25);
  });
  test('a tap on the handle changes nothing and records nothing', () => {
    const { t, id, handle } = tool();
    drag(t, handle, handle);
    expect(t.symbols.placed[id].customInstall).toBeUndefined(); expect(canUndo(t)).toBe(false);
  });
  test('no handle in the Mature view: the same drag does not set a size', () => {
    const { t, id, handle } = tool('mature');
    drag(t, handle, { x: handle.x + 10, y: handle.y });
    expect(t.symbols.placed[id].customInstall).toBeUndefined();
  });
  test('handleDiameterFt is twice the page distance in feet, floored at 0.25', async () => {
    const { handleDiameterFt } = await import('./plant-size');
    expect(handleDiameterFt({ x: 0, y: 0 }, { x: 30, y: 40 }, 0.1)).toBeCloseTo(10);
    expect(handleDiameterFt({ x: 0, y: 0 }, { x: 0, y: 0 }, 0.1)).toBe(0.25);
  });
});
