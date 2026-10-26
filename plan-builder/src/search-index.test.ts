import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadRecent, pushRecent, saveRecent, search, searchEntries, tagsFor, type SearchEntry } from './search-index';

const entries = searchEntries();
const e = (id: string, category: SearchEntry['category'], name: string, family: string): SearchEntry => ({ id, category, name, family, thumb: '' });

afterEach(() => vi.unstubAllGlobals());

describe('searchEntries', () => {
  it('has surfaces, symbols and lines, ids unique', () => {
    for (const c of ['surfaces', 'symbols', 'lines'] as const) expect(entries.some(x => x.category === c)).toBe(true);
    expect(new Set(entries.map(x => x.id)).size).toBe(entries.length);
  });
});

describe('tagsFor', () => {
  it('all', () => expect(tagsFor('all')).toEqual(['All', 'Recent', 'Surfaces', 'Plants & objects', 'Edges & walls']));
  it('surfaces ends with the six material families', () => {
    expect(tagsFor('surfaces').slice(0, 2)).toEqual(['All', 'Recent']);
    expect(tagsFor('surfaces').slice(2)).toEqual(['Turf & seed', 'Mulch & soil', 'Rock & gravel', 'Pavers & stone', 'Concrete', 'Decking']);
  });
});

describe('tagsFor lines and symbols', () => {
  it('lines: the line item names', () => {
    const names = entries.filter(x => x.category === 'lines').map(x => x.name);
    expect(names).toHaveLength(5);
    expect(tagsFor('lines')).toEqual(['All', 'Recent', ...names]);
  });
  it('symbols: unique families', () => {
    const t = tagsFor('symbols').slice(2);
    expect(t.length).toBeGreaterThan(0);
    expect(new Set(t).size).toBe(t.length);
    expect(t.every(f => entries.some(x => x.category === 'symbols' && x.family === f))).toBe(true);
  });
});

describe('search', () => {
  it('a line-name tag returns just that line', () => {
    const r = search('', 'Dry river', entries, []);
    expect(r.map(x => x.name)).toEqual(['Dry river']);
  });
  it('Edges & walls returns every line', () => {
    expect(search('', 'Edges & walls', entries, [])).toHaveLength(5);
  });
  it('a query matching a line or symbol ignores a category tag', () => {
    expect(search('dry river', 'Surfaces', entries, []).map(x => x.name)).toContain('Dry river');
    const sym = entries.find(x => x.category === 'symbols')!;
    expect(search(sym.name, 'Surfaces', entries, []).map(x => x.id)).toContain(sym.id);
  });
  it('Recent de-duplicates and caps at 8', () => {
    const list = Array.from({ length: 10 }, (_, i) => e(`i${i}`, 'symbols', `N${i}`, 'F'));
    expect(search('', 'Recent', list, ['i0', 'i0', 'i1']).map(x => x.id)).toEqual(['i0', 'i1']);
    expect(search('', 'Recent', list, list.map(x => x.id))).toHaveLength(8);
  });
  it('a query ignores the tag', () => {
    const r = search('sod', 'Pavers & stone', entries, []);
    expect(r.map(x => x.name)).toContain('Premium sod');
  });
  it('matches name first, then family', () => {
    const list = [e('1', 'surfaces', 'Gravel path', 'Other'), e('2', 'surfaces', 'Zed', 'Gravel')];
    expect(search('GRAVEL', 'All', list, []).map(x => x.id)).toEqual(['1', '2']);
    expect(search('gravel', 'All', [list[1], list[0]], []).map(x => x.id)).toEqual(['1', '2']);
  });
  it('empty query, All returns everything', () => expect(search('', 'All', entries, [])).toHaveLength(entries.length));
  it('Recent returns recent ids in order', () => {
    const list = [e('a', 'symbols', 'A', 'F'), e('b', 'symbols', 'B', 'F'), e('c', 'symbols', 'C', 'F')];
    expect(search('', 'Recent', list, ['b', 'a', 'gone']).map(x => x.id)).toEqual(['b', 'a']);
  });
  it('a family tag returns only that family', () => {
    const r = search('', 'Concrete', entries, []);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every(x => x.family === 'Concrete')).toBe(true);
  });
  it('a category tag filters to the category', () => {
    expect(search('', 'Surfaces', entries, []).every(x => x.category === 'surfaces')).toBe(true);
    expect(search('', 'Plants & objects', entries, []).every(x => x.category === 'symbols')).toBe(true);
    expect(search('', 'Edges & walls', entries, []).every(x => x.category === 'lines')).toBe(true);
  });
});

describe('pushRecent', () => {
  it('moves an existing id to the front', () => expect(pushRecent(['a', 'b'], 'b')).toEqual(['b', 'a']));
  it('caps at 8', () => {
    let r: string[] = [];
    for (let i = 0; i < 9; i++) r = pushRecent(r, `id${i}`);
    expect(r).toHaveLength(8);
    expect(r[0]).toBe('id8');
  });
});

describe('loadRecent / saveRecent', () => {
  it('returns [] when localStorage throws', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } });
    expect(loadRecent()).toEqual([]);
    expect(() => saveRecent(['a'])).not.toThrow();
  });
  it('round-trips', () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; } });
    saveRecent(['a', 'b']);
    expect(store['recent-picks']).toBe('["a","b"]');
    expect(loadRecent()).toEqual(['a', 'b']);
  });
  it('de-duplicates and caps a corrupt stored list', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(['a', 'a', 'b']), setItem() {} });
    expect(loadRecent()).toEqual(['a', 'b']);
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(Array.from({ length: 12 }, (_, i) => `x${i}`)), setItem() {} });
    expect(loadRecent()).toHaveLength(8);
  });
  it('ignores junk', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{"x":1}', setItem() {} });
    expect(loadRecent()).toEqual([]);
  });
});
