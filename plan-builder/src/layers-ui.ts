// The Layers panel's Outlines section: one row per outline, then what to outline next (the plot boundary,
// House, or a custom feature named from quick picks or typed). Tapping a row selects that outline; the row of
// the outline being drawn or edited expands into a card with its step and actions (there is no
// panel over the plan).
import { formatArea, outlineSuggestions, type Outline } from './outline';
import { outlinesHints, panelState } from './panel-state';
import type { OutlineTool } from './outline-ui';
import { picker } from './surfaces-ui';
import type { MaterialId } from './materials';
import { drawingCard, editActions, wireLayerCard, wireReorder } from './layer-card';
import { button, caption, chips, esc, hint, input, label, layerActions, layerCard, layerForm, layerRow, splitRow, suggestRow, type Swatch } from './ui';

export class OutlinesSection {
  private naming = false; // the custom-feature name form is open
  private filling = false; // the boundary card's material picker for the plot fill is open

  constructor(private el: HTMLElement, private tool: OutlineTool) {}

  render() {
    const t = this.tool, all = Object.values(t.outlines);
    if (t.drawing) this.naming = false;
    if (!t.fillable || !t.cal || t.selected === null || t.outlines[t.selected]?.kind !== 'boundary') this.filling = false;
    const typed = this.el.querySelector<HTMLInputElement>('#outline-name')?.value ?? ''; // survives re-renders
    const s = outlineSuggestions(all);
    const ordered = [...all.filter(o => o.kind === 'boundary'), ...all.filter(o => o.kind === 'feature')];
    const rows = ordered.map(o => o.id === t.drawing || (!t.drawing && o.id === t.selected) ? this.card(o) : layerRow(o.name, {
      swatch: swatchOf(o), data: { layer: o.id }, grip: o.kind === 'feature', eye: { id: o.id, hidden: t.isHidden(o.id) },
      sub: o.kind === 'boundary' && o.closed ? areaText(t.areaSqft(o)) : undefined, // the plot area, quietly, once scaled
    }));
    const placed = Object.values(t.symbols.placed).length + Object.values(t.lines.placed).length + all.filter(o => o.kind === 'surface').length;
    const guide = outlinesHints(panelState({ boundaryClosed: t.boundaryClosed, scaleSet: !!t.cal, placed }), !!t.drawing).map(hint).join('');
    const suggestions = [
      ...(s.boundary ? [suggestRow('Plot boundary', { start: 'boundary' })] : []),
      ...s.features.map(n => suggestRow(n, { feature: n })),
    ];
    this.el.innerHTML = `
      ${guide}
      ${rows.join('')}${suggestions.join('')}
      ${this.naming ? layerForm(`
          ${caption('Common features')}
          ${chips(s.picks.map(n => button(esc(n), { mods: ['chip'], data: { feature: n } })))}
          ${label('outline-name', 'Or type a name')}
          ${input('outline-name', { placeholder: 'e.g. AC pad', value: typed })}
          ${splitRow(button('Outline', { type: 'submit', variant: 'primary' }), button('Cancel', { data: { act: 'cancel-name' } }))}`)
        : suggestRow('Custom outline…', { act: 'name' })}`;

    this.el.querySelectorAll<HTMLButtonElement>('[data-eye]').forEach(b => { b.onclick = () => t.toggleLayer(b.dataset.eye!); });
    this.el.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.layer!;
        if (id === t.drawing) return;
        t.selectOutline(id !== t.selected ? id : null);
      };
    });
    this.wireCard();
    wireReorder(this.el, t);
    this.el.querySelector<HTMLButtonElement>('[data-act=fill-plot]')?.addEventListener('click', () => { this.filling = true; this.render(); });
    this.el.querySelector<HTMLButtonElement>('[data-act=cancel-fill]')?.addEventListener('click', () => { this.filling = false; this.render(); });
    this.el.querySelectorAll<HTMLButtonElement>('[data-fill-material]').forEach(b => { b.onclick = () => { this.filling = false; t.fillPlot(b.dataset.fillMaterial as MaterialId); }; });
    this.el.querySelector<HTMLButtonElement>('[data-start=boundary]')?.addEventListener('click', () => t.startBoundary());
    this.el.querySelectorAll<HTMLButtonElement>('[data-feature]').forEach(b => { b.onclick = () => t.startFeature(b.dataset.feature!); });
    this.el.querySelector<HTMLButtonElement>('[data-act=name]')?.addEventListener('click', () => {
      this.naming = true; this.render(); this.el.querySelector<HTMLInputElement>('#outline-name')!.focus();
    });
    this.el.querySelector<HTMLButtonElement>('[data-act=cancel-name]')?.addEventListener('click', () => { this.naming = false; this.render(); });
    const form = this.el.querySelector<HTMLFormElement>('form');
    if (form) form.onsubmit = e => {
      e.preventDefault();
      const name = this.el.querySelector<HTMLInputElement>('#outline-name')!.value.trim();
      if (name) t.startFeature(name);
    };
  }

  /** The expanded row: drawing — the step and Close shape / Cancel; selected — rename, Redraw, trash. */
  private card(o: Outline): string {
    const t = this.tool;
    if (o.id === t.drawing) return drawingCard(t, o, swatchOf(o), o.kind === 'boundary' ? 'plot boundary' : o.name);
    const feature = o.kind === 'feature';
    return layerCard({
      id: o.id, swatch: swatchOf(o), name: o.name, rename: feature,
      sub: o.kind === 'boundary' ? areaText(t.areaSqft(o)) : undefined,
      actions: editActions(feature), body: o.kind === 'boundary' ? this.fillOffer() : '',
    });
  }
  /** The plot boundary card's "Fill with surface": one surface over the whole lot (once scaled, and only if there is no fill yet). */
  private fillOffer(): string {
    const t = this.tool;
    if (!t.fillable || !t.cal) return '';
    if (!this.filling) return layerActions(button('Fill with surface', { mods: ['compact'], data: { act: 'fill-plot' } }));
    return layerForm(`${hint('Pick the surface to cover the whole plot. It follows the plot boundary.')}${picker().replace(/data-material=/g, 'data-fill-material=')}${button('Cancel', { mods: ['compact'], data: { act: 'cancel-fill' } })}`);
  }
  private wireCard() {
    const card = this.el.querySelector<HTMLElement>('[data-card]');
    if (card) wireLayerCard(card, this.tool);
  }
}

/** A row's swatch: the outline kind, or a surface's material. */
const swatchOf = (o: Outline): Swatch => o.kind === 'surface' ? { material: o.material! } : o.kind;
const areaText = (sqft: number | null) => sqft === null ? undefined : formatArea(sqft);
