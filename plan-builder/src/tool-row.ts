// The Layers panel's tool row (Add, Surface, Edge, Plant) and the search popover it opens under itself.
// The builders are pure; ToolRow owns the query, tag and active tool and re-renders into its element.
import { esc, lucideIcon } from './ui';
import type { LucideName } from './lucide-icons';
import { loadRecent, search, searchEntries, tagsFor, type Category, type SearchEntry } from './search-index';

export type ToolId = 'add' | 'surfaces' | 'lines' | 'symbols';
const TOOLS: readonly { id: ToolId; label: string; icon: LucideName; category: Category | 'all' }[] = [
  { id: 'add', label: 'Add', icon: 'plus', category: 'all' },
  { id: 'surfaces', label: 'Surface', icon: 'surface', category: 'surfaces' },
  { id: 'lines', label: 'Edge', icon: 'edge', category: 'lines' },
  { id: 'symbols', label: 'Plant', icon: 'plant', category: 'symbols' },
];
const DIM_HINT = 'Outline the plot and set the scale first, then add items.';

export function toolRowHtml(o: { active: ToolId | null; ready: boolean }): string {
  const tools = TOOLS.map(t => `<button type="button" class="tool${o.ready ? '' : ' dim'}" data-tool="${t.id}" aria-pressed="${o.active === t.id}"${o.ready ? '' : ' aria-disabled="true"'}>${lucideIcon(t.icon)}<span>${t.label}</span></button>`);
  return `<div class="tool-row" role="toolbar" aria-label="Add to the plan">${tools.join('')}</div>`;
}

export function popoverHtml(o: { query: string; tag: string; tags: string[]; results: SearchEntry[]; hint?: string }): string {
  const chips = o.tags.map(t => `<button type="button" class="chip" data-tag="${esc(t)}" aria-pressed="${t === o.tag}">${esc(t)}</button>`).join('');
  const body = o.results.length
    ? `<div class="tool-grid">${o.results.map(r => `<button type="button" class="grid-cell" data-pick="${esc(r.id)}"><img src="${esc(r.thumb)}" alt="" loading="lazy"><span>${esc(r.name)}</span></button>`).join('')}</div>`
    : `<p class="text-hint">${esc(o.hint ?? 'No matches.')}</p>`;
  return `<div class="tool-popover"><input id="tool-search" type="search" placeholder="Search surfaces, plants, edges" aria-label="Search" value="${esc(o.query)}" autocomplete="off"><div class="chips">${chips}</div>${body}</div>`;
}

export class ToolRow {
  private active: ToolId | null = null;
  private ready = false;
  private query = '';
  private tag = 'All';
  private hint = '';
  private recent: string[] = [];

  constructor(private el: HTMLElement, private pick: (e: SearchEntry) => void) {
    el.addEventListener('keydown', e => { if (e.key === 'Escape' && this.active) { e.stopPropagation(); this.close(); } });
  }

  setReady(ready: boolean) {
    if (ready === this.ready && this.el.childElementCount) return;
    this.ready = ready;
    if (!ready) this.active = null;
    this.hint = '';
    this.render();
  }

  open(tool: ToolId) {
    if (!this.ready) { this.active = null; this.hint = DIM_HINT; this.render(); return; }
    const t = TOOLS.find(x => x.id === tool)!;
    this.active = tool; this.hint = ''; this.query = ''; this.tag = 'All'; // a category tool browses only its own category, so its All is the category tag the brief names this.recent = loadRecent();
    this.render();
    this.el.querySelector<HTMLInputElement>('#tool-search')?.focus();
  }

  close() { this.active = null; this.hint = ''; this.render(); this.el.querySelector<HTMLButtonElement>('.tool[data-tool]')?.blur(); }

  private render() {
    const inputFocused = document.activeElement?.id === 'tool-search';
    const pos = (document.activeElement as HTMLInputElement | null)?.selectionStart ?? null;
    const t = TOOLS.find(x => x.id === this.active);
    let pop = '';
    if (t) {
      const entries = searchEntries().filter(e => t.category === 'all' || e.category === t.category);
      const results = search(this.query, this.tag, entries, this.recent);
      const hint = this.tag === 'Recent' && !this.query.trim() ? 'Nothing picked yet. Your recent picks show here.' : 'No matches.';
      pop = popoverHtml({ query: this.query, tag: this.tag, tags: tagsFor(t.category), results, hint });
    }
    this.el.innerHTML = toolRowHtml({ active: this.active, ready: this.ready }) + (this.hint ? `<p class="text-hint tool-hint" role="status">${esc(this.hint)}</p>` : '') + pop;
    this.el.querySelectorAll<HTMLButtonElement>('.tool').forEach(b => { b.onclick = () => (this.active === b.dataset.tool ? this.close() : this.open(b.dataset.tool as ToolId)); });
    this.el.querySelectorAll<HTMLButtonElement>('[data-tag]').forEach(b => { b.onclick = () => { this.tag = b.dataset.tag!; this.render(); }; });
    this.el.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b => {
      b.onclick = () => { const e = searchEntries().find(x => x.id === b.dataset.pick); if (!e) return; this.close(); this.pick(e); };
    });
    const input = this.el.querySelector<HTMLInputElement>('#tool-search');
    if (input) {
      input.oninput = () => { this.query = input.value; this.render(); };
      if (inputFocused) { input.focus(); if (pos !== null) input.setSelectionRange(pos, pos); }
    }
  }
}
