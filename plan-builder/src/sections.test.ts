import { describe, expect, test } from 'vitest';
import type { Outline } from './outline';
import { DEFAULT_SECTION_ORDER, GROUPS, groupAvailable, groupCounts, groupToOpen, isHidden, isLineHidden, isSectionOrder, isSymbolHidden, moveAmong, moveLabel, moveSection, paintOrder, readOpen, type Group } from './sections';

const o = (id: string, kind: Outline['kind'], closed = true): Outline => ({ id, kind, name: id, pts: [], closed });
const all = Object.fromEntries([o('boundary', 'boundary'), o('f1', 'feature'), o('s1', 'surface'), o('s2', 'surface'), o('f2', 'feature', false)].map(x => [x.id, x]));

describe('collapsible Layers sections', () => {
  test('counts: Outlines = the boundary + features (the plot plan is not counted), Surfaces = zones', () => {
    expect(groupCounts(Object.values(all))).toEqual({ outlines: 3, surfaces: 2, symbols: 0, lines: 0 });
    expect(groupCounts(Object.values(all), 4)).toEqual({ outlines: 3, surfaces: 2, symbols: 4, lines: 0 });
  });
  test('a layer that becomes selected or starts drawing opens its section; otherwise nothing changes', () => {
    expect(groupToOpen(null, 's1', all)).toBe('surfaces');
    expect(groupToOpen('s1', 'boundary', all)).toBe('outlines');
    expect(groupToOpen('f1', 'f1', all)).toBeNull(); // same layer: the contractor may have collapsed it on purpose
    expect(groupToOpen('f1', null, all)).toBeNull();
  });
  test('saved open/closed state: both open by default, bad storage ignored', () => {
    expect(readOpen(null)).toEqual({ outlines: true, surfaces: true, symbols: true, lines: true });
    expect(readOpen('{"outlines":false}')).toEqual({ outlines: false, surfaces: true, symbols: true, lines: true });
    expect(readOpen('not json')).toEqual({ outlines: true, surfaces: true, symbols: true, lines: true });
  });
});

describe('hiding layers and sections', () => {
  const boundary = { id: 'b', kind: 'boundary', name: 'Plot boundary', pts: [], closed: true } as Outline;
  const house = { id: 'f1', kind: 'feature', name: 'House', pts: [], closed: true } as Outline;
  const lawn = { id: 's1', kind: 'surface', name: 'Lawn', pts: [], closed: true } as Outline;
  const none = new Set<never>();
  test('nothing hidden by default', () => expect([boundary, house, lawn].some(o => isHidden(o, none, none))).toBe(false));
  test('a hidden layer is hidden, its neighbours are not', () => {
    expect(isHidden(house, new Set(['f1']), none)).toBe(true);
    expect(isHidden(lawn, new Set(['f1']), none)).toBe(false);
  });
  test('a hidden section hides the plot boundary and features together, or the surfaces', () => {
    const g = new Set<Group>(['outlines']);
    expect([isHidden(boundary, none, g), isHidden(house, none, g), isHidden(lawn, none, g)]).toEqual([true, true, false]);
    expect(isHidden(lawn, none, new Set<Group>(['surfaces']))).toBe(true);
  });
  test('showing a section again restores each layer\'s own state', () => {
    const layers = new Set(['f1']);
    expect(isHidden(house, layers, new Set<Group>(['outlines']))).toBe(true);
    expect(isHidden(house, layers, none)).toBe(true); // still hidden itself
    expect(isHidden(boundary, layers, none)).toBe(false);
  });
});

describe('hiding placed symbols', () => {
  const none = new Set<never>();
  test('a symbol is hidden by its own id or by the symbols section, not by the others', () => {
    expect(isSymbolHidden({ id: 'y1' }, none, none)).toBe(false);
    expect(isSymbolHidden({ id: 'y1' }, new Set(['y1']), none)).toBe(true);
    expect(isSymbolHidden({ id: 'y2' }, new Set(['y1']), none)).toBe(false);
    expect(isSymbolHidden({ id: 'y1' }, none, new Set<Group>(['symbols']))).toBe(true);
    expect(isSymbolHidden({ id: 'y1' }, none, new Set<Group>(['surfaces', 'outlines']))).toBe(false);
  });
  test('the open state covers the symbols section too (open by default)', () => {
    expect(readOpen(null)).toEqual({ outlines: true, surfaces: true, symbols: true, lines: true });
    expect(readOpen(JSON.stringify({ symbols: false }))).toEqual({ outlines: true, surfaces: true, symbols: false, lines: true });
  });
});

describe('lines section', () => {
  const none = new Set<never>();
  test('group order is surfaces, lines, symbols, outlines', () => expect(GROUPS).toEqual(['surfaces', 'lines', 'symbols', 'outlines']));
  test('a line is hidden by its own id or by the lines section, not by the others', () => {
    expect(isLineHidden({ id: 'l1' }, none, none)).toBe(false);
    expect(isLineHidden({ id: 'l1' }, new Set(['l1']), none)).toBe(true);
    expect(isLineHidden({ id: 'l2' }, new Set(['l1']), none)).toBe(false);
    expect(isLineHidden({ id: 'l1' }, none, new Set<Group>(['lines']))).toBe(true);
    expect(isLineHidden({ id: 'l1' }, none, new Set<Group>(['symbols', 'surfaces', 'outlines']))).toBe(false);
  });
  test('counts include the lines passed in; the section is open by default', () => {
    expect(groupCounts(Object.values(all), 2, 3).lines).toBe(3);
    expect(readOpen(null).lines).toBe(true);
  });
});

describe('which sections show', () => {
  const none = { outlines: 0, surfaces: 0, symbols: 0, lines: 0 }, some = { ...none, symbols: 2, lines: 1, surfaces: 1 };
  test('Surfaces, Lines and Plants & objects wait for a closed plot boundary', () => {
    for (const g of ['surfaces', 'lines', 'symbols'] as const) { expect(groupAvailable(g, false, none), g).toBe(false); expect(groupAvailable(g, true, none), g).toBe(true); }
  });
  test('a plan that already has surfaces, lines or symbols always shows them', () => {
    for (const g of ['surfaces', 'lines', 'symbols'] as const) expect(groupAvailable(g, false, some), g).toBe(true);
  });
  test('Outlines always shows: it is where the plot boundary is added', () => {
    expect(groupAvailable('outlines', false, none)).toBe(true);
  });
});

describe('section order', () => {
  test('default, top to bottom: Plants & objects, Lines, Surfaces, Outlines (Outlines stays last in the panel)', () => {
    expect(DEFAULT_SECTION_ORDER).toEqual(['symbols', 'lines', 'surfaces', 'outlines']);
  });
  test('moveSection swaps with the neighbour above or below', () => {
    expect(moveSection(DEFAULT_SECTION_ORDER, 'surfaces', -1)).toEqual(['symbols', 'surfaces', 'lines', 'outlines']);
    expect(moveSection(DEFAULT_SECTION_ORDER, 'lines', 1)).toEqual(['symbols', 'surfaces', 'lines', 'outlines']);
  });
  test('at the ends, or for an unknown group, there is nothing to move (null)', () => {
    expect(moveSection(DEFAULT_SECTION_ORDER, 'symbols', -1)).toBeNull(); expect(moveSection(DEFAULT_SECTION_ORDER, 'outlines', 1)).toBeNull();
    expect(moveSection(DEFAULT_SECTION_ORDER, 'nope' as Group, 1)).toBeNull();
  });
  test('moveSection does not change its input', () => {
    const o = [...DEFAULT_SECTION_ORDER]; moveSection(o, 'surfaces', -1); expect(o).toEqual(DEFAULT_SECTION_ORDER);
  });
  test('paintOrder is bottom to top: the reverse', () => {
    expect(paintOrder(DEFAULT_SECTION_ORDER)).toEqual(['outlines', 'surfaces', 'lines', 'symbols']);
  });
  test('isSectionOrder accepts every permutation of the four groups and nothing else', () => {
    expect(isSectionOrder(['surfaces', 'lines', 'symbols', 'outlines'])).toBe(true); expect(isSectionOrder([...DEFAULT_SECTION_ORDER])).toBe(true);
    expect(isSectionOrder(['symbols', 'symbols', 'lines', 'surfaces'])).toBe(false); expect(isSectionOrder(['symbols', 'outlines', 'lines'])).toBe(false);
    expect(isSectionOrder(['symbols', 'outlines', 'lines', 'surfaces', 'x'])).toBe(false); expect(isSectionOrder(['symbols', 'outlines', 'lines', 'nope'])).toBe(false);
    expect(isSectionOrder('symbols')).toBe(false); expect(isSectionOrder(undefined)).toBe(false);
  });
});

describe('move button labels', () => {
  test('say which section and which way', () => {
    expect(moveLabel('symbols', -1)).toBe('Move Plants & objects up'); expect(moveLabel('lines', 1)).toBe('Move Lines down');
    expect(moveLabel('outlines', -1)).toBe('Move Outlines up'); expect(moveLabel('surfaces', 1)).toBe('Move Surfaces down');
  });
});

describe('moving among the sections that are showing', () => {
  const order = DEFAULT_SECTION_ORDER; // symbols, lines, surfaces, outlines
  test('with every section showing it is moveSection', () => {
    expect(moveAmong(order, 'surfaces', -1, [...order])).toEqual(moveSection(order, 'surfaces', -1));
  });
  test('a hidden section is skipped: Outlines moves up past Lines and Plants & objects to swap with Surfaces', () => {
    const showing: Group[] = ['surfaces', 'outlines']; // no boundary yet: Lines and Plants & objects are not shown
    expect(moveAmong(order, 'outlines', -1, showing)).toEqual(['symbols', 'lines', 'outlines', 'surfaces']);
    expect(moveAmong(order, 'surfaces', 1, showing)).toEqual(['symbols', 'lines', 'outlines', 'surfaces']);
  });
  test('the top showing section cannot move up, the bottom one cannot move down (null), even with hidden ones beyond', () => {
    const showing: Group[] = ['surfaces', 'outlines'];
    expect(moveAmong(order, 'surfaces', -1, showing)).toBeNull(); expect(moveAmong(order, 'outlines', 1, showing)).toBeNull();
  });
  test('a section that is not showing, or the only one showing, has nothing to swap with', () => {
    expect(moveAmong(order, 'lines', 1, ['surfaces', 'outlines'])).toBeNull(); expect(moveAmong(order, 'surfaces', 1, ['surfaces'])).toBeNull();
  });
});
