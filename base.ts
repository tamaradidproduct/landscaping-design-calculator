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
