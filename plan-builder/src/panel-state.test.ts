import { describe, expect, test } from 'vitest';
import { outlinesHints, panelState, visibleGroups } from './panel-state';

const all = { symbols: 2, lines: 2, surfaces: 2, outlines: 2 };
describe('panelState', () => {
  test('locked until the boundary is closed, then needs the scale, then ready', () => {
    expect(panelState({ boundaryClosed: false, scaleSet: false, placed: 0 })).toBe('locked');
    expect(panelState({ boundaryClosed: true, scaleSet: false, placed: 0 })).toBe('needs-scale');
    expect(panelState({ boundaryClosed: true, scaleSet: true, placed: 0 })).toBe('ready');
  });
  test('older plans: any placed item unlocks, with or without a scale or boundary', () => {
    expect(panelState({ boundaryClosed: true, scaleSet: false, placed: 3 })).toBe('ready');
    expect(panelState({ boundaryClosed: false, scaleSet: false, placed: 2 })).toBe('ready');
  });
});
describe('visibleGroups', () => {
  test('locked and needs-scale show Outlines only', () => {
    expect(visibleGroups('locked', all)).toEqual(['outlines']);
    expect(visibleGroups('needs-scale', all)).toEqual(['outlines']);
  });
  test('ready hides empty sections, keeps Outlines, in the fixed order', () => {
    expect(visibleGroups('ready', { symbols: 0, lines: 2, surfaces: 0, outlines: 0 })).toEqual(['lines', 'outlines']);
    expect(visibleGroups('ready', all)).toEqual(['symbols', 'lines', 'surfaces', 'outlines']);
  });
});
describe('outlinesHints', () => {
  test('wording per state, none while drawing or ready', () => {
    expect(outlinesHints('locked', false)).toEqual(['Outline the plot boundary.']);
    expect(outlinesHints('needs-scale', false)).toEqual(['Tap an edge and type its printed length to set the scale.', 'Then outline the house and other existing features.']);
    expect(outlinesHints('locked', true)).toEqual([]);
    expect(outlinesHints('ready', false)).toEqual([]);
  });
});
