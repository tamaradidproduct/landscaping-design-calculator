// UI components as HTML-string builders. Every class name the components in styles/components.css
// rely on is written here, so templates elsewhere compose these instead of spelling out markup.

export type ButtonVariant = 'default' | 'primary' | 'danger';
export interface ButtonOptions {
  variant?: ButtonVariant;
  /** Extra modifiers from the Button component: 'large', 'icon', 'small', 'chip', 'menu-item', 'toggle'. */
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
export const status = (ok: boolean, text: string) => `<span class="${ok ? 'status-ok' : 'status-warn'}">${text}</span>`;
export const row = (...children: string[]) => `<div class="row">${children.join('')}</div>`;

export interface InputOptions { value?: string; placeholder?: string; inputmode?: 'decimal' | 'numeric' | 'text'; short?: boolean }
export function input(id: string, o: InputOptions = {}): string {
  return `<input id="${id}" autocomplete="off"${o.short ? ' class="short"' : ''}`
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

/** Read a design token (CSS custom property) — for drawing on canvas, where var() isn't available. */
export function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
