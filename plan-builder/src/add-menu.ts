// The Layers panel's global "+ Add": a primary button that opens a type menu (Plant or object, Edges & walls, Surface).
// Choosing a type closes the menu and opens that section's picker.
import { button, esc } from './ui';

export type AddType = 'symbols' | 'lines' | 'surfaces';
const ITEMS: readonly { type: AddType; label: string }[] = [
  { type: 'symbols', label: 'Plant or object' }, { type: 'surfaces', label: 'Surface' }, { type: 'lines', label: 'Edges & walls' },
];

export class AddMenu {
  private open = false;

  constructor(private el: HTMLElement, private choose: (type: AddType) => void) {}

  /** Shows the button once the panel is ready; hides it (and closes the menu) otherwise. */
  render(visible: boolean) {
    if (!visible) this.open = false;
    this.el.hidden = !visible;
    if (!visible) { this.el.innerHTML = ''; return; }
    this.el.innerHTML = this.open
      ? `<div class="add-items" role="menu">${ITEMS.map(i => button(esc(i.label), { mods: ['layer-row'], data: { add: i.type } })).join('')}${button('Cancel', { mods: ['compact'], data: { act: 'cancel-add' } })}</div>`
      : button('+ Add', { variant: 'primary', id: 'add-button', expanded: false, data: { act: 'add' }, ariaLabel: 'Add' });
    const btn = this.el.querySelector<HTMLButtonElement>('[data-act=add]');
    if (btn) btn.onclick = () => { this.open = true; this.render(true); };
    this.el.querySelector<HTMLButtonElement>('[data-act=cancel-add]')?.addEventListener('click', () => { this.open = false; this.render(true); });
    this.el.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(b => { b.onclick = () => { this.open = false; this.render(true); this.choose(b.dataset.add as AddType); }; });
  }
}
