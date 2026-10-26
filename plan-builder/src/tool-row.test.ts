import { describe, expect, it } from 'vitest';
import { popoverHtml, toolRowHtml } from './tool-row';
import type { SearchEntry } from './search-index';

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
  it('shows the hint when there are no results', () => {
    const html = popoverHtml({ ...base, results: [], hint: 'Nothing here yet' });
    expect(html).toContain('Nothing here yet');
    expect(html).not.toContain('grid-cell');
  });
});
