// The Layers panel's Surfaces section: the new work (hardscape and softscape zones), above Outlines. One row per
// zone in layer order (a higher zone cuts the ones below; outlines cut every zone). New zones start from the tool row's
// Surface tool (tool-row.ts). The zone being drawn or selected expands into a card.
import type { MaterialId } from './materials';
import { TEX_SCALE } from './outline';
import { formatArea, formatFeet, parseFeet, parseRadius, stepTexScale, isAssigned, type Outline } from './outline';
import { radiusDisplay, roundAllRequest } from './card-helpers';
import { stepRadius } from './shape-edit';
import type { OutlineTool } from './outline-ui';
import { drawingCard, editActions, wireLayerCard, wireReorder } from './layer-card';
import { popoverHtml } from './tool-row';
import { loadRecent, pushRecent, saveRecent, search, searchEntries, tagsFor } from './search-index';
import { button, caption, disclosure, field, formStack, hint, iconButton, input, layerCard, layerRow, row, swatch } from './ui';

/** The material grid's search state: the typed query, the tag chip, and the Recent picks read when it opened. */
export interface GridState { query: string; tag: string; recent: string[] }
export const newGrid = (): GridState => ({ query: '', tag: 'Surfaces', recent: loadRecent() });

/** The shared search grid narrowed to surfaces (a surface card's Change / Assign material, the plot's Fill with surface);
 * `current` is marked. It opens on the Surfaces tag. */
export function materialGrid(g: GridState, current?: MaterialId, inputId = 'material-search'): string {
  const entries = searchEntries().filter(e => e.category === 'surfaces');
  const hintText = g.tag === 'Recent' && !g.query.trim() ? 'No recent surfaces yet.' : 'No matches.';
  return popoverHtml({ query: g.query, tag: g.tag, tags: tagsFor('surfaces'), results: search(g.query, g.tag, entries, g.recent), hint: hintText, inputId, placeholder: 'Search surfaces', current });
}

/** Wire a rendered material grid: typing and tags re-render (the field keeps focus), a tap picks (and is kept as Recent),
 * Escape dismisses without changing anything. */
export function wireMaterialGrid(pop: HTMLElement, g: GridState, on: { pick: (m: MaterialId) => void; dismiss: () => void; rerender: () => void }) {
  pop.querySelectorAll<HTMLButtonElement>('[data-tag]').forEach(b => { b.onclick = () => { g.tag = b.dataset.tag!; on.rerender(); }; });
  pop.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b => {
    b.onclick = () => { const id = b.dataset.pick!; saveRecent(pushRecent(loadRecent(), id)); on.pick(id as MaterialId); };
  });
  const field = pop.querySelector<HTMLInputElement>('input[type=search]');
  if (field) field.oninput = () => {
    g.query = field.value;
    const pos = field.selectionStart, id = field.id;
    on.rerender();
    const next = document.getElementById(id) as HTMLInputElement | null;
    if (next) { next.focus(); if (pos !== null) next.setSelectionRange(pos, pos); }
  };
  pop.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); on.dismiss(); } };
}

export class SurfacesSection {
  private changing: string | null = null; // the zone whose material grid is open in its card
  private grid = newGrid();
  private adjusting: string | null = null; // the zone whose "Corners and texture" disclosure is open
  private lastDrawing: string | null = null; // the zone being drawn at the last render (to spot Close shape)

  /** `onGridOpen` runs when Close shape opens the grid in the new zone's card (main closes the tool row's popover). */
  constructor(private el: HTMLElement, private tool: OutlineTool, private onGridOpen?: () => void) {}

  private openGrid(id: string) { this.changing = id; this.grid = newGrid(); }
  private pendingGrid: string | null = null; // a zone that opens its grid at the next render (Duplicate as surface)
  /** Open the material grid in a new unassigned zone's card, as Close shape does (Duplicate as surface). */
  openGridFor(id: string) { this.pendingGrid = id; this.render(); }

  render() {
    const t = this.tool;
    const zones = Object.values(t.outlines).filter(o => o.kind === 'surface');
    // Shape first: a zone just closed without a material opens the grid in its card.
    const closed = this.lastDrawing && !t.drawing && t.selected === this.lastDrawing ? t.outlines[this.lastDrawing] : undefined;
    this.lastDrawing = t.drawing;
    let opened = false;
    const fresh = closed ?? (this.pendingGrid && t.selected === this.pendingGrid && !t.drawing ? t.outlines[this.pendingGrid] : undefined);
    this.pendingGrid = null;
    if (fresh?.kind === 'surface' && fresh.closed && !isAssigned(fresh)) { this.openGrid(fresh.id); opened = true; }
    if (!t.boundaryClosed && !zones.length) { this.el.innerHTML = ''; return; }
    if (this.changing && (this.changing !== t.selected || t.drawing)) this.changing = null; // the grid closes with the card
    if (this.adjusting && (this.adjusting !== t.selected || t.drawing)) this.adjusting = null; // collapsed again when the selection changes
    const rows = zones.map(o => o.id === t.drawing || (!t.drawing && o.id === t.selected) ? this.card(o)
      : layerRow(o.name, { swatch: { material: o.material }, data: { zone: o.id }, grip: !o.base, eye: { id: o.id, hidden: t.isHidden(o.id) } }));
    this.el.innerHTML = rows.join('');

    this.el.querySelectorAll<HTMLButtonElement>('[data-zone]').forEach(b => {
      b.onclick = () => { const id = b.dataset.zone!; t.selectOutline(id !== t.selected ? id : null); };
    });
    this.el.querySelectorAll<HTMLButtonElement>('[data-eye]').forEach(b => { b.onclick = () => t.toggleLayer(b.dataset.eye!); });
    const card = this.el.querySelector<HTMLElement>('[data-card]');
    const dismiss = () => { this.changing = null; this.render(); };
    if (card) {
      const id = card.dataset.card!, open = () => { this.openGrid(id); this.render(); this.el.querySelector<HTMLInputElement>('#material-search')?.focus(); };
      wireLayerCard(card, t, { 'change-material': open, 'assign-material': open, 'cancel-material': dismiss });
      const pop = card.querySelector<HTMLElement>('.tool-popover');
      // A tap applies at once (one undo step) and closes the grid.
      if (pop) wireMaterialGrid(pop, this.grid, { pick: m => { this.changing = null; t.setMaterial(id, m); this.render(); }, dismiss, rerender: () => this.render() });
      if (opened && pop) { this.onGridOpen?.(); card.scrollIntoView({ block: 'nearest' }); }
    }
    wireReorder(this.el, t);
    this.el.querySelector('form')?.addEventListener('submit', e => e.preventDefault());
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
    return surfaceCard(this.tool, o, { open: this.adjusting === o.id, changing: this.changing === o.id, grid: this.grid });
  }
}

/** The card's "Assign material" / "Change material" line, the grid, and Cancel (which keeps the zone as it is). */
const materialPick = (o: Outline, g: GridState) =>
  `${caption(isAssigned(o) ? 'Change material' : 'Assign material')}${materialGrid(g, o.material)}${button('Cancel', { mods: ['compact'], data: { act: 'cancel-material' } })}`;

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
export function surfaceCard(t: OutlineTool, o: Outline, st: { open: boolean; changing: boolean; grid?: GridState }): string {
  const sw = { material: o.material };
  if (o.id === t.drawing) return drawingCard(t, o, sw, o.name.toLowerCase());
  // The swatch lives in the Material button (that's where the material is swapped); the grid opens in its place.
  // An unassigned zone says so and offers Assign material instead; either opens the shared grid in the card.
  const material = st.changing ? materialPick(o, st.grid ?? newGrid())
    : isAssigned(o) ? button(`${swatch(sw)}<span>Material</span>`, { mods: ['compact', 'with-swatch'], ariaLabel: 'Change material', data: { act: 'change-material' } })
    : `${hint('Not counted yet')}${button(`${swatch(sw)}<span>Assign material</span>`, { mods: ['compact', 'with-swatch'], data: { act: 'assign-material' } })}`;
  const rd = radiusDisplay(t.cornerRadiiFt(o.id));
  const round = t.cal ? formStack(field('round-all', 'Corner radius', row(
    input('round-all', { inputmode: 'decimal', value: rd.value, placeholder: rd.placeholder, ariaLabel: 'Corner radius' }), button('Done', { mods: ['compact'], type: 'submit' }))), 'round-all') : '';
  if (o.base) return layerCard({
    id: o.id, name: o.name,
    actions: iconButton('trash', { ariaLabel: 'Delete', variant: 'danger', data: { act: 'delete' } }),
    body: `${material}${texScale(o)}${hint('Follows the plot boundary.')}`,
  });
  const adjust = disclosure('adjust', 'Corners and texture', st.open, `${round}${texScale(o)}`);
  const area = t.areaSqft(o);
  return layerCard({
    id: o.id, name: o.name, sub: area === null ? undefined : formatArea(area), rename: true, renameId: 'surface-rename',
    actions: editActions(true), body: `${material}${sizeForm(t, o)}${adjust}`,
  });
}
