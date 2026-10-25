import type { EdgeMenuItem } from './card-helpers';
import { button, error, esc, formStack, iconButton, input, numericKeypad } from './ui';

/**
 * The small chip beside a selected edge: its length (tap to type one), an info button that opens its tip in the chip and,
 * when there is anything to offer, a ⋯ menu. `keyboard` (a fine pointer: desktop) makes the field typeable with a Done
 * button; otherwise (touch) the field is readonly and the on-screen keypad stands in for the soft keyboard.
 */
export function edgeChip(o: {
  text: string; editing: boolean; field?: { value: string; placeholder: string };
  menu: EdgeMenuItem[]; menuOpen: boolean; tip: string; canEdit?: boolean; tipOpen?: boolean; keyboard?: boolean;
}): string {
  const items = o.menuOpen && o.menu.length
    ? `<ul class="edge-menu">${o.menu.map(i => `<li>${button(esc(i.label), { data: { act: i.act } })}</li>`).join('')}</ul>` : '';
  const info = iconButton('info', { ariaLabel: o.tip, data: { act: 'tip' }, expanded: !!o.tipOpen });
  const tip = o.tipOpen ? `<p class="edge-tip" role="note">${esc(o.tip)}</p>` : '';
  if (o.editing) {
    const field = input('edge-len', { readonly: !o.keyboard, inputmode: o.keyboard ? 'decimal' : undefined, placeholder: o.field?.placeholder, value: o.field?.value ?? '', ariaLabel: 'Edge length' });
    const done = o.keyboard ? button('Done', { mods: ['compact'], type: 'submit' }) : '';
    return `<div class="edge-chip editing">${formStack(`<div class="row">${field}${done}${info}</div>${tip}`
      + `${o.keyboard ? '' : numericKeypad()}${error(`Type a length in feet, like 116.45 or 116' 5".`)}`)}</div>`;
  }
  return `<div class="edge-chip"><div class="row">`
    + `${button(esc(o.text), { mods: ['length'], data: { act: 'edit-length' }, disabled: o.canEdit === false })}`
    + info
    + `${o.menu.length ? iconButton('more', { ariaLabel: 'More', data: { act: 'menu' }, pressed: o.menuOpen }) : ''}</div>${tip}${items}</div>`;
}
