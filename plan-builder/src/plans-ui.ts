// Screens outside the editor: Sign-in, Not invited, and Plans (list + New plan form).
import { SignInError, type AuthGate } from './auth';
import { cleanAddress, editedAgo, type PlanMeta } from './plan-model';
import { PlanInputError, type PlanStore } from './plan-store';
import { button, error, esc, field, hint, input } from './ui';

/** The shared `#file` picker, reused for New plan and Replace plot plan: whoever armed it last gets the file. */
export function armFilePicker(onFile: ((file: File) => void) | null): HTMLInputElement {
  const el = document.getElementById('file') as HTMLInputElement;
  el.onchange = onFile ? () => { const f = el.files?.[0]; el.value = ''; if (f) onFile(f); } : null;
  return el;
}

const INPUT_MESSAGES: Record<PlanInputError['reason'], string> = {
  address: "Enter the job's address.",
  'not-pdf': "That file isn't a PDF. Pick the plot plan PDF.",
  'too-big': 'This PDF is over 25 MB. Export a smaller copy and try again.',
  'device-storage': "Couldn't keep this PDF on the device. Connect to the internet and try again.",
};
export const planInputMessage = (e: PlanInputError) => INPUT_MESSAGES[e.reason];

const panel = (html: string) => `<div class="auth-panel card"><h1 class="screen-title">Plan Builder</h1>${html}</div>`;

export function renderLoading(root: HTMLElement): void {
  root.innerHTML = panel(hint('Signing in…'));
}

export function renderSignIn(root: HTMLElement, gate: AuthGate, opts: { offline?: boolean } = {}): void {
  root.innerHTML = panel('<button type="button" class="primary large" id="sign-in">Sign in with Google</button>'
    + error('', true));
  const btn = root.querySelector<HTMLButtonElement>('#sign-in')!, msg = root.querySelector<HTMLElement>('.text-error')!;
  const say = (text: string) => { msg.textContent = text; msg.hidden = false; };
  if (opts.offline) say('Connect to the internet to sign in.');
  btn.onclick = async () => {
    msg.hidden = true; btn.disabled = true;
    try {
      await gate.signIn();
    } catch (e) {
      if (e instanceof SignInError && e.reason === 'offline') say('Connect to the internet to sign in.');
      else if (e instanceof SignInError) say("Sign-in didn't finish. Allow pop-ups for this site and try again.");
      else { console.error('sign-in failed', e); say("Sign-in didn't finish. Allow pop-ups for this site and try again."); }
    } finally {
      btn.disabled = false;
    }
  };
}

export function renderNotInvited(root: HTMLElement, email: string, gate: AuthGate): void {
  root.innerHTML = panel(`<p class="screen-text">This Google account (${esc(email)}) hasn't been invited to Plan Builder. Ask Tamara for an invite.</p>`
    + '<button type="button" id="use-another">Use another account</button>');
  root.querySelector<HTMLButtonElement>('#use-another')!.onclick = () => { void gate.signOut(); };
}

export interface PlansScreenOptions {
  onOpen(id: string): void;
  onSignOut(): void;
  email: string;
  /** Store failures with no inline place to show them: 'load' for the list itself, 'save' for rename, delete, create. */
  onError?(e: Error, what: 'load' | 'save'): void;
}

type Inline = { kind: 'rename'; id: string } | { kind: 'delete'; id: string } | null;

export class PlansScreen {
  private plans: PlanMeta[] = [];
  private loaded = false;
  private inline: Inline = null;
  private newOpen = false;
  private newError = '';
  private creating = false;
  private menuOpen = false;
  private signOutWarn = false;
  private opening: string | null = null;
  private unwatch: (() => void) | null = null;
  private revived = false;
  private tick = 0;

  constructor(private root: HTMLElement, private store: PlanStore, private opts: PlansScreenOptions) {
    root.addEventListener('click', e => this.onClick(e));
    root.addEventListener('keydown', e => this.onKey(e));
    root.addEventListener('submit', e => e.preventDefault());
  }

  show(): void {
    this.root.hidden = false;
    this.inline = null; this.opening = null; this.menuOpen = false; this.signOutWarn = false;
    this.revived = false;
    this.watch();
    clearInterval(this.tick);
    this.tick = window.setInterval(() => this.render(), 60_000); // keep "Edited … ago" current
    this.render();
  }

  hide(): void {
    this.root.hidden = true;
    this.unwatch?.(); this.unwatch = null;
    clearInterval(this.tick);
    this.closeNew();
  }

  /** Restarts the list after an error ended it (e.g. permission-denied, then the invite re-check passed). Once per show, so a lasting denial can't loop. */
  revive(): void {
    if (this.root.hidden || this.unwatch || this.revived) return;
    this.revived = true;
    this.watch();
  }

  private watch() {
    if (this.unwatch) return;
    const off = this.store.watchPlans(p => { this.plans = p; this.loaded = true; this.render(); }, e => {
      if (this.unwatch === off) this.unwatch = null; // an error ends the listener
      this.opts.onError?.(e, 'load');
    });
    this.unwatch = off;
  }

  /** Marks a row as opening (main is loading its plan), or clears it. */
  setOpening(id: string | null): void { this.opening = id; this.render(); }

  private closeNew() {
    this.newOpen = false; this.newError = ''; this.creating = false;
    armFilePicker(null);
  }

  private render() {
    if (this.root.hidden) return;
    // Keep what's being typed (and focus) across list updates from the store
    const active = document.activeElement instanceof HTMLInputElement && this.root.contains(document.activeElement) ? document.activeElement.id : null;
    const values = new Map([...this.root.querySelectorAll('input')].map(i => [i.id, i.value]));
    const account = `<div class="account">`
      + `<button type="button" class="account-toggle" id="account" aria-expanded="${this.menuOpen}">${esc(this.opts.email)}</button>`
      + (this.menuOpen ? `<div class="account-menu card">`
        + `<p class="text-hint">${esc(this.opts.email)}</p>`
        + (this.signOutWarn
          ? `<p class="text-error">Some changes haven't synced yet. They'll sync when you sign back in on this device.</p>`
            + `<div class="row split">${button('Sign out anyway', { variant: 'danger', data: { act: 'sign-out-anyway' } })}${button('Cancel', { data: { act: 'menu-close' } })}</div>`
          : `<button type="button" id="sign-out">Sign out</button>`)
        + `</div>` : '')
      + `</div>`;
    const head = `<header class="plans-head"><h1 class="screen-title">Plans</h1>${account}</header>`;
    const create = this.newOpen
      ? `<form class="new-plan card stack" novalidate>`
        + `<strong>New plan</strong>`
        + field('new-address', "Job's address", input('new-address', { placeholder: '123 Main St' }).replace('<input', '<input required'))
        + `<div class="row">`
        + `<button type="button" class="primary" id="new-pdf"${this.creating ? ' disabled' : ''}>${this.creating ? 'Creating…' : 'Pick plot plan PDF'}</button>`
        + button('Cancel', { data: { act: 'new-cancel' } }) + `</div>`
        + error(esc(this.newError), !this.newError)
        + `</form>`
      : `<button type="button" class="primary" id="new-plan">New plan</button>`;
    const now = Date.now();
    const rows = this.plans.map(p => this.row(p, now)).join('');
    const list = !this.loaded ? hint('Loading plans…')
      : rows ? `<div class="plan-list">${rows}</div>`
        : `<p class="plans-empty">No plans yet. Start one for your next job.</p>`;
    this.root.innerHTML = `<div class="plans">${head}${create}${list}</div>`;
    for (const [id, v] of values) { const el = this.root.querySelector<HTMLInputElement>(`#${CSS.escape(id)}`); if (el && id) el.value = v; }
    if (active) this.root.querySelector<HTMLInputElement>(`#${CSS.escape(active)}`)?.focus();
  }

  private row(p: PlanMeta, now: number): string {
    const id = esc(p.id);
    if (this.inline?.id === p.id && this.inline.kind === 'rename') {
      return `<div class="plan-row editing" data-id="${id}">`
        + `<input id="rename-${id}" class="plan-rename" aria-label="Address" autocomplete="off" value="${esc(p.address)}" />`
        + button('Save', { mods: ['compact'], variant: 'primary', data: { act: 'rename-save' } })
        + button('Cancel', { mods: ['compact'], data: { act: 'inline-cancel' } })
        + error('', true) + `</div>`;
    }
    if (this.inline?.id === p.id && this.inline.kind === 'delete') {
      return `<div class="plan-row confirming" data-id="${id}">`
        + `<p class="plan-confirm">Delete ${esc(p.address)}? This can't be undone.</p>`
        + button('Delete', { mods: ['compact'], variant: 'danger', data: { act: 'delete-confirm' } })
        + button('Cancel', { mods: ['compact'], data: { act: 'inline-cancel' } }) + `</div>`;
    }
    const meta = this.opening === p.id ? 'Opening…' : editedAgo(p.updatedAt, now);
    return `<div class="plan-row" data-id="${id}">`
      + `<button type="button" class="plan-open" data-act="open">`
      + `<span class="plan-address">${esc(p.address)}</span>`
      + `<span class="plan-meta">${esc(meta)}${p.pending ? ' · <span class="plan-pending">Not synced yet</span>' : ''}</span></button>`
      + button('Rename', { mods: ['compact'], data: { act: 'rename' } })
      + button('Delete', { mods: ['compact'], variant: 'danger', data: { act: 'delete' } }) + `</div>`;
  }

  private onClick(e: Event) {
    const t = e.target as HTMLElement;
    const el = t.closest<HTMLElement>('button');
    if (!el) return;
    const id = el.closest<HTMLElement>('.plan-row')?.dataset.id ?? '';
    const act = el.dataset.act ?? el.id;
    switch (act) {
      case 'new-plan': this.newOpen = true; this.armNew(); this.render(); this.root.querySelector<HTMLInputElement>('#new-address')?.focus(); return;
      case 'new-cancel': this.closeNew(); this.render(); return;
      case 'new-pdf': {
        const address = this.root.querySelector<HTMLInputElement>('#new-address')!.value;
        if (!cleanAddress(address)) { this.newError = INPUT_MESSAGES.address; this.render(); return; }
        this.armNew().click(); return;
      }
      case 'account': this.menuOpen = !this.menuOpen; this.signOutWarn = false; this.render(); return;
      case 'menu-close': this.menuOpen = false; this.signOutWarn = false; this.render(); return;
      case 'sign-out':
        if (this.plans.some(p => p.pending)) { this.signOutWarn = true; this.render(); return; }
        this.opts.onSignOut(); return;
      case 'sign-out-anyway': this.opts.onSignOut(); return;
      case 'open': if (!this.opening) this.opts.onOpen(id); return;
      case 'rename': this.inline = { kind: 'rename', id }; this.render(); this.focusRename(); return;
      case 'rename-save': void this.saveRename(id); return;
      case 'delete': this.inline = { kind: 'delete', id }; this.render(); return;
      case 'delete-confirm': {
        this.inline = null;
        this.store.remove(id).catch(err => this.opts.onError?.(err, 'save'));
        this.render(); return;
      }
      case 'inline-cancel': this.inline = null; this.render(); return;
    }
  }

  private onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.classList.contains('plan-rename')) {
      const id = t.closest<HTMLElement>('.plan-row')?.dataset.id ?? '';
      if (e.key === 'Enter') { e.preventDefault(); void this.saveRename(id); }
      if (e.key === 'Escape') { this.inline = null; this.render(); }
    } else if (t.id === 'new-address' && e.key === 'Enter') {
      e.preventDefault(); this.root.querySelector<HTMLButtonElement>('#new-pdf')?.click();
    }
  }

  private focusRename() {
    const el = this.root.querySelector<HTMLInputElement>('.plan-rename');
    el?.focus(); el?.select();
  }

  private async saveRename(id: string) {
    const el = this.root.querySelector<HTMLInputElement>('.plan-rename');
    if (!el) return;
    const clean = cleanAddress(el.value);
    const msg = el.parentElement!.querySelector<HTMLElement>('.text-error')!;
    if (!clean) { msg.textContent = INPUT_MESSAGES.address; msg.hidden = false; return; }
    this.inline = null;
    try {
      await this.store.rename(id, clean);
    } catch (err) {
      if (err instanceof PlanInputError) { this.inline = { kind: 'rename', id }; this.render(); return; }
      this.opts.onError?.(err as Error, 'save');
    }
    this.render();
  }

  /** While the New plan form is open, a picked file creates the plan. */
  private armNew(): HTMLInputElement {
    return armFilePicker(file => void this.create(file));
  }

  private async create(file: File) {
    if (!this.newOpen || this.creating) return;
    const address = this.root.querySelector<HTMLInputElement>('#new-address')?.value ?? '';
    this.creating = true; this.newError = ''; this.render();
    try {
      const id = await this.store.create(address, file);
      this.closeNew();
      this.opts.onOpen(id);
    } catch (err) {
      this.creating = false;
      if (err instanceof PlanInputError) this.newError = INPUT_MESSAGES[err.reason];
      else { console.error('create failed', err); this.opts.onError?.(err as Error, 'save'); }
      this.render();
    }
  }
}
