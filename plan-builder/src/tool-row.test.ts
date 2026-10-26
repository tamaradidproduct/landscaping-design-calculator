import { describe, expect, it } from 'vitest';
import { browse, fillPlotCell, popoverHtml, startTag, toolRowHtml } from './tool-row';
import { searchEntries, type SearchEntry } from './search-index';

const entry = (name: string): SearchEntry => ({ id: name, category: 'surfaces', name, family: 'Lawn', thumb: 'x.png' });
const count = (html: string, s: string) => html.split(s).length - 1;

describe('toolRowHtml', () => {
  it('lists Add, Surface, Edge, Plant in order', () => {
    const html = toolRowHtml({ active: null, ready: true });
    const order = [...html.matchAll(/data-tool="(\w+)"/g)].map(m => m[1]);
    expect(order).toEqual(['add', 'surfaces', 'lines', 'symbols']);
    expect(html).not.toContain('aria-disabled');
  });
  it('marks only the active tool pressed', () => {
    const html = toolRowHtml({ active: 'lines', ready: true });
    expect(count(html, 'aria-pressed="true"')).toBe(1);
    expect(html).toMatch(/data-tool="lines"[^>]*aria-pressed="true"/);
  });
  it('dims every tool, still focusable, when not ready', () => {
    const html = toolRowHtml({ active: null, ready: false });
    expect(count(html, 'aria-disabled="true"')).toBe(4);
    expect(count(html, 'dim')).toBe(4);
    expect(html).not.toContain(' disabled');
  });
});

describe('popoverHtml', () => {
  const base = { query: '', tag: 'All', tags: ['All', 'Recent', 'Lawn'] };
  it('renders one grid cell per result and the active tag pressed', () => {
    const html = popoverHtml({ ...base, results: [entry('Sod'), entry('Gravel')] });
    expect(count(html, 'class="grid-cell"')).toBe(2);
    expect(html).toContain('id="tool-search"');
    expect(html).toMatch(/data-tag="All"[^>]*aria-pressed="true"/);
    expect(html).toMatch(/data-tag="Lawn"[^>]*aria-pressed="false"/);
  });
  it('escapes names', () => {
    const html = popoverHtml({ ...base, results: [entry('<b>')] });
    expect(html).not.toContain('<b>');
    expect(html).toContain('&lt;b&gt;');
  });
  it('puts a lead cell (Fill the plot) first in the grid, even with no results', () => {
    const lead = fillPlotCell();
    const html = popoverHtml({ ...base, results: [entry('Sod')], lead });
    expect(html.indexOf('data-act="fill-plot"')).toBeLessThan(html.indexOf('data-pick="Sod"'));
    expect(html).toContain('Fill the plot');
    expect(popoverHtml({ ...base, results: [], lead })).toContain('data-act="fill-plot"');
  });
  it('shows the hint when there are no results', () => {
    const html = popoverHtml({ ...base, results: [], hint: 'Nothing here yet' });
    expect(html).toContain('Nothing here yet');
    expect(html).not.toContain('grid-cell');
  });
});

describe('browse and startTag', () => {
  const cats = (r: SearchEntry[]) => new Set(r.map(x => x.category));
  it('Surface opens on the Surfaces tag and shows only surfaces on an empty query', () => {
    expect(startTag('surfaces')).toBe('Surfaces');
    const { results, tags } = browse('surfaces', '', startTag('surfaces'), []);
    expect(tags.slice(0, 3)).toEqual(['All', 'Recent', 'Surfaces']);
    expect([...cats(results)]).toEqual(['surfaces']);
  });
  it('Plant and Edge open on their category tags; Add on All', () => {
    expect(startTag('symbols')).toBe('Plants & objects');
    expect(startTag('lines')).toBe('Edges & walls');
    expect(startTag('add')).toBe('All');
  });
  it('a typed query searches every category even from a category tool', () => {
    const { results } = browse('surfaces', 'pine', 'Surfaces', []);
    expect(cats(results).has('symbols')).toBe(true);
  });
  it('Recent shows a picked entry', () => {
    const id = searchEntries()[0].id;
    expect(browse('add', '', 'Recent', [id]).results.map(x => x.id)).toEqual([id]);
  });
});
