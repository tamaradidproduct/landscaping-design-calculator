// The Layers panel's Surfaces section: the new work (hardscape and softscape zones), above Outlines. One row per
// zone in layer order (a higher zone cuts the ones below; outlines cut every zone), then "Add surface…", which
// opens a material picker; picking a material starts drawing. The zone being drawn or selected expands into a card.
import { material, materialsByTrade, type MaterialId, type Trade } from './materials';
import { parseRadius, type Outline } from './outline';
import type { OutlineTool } from './outline-ui';
import { drawingCard, editActions, orderControl, wireLayerCard } from './layer-card';
import { button, caption, choiceLine, chips, esc, field, formStack, hint, input, layerCard, layerForm, layerRow, nudgePad, row, suggestRow, swatch } from './ui';

const TRADES: [Trade, string][] = [['hardscape', 'Hardscape'], ['softscape', 'Softscape']];

/** Chips for every material, grouped by trade; `current` is marked. */
const picker = (current?: MaterialId) => TRADES.map(([trade, title]) => `${caption(title)}${chips(materialsByTrade(trade).map(m =>
  button(`${swatch({ material: m.id })}${esc(m.name)}`, { mods: ['chip', 'compact', 'material-chip'], pressed: m.id === current, data: { material: m.id } })))}`).join('');

export class SurfacesSection {
  private picking = false; // the material picker for a new zone is open
  private changing: string | null = null; // the zone whose material picker is open in its card

  constructor(private el: HTMLElement, private tool: OutlineTool) {}

  render() {
    const t = this.tool;
    const zones = Object.values(t.outlines).filter(o => o.kind === 'surface');
    if (!t.boundaryClosed && !zones.length) { this.picking = false; this.el.innerHTML = hint('Outline the plot boundary first.'); return; }
    if (t.drawing || !t.boundaryClosed) this.picking = false;
    if (this.changing && this.changing !== t.selected) this.changing = null; // the picker closes with the card
    const rows = zones.map(o => o.id === t.drawing || (!t.drawing && o.id === t.selected) ? this.card(o)
      : layerRow(o.name, { swatch: { material: o.material! }, data: { zone: o.id } }));
    this.el.innerHTML = `
      ${zones.length ? '' : hint('Add the new surfaces: lawn, beds, patio…')}
      ${rows.join('')}
      ${t.drawing || !t.boundaryClosed ? '' : this.picking
        ? layerForm(`${picker()}${button('Cancel', { mods: ['compact'], data: { act: 'cancel-picker' } })}`)
        : suggestRow('Add surface…', { act: 'add-surface' })}`;

    this.el.querySelectorAll<HTMLButtonElement>('[data-zone]').forEach(b => {
      b.onclick = () => { const id = b.dataset.zone!; t.selectOutline(id !== t.selected ? id : null); };
    });
    // Adding a zone closes the selected one's card, so only one material picker shows at a time.
    this.el.querySelector<HTMLButtonElement>('[data-act=add-surface]')?.addEventListener('click', () => { this.picking = true; if (t.selected) t.selectOutline(null); else this.render(); });
    this.el.querySelector<HTMLButtonElement>('[data-act=cancel-picker]')?.addEventListener('click', () => { this.picking = false; this.render(); });
    const card = this.el.querySelector<HTMLElement>('[data-card]');
    // The picker's chips start a new zone; the card's chips change that zone's material.
    this.el.querySelectorAll<HTMLButtonElement>('.layer-form [data-material]').forEach(b => { b.onclick = () => t.startSurface(b.dataset.material as MaterialId); });
    card?.querySelectorAll<HTMLButtonElement>('[data-material]').forEach(b => { b.onclick = () => { this.changing = null; t.setMaterial(card.dataset.card!, b.dataset.material as MaterialId); this.render(); }; });
    this.el.querySelector('form')?.addEventListener('submit', e => e.preventDefault());
    if (card) wireLayerCard(card, t, { 'change-material': () => { this.changing = card.dataset.card!; this.render(); } });
    const round = this.el.querySelector<HTMLFormElement>('form.round-all');
    if (round && card) round.onsubmit = e => {
      e.preventDefault();
      const ft = parseRadius(round.querySelector('input')!.value);
      if (ft !== null) t.roundAll(card.dataset.card!, ft);
    };
  }

  /** The expanded row: drawing — the step and Close shape / Cancel; selected — rename, material, rounding, tidy, order. */
  private card(o: Outline): string {
    const t = this.tool, sw = { material: o.material! };
    if (o.id === t.drawing) return drawingCard(t, o, sw, o.name.toLowerCase());
    // The material shows as one line; Change opens the picker in place.
    const mat = this.changing === o.id ? picker(o.material)
      : choiceLine(swatch(sw), material(o.material!).name, button('Change', { mods: ['compact'], data: { act: 'change-material' } }));
    const round = t.cal ? formStack(field('round-all', 'Round all corners', row(
      input('round-all', { inputmode: 'decimal', placeholder: 'Radius, e.g. 2′' }), button('Apply', { mods: ['compact'], type: 'submit' }))), 'round-all') : '';
    return layerCard({
      id: o.id, swatch: sw, name: o.name, done: true, rename: true, renameId: 'surface-rename',
      body: `${caption('Material')}${mat}${t.cornerSelected ? nudgePad() : ''}${round}${editActions(true)}${orderControl(t, o.id)}`,
    });
  }
}
