// The Layers panel's Plants & objects section: one row per kind of plant or object placed ("Blue Diamond Spruce × 3", with an eye).
// Picking one from the tool row's grid (tool-row.ts) arms placing: each tap on the plan drops one until Done.
// The selected symbol's row opens into a card with its size, stepping and Delete (Rotate for objects).
import { button, esc, hint, iconButton, inlineHint, input, layerCard, layerRow, row } from './ui';
import { instanceLabel } from './card-helpers';
import type { OutlineTool } from './outline-ui';
import { stepRotation } from './symbol-layer';
import { symbolById } from './symbols';

export class SymbolsSection {
  constructor(private el: HTMLElement, private tool: OutlineTool) {}

  render() {
    const t = this.tool, sel = t.selectedSymbol ? t.symbols.placed[t.selectedSymbol] : null;
    const groups = t.symbols.groups();
    const rows = groups.map(g => {
      const lib = symbolById(g.symbol)!, hidden = g.ids.every(id => t.hiddenLayers.has(id)) || t.hiddenSections.has('symbols');
      const open = sel?.symbol === g.symbol;
      return layerRow(lib.name, { swatch: { symbol: lib.thumb }, meta: `× ${g.ids.length}`, selected: open, data: { 'symbol-row': g.symbol }, eye: { id: g.symbol, hidden, attr: 'eye-symbol' } });
    });
    const card = sel ? this.card(sel.id) : '';
    const placing = t.placing ? symbolById(t.placing)! : null;
    this.el.innerHTML = `
      ${placing ? layerCard({ id: placing.id, swatch: { symbol: placing.thumb }, name: placing.name,
        body: `${hint('Placing: tap the plan to drop one. Drag to move the plan. Done or Esc stops.')}${button('Done', { mods: ['compact'], data: { act: 'stop-placing' } })}` }) : ''}
      ${rows.join('')}${card}`;
    this.wire(sel?.id ?? null);
  }

  /** The selected symbol's card: its size in the sub-line, `1 of N` with ‹ › to step through the placed copies, a trash icon; objects and markers also Rotate. */
  private card(id: string): string {
    const t = this.tool, s = t.symbols.placed[id], lib = symbolById(s.symbol)!, deg = Math.round((s.rot ?? 0) * 10) / 10;
    const size = lib.kind === 'plant' ? `${fmt(lib.size.w)} ft wide` : `${fmt(lib.size.w)} × ${fmt(lib.size.d)} ft`;
    const which = instanceLabel(id, t.symbols.groups().find(g => g.symbol === s.symbol)?.ids ?? []);
    const step = which ? `${inlineHint(esc(which))}${iconButton('chevron-left', { ariaLabel: 'Previous', data: { act: 'prev' } })}${iconButton('chevron-right', { ariaLabel: 'Next', data: { act: 'next' } })}` : '';
    const rotate = lib.kind === 'plant' ? '' : row(
      button('−', { mods: ['icon'], ariaLabel: 'Turn 15° left', data: { act: 'rot-down' } }),
      input('symbol-rotation', { inputmode: 'decimal', value: String(deg), ariaLabel: 'Rotation in degrees' }),
      button('+', { mods: ['icon'], ariaLabel: 'Turn 15° right', data: { act: 'rot-up' } }));
    const sizeText = `${size}${lib.sizeSource.approximate ? ' (approximate)' : ''}`;
    return layerCard({
      id, swatch: { symbol: lib.thumb }, name: lib.name, sub: [lib.category, sizeText].filter(Boolean).join(' · '),
      actions: iconButton('trash', { ariaLabel: 'Delete', variant: 'danger', data: { act: 'delete-symbol' } }),
      body: `${step ? `<div class="layer-actions">${step}</div>` : ''}${lib.kind === 'marker' ? hint('Direction: the arrow points along the run (0° = up). Turn it to match.') : ''}${rotate}`,
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
    el.querySelector<HTMLButtonElement>('[data-act=stop-placing]')?.addEventListener('click', () => t.stopPlacing());
    const card = el.querySelector<HTMLElement>('[data-card]');
    // Tapping the head (not its buttons) closes the card, like tapping the row again.
    card?.querySelector<HTMLElement>('.layer-head')?.addEventListener('click', e => {
      if (!(e.target as Element).closest('input, button') && !t.placing) t.selectSymbol(null);
    });
    if (!card || !selId) return;
    const ids = t.symbols.groups().find(g => g.symbol === t.symbols.placed[selId]?.symbol)?.ids ?? [];
    const stepTo = (d: number) => { const at = ids.indexOf(selId); if (at >= 0) t.selectSymbol(ids[(at + d + ids.length) % ids.length]); };
    card.querySelector<HTMLButtonElement>('[data-act=prev]')?.addEventListener('click', () => stepTo(-1));
    card.querySelector<HTMLButtonElement>('[data-act=next]')?.addEventListener('click', () => stepTo(1));
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
