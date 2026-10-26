// UI components as HTML-string builders. Every class name the components in styles/components.css
// rely on is written here, so templates elsewhere compose these instead of spelling out markup.
import { LUCIDE, type LucideName } from './lucide-icons';
import type { MaterialId } from './materials';
import { swatchFill, UNASSIGNED_FILL } from './patterns';

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
  /** Tooltip (a shortcut hint, say). */
  title?: string;
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
    + `${o.expanded !== undefined ? ` aria-expanded="${o.expanded}"` : ''}${o.ariaLabel ? ` aria-label="${esc(o.ariaLabel)}"` : ''}${o.title ? ` title="${esc(o.title)}"` : ''}${o.pressed ? ' aria-pressed="true"' : ''}${o.disabled ? ' disabled' : ''}>${label}</button>`;
}

/** A Lucide icon by name (lucide-icons.ts), drawn on a 24-unit grid. */
export const lucideIcon = (name: LucideName) => `<svg class="line-icon lucide" viewBox="0 0 24 24" aria-hidden="true">${LUCIDE[name]}</svg>`;

/** A 16 px line icon from an SVG path (`d`); sized and stroked by .line-icon. */
export const lineIcon = (d: string) => `<svg class="line-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="${d}" /></svg>`;

export interface SegmentedOption { label: string; value: string; pressed: boolean }
/** Segmented control: one choice of a few, joined. Each button carries data-<attr>="value". */
export function segmented(id: string, ariaLabel: string, attr: string, options: SegmentedOption[]): string {
  return `<div class="segmented" id="${id}" role="group" aria-label="${esc(ariaLabel)}">`
    + options.map(o => button(o.label, { pressed: o.pressed, data: { [attr]: o.value } })).join('') + '</div>';
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

export type IconName = 'trash' | 'info' | 'more' | 'chevron-left' | 'chevron-right' | 'replace';
const ICON_PATHS: Record<IconName, string> = {
  trash: '<path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 8.5h6.6l.7-8.5M6.5 7v4M9.5 7v4" />',
  info: '<circle cx="8" cy="8" r="6" /><path d="M8 7.5V11M8 5v.1" />',
  more: '<circle cx="3.5" cy="8" r=".6" /><circle cx="8" cy="8" r=".6" /><circle cx="12.5" cy="8" r=".6" />',
  'chevron-left': '<path d="M10 3L5 8l5 5" />',
  'chevron-right': '<path d="M6 3l5 5-5 5" />',
  replace: '<path d="M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13" />',
};
const cardIcon = (name: IconName) => `<svg class="line-icon" viewBox="0 0 16 16" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
/** An icon-only button (48 px): a line icon with an aria-label and title. */
export function iconButton(icon: IconName, o: { ariaLabel: string; data?: Record<string, string>; variant?: 'danger'; pressed?: boolean; expanded?: boolean }): string {
  const d = Object.entries(o.data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  return `<button type="button" class="icon${o.variant ? ` ${o.variant}` : ''}"${d} aria-label="${esc(o.ariaLabel)}" title="${esc(o.ariaLabel)}"`
    + `${o.pressed ? ' aria-pressed="true"' : ''}${o.expanded !== undefined ? ` aria-expanded="${o.expanded}"` : ''}>${cardIcon(icon)}</button>`;
}
/** A row that opens and closes its body (aria-expanded); the body is only in the markup while open. */
export function disclosure(id: string, labelText: string, open: boolean, bodyHtml: string): string {
  return `<div class="disclosure"><button type="button" class="disclosure-head" data-disclosure="${esc(id)}" aria-expanded="${open}">`
    + `<span class="layer-name">${esc(labelText)}</span>${cardIcon('chevron-right')}</button>`
    + `${open ? `<div class="disclosure-body">${bodyHtml}</div>` : ''}</div>`;
}
/** Four arrows over the canvas (bottom-left) that nudge the selected corner by one screen pixel (data-nudge="dx,dy"). */
export function canvasNudgePad(): string {
  const arrow = (glyph: string, dir: string, d: string) => button(glyph, { mods: ['icon'], ariaLabel: `Nudge ${dir}`, data: { nudge: d } });
  return `<div class="nudge-pad">${arrow('←', 'left', '-1,0')}${arrow('↑', 'up', '0,-1')}${arrow('↓', 'down', '0,1')}${arrow('→', 'right', '1,0')}</div>`;
}

/** A layer's swatch: the outline kind's look, or a surface's material (its texture). */
export type Swatch = 'boundary' | 'feature' | { material?: MaterialId } | { symbol: string };
export const swatch = (s: Swatch) => typeof s === 'string' ? `<span class="swatch ${s}"></span>`
  : 'symbol' in s ? `<span class="swatch symbol"><img src="${esc(s.symbol)}" alt=""></span>`
  : `<span class="swatch material"><svg aria-hidden="true"><rect width="100%" height="100%" fill="${s.material ? swatchFill(s.material) : UNASSIGNED_FILL}"/></svg></span>`;

/** Layer row: a swatch for the outline kind, the name, and an optional status (e.g. "Drawing…"). */
export interface LayerRowOptions {
  swatch: Swatch; meta?: string; selected?: boolean; data?: Record<string, string>;
  /** A quiet second line under the name (e.g. the plot area). */
  sub?: string;
  /** Adds an eye beside the row (data-eye, or data-<attr>) that shows or hides layer `id`. */
  eye?: { id: string; hidden: boolean; attr?: string };
  /** Prefixes a reorder grip (data-grip = the row's data-layer or data-zone id). */
  grip?: boolean;
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
const GRIP_ICON = '<svg class="line-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="6" cy="4" r=".6" /><circle cx="10" cy="4" r=".6" /><circle cx="6" cy="8" r=".6" /><circle cx="10" cy="8" r=".6" /><circle cx="6" cy="12" r=".6" /><circle cx="10" cy="12" r=".6" /></svg>';
export function layerRow(name: string, o: LayerRowOptions): string {
  const data = Object.entries(o.data ?? {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  const row = `<button type="button" class="layer-row${o.selected ? ' selected' : ''}${o.eye?.hidden ? ' off' : ''}"${data}${o.selected ? ' aria-pressed="true"' : ''}>`
    + `${swatch(o.swatch)}${layerName(name, o.sub)}`
    + `${o.meta ? `<span class="layer-meta">${esc(o.meta)}</span>` : ''}</button>`;
  if (!o.eye && !o.grip) return row;
  const gripId = o.data?.layer ?? o.data?.zone ?? '';
  const grip = o.grip ? `<span class="grip" role="button" tabindex="0" aria-label="Reorder ${esc(name)}" data-grip="${esc(gripId)}">${GRIP_ICON}</span>` : '';
  const eye = o.eye ? eyeButton(o.eye.hidden, name, { [o.eye.attr ?? 'eye']: o.eye.id }) : '';
  return `<div class="layer-item">${grip}${eye}${row}</div>`;
}
/**
 * Layer card: the row of the outline being drawn or edited, expanded in place. The head keeps the swatch and
 * name (a name field when it can be renamed) and a Done button; the body holds the step, nudge arrows and actions.
 */
export interface LayerCardOptions {
  id: string; name: string; sub?: string; meta?: string;
  /** The head's swatch; left out when the card shows it elsewhere (a zone's Material button). */
  swatch?: Swatch;
  /** Show the name as a field (id `renameId`, default "outline-rename") so it can be renamed in place. */
  rename?: boolean;
  renameId?: string;
  /** Show a Done button (data-act="collapse") that closes the card. */
  done?: boolean;
  /** Icon buttons at the right of the head (Redraw, trash). */
  actions?: string;
  body: string;
}
export function layerCard(o: LayerCardOptions): string {
  const name = o.rename
    // Looks like a field (underlined) so it's clear the name can be changed right here.
    ? (() => {
      const field = `<label class="layer-rename-wrap" title="Rename">${input(o.renameId ?? 'outline-rename', { cls: 'layer-rename', ariaLabel: 'Name', value: o.name })}</label>`;
      return o.sub ? `<span class="layer-text">${field}<span class="layer-sub">${esc(o.sub)}</span></span>` : field;
    })()
    : layerName(o.name, o.sub);
  return `<div class="layer-card" data-card="${esc(o.id)}"><div class="layer-head">${o.swatch ? swatch(o.swatch) : ''}${name}`
    + `${o.meta ? `<span class="layer-meta">${esc(o.meta)}</span>` : ''}`
    + `${o.actions ? `<span class="layer-head-actions">${o.actions}</span>` : ''}`
    + `${o.done ? button('×', { mods: ['icon', 'small'], ariaLabel: 'Done', data: { act: 'collapse' } }) : ''}</div>`
    + `${o.body ? `<div class="layer-body">${o.body}</div>` : ''}</div>`;
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
