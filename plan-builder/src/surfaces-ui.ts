// The Layers panel's Surfaces section: the new work (hardscape and softscape zones), above Outlines. One row per
// zone in layer order (a higher zone cuts the ones below; outlines cut every zone), then "Add surface…", which
// opens a material picker; picking a material starts drawing. The zone being drawn or selected expands into a card.
import { materialsByTrade, type MaterialId, type Trade } from './materials';
import type { Outline } from './outline';
import type { OutlineTool } from './outline-ui';
import { button, caption, chips, esc, hint, layerActions, layerCard, layerForm, layerOrder, layerRow, nudgePad, suggestRow, swatch } from './ui';

const TRADES: [Trade, string][] = [['hardscape', 'Hardscape'], ['softscape', 'Softscape']];

/** Chips for every material, grouped by trade; `current` is marked. */
const picker = (current?: MaterialId) => TRADES.map(([trade, title]) => `${caption(title)}${chips(materialsByTrade(trade).map(m =>
  button(`${swatch({ material: m.id })}${esc(m.name)}`, { mods: ['chip', 'compact', 'material-chip'], pressed: m.id === current, data: { material: m.id } })))}`).join('');

export class SurfacesSection {
  private picking = false; // the material picker for a new zone is open

  constructor(private el: HTMLElement, private tool: OutlineTool) {}

  render() {
    const t = this.tool;
    if (!t.boundaryClosed) { this.picking = false; this.el.innerHTML = hint('Outline the plot boundary first.'); return; }
    if (t.drawing) this.picking = false;
    const zones = Object.values(t.outlines).filter(o => o.kind === 'surface');
    const rows = zones.map(o => o.id === t.drawing || (!t.drawing && o.id === t.selected) ? this.card(o)
      : layerRow(o.name, { swatch: { material: o.material! }, data: { zone: o.id } }));
    this.el.innerHTML = `
      ${zones.length ? '' : hint('Add the new surfaces: lawn, beds, patio…')}
      ${rows.join('')}
      ${t.drawing ? '' : this.picking
        ? layerForm(`${picker()}${button('Cancel', { mods: ['compact'], data: { act: 'cancel-picker' } })}`)
        : suggestRow('Add surface…', { act: 'add-surface' })}`;

    this.el.querySelectorAll<HTMLButtonElement>('[data-zone]').forEach(b => {
      b.onclick = () => { const id = b.dataset.zone!; t.selectOutline(id !== t.selected ? id : null); };
    });
    this.el.querySelector<HTMLButtonElement>('[data-act=add-surface]')?.addEventListener('click', () => { this.picking = true; this.render(); });
    this.el.querySelector<HTMLButtonElement>('[data-act=cancel-picker]')?.addEventListener('click', () => { this.picking = false; this.render(); });
    const card = this.el.querySelector<HTMLElement>('[data-card]');
    this.el.querySelectorAll<HTMLButtonElement>('[data-material]').forEach(b => {
      const m = b.dataset.material as MaterialId;
      b.onclick = card ? () => t.setMaterial(card.dataset.card!, m) : () => t.startSurface(m);
    });
    this.el.querySelector('form')?.addEventListener('submit', e => e.preventDefault());
    if (card) this.wireCard(card);
  }

  /** The expanded row: drawing — the step and Close shape / Cancel; selected — rename, material, tidy, order. */
  private card(o: Outline): string {
    const t = this.tool, compact = ['compact'], nudge = t.cornerSelected ? nudgePad() : '', sw = { material: o.material! };
    if (o.id === t.drawing) {
      const n = o.pts.length, what = `<b>${esc(o.name.toLowerCase())}</b>`;
      const step = t.shape === 'rect'
        ? (n ? 'Now drag or tap to the opposite corner.' : `Drag from one corner of the ${what} to the opposite corner.`)
        : n >= 3 ? `${n} corners. Tap the first corner or double-tap to finish.` : `Tap each corner of the ${what} · ${n} placed`;
      return layerCard({ id: o.id, swatch: sw, name: o.name, meta: 'Drawing…', body: `${hint(step)}${nudge}${layerActions(
        t.shape === 'rect' ? '' : button('Close shape', { variant: 'primary', mods: compact, disabled: n < 3, data: { act: 'close' } }),
        button('Cancel', { mods: compact, data: { act: 'cancel' } }))}` });
    }
    const p = t.layerPosition(o.id);
    return layerCard({
      id: o.id, swatch: sw, name: o.name, done: true, rename: true, renameId: 'surface-rename',
      body: `${caption('Material')}${picker(o.material)}${nudge}${layerActions(
        button('Square all corners', { mods: compact, data: { act: 'square-all' } }),
        button('Redo outline', { mods: compact, data: { act: 'redraw' } }),
        button('Delete', { variant: 'danger', mods: compact, data: { act: 'delete' } }))}${p.first && p.last ? '' : layerOrder(p.first, p.last)}`,
    });
  }
  private wireCard(card: HTMLElement) {
    const t = this.tool, id = card.dataset.card!;
    const act: Record<string, () => void> = {
      close: () => t.close(), cancel: () => t.cancel(), collapse: () => t.selectOutline(null),
      'square-all': () => t.squareAll(id), redraw: () => t.redraw(id), delete: () => t.deleteLayer(id),
      up: () => t.moveLayer(id, -1), down: () => t.moveLayer(id, 1),
    };
    card.querySelectorAll<HTMLButtonElement>('[data-act]').forEach(b => { if (act[b.dataset.act!]) b.onclick = act[b.dataset.act!]; });
    card.querySelectorAll<HTMLButtonElement>('[data-nudge]').forEach(b => {
      b.onclick = () => { const [dx, dy] = b.dataset.nudge!.split(',').map(Number); t.nudge(dx, dy); };
    });
    card.querySelector<HTMLElement>('.layer-head')!.onclick = e => {
      if (!(e.target as Element).closest('input, button') && !t.drawing) t.selectOutline(null);
    };
    const rename = card.querySelector<HTMLInputElement>('#surface-rename');
    if (rename) {
      rename.onchange = () => t.renameLayer(id, rename.value);
      rename.onkeydown = e => {
        if (e.key === 'Enter') rename.blur();
        else if (e.key === 'Escape') { rename.value = t.outlines[id]?.name ?? rename.value; rename.blur(); }
      };
    }
  }
}
