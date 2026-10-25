// The Layers panel's Surfaces section: the new work (hardscape and softscape zones), above Outlines. One row per
// zone in layer order (a higher zone cuts the ones below; outlines cut every zone), then "Add surface…", which
// opens a material picker; picking a material starts drawing. The zone being drawn or selected expands into a card.
import { materialsByFamily, type MaterialId } from './materials';
import { TEX_SCALE } from './outline';
import { formatArea, formatFeet, parseFeet, parseRadius, stepTexScale, type Outline } from './outline';
import { radiusDisplay, roundAllRequest } from './card-helpers';
import { stepRadius } from './shape-edit';
import type { OutlineTool } from './outline-ui';
import { drawingCard, editActions, wireLayerCard, wireReorder } from './layer-card';
import { button, caption, disclosure, esc, field, formStack, input, layerCard, layerForm, layerRow, row, swatch } from './ui';

/** Every material as a list, grouped by family under a caption; `current` is marked. */
const picker = (current?: MaterialId) => materialsByFamily().map(({ family, materials }) => `${caption(family)}<div class="layer-list material-list">${materials.map(m =>
  button(`${swatch({ material: m.id })}<span class="layer-name">${esc(m.name)}</span>`, { mods: ['layer-row', ...(m.id === current ? ['selected'] : [])], pressed: m.id === current, data: { material: m.id } })).join('')}</div>`).join('');

export class SurfacesSection {
  private picking = false; // the material picker for a new zone is open
  private changing: string | null = null; // the zone whose material picker is open in its card
  private adjusting: string | null = null; // the zone whose "Corners and texture" disclosure is open

  constructor(private el: HTMLElement, private tool: OutlineTool) {}

  get pickerOpen() { return this.picking; }
  /** The global Add menu's "Surface": open the material picker (adding a zone closes the selected one's card). */
  openPicker() { this.picking = true; if (this.tool.selected) this.tool.selectOutline(null); else this.render(); }

  render() {
    const t = this.tool;
    const zones = Object.values(t.outlines).filter(o => o.kind === 'surface');
    if (!t.boundaryClosed && !zones.length) { this.picking = false; this.el.innerHTML = ''; return; }
    if (t.drawing || !t.boundaryClosed) this.picking = false;
    if (this.changing && this.changing !== t.selected) this.changing = null; // the picker closes with the card
    if (this.adjusting && (this.adjusting !== t.selected || t.drawing)) this.adjusting = null; // collapsed again when the selection changes
    const rows = zones.map(o => o.id === t.drawing || (!t.drawing && o.id === t.selected) ? this.card(o)
      : layerRow(o.name, { swatch: { material: o.material! }, data: { zone: o.id }, grip: true, eye: { id: o.id, hidden: t.isHidden(o.id) } }));
    this.el.innerHTML = `
      ${rows.join('')}
      ${t.drawing || !t.boundaryClosed ? '' : this.picking
        ? layerForm(`${picker()}${button('Cancel', { mods: ['compact'], data: { act: 'cancel-picker' } })}`)
        : ''}`;

    this.el.querySelectorAll<HTMLButtonElement>('[data-zone]').forEach(b => {
      b.onclick = () => { const id = b.dataset.zone!; t.selectOutline(id !== t.selected ? id : null); };
    });
    this.el.querySelector<HTMLButtonElement>('[data-act=cancel-picker]')?.addEventListener('click', () => { this.picking = false; this.render(); });
    this.el.querySelectorAll<HTMLButtonElement>('[data-eye]').forEach(b => { b.onclick = () => t.toggleLayer(b.dataset.eye!); });
    const card = this.el.querySelector<HTMLElement>('[data-card]');
    // The picker's chips start a new zone; the card's chips change that zone's material.
    this.el.querySelectorAll<HTMLButtonElement>('.layer-form [data-material]').forEach(b => { b.onclick = () => t.startSurface(b.dataset.material as MaterialId); });
    card?.querySelectorAll<HTMLButtonElement>('[data-material]').forEach(b => { b.onclick = () => { this.changing = null; t.setMaterial(card.dataset.card!, b.dataset.material as MaterialId); this.render(); }; });
    wireReorder(this.el, t);
    this.el.querySelector('form')?.addEventListener('submit', e => e.preventDefault());
    if (card) wireLayerCard(card, t, { 'change-material': () => { this.changing = card.dataset.card!; this.render(); } });
    card?.querySelector<HTMLButtonElement>('[data-disclosure=adjust]')?.addEventListener('click', () => { this.adjusting = this.adjusting === card.dataset.card ? null : card.dataset.card!; this.render(); });
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
        const ft = roundAllRequest(field.value);
        if (ft !== null) t.roundAll(id, ft);
      };
      // Arrow keys step the radius live (0.5′, Shift 2′), like a corner's; the field keeps focus through the redraw.
      field.onkeydown = e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const ft = stepRadius(parseRadius(field.value) ?? 0, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
        t.roundAll(id, ft, true);
        const next = this.el.querySelector<HTMLInputElement>('form.round-all input');
        if (next) { next.value = ft ? String(ft) : ''; next.focus(); }
      };
    }
  }

  private card(o: Outline): string {
    return surfaceCard(this.tool, o, { open: this.adjusting === o.id, changing: this.changing === o.id });
  }
}

/** Width × Depth of the zone's bounding box with an aspect lock between them (needs a scale). */
function sizeForm(t: OutlineTool, o: Outline): string {
  const b = t.zoneBox(o.id); if (!b) return '';
  const box = (id: string, text: string, ft: number) => field(id, text, input(id, { inputmode: 'decimal', value: formatFeet(ft), ariaLabel: text }));
  return formStack(`${row(box('zone-width', 'Width', b.w),
    button('<svg class="line-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.5l1-1a2.5 2.5 0 013.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 014.5 9l1-1"/></svg>', { mods: ['icon', 'small', 'toggle'], pressed: t.aspectLock, ariaLabel: 'Lock aspect ratio', data: { act: 'aspect-lock' } }),
    box('zone-depth', 'Depth', b.h))}`, 'zone-size', true);
}

/** Texture scale: − smaller, the percent (tap to reset to 100%), + larger. */
function texScale(o: Outline): string {
  const s = o.texScale ?? 1;
  return `<div class="tex-scale"><span class="text-label">Texture</span><div class="row">${
    button('−', { mods: ['icon'], ariaLabel: 'Smaller texture', data: { act: 'tex-down' }, disabled: s <= TEX_SCALE.min })}${
    button(`${Math.round(s * 100)}%`, { mods: ['compact'], ariaLabel: 'Reset texture scale to 100%', data: { act: 'tex-reset' } })}${
    button('+', { mods: ['icon'], ariaLabel: 'Larger texture', data: { act: 'tex-up' }, disabled: s >= TEX_SCALE.max })}</div></div>`;
}

/** The selected zone's card: the name with its area beneath, the Material button (its swatch; aria-label Change material),
 * Width × Depth, then the closed "Corners and texture" disclosure; Redraw and trash in the header. */
export function surfaceCard(t: OutlineTool, o: Outline, st: { open: boolean; changing: boolean }): string {
  const sw = { material: o.material! };
  if (o.id === t.drawing) return drawingCard(t, o, sw, o.name.toLowerCase());
  // The swatch lives in the Material button (that's where the material is swapped); the picker opens in its place.
  const change = button(`${swatch(sw)}<span>Material</span>`, { mods: ['compact', 'with-swatch'], ariaLabel: 'Change material', data: { act: 'change-material' } });
  const rd = radiusDisplay(t.cornerRadiiFt(o.id));
  const round = t.cal ? formStack(field('round-all', 'Corner radius', row(
    input('round-all', { inputmode: 'decimal', value: rd.value, placeholder: rd.placeholder, ariaLabel: 'Corner radius' }), button('Done', { mods: ['compact'], type: 'submit' }))), 'round-all') : '';
  const adjust = disclosure('adjust', 'Corners and texture', st.open, `${round}${texScale(o)}`);
  const area = t.areaSqft(o);
  return layerCard({
    id: o.id, name: o.name, sub: area === null ? undefined : formatArea(area), rename: true, renameId: 'surface-rename',
    actions: editActions(true), body: `${st.changing ? picker(o.material) : change}${sizeForm(t, o)}${adjust}`,
  });
}
