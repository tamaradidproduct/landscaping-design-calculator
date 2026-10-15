// UI components as HTML-string builders. Every class name the components in styles/components.css
// rely on is written here, so templates elsewhere compose these instead of spelling out markup.

export type ButtonVariant = 'default' | 'primary' | 'danger';
export interface ButtonOptions {
  variant?: ButtonVariant;
  /** Extra modifiers from the Button component: 'large', 'icon', 'small', 'chip', 'toggle', 'layer-action'. */
  mods?: string[];
  type?: 'button' | 'submit';
  disabled?: boolean;
  ariaLabel?: string;
  /** data-* attributes, e.g. { act: 'close' } → data-act="close". */
  data?: Record<string, string>;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function button(label: string, o: ButtonOptions = {}): string {
  const cls = [o.variant && o.variant !== 'default' ? o.variant : '', ...(o.mods ?? [])].filter(Boolean).join(' ');
  const data = Object.entries(o.data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button type="${o.type ?? 'button'}"${cls ? ` class="${cls}"` : ''}${data}`
    + `${o.ariaLabel ? ` aria-label="${esc(o.ariaLabel)}"` : ''}${o.disabled ? ' disabled' : ''}>${label}</button>`;
}

/** Text styles. `html` is trusted markup; escape user text with esc() first. */
export const body = (html: string) => `<p class="text-body">${html}</p>`;
export const hint = (html: string) => `<p class="text-hint">${html}</p>`;
export const error = (html: string, hidden = true) => `<p class="text-error"${hidden ? ' hidden' : ''}>${html}</p>`;
export const label = (forId: string, text: string) => `<label class="text-label" for="${forId}">${text}</label>`;
/** A figure line (measurement, angle): tabular numbers. */
export const figure = (html: string) => `<p class="text-figure">${html}</p>`;
/** A label that names a group rather than one field. */
export const caption = (text: string) => `<p class="text-label">${text}</p>`;
export const row = (...children: string[]) => `<div class="row">${children.join('')}</div>`;
/** A row whose children share the width equally (Undo / Redo, Outline / Cancel). */
export const splitRow = (...children: string[]) => `<div class="row split">${children.join('')}</div>`;
/** Wrapping group of quick-pick chips (buttons with mods: ['chip']). */
export const chips = (buttons: string[]) => `<div class="chips">${buttons.join('')}</div>`;

export interface InputOptions { value?: string; placeholder?: string; inputmode?: 'decimal' | 'numeric' | 'text' }
export function input(id: string, o: InputOptions = {}): string {
  return `<input id="${id}" autocomplete="off"`
    + `${o.inputmode ? ` inputmode="${o.inputmode}"` : ''}${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}`
    + `${o.value !== undefined ? ` value="${esc(o.value)}"` : ''} />`;
}

/** Card header: a title and a small close button (data-act="close"). */
export const cardHead = (titleHtml: string) =>
  `<div class="card-head"><strong>${titleHtml}</strong>${button('×', { mods: ['icon', 'small'], ariaLabel: 'Close', data: { act: 'close' } })}</div>`;

/** Arrow pad that nudges the selected corner by one screen pixel (data-nudge="dx,dy"). */
export function nudgePad(): string {
  const arrow = (glyph: string, dir: string, d: string) => button(glyph, { mods: ['icon'], ariaLabel: `Nudge ${dir}`, data: { nudge: d } });
  return `<div class="nudge"><span class="text-hint">Nudge the selected corner</span>`
    + arrow('←', 'left', '-1,0') + arrow('↑', 'up', '0,-1') + arrow('↓', 'down', '0,1') + arrow('→', 'right', '1,0') + '</div>';
}

/** Layer row: a swatch for the outline kind, the name, and an optional status (e.g. "Drawing…"). */
export interface LayerRowOptions {
  swatch: 'boundary' | 'feature'; meta?: string; selected?: boolean; data?: Record<string, string>;
  /** A quiet second line under the name (e.g. the plot area). */
  sub?: string;
  /** A small action button beside the row (from button()), e.g. Redo. */
  action?: string;
}
export function layerRow(name: string, o: LayerRowOptions): string {
  const data = Object.entries(o.data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  const rowHtml = `<button type="button" class="layer-row${o.selected ? ' selected' : ''}"${data}${o.selected ? ' aria-pressed="true"' : ''}>`
    + `<span class="swatch ${o.swatch}"></span>`
    + (o.sub ? `<span class="layer-text"><span class="layer-name">${esc(name)}</span><span class="layer-sub">${esc(o.sub)}</span></span>`
      : `<span class="layer-name">${esc(name)}</span>`)
    + `${o.meta ? `<span class="layer-meta">${esc(o.meta)}</span>` : ''}</button>`;
  return o.action ? `<div class="layer-item">${rowHtml}${o.action}</div>` : rowHtml;
}
/** Layer form: a bordered block inside the layer list (naming a custom outline). */
export const layerForm = (html: string) => `<form class="layer-form">${html}</form>`;
/** Suggestion row: a dashed "+ name" row that starts outlining it. */
export function suggestRow(name: string, data: Record<string, string>): string {
  const d = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button type="button" class="layer-row suggest"${d}><span class="swatch add" aria-hidden="true">+</span><span class="layer-name">${esc(name)}</span></button>`;
}

/** Read a design token (CSS custom property) — for drawing on canvas, where var() isn't available. */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
