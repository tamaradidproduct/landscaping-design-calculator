// UI components as HTML-string builders. Every class name the components in styles/components.css
// rely on is written here, so templates elsewhere compose these instead of spelling out markup.
import type { MaterialId } from './materials';
import { materialFill } from './patterns';

export type ButtonVariant = 'default' | 'primary' | 'danger';
export interface ButtonOptions {
  variant?: ButtonVariant;
  /** Extra modifiers from the Button component: 'large', 'icon', 'small', 'chip', 'toggle', 'compact'. */
  mods?: string[];
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** A toggle or choice that is on (aria-pressed="true"). */
  pressed?: boolean;
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
    + `${o.ariaLabel ? ` aria-label="${esc(o.ariaLabel)}"` : ''}${o.pressed ? ' aria-pressed="true"' : ''}${o.disabled ? ' disabled' : ''}>${label}</button>`;
}

/** Text styles. `html` is trusted markup; escape user text with esc() first. */
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
  return `<div class="nudge"><span class="text-hint">Nudge corner</span>`
    + arrow('←', 'left', '-1,0') + arrow('↑', 'up', '0,-1') + arrow('↓', 'down', '0,1') + arrow('→', 'right', '1,0') + '</div>';
}

/** A layer's swatch: the outline kind's look, or a surface's material (colour + pattern). */
export type Swatch = 'boundary' | 'feature' | { material: MaterialId };
export const swatch = (s: Swatch) => typeof s === 'string' ? `<span class="swatch ${s}"></span>`
  : `<span class="swatch material"><svg aria-hidden="true"><rect width="100%" height="100%" fill="${materialFill(s.material)}"/></svg></span>`;

/** Layer row: a swatch for the outline kind, the name, and an optional status (e.g. "Drawing…"). */
export interface LayerRowOptions {
  swatch: Swatch; meta?: string; selected?: boolean; data?: Record<string, string>;
  /** A quiet second line under the name (e.g. the plot area). */
  sub?: string;
}
const layerName = (name: string, sub?: string) => sub
  ? `<span class="layer-text"><span class="layer-name">${esc(name)}</span><span class="layer-sub">${esc(sub)}</span></span>`
  : `<span class="layer-name">${esc(name)}</span>`;
export function layerRow(name: string, o: LayerRowOptions): string {
  const data = Object.entries(o.data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button type="button" class="layer-row${o.selected ? ' selected' : ''}"${data}${o.selected ? ' aria-pressed="true"' : ''}>`
    + `${swatch(o.swatch)}${layerName(name, o.sub)}`
    + `${o.meta ? `<span class="layer-meta">${esc(o.meta)}</span>` : ''}</button>`;
}
/**
 * Layer card: the row of the outline being drawn or edited, expanded in place. The head keeps the swatch and
 * name (a name field when it can be renamed) and a Done button; the body holds the step, nudge arrows and actions.
 */
export interface LayerCardOptions {
  id: string; swatch: Swatch; name: string; sub?: string; meta?: string;
  /** Show the name as a field (id `renameId`, default "outline-rename") so it can be renamed in place. */
  rename?: boolean;
  renameId?: string;
  /** Show a Done button (data-act="collapse") that closes the card. */
  done?: boolean;
  body: string;
}
export function layerCard(o: LayerCardOptions): string {
  const name = o.rename
    // Looks like a field (underline + pencil) so it's clear the name can be changed right here.
    ? `<label class="layer-rename-wrap" title="Rename"><input id="${o.renameId ?? 'outline-rename'}" class="layer-rename" autocomplete="off" aria-label="Name" value="${esc(o.name)}" />`
      + `<svg class="line-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M11 2.5l2.5 2.5L6 12.5H3.5V10z" /></svg></label>`
    : layerName(o.name, o.sub);
  return `<div class="layer-card" data-card="${esc(o.id)}"><div class="layer-head">${swatch(o.swatch)}${name}`
    + `${o.meta ? `<span class="layer-meta">${esc(o.meta)}</span>` : ''}`
    + `${o.done ? button('×', { mods: ['icon', 'small'], ariaLabel: 'Done', data: { act: 'collapse' } }) : ''}</div>`
    + `<div class="layer-body">${o.body}</div></div>`;
}
/** "Layer order ↑ ↓" in a layer card (data-act="up" / "down"); higher layers cut the ones below. */
export function layerOrder(first: boolean, last: boolean): string {
  const arrow = (glyph: string, dir: 'up' | 'down', disabled: boolean) =>
    button(glyph, { mods: ['icon', 'small'], ariaLabel: `Move ${dir} (higher layers cut the ones below)`, disabled, data: { act: dir } });
  return `<div class="layer-order"><span class="text-hint">Layer order</span>${arrow('↑', 'up', first)}${arrow('↓', 'down', last)}</div>`;
}
/** Wrapping group of compact actions inside a layer card. */
export const layerActions = (...buttons: string[]) => `<div class="layer-actions">${buttons.join('')}</div>`;
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
