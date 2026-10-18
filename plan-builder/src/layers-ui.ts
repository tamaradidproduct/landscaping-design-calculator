// The Layers panel's Outlines section: one row per outline, then what to outline next (the plot boundary,
// House, or a custom feature named from quick picks or typed). Tapping a row selects that outline; the row of
// the outline being drawn or edited expands into a card with its step, nudge arrows and actions (there is no
// panel over the plan).
import { formatArea, outlineSuggestions, type Outline } from './outline';
import type { OutlineTool } from './outline-ui';
import { drawingCard, editActions, orderControl, wireLayerCard } from './layer-card';
import { button, caption, chips, esc, hint, input, label, layerCard, layerForm, layerRow, nudgePad, splitRow, suggestRow, type Swatch } from './ui';

export class OutlinesSection {
  private naming = false; // the custom-feature name form is open

  constructor(private el: HTMLElement, private tool: OutlineTool) {}

  render() {
    const t = this.tool, all = Object.values(t.outlines);
    if (t.drawing) this.naming = false;
    const typed = this.el.querySelector<HTMLInputElement>('#outline-name')?.value ?? ''; // survives re-renders
    const s = outlineSuggestions(all);
    const ordered = [...all.filter(o => o.kind === 'boundary'), ...all.filter(o => o.kind === 'feature')];
    const rows = ordered.map(o => o.id === t.drawing || (!t.drawing && o.id === t.selected) ? this.card(o) : layerRow(o.name, {
      swatch: swatchOf(o), data: { layer: o.id }, eye: { id: o.id, hidden: t.isHidden(o.id) },
      sub: o.kind === 'boundary' && o.closed ? areaText(t.areaSqft(o)) : undefined, // the plot area, quietly, once scaled
    }));
    const scaleHint = !t.cal && all.some(o => o.closed) && !t.drawing
      ? hint('Tap an edge and type its printed length to set the scale.') : '';
    const suggestions = [
      ...(s.boundary ? [suggestRow('Plot boundary', { start: 'boundary' })] : []),
      ...s.features.map(n => suggestRow(n, { feature: n })),
    ];
    this.el.innerHTML = `
      ${all.length ? '' : hint('Trace what is already on the lot. Start with the plot boundary to set the scale.')}
      ${rows.join('')}${scaleHint}${suggestions.join('')}
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

  /** The expanded row: drawing — the step and Close shape / Cancel; selected — rename, nudge, Square all, Redo, Delete. */
  private card(o: Outline): string {
    const t = this.tool;
    if (o.id === t.drawing) return drawingCard(t, o, swatchOf(o), o.kind === 'boundary' ? 'plot boundary' : o.name);
    const feature = o.kind === 'feature';
    return layerCard({
      id: o.id, swatch: swatchOf(o), name: o.name, done: true, rename: feature,
      sub: o.kind === 'boundary' ? areaText(t.areaSqft(o)) : undefined,
      body: `${t.cornerSelected ? nudgePad() : ''}${editActions(feature)}${feature ? orderControl(t, o.id) : ''}`,
    });
  }
  private wireCard() {
    const card = this.el.querySelector<HTMLElement>('[data-card]');
    if (card) wireLayerCard(card, this.tool);
  }
}

/** A row's swatch: the outline kind, or a surface's material. */
const swatchOf = (o: Outline): Swatch => o.kind === 'surface' ? { material: o.material! } : o.kind;
const areaText = (sqft: number | null) => sqft === null ? undefined : formatArea(sqft);
