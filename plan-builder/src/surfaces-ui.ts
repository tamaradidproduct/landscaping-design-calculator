// The Layers panel's Surfaces section: the new work (hardscape and softscape zones), above Outlines. One row per
// zone in layer order (a higher zone cuts the ones below; outlines cut every zone), then "Add surface…", which
// opens a material picker; picking a material starts drawing. The zone being drawn or selected expands into a card.
import { material, materialsByFamily, type MaterialId } from './materials';
import { formatFeet, parseFeet, parseRadius, type Outline } from './outline';
import type { OutlineTool } from './outline-ui';
import { drawingCard, editActions, orderControl, wireLayerCard } from './layer-card';
import { button, caption, choiceLine, chips, esc, field, formStack, hint, input, layerCard, layerForm, layerRow, nudgePad, row, suggestRow, swatch } from './ui';

/** Chips for every material, grouped by family; `current` is marked. */
const picker = (current?: MaterialId) => materialsByFamily().map(({ family, materials }) => `${caption(family)}${chips(materials.map(m =>
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
    const size = this.el.querySelector<HTMLFormElement>('form.zone-size');
    if (size && card) {
      const commit = (axis: 'w' | 'h', el: HTMLInputElement) => {
        const ft = parseFeet(el.value), b = t.zoneBox(card.dataset.card!);
        if (ft && ft > 0) t.resizeZone(card.dataset.card!, axis, ft); else if (b) el.value = formatFeet(b[axis]);
      };
      const w = size.querySelector<HTMLInputElement>('#zone-width')!, d = size.querySelector<HTMLInputElement>('#zone-depth')!;
      size.onsubmit = e => { e.preventDefault(); };
      w.onchange = () => commit('w', w); d.onchange = () => commit('h', d);
      for (const el of [w, d]) el.onkeydown = e => { if (e.key === 'Enter') el.blur(); };
      size.querySelector<HTMLButtonElement>('[data-act=aspect-lock]')!.onclick = () => { t.aspectLock = !t.aspectLock; this.render(); };
    }
    const round = this.el.querySelector<HTMLFormElement>('form.round-all');
    if (round && card) round.onsubmit = e => {
      e.preventDefault();
      const ft = parseRadius(round.querySelector('input')!.value);
      if (ft !== null) t.roundAll(card.dataset.card!, ft);
    };
  }

  /** Width × Depth of the zone's bounding box with an aspect lock between them (needs a scale). */
  private size(o: Outline): string {
    const t = this.tool, b = t.zoneBox(o.id); if (!b) return '';
    const box = (id: string, text: string, ft: number) => field(id, text, input(id, { inputmode: 'decimal', value: formatFeet(ft), ariaLabel: text }));
    return formStack(`${caption('Size')}${row(box('zone-width', 'Width', b.w),
      button('<svg class="line-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 013.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 014.5 9l1-1"/></svg>', { mods: ['icon', 'small', 'toggle'], pressed: t.aspectLock, ariaLabel: 'Lock aspect ratio', data: { act: 'aspect-lock' } }),
      box('zone-depth', 'Depth', b.h))}`, 'zone-size', true);
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
      body: `${caption('Material')}${mat}${this.size(o)}${t.cornerSelected ? nudgePad() : ''}${round}${editActions(true)}${orderControl(t, o.id)}`,
    });
  }
}
