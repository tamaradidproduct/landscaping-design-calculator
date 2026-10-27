// The Layers panel's Lines section: one row per kind of line drawn ("Wood privacy fence × 3", with an eye). Picking a line item from
// the tool row's grid (tool-row.ts) starts drawing: each tap on the plan adds a point until Done. The selected line's row opens
// into a card with its length, Width, Delete point and Delete line.
import { stepLineWidth, lineItemById } from './line-items';
import { lineLengthFt } from './line-layer';
import { parseFeet } from './outline';
import type { OutlineTool } from './outline-ui';
import { button, hint, input, layerCard, layerRow, row } from './ui';

/** A run's length for the card and the list: feet to one decimal, or "no scale" until the plan has one. */
export const lengthText = (ft: number | null): string => ft === null ? 'no scale' : `${Math.round(ft * 10) / 10} ft`;

export class LinesSection {
  constructor(private el: HTMLElement, private tool: OutlineTool) {}

  render() {
    const t = this.tool, sel = t.selectedLine ? t.lines.placed[t.selectedLine] : null, draft = t.lineDraft;
    const groups = t.lines.groups();
    const rows = groups.map(g => {
      const lib = lineItemById(g.item)!, hidden = g.ids.every(id => t.hiddenLayers.has(id)) || t.hiddenSections.has('lines');
      return layerRow(lib.name, { swatch: { symbol: lib.thumb }, meta: `× ${g.ids.length}`, selected: sel?.item === g.item, data: { lineRow: g.item }, eye: { id: g.item, hidden, attr: 'eye-line' } });
    });
    const drafting = draft ? lineItemById(draft.item)! : null;
    this.el.innerHTML = `
      ${drafting ? layerCard({ id: draft!.item, swatch: { symbol: drafting.thumb }, name: drafting.name, done: true,
        body: `${hint(`Drawing: tap a point for each corner of the run. Drag to move the plan. ${draft!.points.length} so far.`)}${row(
          button('Done', { mods: ['compact'], data: { act: 'finish-line' } }), button('Cancel', { mods: ['compact'], data: { act: 'cancel-line' } }))}` }) : ''}
      ${rows.join('')}${sel ? this.card(sel.id) : ''}`;
    this.wire(sel?.id ?? null);
  }

  /** The selected line's card: what it is and how long, its Width, and Delete point / Delete line. */
  private card(id: string): string {
    const t = this.tool, l = t.lines.placed[id], lib = lineItemById(l.item)!;
    const canDeletePoint = t.selectedLinePoint !== null && l.points.length > 2;
    return layerCard({
      id, swatch: { symbol: lib.thumb }, name: lib.name, sub: lengthText(lineLengthFt(l, t.cal?.ftPerPt ?? null)), done: true,
      body: `${hint('Drag a point to move it, a square to bend the run, or tap the + to add one. Tap a point to select it.')}${row(
        button('−', { mods: ['icon'], ariaLabel: 'Narrower', data: { act: 'width-down' } }),
        input('line-width', { inputmode: 'decimal', value: String(l.widthFt), ariaLabel: 'Width in feet' }),
        button('+', { mods: ['icon'], ariaLabel: 'Wider', data: { act: 'width-up' } }))}${hint('Width in feet (6 in works too).')}${row(
        button('Delete point', { mods: ['compact'], disabled: !canDeletePoint, data: { act: 'delete-line-point' } }),
        button('Delete line', { variant: 'danger', mods: ['compact'], data: { act: 'delete-line' } }))}`,
    });
  }

  private wire(selId: string | null) {
    const t = this.tool, el = this.el;
    el.querySelectorAll<HTMLButtonElement>('[data-eye-line]').forEach(b => { b.onclick = () => t.toggleLineGroup(b.dataset.eyeLine!); });
    // Tapping a kind selects its next line (so a plan with many can be stepped through).
    el.querySelectorAll<HTMLButtonElement>('[data-line-row]').forEach(b => {
      b.onclick = () => {
        const ids = (t.lines.groups().find(g => g.item === b.dataset.lineRow)?.ids ?? []).filter(id => t.lineShown(t.lines.placed[id]));
        if (!ids.length) return;
        const cur = t.selectedLine ? ids.indexOf(t.selectedLine) : -1;
        t.selectLine(cur < 0 ? ids[0] : cur + 1 < ids.length ? ids[cur + 1] : null);
      };
    });
    el.querySelector<HTMLButtonElement>('[data-act=finish-line]')?.addEventListener('click', () => t.finishLine());
    el.querySelector<HTMLButtonElement>('[data-act=cancel-line]')?.addEventListener('click', () => t.cancelLine());
    const card = el.querySelector<HTMLElement>('[data-card]');
    card?.querySelector<HTMLButtonElement>('[data-act=collapse]')?.addEventListener('click', () => { if (t.lineDraft) t.cancelLine(); else t.selectLine(null); });
    if (!card || !selId) return;
    const cur = () => t.lines.placed[selId]?.widthFt ?? 1;
    card.querySelector<HTMLButtonElement>('[data-act=width-down]')?.addEventListener('click', () => t.setLineWidth(selId, stepLineWidth(cur(), -1)));
    card.querySelector<HTMLButtonElement>('[data-act=width-up]')?.addEventListener('click', () => t.setLineWidth(selId, stepLineWidth(cur(), 1)));
    card.querySelector<HTMLButtonElement>('[data-act=delete-line-point]')?.addEventListener('click', () => { if (t.selectedLinePoint !== null) t.removeLinePoint(selId, t.selectedLinePoint); });
    card.querySelector<HTMLButtonElement>('[data-act=delete-line]')?.addEventListener('click', () => t.removeLine(selId));
    const width = card.querySelector<HTMLInputElement>('#line-width');
    if (width) {
      width.onchange = () => { const v = parseFeet(width.value); if (v !== null) t.setLineWidth(selId, v); else width.value = String(cur()); };
      width.onkeydown = e => { if (e.key === 'Enter') width.blur(); };
    }
  }
}
