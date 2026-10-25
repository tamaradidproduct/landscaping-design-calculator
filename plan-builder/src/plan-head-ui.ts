// The top bar's left cluster: "←" (Plans), the plan's name, and a ⋯ menu (Rename, Archive, Delete).
import { cleanAddress } from './plan-model';
import { planBarHtml } from './top-bar';
import { button, card, error, esc, input, splitRow } from './ui';

export interface PlanHeadActions {
  back(): void;
  /** Resolves false when the store refused the name (the field stays open). */
  rename(address: string): Promise<boolean>;
  setArchived(archived: boolean): void;
  remove(): void;
}

type Mode = 'menu' | 'rename' | 'delete' | null;

export class PlanHead {
  private plan: { address: string; archived: boolean } | null = null;
  private mode: Mode = null;
  private title: HTMLElement;
  private more: HTMLButtonElement;
  private menu: HTMLElement;

  constructor(root: HTMLElement, private actions: PlanHeadActions) {
    root.innerHTML = planBarHtml('') + card('', 'plan-menu');
    this.title = root.querySelector('#plan-title')!;
    this.more = root.querySelector('#plan-more')!;
    this.menu = root.querySelector('.plan-menu')!;
    root.addEventListener('click', e => this.onClick(e));
    root.addEventListener('keydown', e => this.onKey(e));
    root.addEventListener('submit', e => e.preventDefault());
    // A tap anywhere else closes the menu (not an open rename or delete confirm)
    document.addEventListener('pointerdown', e => { if (this.mode === 'menu' && !root.contains(e.target as Node)) this.set(null); });
  }

  show(plan: { address: string; archived: boolean } | null): void {
    this.plan = plan; this.mode = null; this.render();
  }

  private set(mode: Mode) { this.mode = mode; this.render(); }

  private render() {
    this.title.textContent = this.plan?.address ?? '';
    this.title.title = this.plan?.address ?? '';
    this.more.setAttribute('aria-expanded', String(this.mode !== null));
    this.menu.hidden = !this.plan || !this.mode;
    if (!this.plan || !this.mode) { this.menu.innerHTML = ''; return; }
    const { address, archived } = this.plan, compact = ['compact'];
    if (this.mode === 'rename') {
      this.menu.innerHTML = `<form class="stack">`
        + input('plan-rename', { ariaLabel: 'Address', value: address })
        + splitRow(button('Save', { mods: compact, variant: 'primary', data: { act: 'rename-save' } }), button('Cancel', { mods: compact, data: { act: 'cancel' } }))
        + error('', true) + '</form>';
      const el = this.menu.querySelector<HTMLInputElement>('#plan-rename')!;
      el.focus(); el.select();
    } else if (this.mode === 'delete') {
      this.menu.innerHTML = `<p class="plan-confirm">Delete ${esc(address)}? This can't be undone.</p>`
        + splitRow(button('Delete', { mods: compact, variant: 'danger', data: { act: 'delete-confirm' } }), button('Cancel', { mods: compact, data: { act: 'cancel' } }));
    } else {
      this.menu.innerHTML = `<div class="menu-list" role="menu">`
        + button('Rename', { mods: ['menu-item'], data: { act: 'rename' } })
        + button(archived ? 'Unarchive' : 'Archive', { mods: ['menu-item'], data: { act: archived ? 'unarchive' : 'archive' } })
        + button('Delete…', { mods: ['menu-item'], variant: 'danger', data: { act: 'delete' } })
        + '</div>';
      this.menu.querySelectorAll('button').forEach(b => b.setAttribute('role', 'menuitem'));
    }
  }

  private onClick(e: Event) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!el) return;
    const act = el.dataset.act ?? el.id;
    if (act === 'back-to-plans') { this.set(null); this.actions.back(); return; }
    if (!this.plan) return;
    switch (act) {
      case 'plan-more': this.set(this.mode ? null : 'menu'); return;
      case 'rename': this.set('rename'); return;
      case 'rename-save': void this.saveRename(); return;
      case 'archive': case 'unarchive': {
        const archived = el.dataset.act === 'archive';
        this.plan = { ...this.plan, archived }; this.set(null);
        this.actions.setArchived(archived); return;
      }
      case 'delete': this.set('delete'); return;
      case 'delete-confirm': this.set(null); this.actions.remove(); return;
      case 'cancel': this.set(null); this.more.focus(); return;
    }
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && this.mode) { e.preventDefault(); this.set(null); this.more.focus(); return; }
    if (e.key === 'Enter' && (e.target as HTMLElement).id === 'plan-rename') { e.preventDefault(); void this.saveRename(); }
  }

  private async saveRename() {
    const el = this.menu.querySelector<HTMLInputElement>('#plan-rename');
    if (!el || !this.plan) return;
    const msg = this.menu.querySelector<HTMLElement>('.text-error')!;
    const clean = cleanAddress(el.value);
    if (!clean) { msg.textContent = "Enter the job's address."; msg.hidden = false; return; }
    if (clean === this.plan.address) { this.set(null); return; }
    if (!(await this.actions.rename(clean))) { msg.textContent = "Enter the job's address."; msg.hidden = false; return; }
    if (this.plan) { this.plan = { ...this.plan, address: clean }; this.set(null); }
  }
}
