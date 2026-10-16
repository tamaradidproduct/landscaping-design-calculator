import { describe, expect, test } from 'vitest';
import type { Outline } from './outline';
import { groupCounts, groupToOpen, readOpen } from './sections';

const o = (id: string, kind: Outline['kind'], closed = true): Outline => ({ id, kind, name: id, pts: [], closed });
const all = Object.fromEntries([o('boundary', 'boundary'), o('f1', 'feature'), o('s1', 'surface'), o('s2', 'surface'), o('f2', 'feature', false)].map(x => [x.id, x]));

describe('collapsible Layers sections', () => {
  test('counts: Outlines = the boundary + features (the plot plan is not counted), Surfaces = zones', () => {
    expect(groupCounts(Object.values(all))).toEqual({ outlines: 3, surfaces: 2 });
  });
  test('a layer that becomes selected or starts drawing opens its section; otherwise nothing changes', () => {
    expect(groupToOpen(null, 's1', all)).toBe('surfaces');
    expect(groupToOpen('s1', 'boundary', all)).toBe('outlines');
    expect(groupToOpen('f1', 'f1', all)).toBeNull(); // same layer: the contractor may have collapsed it on purpose
    expect(groupToOpen('f1', null, all)).toBeNull();
  });
  test('saved open/closed state: both open by default, bad storage ignored', () => {
    expect(readOpen(null)).toEqual({ outlines: true, surfaces: true });
    expect(readOpen('{"outlines":false}')).toEqual({ outlines: false, surfaces: true });
    expect(readOpen('not json')).toEqual({ outlines: true, surfaces: true });
  });
});
