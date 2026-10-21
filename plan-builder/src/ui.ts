// UI components as HTML-string builders. Every class name the components in styles/components.css
// rely on is written here, so templates elsewhere compose these instead of spelling out markup.
import type { MaterialId } from './materials';
import { swatchFill } from './patterns';

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
  id?: string;
  /** A button that opens or closes something (aria-expanded="true"/"false"). */
  expanded?: boolean;
  /** data-* attributes, e.g. { act: 'close' } → data-act="close". */
  data?: Record<string, string>;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function button(label: string, o: ButtonOptions = {}): string {
  const cls = [o.variant && o.variant !== 'default' ? o.variant : '', ...(o.mods ?? [])].filter(Boolean).join(' ');
  const data = Object.entries(o.data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button type="${o.type ?? 'button'}"${o.id ? ` id="${o.id}"` : ''}${cls ? ` class="${cls}"` : ''}${data}`
    + `${o.expanded !== undefined ? ` aria-expanded="${o.expanded}"` : ''}${o.ariaLabel ? ` aria-label="${esc(o.ariaLabel)}"` : ''}${o.pressed ? ' aria-pressed="true"' : ''}${o.disabled ? ' disabled' : ''}>${label}</button>`;
}

/** Text styles. `html` is trusted markup; escape user text with esc() first. */
export const hint = (html: string) => `<p class="text-hint">${html}</p>`;
/** A hint inside a row (beside buttons), rather than a paragraph of its own. */
export const inlineHint = (html: string) => `<span class="text-hint">${html}</span>`;
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

export interface InputOptions {
  value?: string; placeholder?: string; inputmode?: 'decimal' | 'numeric' | 'text';
  /** Extra class for a field that looks different in place (an inline rename). */
  cls?: string;
  ariaLabel?: string;
  required?: boolean;
  /** Blocks the native keyboard (and typing): a numericKeypad() beside the field drives its value instead. */
  readonly?: boolean;
}
export function input(id: string, o: InputOptions = {}): string {
  return `<input id="${id}"${o.cls ? ` class="${o.cls}"` : ''} autocomplete="off"${o.ariaLabel ? ` aria-label="${esc(o.ariaLabel)}"` : ''}${o.required ? ' required' : ''}`
    + `${o.inputmode ? ` inputmode="${o.inputmode}"` : ''}${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}${o.readonly ? ' readonly' : ''}`
    + `${o.value !== undefined ? ` value="${esc(o.value)}"` : ''} />`;
}

/** Keys on the numericKeypad(): digits, the feet/inches marks and decimal point build up the field's value;
 * 'back' drops the last character, 'clear' empties it, and 'done' is a no-op — the caller submits the form. */
export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | "'" | '"' | '.' | 'back' | 'clear' | 'done';
export function applyKeypadKey(value: string, key: KeypadKey): string {
  if (key === 'done') return value;
  if (key === 'clear') return '';
  if (key === 'back') return value.slice(0, -1);
  return value + key;
}
/**
 * On-screen keypad that stands in for the native keyboard on a length field (digits + the feet/inches/decimal
 * marks), so contractors get numeric-only entry on iPad. Every key is a grid cell at least --control-md (48px)
 * tall, per PRD §6.6. Pair it with a `readonly` input() — the caller wires each key's click to applyKeypadKey().
 */
export function numericKeypad(): string {
  const key = (glyph: string, k: KeypadKey, extra: ButtonOptions = {}) => button(glyph, { mods: ['keypad-key'], data: { key: k }, ...extra });
  return `<div class="keypad">`
    + key('1', '1') + key('2', '2') + key('3', '3') + key('′', "'", { ariaLabel: 'Feet mark' })
    + key('4', '4') + key('5', '5') + key('6', '6') + key('″', '"', { ariaLabel: 'Inches mark' })
    + key('7', '7') + key('8', '8') + key('9', '9') + key('.', '.', { ariaLabel: 'Decimal point' })
    + key('C', 'clear', { ariaLabel: 'Clear' }) + key('0', '0') + key('⌫', 'back', { ariaLabel: 'Backspace' }) + key('Done', 'done')
    + `</div>`;
}

/** Field: a label stacked over its control(s) — pass `row(...)` for a field with an action beside it. */
export const field = (id: string, labelText: string, control: string, cls = '') =>
  `<div class="field${cls ? ` ${cls}` : ''}">${label(id, labelText)}${control}</div>`;
/** A form whose children stack (fields, actions, its error line). */
export const formStack = (html: string, cls = 'stack', novalidate = false) =>
  `<form class="${cls}"${novalidate ? ' novalidate' : ''}>${html}</form>`;
/** The floating surface (see Card in components.css): popovers, menus and forms that sit above the page. */
export const card = (html: string, cls = '') => `<div class="card${cls ? ` ${cls}` : ''}">${html}</div>`;
/** Inline field inside a chip: a muted label before a short input ("Round [ 2 ]"). */
export const chipField = (id: string, labelText: string, o: InputOptions & { title?: string } = {}) =>
  `<label class="chip-field" hidden${o.title ? ` title="${esc(o.title)}"` : ''}>${labelText} ${input(id, o)}</label>`;
/** One chosen value shown as a line — swatch, name and an action that opens the choices (e.g. a zone's material). */
export const choiceLine = (swatchHtml: string, name: string, action: string) =>
  `<div class="choice-line">${swatchHtml}<span class="layer-name">${esc(name)}</span>${action}</div>`;

/** Screen panel: the app name over one centred action (Sign-in, Not invited). */
export const screenPanel = (titleHtml: string, bodyHtml: string) =>
  card(`<h1 class="screen-title">${titleHtml}</h1>${bodyHtml}`, 'auth-panel');
/** Body text on a screen (larger than a hint). */
export const screenText = (html: string) => `<p class="screen-text">${html}</p>`;
/** What a list says when it has nothing in it. */
export const emptyNote = (text: string) => `<p class="plans-empty">${esc(text)}</p>`;
/**
 * List row: a bordered strip holding a main part and its actions (a plan: open, Rename, Delete). `state` swaps the
 * contents for an inline edit ('editing') or an inline confirm ('confirming') and outlines the row; 'archived' mutes it.
 */
export const listRow = (id: string, children: string[], state?: 'editing' | 'confirming' | 'archived') =>
  `<div class="plan-row${state ? ` ${state}` : ''}" data-id="${esc(id)}">${children.join('')}</div>`;

/** Card header: a title and a small close button (data-act="close"). */
export const cardHead = (titleHtml: string) =>
  `<div class="card-head"><strong>${titleHtml}</strong>${button('×', { mods: ['icon', 'small'], ariaLabel: 'Close', data: { act: 'close' } })}</div>`;

/** Arrow pad that nudges the selected corner by one screen pixel (data-nudge="dx,dy"). */
export function nudgePad(): string {
  const arrow = (glyph: string, dir: string, d: string) => button(glyph, { mods: ['icon'], ariaLabel: `Nudge ${dir}`, data: { nudge: d } });
  return `<div class="nudge">${inlineHint('Nudge corner')}`
    + arrow('←', 'left', '-1,0') + arrow('↑', 'up', '0,-1') + arrow('↓', 'down', '0,1') + arrow('→', 'right', '1,0') + '</div>';
}

/** A layer's swatch: the outline kind's look, or a surface's material (its texture). */
export type Swatch = 'boundary' | 'feature' | { material: MaterialId } | { symbol: string };
export const swatch = (s: Swatch) => typeof s === 'string' ? `<span class="swatch ${s}"></span>`
  : 'symbol' in s ? `<span class="swatch symbol"><img src="${esc(s.symbol)}" alt=""></span>`
  : `<span class="swatch material"><svg aria-hidden="true"><rect width="100%" height="100%" fill="${swatchFill(s.material)}"/></svg></span>`;

/** Layer row: a swatch for the outline kind, the name, and an optional status (e.g. "Drawing…"). */
export interface LayerRowOptions {
  swatch: Swatch; meta?: string; selected?: boolean; data?: Record<string, string>;
  /** A quiet second line under the name (e.g. the plot area). */
  sub?: string;
  /** Adds an eye beside the row (data-eye, or data-<attr>) that shows or hides layer `id`. */
  eye?: { id: string; hidden: boolean; attr?: string };
}
/** An eye toggle: pressed = shown. `what` names it for the label ("Lawn"); `data` says what it toggles. */
export const eyeButton = (hidden: boolean, what: string, data: Record<string, string>) => {
  const label = `${hidden ? 'Show' : 'Hide'} ${what}`, d = Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button type="button" class="icon" aria-pressed="${!hidden}" aria-label="${esc(label)}" title="${esc(label)}"${d}>`
    + '<svg class="line-icon" viewBox="0 0 16 16" aria-hidden="true"><path class="eye" d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" /><circle class="eye" cx="8" cy="8" r="2" /><path class="eye-off" d="M2.5 2.5l11 11" /></svg></button>';
};
const layerName = (name: string, sub?: string) => sub
  ? `<span class="layer-text"><span class="layer-name">${esc(name)}</span><span class="layer-sub">${esc(sub)}</span></span>`
  : `<span class="layer-name">${esc(name)}</span>`;
export function layerRow(name: string, o: LayerRowOptions): string {
  const data = Object.entries(o.data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  const row = `<button type="button" class="layer-row${o.selected ? ' selected' : ''}${o.eye?.hidden ? ' off' : ''}"${data}${o.selected ? ' aria-pressed="true"' : ''}>`
    + `${swatch(o.swatch)}${layerName(name, o.sub)}`
    + `${o.meta ? `<span class="layer-meta">${esc(o.meta)}</span>` : ''}</button>`;
  return o.eye ? `<div class="layer-item">${eyeButton(o.eye.hidden, name, { [o.eye.attr ?? 'eye']: o.eye.id })}${row}</div>` : row;
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
    ? `<label class="layer-rename-wrap" title="Rename">${input(o.renameId ?? 'outline-rename', { cls: 'layer-rename', ariaLabel: 'Name', value: o.name })}`
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
  return `<div class="layer-order">${inlineHint('Layer order')}${arrow('↑', 'up', first)}${arrow('↓', 'down', last)}</div>`;
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
