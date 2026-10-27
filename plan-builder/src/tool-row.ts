// The Layers panel's tool row (Add, Surface, Edge, Plant) and the search popover it opens under itself.
// The builders are pure; ToolRow owns the query, tag and active tool and re-renders into its element.
import { esc, lucideIcon } from './ui';
import type { LucideName } from './lucide-icons';
import { loadRecent, search, searchEntries, tagsFor, type Category, type SearchEntry } from './search-index';

export type ToolId = 'add' | 'surfaces' | 'lines' | 'symbols';
const TOOLS: readonly { id: ToolId; label: string; title: string; icon: LucideName; category: Category | 'all' }[] = [
  { id: 'add', label: 'Add', title: 'Add anything', icon: 'plus', category: 'all' },
  { id: 'surfaces', label: 'Surface', title: 'Surfaces', icon: 'surface', category: 'surfaces' },
  { id: 'lines', label: 'Edge', title: 'Edges & walls', icon: 'edge', category: 'lines' },
  { id: 'symbols', label: 'Plant', title: 'Plants & objects', icon: 'plant', category: 'symbols' },
];
/** The small label under a cell's name in typed-query results, which mix categories. */
export const CATEGORY_LABEL: Record<Category, string> = { surfaces: 'Surface', symbols: 'Plant or object', lines: 'Edge or wall' };

/** Whether the tool row's document-level Esc should close its popover: not when something else already handled it, nor when
 * focus is in another field, menu or material grid outside the row (the plan menu, the edge-length field, a layer rename, a
 * card's grid), which keep their own Esc. */
export function rowTakesEscape(e: { defaultPrevented: boolean; target: EventTarget | null }, row: { contains(n: Node | null): boolean }): boolean {
  if (e.defaultPrevented) return false;
  const t = e.target as (Node & { closest?: (s: string) => Element | null }) | null;
  if (t && typeof t.closest === 'function' && t.closest('input, textarea, select, [role=menu], .tool-popover') && !row.contains(t)) return false;
  return true;
}
/** The tag a tool opens on: Add browses everything, the others their own category tag. */
export const startTag = (tool: ToolId): string => TOOLS.find(t => t.id === tool)!.category === 'all' ? 'All' : tagsFor(TOOLS.find(t => t.id === tool)!.category)[2];

/** What the popover shows. A typed query searches every entry (whatever the tool); with none, the tag narrows the browse. */
export function browse(tool: ToolId, query: string, tag: string, recent: string[]): { tags: string[]; results: SearchEntry[] } {
  return { tags: tagsFor(TOOLS.find(t => t.id === tool)!.category), results: search(query, tag, searchEntries(), recent) };
}

const DIM_HINT = 'Outline the plot and set the scale first, then add items.';

export function toolRowHtml(o: { active: ToolId | null; ready: boolean }): string {
  const tools = TOOLS.map(t => `<button type="button" class="tool${o.ready ? '' : ' dim'}" data-tool="${t.id}" title="${esc(t.title)}" aria-pressed="${o.active === t.id}"${o.ready ? '' : ' aria-disabled="true"'}>${lucideIcon(t.icon)}<span>${t.label}</span></button>`);
  return `<div class="tool-row" role="toolbar" aria-label="Add to the plan">${tools.join('')}</div>`;
}

/** The Surface grid's first cell once the plot can be filled: it opens the plot boundary's Fill the plot grid. */
export const fillPlotCell = (): string =>
  `<button type="button" class="grid-cell fill-cell" data-act="fill-plot"><span class="cell-pic">${lucideIcon('fill')}</span><span>Fill the plot</span></button>`;

/** The search field, tag chips and picture grid. `inputId` and `placeholder` let a second copy (a surface card's material
 * grid) live beside the tool row's; `current` marks the entry already in use; `lead` is a cell put first (Fill the plot). */
export function popoverHtml(o: { query: string; tag: string; tags: string[]; results: SearchEntry[]; hint?: string; inputId?: string; placeholder?: string; current?: string; lead?: string }): string {
  const chips = o.tags.map(t => `<button type="button" class="chip" data-tag="${esc(t)}" aria-pressed="${t === o.tag}">${esc(t)}</button>`).join('');
  const cat = !!o.query.trim(); // a typed query searches every category, so each cell says which
  const body = o.results.length || o.lead
    ? `<div class="tool-grid">${o.lead ?? ''}${o.results.map(r => `<button type="button" class="grid-cell" data-pick="${esc(r.id)}"${r.id === o.current ? ' aria-current="true"' : ''}><img src="${esc(r.thumb)}" alt="" loading="lazy"><span>${esc(r.name)}</span>${cat ? `<span class="text-hint cell-cat">${CATEGORY_LABEL[r.category]}</span>` : ''}</button>`).join('')}</div>`
    : `<p class="text-hint">${esc(o.hint ?? 'No matches')}</p>`;
  return `<div class="tool-popover"><input id="${o.inputId ?? 'tool-search'}" type="search" placeholder="${esc(o.placeholder ?? 'Search everything')}" aria-label="Search" value="${esc(o.query)}" autocomplete="off"><div class="chips">${chips}</div>${body}</div>`;
}

export class ToolRow {
  private active: ToolId | null = null;
  private ready = false;
  private query = '';
  private tag = 'All';
  private hint = '';
  private recent: string[] = [];

  /** `pick` gets the tapped cell's entry; `onOpen` runs when a tool opens (Surface starts drawing at once); `fill` puts
   * Fill the plot first in the Surface grid while `available()` (no query typed) and runs `open` when it is tapped. */
  constructor(private el: HTMLElement, private pick: (e: SearchEntry) => void, private onOpen?: (tool: ToolId) => void,
    private fill?: { available: () => boolean; open: () => void }) {
  }

  /** Esc closes the popover from anywhere while a tool is active. */
  private onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && rowTakesEscape(e, this.el)) { e.stopPropagation(); this.close(); } };

  setReady(ready: boolean) {
    if (ready === this.ready && this.el.childElementCount) return;
    this.ready = ready;
    if (!ready) this.dismiss();
    this.hint = '';
    this.render();
  }

  open(tool: ToolId) {
    if (!this.ready) { this.dismiss(); this.hint = DIM_HINT; this.render(); return; }
    if (!this.active) document.addEventListener('keydown', this.onKey, true);
    this.active = tool;
    this.hint = '';
    this.query = '';
    this.tag = startTag(tool);
    this.recent = loadRecent();
    this.render();
    this.el.querySelector<HTMLInputElement>('#tool-search')?.focus();
    this.onOpen?.(tool);
  }

  close() {
    const was = this.active;
    this.dismiss();
    this.render();
    if (was) this.el.querySelector<HTMLButtonElement>(`.tool[data-tool=${was}]`)?.focus();
  }

  private dismiss() { this.active = null; this.hint = ''; document.removeEventListener('keydown', this.onKey, true); }

  private render() {
    const inputFocused = document.activeElement?.id === 'tool-search';
    const pos = (document.activeElement as HTMLInputElement | null)?.selectionStart ?? null;
    let pop = '';
    if (this.active) {
      const { tags, results } = browse(this.active, this.query, this.tag, this.recent);
      const hint = this.tag === 'Recent' && !this.query.trim() ? 'Nothing picked yet. Your recent picks show here.' : 'No matches';
      const lead = this.active === 'surfaces' && !this.query.trim() && this.fill?.available() ? fillPlotCell() : undefined;
      pop = popoverHtml({ query: this.query, tag: this.tag, tags, results, hint, lead });
    }
    this.el.innerHTML = toolRowHtml({ active: this.active, ready: this.ready }) + (this.hint ? `<p class="text-hint tool-hint" role="status">${esc(this.hint)}</p>` : '') + pop;
    this.el.querySelectorAll<HTMLButtonElement>('.tool').forEach(b => { b.onclick = () => (this.active === b.dataset.tool ? this.close() : this.open(b.dataset.tool as ToolId)); });
    this.el.querySelectorAll<HTMLButtonElement>('[data-tag]').forEach(b => { b.onclick = () => { this.tag = b.dataset.tag!; this.render(); }; });
    this.el.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b => {
      b.onclick = () => { const e = searchEntries().find(x => x.id === b.dataset.pick); if (!e) return; this.close(); this.pick(e); };
    });
    const fillCell = this.el.querySelector<HTMLButtonElement>('.tool-popover [data-act=fill-plot]');
    if (fillCell) fillCell.onclick = () => { this.close(); this.fill?.open(); };
    const input = this.el.querySelector<HTMLInputElement>('#tool-search');
    if (input) {
      input.oninput = () => { this.query = input.value; this.render(); };
      if (inputFocused) { input.focus(); if (pos !== null) input.setSelectionRange(pos, pos); }
    }
  }
}
