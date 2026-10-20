// The Layers panel's Surfaces section: the new work (hardscape and softscape zones), above Outlines. One row per
// zone in layer order (a higher zone cuts the ones below; outlines cut every zone), then "Add surface…", which
// opens a material picker; picking a material starts drawing. The zone being drawn or selected expands into a card.
import { material, materialsByFamily, type MaterialId } from './materials';
import { TEX_SCALE } from './outline';
import { formatFeet, parseFeet, parseRadius, stepTexScale, type Outline } from './outline';
import { stepRadius } from './shape-edit';
import type { OutlineTool } from './outline-ui';
import { drawingCard, editActions, orderControl, wireLayerCard } from './layer-card';
import { button, caption, choiceLine, esc, field, formStack, hint, input, layerActions, layerCard, layerForm, layerRow, nudgePad, row, suggestRow, swatch } from './ui';

/** Every material as a list, grouped by family under a caption; `current` is marked. */
const picker = (current?: MaterialId) => materialsByFamily().map(({ family, materials }) => `${caption(family)}<div class="layer-list material-list">${materials.map(m =>
  button(`${swatch({ material: m.id })}<span class="layer-name">${esc(m.name)}</span>`, { mods: ['layer-row', ...(m.id === current ? ['selected'] : [])], pressed: m.id === current, data: { material: m.id } })).join('')}</div>`).join('');

export class SurfacesSection {
  private picking = false; // the material picker for a new zone is open
  private filling = false; // the material picker for the plot fill is open
  private changing: string | null = null; // the zone whose material picker is open in its card

  constructor(private el: HTMLElement, private tool: OutlineTool) {}

  render() {
    const t = this.tool;
    const zones = Object.values(t.outlines).filter(o => o.kind === 'surface');
    if (!t.boundaryClosed && !zones.length) { this.picking = false; this.el.innerHTML = hint('Outline the plot boundary first.'); return; }
    if (t.drawing || !t.boundaryClosed) this.picking = this.filling = false;
    if (!t.fillable) this.filling = false;
    if (this.changing && this.changing !== t.selected) this.changing = null; // the picker closes with the card
    const rows = zones.map(o => o.id === t.drawing || (!t.drawing && o.id === t.selected) ? this.card(o)
      : layerRow(o.name, { swatch: { material: o.material! }, data: { zone: o.id }, eye: { id: o.id, hidden: t.isHidden(o.id) } }));
    this.el.innerHTML = `
      ${zones.length ? '' : hint('Add the new surfaces: lawn, beds, patio…')}
      ${rows.join('')}
      ${t.drawing || !t.boundaryClosed ? '' : this.picking || this.filling
        ? layerForm(`${this.filling ? hint('Pick the surface to cover the whole plot. It follows the plot boundary.') : ''}${picker()}${button('Cancel', { mods: ['compact'], data: { act: 'cancel-picker' } })}`)
        : `${suggestRow('Add surface…', { act: 'add-surface' })}${t.fillable ? suggestRow('Fill the plot…', { act: 'fill-plot' }) : ''}`}`;

    this.el.querySelectorAll<HTMLButtonElement>('[data-zone]').forEach(b => {
      b.onclick = () => { const id = b.dataset.zone!; t.selectOutline(id !== t.selected ? id : null); };
    });
    // Adding a zone closes the selected one's card, so only one material picker shows at a time.
    this.el.querySelector<HTMLButtonElement>('[data-act=add-surface]')?.addEventListener('click', () => { this.picking = true; if (t.selected) t.selectOutline(null); else this.render(); });
    this.el.querySelector<HTMLButtonElement>('[data-act=fill-plot]')?.addEventListener('click', () => { this.filling = true; if (t.selected) t.selectOutline(null); else this.render(); });
    this.el.querySelector<HTMLButtonElement>('[data-act=cancel-picker]')?.addEventListener('click', () => { this.picking = this.filling = false; this.render(); });
    this.el.querySelectorAll<HTMLButtonElement>('[data-eye]').forEach(b => { b.onclick = () => t.toggleLayer(b.dataset.eye!); });
    const card = this.el.querySelector<HTMLElement>('[data-card]');
    // The picker's chips start a new zone; the card's chips change that zone's material.
    this.el.querySelectorAll<HTMLButtonElement>('.layer-form [data-material]').forEach(b => {
      b.onclick = () => { if (this.filling) { this.filling = false; t.fillPlot(b.dataset.material as MaterialId); } else t.startSurface(b.dataset.material as MaterialId); };
    });
    card?.querySelectorAll<HTMLButtonElement>('[data-material]').forEach(b => { b.onclick = () => { this.changing = null; t.setMaterial(card.dataset.card!, b.dataset.material as MaterialId); this.render(); }; });
    this.el.querySelector('form')?.addEventListener('submit', e => e.preventDefault());
    if (card) wireLayerCard(card, t, { 'change-material': () => { this.changing = card.dataset.card!; this.render(); } });
    const scaleOf = () => t.outlines[card?.dataset.card ?? '']?.texScale ?? 1;
    card?.querySelector<HTMLButtonElement>('[data-act=tex-down]')?.addEventListener('click', () => t.setTexScale(card.dataset.card!, stepTexScale(scaleOf(), -1)));
    card?.querySelector<HTMLButtonElement>('[data-act=tex-up]')?.addEventListener('click', () => t.setTexScale(card.dataset.card!, stepTexScale(scaleOf(), 1)));
    card?.querySelector<HTMLButtonElement>('[data-act=tex-reset]')?.addEventListener('click', () => t.setTexScale(card.dataset.card!, 1));
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
    if (round && card) {
      const field = round.querySelector<HTMLInputElement>('input')!, id = card.dataset.card!;
      round.onsubmit = e => {
        e.preventDefault();
        const ft = parseRadius(field.value);
        if (ft !== null) t.roundAll(id, ft);
      };
      // Arrow keys step the radius live (0.5′, Shift 2′), like a corner's; the field keeps focus through the redraw.
      field.onkeydown = e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const ft = stepRadius(parseRadius(field.value) ?? t.uniformRadius(id), e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
        t.roundAll(id, ft, true);
        const next = this.el.querySelector<HTMLInputElement>('form.round-all input');
        if (next) { next.value = ft ? String(ft) : ''; next.focus(); }
      };
    }
  }

  /** Width × Depth of the zone's bounding box with an aspect lock between them (needs a scale). */
  private size(o: Outline): string {
    const t = this.tool, b = t.zoneBox(o.id); if (!b) return '';
    const box = (id: string, text: string, ft: number) => field(id, text, input(id, { inputmode: 'decimal', value: formatFeet(ft), ariaLabel: text }));
    return formStack(`${row(box('zone-width', 'Width', b.w),
      button('<svg class="line-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 013.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 014.5 9l1-1"/></svg>', { mods: ['icon', 'small', 'toggle'], pressed: t.aspectLock, ariaLabel: 'Lock aspect ratio', data: { act: 'aspect-lock' } }),
      box('zone-depth', 'Depth', b.h))}`, 'zone-size', true);
  }

  /** Texture scale: − smaller, the percent (tap to reset to 100%), + larger. */
  private texScale(o: Outline): string {
    const s = o.texScale ?? 1;
    return `<div class="tex-scale"><span class="text-label">Texture</span><div class="row">${
      button('−', { mods: ['icon'], ariaLabel: 'Smaller texture', data: { act: 'tex-down' }, disabled: s <= TEX_SCALE.min })}${
      button(`${Math.round(s * 100)}%`, { mods: ['compact'], ariaLabel: 'Reset texture scale to 100%', data: { act: 'tex-reset' } })}${
      button('+', { mods: ['icon'], ariaLabel: 'Larger texture', data: { act: 'tex-up' }, disabled: s >= TEX_SCALE.max })}</div></div>`;
  }

  /** The expanded row: drawing — the step and Close shape / Cancel; selected — rename, material, rounding, tidy, order. */
  private card(o: Outline): string {
    const t = this.tool, sw = { material: o.material! };
    if (o.id === t.drawing) return drawingCard(t, o, sw, o.name.toLowerCase());
    // The material shows as one line; Change opens the picker in place.
    const mat = this.changing === o.id ? picker(o.material)
      : choiceLine(swatch(sw), material(o.material!).name, button('Change', { mods: ['compact'], data: { act: 'change-material' } }));
    const round = t.cal ? formStack(row(
      input('round-all', { inputmode: 'decimal', placeholder: 'Round all corners, e.g. 2′ (↑ ↓ to adjust)', ariaLabel: 'Round all corners' }), button('Apply', { mods: ['compact'], type: 'submit' })), 'round-all') : '';
    // The plot fill follows the boundary: its material and texture can change, its shape cannot.
    if (o.base) return layerCard({
      id: o.id, swatch: sw, name: o.name, done: true,
      body: `${mat}${this.texScale(o)}${hint('Follows the plot boundary.')}${layerActions(button('Delete', { variant: 'danger', mods: ['compact'], data: { act: 'delete' } }))}`,
    });
    return layerCard({
      id: o.id, swatch: sw, name: o.name, done: true, rename: true, renameId: 'surface-rename',
      body: `${mat}${this.texScale(o)}${this.size(o)}${t.cornerSelected ? nudgePad() : ''}${round}${editActions(true)}${orderControl(t, o.id)}`,
    });
  }
}
