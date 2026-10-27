import { describe, expect, test } from 'vitest';
import { OutlineTool } from './outline-ui';
import { GESTURE, HIT } from './overlay-tokens';
import { History } from './history';
import { SymbolLayer } from './symbol-layer';
import { LineLayer } from './line-layer';
import { plantDiameter } from './plant-size';
import { symbolById } from './symbols';
import type { PlanState } from './plan-model';
import { bulgeToward } from './outline';

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
  test('corn placed first still stores Install, so a later oak draws at install size', () => {
    const t = tool(); place(t, 'corn');
    expect(t.state().plantSizeView).toBe('install');
    place(t, 'oak'); expect(t.plantView).toBe('install'); expect(t.state().plantSizeView).toBe('install');
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
  // The handle's hit area clears the plant's own (its radius, at least 14 px): its centre is that far out plus the 22 px hit radius.
  const handleAt = (dFt: number) => ({ x: 100 + Math.max(dFt / FT_PER_PT / 2, 14) + HIT.sizeHandle, y: 100 });
  function tool(view: 'install' | 'mature' = 'install', symbol = 'blue-diamond-spruce'): { t: OutlineTool; id: string; handle: { x: number; y: number } } {
    const t = Object.create(OutlineTool.prototype) as OutlineTool;
    const id_ = (p: { x: number; y: number }) => ({ x: p.x, y: p.y });
    Object.assign(t, {
      host: { toPage: id_, toScreen: id_, pxPerPt: () => 1, historyChanged: () => {}, changed: () => {} }, history: new History(), symbols: new SymbolLayer(), lines: new LineLayer(),
      outlines: {}, refs: [], hiddenLayers: new Set(), hiddenSections: new Set(), magnifier: {}, revision: 0, update: () => {}, render: () => {}, hideTip: () => {},
      placing: null, lineDraft: null, drawing: null, selected: null, selectedCorner: null, selectedEdge: null, selectedLine: null, selectedLinePoint: null,
      hoverCorner: null, drag: null, cal: { ftPerPt: FT_PER_PT }, plantSizeView: view, visible: new Map(), symbolShown: () => true, lineShown: () => true,
    });
    const id = t.symbols.place(symbol, { x: 100, y: 100 });
    t.selectedSymbol = id;
    return { t, id, handle: handleAt(plantDiameter(symbol, {}, view)) };
  }
  const drag = (t: OutlineTool, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const took = t.pointerDown(from, 'mouse'); t.pointerMove(to); t.pointerUp(); return took;
  };
  const canUndo = (t: OutlineTool) => (t as unknown as { history: History<unknown> }).history.canUndo;

  test('dragging the handle out by 1 ft grows the plant by 2 ft as a custom size; one undo restores the container', () => {
    const { t, id } = tool();
    t.setContainer(id, '5 gal'); (t as unknown as { history: History<unknown> }).history.clear();
    const handle = handleAt(plantDiameter('blue-diamond-spruce', { container: '5 gal' }, 'install')); // the 5 gal plant's handle
    const to = { x: handle.x + 1 / FT_PER_PT, y: handle.y };
    expect(drag(t, handle, to)).toBe(true);
    expect(t.symbols.placed[id].customInstall).toBeCloseTo(plantDiameter('blue-diamond-spruce', { container: '5 gal' }, 'install') + 2); // grows by 2 ft, no jump from where the handle was grabbed
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
  test('a small plant (1 ft, 10 px across) dragged from its centre moves, not resizes; its handle still resizes', () => {
    const { t, id } = tool('install', 'lilacs');
    t.setContainer(id, '1 gal'); (t as unknown as { history: History<unknown> }).history.clear();
    expect(drag(t, { x: 100, y: 100 }, { x: 130, y: 100 })).toBe(true);
    expect(t.symbols.placed[id]).toMatchObject({ x: 130, y: 100, container: '1 gal' });
    expect(t.symbols.placed[id].customInstall).toBeUndefined();
    t.undo(); expect(t.symbols.placed[id]).toMatchObject({ x: 100, y: 100 });
    const h = handleAt(1);
    drag(t, h, { x: h.x + 1 / FT_PER_PT, y: h.y });
    expect(t.symbols.placed[id].customInstall).toBeCloseTo(3); // 1 ft out: 1 + 2 ft
    expect(t.symbols.placed[id]).toMatchObject({ x: 100, y: 100 });
  });
  test('a plain tap on the handle off the plant still deselects, as a tap there did before', () => {
    const { t, handle } = tool();
    Object.assign(t, { featureAt: () => null });
    expect(t.pointerDown(handle, 'mouse')).toBe(true); t.pointerUp();
    expect(t.selectedSymbol).toBeNull();
  });
  test('a plain tap on the handle over another plant selects that plant', () => {
    const { t, id, handle } = tool();
    const other = t.symbols.place('lavender', handle);
    t.pointerDown(handle, 'mouse'); t.pointerUp();
    expect(t.selectedSymbol).toBe(other); expect(t.symbols.placed[id].customInstall).toBeUndefined();
  });
  test('dense planting: pressing a neighbour inside the selected plant\'s handle area moves the neighbour, not the size', () => {
    const { t, id, handle } = tool();
    const b = t.symbols.place('blue-diamond-spruce', { x: handle.x + 4, y: handle.y }); // B's circle covers the handle point
    expect(drag(t, handle, { x: handle.x + 30, y: handle.y + 10 })).toBe(true);
    expect(t.symbols.placed[id].customInstall).toBeUndefined(); expect(t.symbols.placed[id]).toMatchObject({ x: 100, y: 100 });
    expect(t.selectedSymbol).toBe(b);
    expect(t.symbols.placed[b]).toMatchObject({ x: handle.x + 34, y: handle.y + 10 });
  });
  test('dense planting: with nothing else under it, the handle still resizes', () => {
    const { t, id, handle } = tool();
    t.symbols.place('blue-diamond-spruce', { x: handle.x + 200, y: handle.y }); // a neighbour, but not under the press
    drag(t, handle, { x: handle.x + 10, y: handle.y });
    expect(t.symbols.placed[id].customInstall).toBeDefined(); expect(t.selectedSymbol).toBe(id);
  });
  test('no handle in Preview', () => {
    const { t, id, handle } = tool(); t.previewing = true;
    expect(drag(t, handle, { x: handle.x + 10, y: handle.y })).toBe(false); expect(t.symbols.placed[id].customInstall).toBeUndefined();
  });
  test('no handle in the Mature view: the same drag does not set a size', () => {
    const { t, id, handle } = tool('mature');
    drag(t, handle, { x: handle.x + 10, y: handle.y });
    expect(t.symbols.placed[id].customInstall).toBeUndefined();
  });
  test('the handle keeps its grab offset: no move leaves the size; 1 ft out grows it by 2 ft; inward stops at 0.25', async () => {
    const { handleDiameterFt, handleGrabOffsetFt } = await import('./plant-size');
    const c = { x: 0, y: 0 }, grab = { x: 25.5, y: 0 }; // 3 pt outside a 4.5 ft plant at 0.1 ft/pt
    const off = handleGrabOffsetFt(c, grab, 0.1, 4.5);
    expect(off).toBeCloseTo(0.3);
    expect(handleDiameterFt(c, grab, 0.1, off)).toBeCloseTo(4.5);
    expect(handleDiameterFt(c, { x: 35.5, y: 0 }, 0.1, off)).toBeCloseTo(6.5);
    expect(handleDiameterFt(c, { x: 0, y: 2 }, 0.1, off)).toBe(0.25);
  });
  test('handleDiameterFt is twice the page distance in feet, floored at 0.25', async () => {
    const { handleDiameterFt } = await import('./plant-size');
    expect(handleDiameterFt({ x: 0, y: 0 }, { x: 30, y: 40 }, 0.1)).toBeCloseTo(10);
    expect(handleDiameterFt({ x: 0, y: 0 }, { x: 0, y: 0 }, 0.1)).toBe(0.25);
  });
});

describe('Surface tool and material picks', () => {
  /** A tool with a closed plot boundary and no DOM: record/update only count. */
  function bare() {
    const tool = Object.create(OutlineTool.prototype) as OutlineTool;
    const internals = tool as unknown as { record: () => void; update: () => void };
    const calls = { record: 0 };
    Object.assign(tool, {
      outlines: { boundary: { id: 'boundary', kind: 'boundary', name: 'Plot boundary', pts: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], closed: true } },
      drawing: null, replaced: null, selected: null, selectedCorner: null, selectedEdge: null, selectedSymbol: null, placing: null,
      lineDraft: null, selectedLine: null, selectedLinePoint: null, lastLineTap: null, lastTap: null, refs: [], cal: null,
      pendingMaterial: null, hiddenLayers: new Set(), hiddenSections: new Set(), shapePrefs: { outline: 'freehand', surface: 'rect' },
      host: { toast: () => {} },
    });
    internals.record = () => { calls.record++; };
    internals.update = () => {};
    return { tool, calls };
  }
  const square = [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }];

  test('startSurfaceDrawing starts an unassigned "Surface N" and keeps a surface already being drawn', () => {
    const { tool } = bare();
    tool.startSurfaceDrawing();
    expect(tool.drawing).toBe('s1');
    expect(tool.outlines.s1).toMatchObject({ kind: 'surface', name: 'Surface 1', closed: false });
    expect(tool.outlines.s1!.material).toBeUndefined();
    tool.startSurfaceDrawing();
    expect(tool.drawing).toBe('s1');
    expect(Object.keys(tool.outlines)).toEqual(['boundary', 's1']);
  });

  test('a material picked while a surface is drawn applies to it at once, as one undo step', () => {
    const { tool, calls } = bare();
    tool.startSurfaceDrawing();
    const before = calls.record;
    tool.pickMaterial('premium-sod');
    expect(calls.record).toBe(before + 1);
    expect(tool.outlines.s1).toMatchObject({ material: 'premium-sod', name: 'Premium sod' });
    expect(tool.pendingMaterial).toBeNull();
  });

  test('a material picked replaces an unknown material on the surface being drawn', () => {
    const { tool } = bare();
    tool.startSurfaceDrawing();
    Object.assign(tool.outlines.s1!, { material: 'removed-material', name: 'Removed material' });
    expect(() => tool.pickMaterial('premium-sod')).not.toThrow();
    expect(tool.outlines.s1).toMatchObject({ material: 'premium-sod', name: 'Premium sod' });
  });

  test('a material picked with nothing drawn becomes pending and starts a surface with it', () => {
    const { tool } = bare();
    tool.pickMaterial('premium-sod');
    expect(tool.drawing).toBe('s1');
    expect(tool.outlines.s1).toMatchObject({ material: 'premium-sod', name: 'Premium sod' });
    expect(tool.pendingMaterial).toBeNull();
  });

  test('a pending material goes to the next surface closed without one', () => {
    const { tool } = bare();
    tool.startSurfaceDrawing();
    tool.pendingMaterial = 'premium-sod';
    tool.outlines.s1!.pts = square.map(p => ({ ...p }));
    tool.close();
    expect(tool.outlines.s1).toMatchObject({ closed: true, material: 'premium-sod', name: 'Premium sod' });
    expect(tool.pendingMaterial).toBeNull();
  });

  test('closing without a pending material leaves the zone unassigned; a pick then assigns it', () => {
    const { tool } = bare();
    tool.startSurfaceDrawing();
    tool.outlines.s1!.pts = square.map(p => ({ ...p }));
    tool.close();
    expect(tool.outlines.s1).toMatchObject({ closed: true, name: 'Surface 1' });
    expect(tool.outlines.s1!.material).toBeUndefined();
    expect(tool.selected).toBe('s1');
    tool.pickMaterial('premium-sod');
    expect(tool.outlines.s1).toMatchObject({ material: 'premium-sod', name: 'Premium sod' });
    expect(tool.drawing).toBeNull();
  });

  test('starting a line or placing cancels the surface draft', () => {
    const { tool } = bare();
    tool.startSurfaceDrawing();
    tool.startLine('wood-privacy-fence');
    expect(tool.drawing).toBeNull();
    expect(tool.outlines.s1).toBeUndefined();
    expect(tool.lineDraft?.item).toBe('wood-privacy-fence');
    tool.startSurfaceDrawing();
    expect(tool.lineDraft).toBeNull();
    expect(tool.drawing).toBe('s1');
  });
});

describe('Duplicate as surface', () => {
  /** A tool with real undo history, a closed boundary, a patio, the House and one surface; no DOM. */
  function withHistory() {
    const tool = Object.create(OutlineTool.prototype) as OutlineTool;
    const square = [{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }, { x: 10, y: 20 }];
    Object.assign(tool, {
      outlines: {
        boundary: { id: 'boundary', kind: 'boundary', name: 'Plot boundary', pts: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], closed: true },
        f2: { id: 'f2', kind: 'feature', name: 'Patio', pts: square, bulges: [0, 0.3, 0, 0], closed: true },
        f3: { id: 'f3', kind: 'feature', name: 'House', pts: square, bulges: [0, 0, 0, 0], closed: true },
        s1: { id: 's1', kind: 'surface', name: 'Premium sod', material: 'premium-sod', pts: square, bulges: [0, 0, 0, 0], closed: true },
      },
      history: new History(), revision: 0, lastNudge: null,
      symbols: { placed: {} }, lines: { placed: {} }, magnifier: { hidden: true }, hoverAt: null, drag: null,
      drawing: null, replaced: null, selected: 'f2', selectedCorner: null, selectedEdge: null, selectedSymbol: null, placing: null,
      lineDraft: null, selectedLine: null, selectedLinePoint: null, lastLineTap: null, lastTap: null, refs: [], cal: null,
      pendingMaterial: null, hiddenLayers: new Set(), hiddenSections: new Set(), host: { toast: () => {} },
    });
    (tool as unknown as { update: () => void }).update = () => {};
    return tool;
  }

  test('copies a custom outline into a new unassigned surface above the others, selected; the outline stays', () => {
    const tool = withHistory();
    const id = tool.duplicateAsSurface('f2');
    expect(id).toBe('s2');
    const s = tool.outlines[id!]!;
    expect(s).toMatchObject({ kind: 'surface', closed: true, pts: tool.outlines.f2!.pts, bulges: [0, 0.3, 0, 0] });
    expect(s.material).toBeUndefined();
    expect(s.pts).not.toBe(tool.outlines.f2!.pts); // a copy, not shared
    expect(tool.outlines.f2).toMatchObject({ kind: 'feature', name: 'Patio' });
    expect(tool.selected).toBe(id);
    const surfaces = Object.keys(tool.outlines).filter(k => tool.outlines[k]!.kind === 'surface');
    expect(surfaces).toEqual(['s2', 's1']);
  });

  test('one undo removes only the copy', () => {
    const tool = withHistory();
    const before = structuredClone(tool.outlines);
    tool.duplicateAsSurface('f2');
    tool.undo();
    expect(tool.outlines).toEqual(before);
    expect(tool.selected).toBe('f2');
  });

  test('returns null on the House, the boundary and an unknown id, changing nothing', () => {
    const tool = withHistory();
    const before = structuredClone(tool.outlines);
    expect(tool.duplicateAsSurface('f3')).toBeNull();
    expect(tool.duplicateAsSurface('boundary')).toBeNull();
    expect(tool.duplicateAsSurface('nope')).toBeNull();
    expect(tool.outlines).toEqual(before);
  });
});

describe('Drawing a line: a drag bends the segment into the point', () => {
  function drafting() {
    const t = Object.create(OutlineTool.prototype) as OutlineTool;
    const id_ = (p: { x: number; y: number }) => ({ x: p.x, y: p.y });
    Object.assign(t, {
      host: { toPage: id_, toScreen: id_, pxPerPt: () => 1, toast: () => {}, historyChanged: () => {}, changed: () => {} }, history: new History(), symbols: new SymbolLayer(), lines: new LineLayer(),
      outlines: {}, refs: [], hiddenLayers: new Set(), hiddenSections: new Set(), magnifier: {}, revision: 0, update: () => {}, render: () => {}, hideTip: () => {},
      placing: null, drawing: null, selected: null, selectedCorner: null, selectedEdge: null, selectedSymbol: null, selectedLine: null, selectedLinePoint: null,
      lastLineTap: null, lastTap: null, hoverCorner: null, drag: null, cal: null, shiftKey: false,
    });
    t.startLine('wood-privacy-fence');
    return t;
  }
  const press = (t: OutlineTool, at: { x: number; y: number }, to?: { x: number; y: number }) => {
    const took = t.pointerDown(at, 'mouse'); if (to) t.pointerMove(to); t.pointerUp(); return took;
  };

  test('a press with no drag still places a sharp point (the tool takes the press, the release places)', () => {
    const t = drafting();
    expect(press(t, { x: 0, y: 0 })).toBe(true);
    expect(press(t, { x: 100, y: 0 })).toBe(true);
    expect(t.lineDraft!.points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    expect(t.lineDraft!.bulges.every(b => b === 0)).toBe(true);
  });

  test('dragging from the placement point puts the point where pressed and bends the segment into it through the release', () => {
    const t = drafting();
    press(t, { x: 0, y: 0 });
    press(t, { x: 100, y: 0 }, { x: 50, y: 40 });
    expect(t.lineDraft!.points[1]).toEqual({ x: 100, y: 0 });
    expect(t.lineDraft!.bulges[0]).toBeCloseTo(bulgeToward({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 40 }));
    expect(t.lineDraft!.bulges[0]).not.toBe(0);
  });

  test('a drag on the first point places it sharp (there is no segment to bend yet)', () => {
    const t = drafting();
    press(t, { x: 0, y: 0 }, { x: 60, y: 60 });
    expect(t.lineDraft!.points).toEqual([{ x: 0, y: 0 }]);
    expect(t.lineDraft!.bulges).toEqual([]);
  });

  test('a second finger abandons the drag without placing anything', () => {
    const t = drafting();
    press(t, { x: 0, y: 0 });
    t.pointerDown({ x: 100, y: 0 }, 'touch'); t.pointerMove({ x: 50, y: 40 }); t.cancelPointer();
    expect(t.lineDraft!.points).toHaveLength(1);
  });

  test('undo takes back the point and its bend together; Done saves the bends on the line', () => {
    const t = drafting();
    press(t, { x: 0, y: 0 }); press(t, { x: 100, y: 0 }, { x: 50, y: 40 }); press(t, { x: 200, y: 0 });
    t.undo();
    expect(t.lineDraft!.points).toHaveLength(2);
    expect(t.lineDraft!.bulges).toHaveLength(1);
    t.finishLine();
    const l = Object.values(t.lines.placed)[0];
    expect(l.bulges?.[0]).toBeCloseTo(bulgeToward({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 40 }));
    expect(l.points).toHaveLength(2);
  });

  test('a tiny wobble during a press is a tap, not a bend', () => {
    const t = drafting();
    press(t, { x: 0, y: 0 }); press(t, { x: 100, y: 0 }, { x: 101, y: 2 });
    expect(t.lineDraft!.bulges[0]).toBe(0);
  });
});
