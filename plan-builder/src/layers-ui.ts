// The Layers panel's Outlines section: one row per outline, then what to outline next (the plot boundary,
// House, or a custom feature named from quick picks or typed). Tapping a row selects that outline for editing.
import { outlineSuggestions } from './outline';
import type { OutlineTool } from './outline-ui';
import { formatArea } from './outline';
import { button, caption, chips, esc, hint, input, label, layerForm, layerRow, splitRow, suggestRow } from './ui';

export class OutlinesSection {
  private naming = false; // the custom-feature name form is open

  constructor(private el: HTMLElement, private tool: OutlineTool) {}

  render() {
    const t = this.tool, all = Object.values(t.outlines);
    if (t.drawing) this.naming = false;
    const typed = this.el.querySelector<HTMLInputElement>('#outline-name')?.value ?? ''; // survives re-renders
    const s = outlineSuggestions(all);
    const ordered = [...all.filter(o => o.kind === 'boundary'), ...all.filter(o => o.kind === 'feature')];
    const rows = ordered.map(o => layerRow(o.name, {
      swatch: o.kind, meta: o.id === t.drawing ? 'Drawing…' : undefined,
      selected: o.id === t.selected, data: { layer: o.id },
      sub: o.kind === 'boundary' && o.closed ? areaText(t.areaSqft(o)) : undefined, // the plot area, quietly, once scaled
      action: o.kind === 'boundary' && o.closed && !t.drawing
        ? button('Redo', { mods: ['layer-action'], ariaLabel: 'Redo plot boundary', data: { redo: o.id } }) : undefined,
    }));
    const suggestions = [
      ...(s.boundary ? [suggestRow('Plot boundary', { start: 'boundary' })] : []),
      ...s.features.map(n => suggestRow(n, { feature: n })),
    ];
    this.el.innerHTML = `
      ${all.length ? '' : hint('Trace what is already on the lot. Start with the plot boundary to set the scale.')}
      ${rows.join('')}${suggestions.join('')}
      ${this.naming ? layerForm(`
          ${caption('Common features')}
          ${chips(s.picks.map(n => button(esc(n), { mods: ['chip'], data: { feature: n } })))}
          ${label('outline-name', 'Or type a name')}
          ${input('outline-name', { placeholder: 'e.g. AC pad', value: typed })}
          ${splitRow(button('Outline', { type: 'submit', variant: 'primary' }), button('Cancel', { data: { act: 'cancel-name' } }))}`)
        : suggestRow('Custom outline…', { act: 'name' })}`;

    this.el.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach(b => {
      b.onclick = () => {
        const id = b.dataset.layer!;
        if (id === t.drawing) return;
        t.selectOutline(id !== t.selected ? id : null);
      };
    });
    this.el.querySelectorAll<HTMLButtonElement>('[data-redo]').forEach(b => { b.onclick = () => t.redraw(b.dataset.redo!); });
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
}

const areaText = (sqft: number | null) => sqft === null ? undefined : formatArea(sqft);
