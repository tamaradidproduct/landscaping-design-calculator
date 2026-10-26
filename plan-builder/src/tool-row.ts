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
/** The tag a tool opens on: Add browses everything, the others their own category tag. */
export const startTag = (tool: ToolId): string => TOOLS.find(t => t.id === tool)!.category === 'all' ? 'All' : tagsFor(TOOLS.find(t => t.id === tool)!.category)[2];

/** What the popover shows. A typed query searches every entry (whatever the tool); with none, the tag narrows the browse. */
export function browse(tool: ToolId, query: string, tag: string, recent: string[]): { tags: string[]; results: SearchEntry[] } {
  return { tags: tagsFor(TOOLS.find(t => t.id === tool)!.category), results: search(query, tag, searchEntries(), recent) };
}

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
  }

  /** Esc closes the popover from anywhere while a tool is active. */
  private onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); this.close(); } };

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
      const hint = this.tag === 'Recent' && !this.query.trim() ? 'Nothing picked yet. Your recent picks show here.' : 'No matches.';
      pop = popoverHtml({ query: this.query, tag: this.tag, tags, results, hint });
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
