import type { EdgeMenuItem } from './card-helpers';
import { button, error, esc, formStack, iconButton, input, numericKeypad } from './ui';

/** The small chip beside a selected edge: its length (tap to type one), an info tip and, when there is anything to offer, a ⋯ menu. */
export function edgeChip(o: {
  text: string; editing: boolean; field?: { value: string; placeholder: string };
  menu: EdgeMenuItem[]; menuOpen: boolean; tip: string; canEdit?: boolean;
}): string {
  const items = o.menuOpen && o.menu.length
    ? `<ul class="edge-menu">${o.menu.map(i => `<li>${button(esc(i.label), { data: { act: i.act } })}</li>`).join('')}</ul>` : '';
  if (o.editing) {
    return `<div class="edge-chip editing">${formStack(`<div class="row">${input('edge-len', { readonly: true, placeholder: o.field?.placeholder, value: o.field?.value ?? '', ariaLabel: 'Edge length' })}`
      + `${iconButton('info', { ariaLabel: o.tip })}</div>${numericKeypad()}${error(`Type a length in feet, like 116.45 or 116' 5".`)}`)}</div>`;
  }
  return `<div class="edge-chip"><div class="row">`
    + `${button(esc(o.text), { mods: ['length'], data: { act: 'edit-length' }, disabled: o.canEdit === false })}`
    + `${iconButton('info', { ariaLabel: o.tip })}`
    + `${o.menu.length ? iconButton('more', { ariaLabel: 'More', data: { act: 'menu' }, pressed: o.menuOpen }) : ''}</div>${items}</div>`;
}
