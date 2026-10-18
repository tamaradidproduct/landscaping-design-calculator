// The Layers panel's Plants & objects section: one row per kind of plant or object placed ("Blue Diamond Spruce × 3", with an eye), then
// "Add…", which opens a picker (search, then the families as lists); picking one arms placing: each tap on the plan drops one until Done.
// The selected symbol's row opens into a card with Rotate and Delete.
import { button, caption, esc, hint, input, layerCard, layerForm, layerRow, row, suggestRow, swatch } from './ui';
import type { OutlineTool } from './outline-ui';
import { stepRotation } from './symbol-layer';
import { searchSymbols, symbolById, symbolFamilies, type LibrarySymbol } from './symbols';

const pickerRow = (s: LibrarySymbol) => button(`${swatch({ symbol: s.thumb })}<span class="layer-name">${esc(s.name)}</span>`, { mods: ['layer-row'], data: { symbol: s.id } });
/** The picker's list for a query: families as captions with a row per symbol, or a note when nothing matches. */
export function pickerList(query: string): string {
  const found = new Set(searchSymbols(query).map(s => s.id));
  const groups = symbolFamilies().map(g => ({ family: g.family, symbols: g.symbols.filter(s => found.has(s.id)) })).filter(g => g.symbols.length);
  return groups.length ? groups.map(g => `${caption(esc(g.family))}<div class="layer-list symbol-list">${g.symbols.map(pickerRow).join('')}</div>`).join('') : hint('No plant or object matches.');
}

export class SymbolsSection {
  private picking = false;   // the picker for a new symbol is open
  private query = '';

  constructor(private el: HTMLElement, private tool: OutlineTool) {}

  render() {
    const t = this.tool, sel = t.selectedSymbol ? t.symbols.placed[t.selectedSymbol] : null;
    if (t.placing || sel) this.picking = false;
    const groups = t.symbols.groups();
    const rows = groups.map(g => {
      const lib = symbolById(g.symbol)!, hidden = g.ids.every(id => t.hiddenLayers.has(id)) || t.hiddenSections.has('symbols');
      const open = sel?.symbol === g.symbol;
      return layerRow(lib.name, { swatch: { symbol: lib.thumb }, meta: `× ${g.ids.length}`, selected: open, data: { symbolRow: g.symbol }, eye: { id: g.symbol, hidden, attr: 'eye-symbol' } });
    });
    const card = sel ? this.card(sel.id) : '';
    const placing = t.placing ? symbolById(t.placing)! : null;
    this.el.innerHTML = `
      ${groups.length || placing || this.picking ? '' : hint('Add plants and objects: tap the plan to place each one at its true size.')}
      ${placing ? layerCard({ id: placing.id, swatch: { symbol: placing.thumb }, name: placing.name, done: true,
        body: `${hint('Placing: tap the plan to drop one. Drag to move the plan. Done or Esc stops.')}${button('Done', { mods: ['compact'], data: { act: 'stop-placing' } })}` }) : ''}
      ${rows.join('')}${card}
      ${placing ? '' : this.picking
        ? layerForm(`${input('symbol-search', { placeholder: 'Search plants and objects', ariaLabel: 'Search plants and objects', value: this.query })}<div id="symbol-results">${pickerList(this.query)}</div>${button('Cancel', { mods: ['compact'], data: { act: 'cancel-symbol-picker' } })}`)
        : suggestRow('Add plant or object…', { act: 'add-symbol' })}`;
    this.wire(sel?.id ?? null);
  }

  /** The selected symbol's card: what it is, Rotate and Delete. */
  private card(id: string): string {
    const s = this.tool.symbols.placed[id], lib = symbolById(s.symbol)!, deg = Math.round((s.rot ?? 0) * 10) / 10;
    const size = lib.kind === 'plant' ? `${fmt(lib.size.w)} ft wide` : `${fmt(lib.size.w)} × ${fmt(lib.size.d)} ft`;
    return layerCard({
      id, swatch: { symbol: lib.thumb }, name: lib.name, sub: lib.category || undefined, done: true,
      body: `${hint(`${size}${lib.sizeSource.approximate ? ' (approximate)' : ''}`)}${lib.kind === 'marker' ? hint('Direction: the arrow points along the run (0° = up). Turn it to match.') : ''}${row(
        button('−', { mods: ['icon'], ariaLabel: 'Turn 15° left', data: { act: 'rot-down' } }),
        input('symbol-rotation', { inputmode: 'decimal', value: String(deg), ariaLabel: 'Rotation in degrees' }),
        button('+', { mods: ['icon'], ariaLabel: 'Turn 15° right', data: { act: 'rot-up' } }))}${button('Delete', { variant: 'danger', mods: ['compact'], data: { act: 'delete-symbol' } })}`,
    });
  }

  private wire(selId: string | null) {
    const t = this.tool, el = this.el;
    el.querySelectorAll<HTMLButtonElement>('[data-eye-symbol]').forEach(b => { b.onclick = () => t.toggleSymbolGroup(b.dataset.eyeSymbol!); });
    // Tapping a kind selects its next placed symbol (so a plan with many can be stepped through).
    el.querySelectorAll<HTMLButtonElement>('[data-symbol-row]').forEach(b => {
      b.onclick = () => {
        const ids = (t.symbols.groups().find(g => g.symbol === b.dataset.symbolRow)?.ids ?? []).filter(id => t.symbolShown(t.symbols.placed[id]));
        if (!ids.length) return;
        const cur = t.selectedSymbol ? ids.indexOf(t.selectedSymbol) : -1;
        t.selectSymbol(cur < 0 ? ids[0] : cur + 1 < ids.length ? ids[cur + 1] : null);
      };
    });
    el.querySelector<HTMLButtonElement>('[data-act=add-symbol]')?.addEventListener('click', () => { this.picking = true; this.query = ''; t.deselect(); this.render(); el.querySelector<HTMLInputElement>('#symbol-search')?.focus(); });
    el.querySelector<HTMLButtonElement>('[data-act=cancel-symbol-picker]')?.addEventListener('click', () => { this.picking = false; this.render(); });
    el.querySelector<HTMLButtonElement>('[data-act=stop-placing]')?.addEventListener('click', () => t.stopPlacing());
    const bindPicker = () => el.querySelectorAll<HTMLButtonElement>('#symbol-results [data-symbol]').forEach(b => { b.onclick = () => { this.picking = false; t.startPlacing(b.dataset.symbol!); }; });
    bindPicker();
    const search = el.querySelector<HTMLInputElement>('#symbol-search');
    if (search) search.oninput = () => { this.query = search.value; el.querySelector('#symbol-results')!.innerHTML = pickerList(this.query); bindPicker(); };
    el.querySelector('form.layer-form')?.addEventListener('submit', e => e.preventDefault());
    const card = el.querySelector<HTMLElement>('[data-card]');
    card?.querySelector<HTMLButtonElement>('[data-act=collapse]')?.addEventListener('click', () => { if (t.placing) t.stopPlacing(); else t.selectSymbol(null); });
    if (!card || !selId) return;
    const cur = () => t.symbols.placed[selId]?.rot ?? 0;
    card.querySelector<HTMLButtonElement>('[data-act=rot-down]')?.addEventListener('click', () => t.rotateSymbol(selId, stepRotation(cur(), -1)));
    card.querySelector<HTMLButtonElement>('[data-act=rot-up]')?.addEventListener('click', () => t.rotateSymbol(selId, stepRotation(cur(), 1)));
    card.querySelector<HTMLButtonElement>('[data-act=delete-symbol]')?.addEventListener('click', () => t.removeSymbol(selId));
    const rot = card.querySelector<HTMLInputElement>('#symbol-rotation');
    if (rot) {
      rot.onchange = () => { const v = Number(rot.value.replace(/[°\s]/g, '')); if (Number.isFinite(v)) t.rotateSymbol(selId, v); else rot.value = String(cur()); };
      rot.onkeydown = e => { if (e.key === 'Enter') rot.blur(); };
    }
  }
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);
