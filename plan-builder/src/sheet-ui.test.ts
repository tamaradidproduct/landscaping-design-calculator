import { describe, expect, test } from 'vitest';
import { sheetHtml } from './sheet-ui';
import { plantList } from './plant-list';
import { SYMBOLS } from './symbols';
import { LINE_ITEMS } from './line-items';
import { MATERIALS } from './materials';

const plant = SYMBOLS.find(s => s.kind === 'plant')!, object = SYMBOLS.find(s => s.kind === 'object')!, marker = SYMBOLS.find(s => s.kind === 'marker')!;
const put = (id: string, sym: string) => [id, { id, symbol: sym, x: 0, y: 0 }] as const;
const none = {};

describe('sheetHtml', () => {
  test('an empty plan shows a quiet note', () => {
    expect(sheetHtml(plantList({}, {}), none)).toContain('Nothing on the plan yet.');
  });
  test('a plant card shows its name, category and quantity', () => {
    const html = sheetHtml(plantList(Object.fromEntries([put('a', plant.id), put('b', plant.id), put('c', plant.id)]), {}), none);
    expect(html).toContain('>Plants<');
    expect(html).toContain(plant.name);
    expect(html).toContain('<span class="plant-count">3</span>');
  });
  test('groups come in order: Plants, Objects, Utility markers, Edges & walls, Surfaces', () => {
    const symbols = Object.fromEntries([put('a', marker.id), put('b', object.id), put('c', plant.id)]);
    const lines = { l1: { id: 'l1', item: LINE_ITEMS[0].id, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], widthFt: 1 } };
    const outlines = { s: { id: 's', kind: 'surface' as const, name: 'Lawn', pts: [], closed: true, material: MATERIALS[0].id } };
    const html = sheetHtml(plantList(symbols, outlines, lines, null), none);
    const at = (t: string) => html.indexOf(`>${t}<`);
    expect([at('Plants'), at('Objects'), at('Utility markers'), at('Edges &amp; walls')].every((n, i, a) => n >= 0 && (i === 0 || n > a[i - 1]))).toBe(true);
  });
  test('an edge with no scale says so', () => {
    const lines = { l1: { id: 'l1', item: LINE_ITEMS[0].id, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], widthFt: 1 } };
    expect(sheetHtml(plantList({}, {}, lines, null), none)).toContain('no scale');
  });
  test('the selected symbol\'s card is marked selected', () => {
    const list = plantList(Object.fromEntries([put('a', plant.id)]), {});
    expect(sheetHtml(list, { symbol: plant.id })).toContain('plant-card selected');
    expect(sheetHtml(list, none)).not.toContain('selected');
  });
  test('the plants block ends with the footnote for the active view; none without plants', () => {
    const l = (v: 'install' | 'mature') => plantList(Object.fromEntries([put('a', plant.id)]), {}, {}, null, null, v);
    expect(sheetHtml(l('install'), none, 'install')).toContain('Sizes shown at install. Switch to Mature to see grown sizes.');
    expect(sheetHtml(l('mature'), none, 'mature')).toContain('Sizes shown at mature. Switch to Install to see nursery sizes.');
    const o = sheetHtml(plantList(Object.fromEntries([put('a', object.id)]), {}), none, 'install');
    expect(o).not.toContain('Sizes shown');
  });
});
