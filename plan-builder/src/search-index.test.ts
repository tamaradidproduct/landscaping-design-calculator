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

describe('search', () => {
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
  it('ignores junk', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{"x":1}', setItem() {} });
    expect(loadRecent()).toEqual([]);
  });
});
