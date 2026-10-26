import { describe, expect, test } from 'vitest';
import { OutlineTool } from './outline-ui';
import { GESTURE } from './overlay-tokens';

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
