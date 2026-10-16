// Screens outside the editor: Sign-in, Not invited, and Plans (list + New plan form).
import { SignInError, type AuthGate } from './auth';
import { extractAddress, fileNameToTitle, suggestName } from './address-extract';
import { cleanAddress, editedAgo, type PlanMeta } from './plan-model';
import { checkPdf, PlanInputError, type PlanStore } from './plan-store';
import { button, card, emptyNote, error, esc, field, formStack, hint, input, listRow, row, screenPanel, screenText, splitRow } from './ui';

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

const panel = (html: string) => screenPanel('Plan Builder', html);

export function renderLoading(root: HTMLElement): void {
  root.innerHTML = panel(hint('Signing in…'));
}

export function renderSignIn(root: HTMLElement, gate: AuthGate, opts: { offline?: boolean } = {}): void {
  root.innerHTML = panel(button('Sign in with Google', { variant: 'primary', mods: ['large'], id: 'sign-in' })
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
  root.innerHTML = panel(screenText(`This Google account (${esc(email)}) hasn't been invited to Plan Builder. Ask Tamara for an invite.`)
    + button('Use another account', { id: 'use-another' }));
  root.querySelector<HTMLButtonElement>('#use-another')!.onclick = () => { void gate.signOut(); };
}

export interface PlansScreenOptions {
  onOpen(id: string): void;
  onSignOut(): void;
  email: string;
  /** Store failures with no inline place to show them: 'load' for the list itself, 'save' for rename, delete, create. */
  onError?(e: Error, what: 'load' | 'save'): void;
  /** Page-1 text of a picked PDF, to find an address ('' when none or it can't be read). Takes ownership of the buffer. */
  readPdfText?(bytes: ArrayBuffer): Promise<string>;
}

type Inline = { kind: 'rename'; id: string } | { kind: 'delete'; id: string } | null;

export class PlansScreen {
  private plans: PlanMeta[] = [];
  private loaded = false;
  private inline: Inline = null;
  private newOpen = false;
  private newError = '';
  private creating = false;
  private picked: File | null = null;  // the plot plan held by the New plan form until Create plan
  private userEdited = false;          // the user typed in the address field: nothing overwrites it
  private extractSeq = 0;              // bumped per pick, Cancel and close: a late extraction result is ignored
  private extracted: string | null = null;
  private menuOpen = false;
  private signOutWarn = false;
  private opening: string | null = null;
  private unwatch: (() => void) | null = null;
  private revived = false;
  private tick = 0;

  constructor(private root: HTMLElement, private store: PlanStore, private opts: PlansScreenOptions) {
    root.addEventListener('click', e => this.onClick(e));
    root.addEventListener('keydown', e => this.onKey(e));
    root.addEventListener('input', e => { if ((e.target as HTMLElement).id === 'new-address') this.userEdited = true; });
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
    this.picked = null; this.userEdited = false; this.extracted = null; this.extractSeq++;
    armFilePicker(null);
  }

  private render() {
    if (this.root.hidden) return;
    // Keep what's being typed (and focus) across list updates from the store
    const active = document.activeElement instanceof HTMLInputElement && this.root.contains(document.activeElement) && document.activeElement.id
      ? document.activeElement.id
      : null;
    const values = new Map([...this.root.querySelectorAll('input')].filter((i): i is HTMLInputElement => !!i.id).map(i => [i.id, i.value]));
    const menu = this.menuOpen
      ? card(hint(esc(this.opts.email))
        + (this.signOutWarn
          ? error("Some changes haven't synced yet. They'll sync when you sign back in on this device.", false)
            + splitRow(button('Sign out anyway', { variant: 'danger', data: { act: 'sign-out-anyway' } }), button('Cancel', { data: { act: 'menu-close' } }))
          : button('Sign out', { id: 'sign-out' })), 'account-menu')
      : '';
    const account = `<div class="account">${button(esc(this.opts.email), { mods: ['account-toggle'], id: 'account', expanded: this.menuOpen })}${menu}</div>`;
    const head = `<header class="plans-head"><h1 class="screen-title">Plans</h1>${account}</header>`;
    const create = this.newOpen
      ? formStack(`<strong>New plan</strong>`
        + field('new-address', "Job's address (optional)", input('new-address', { placeholder: '123 Main St' }))
        + row(button(this.picked ? 'Change PDF' : 'Pick plot plan PDF', { variant: this.picked ? undefined : 'primary', id: 'new-pdf', disabled: this.creating }),
          this.picked ? button(this.creating ? 'Creating…' : 'Create plan', { variant: 'primary', id: 'create-plan', disabled: this.creating }) : '',
          button('Cancel', { data: { act: 'new-cancel' } }))
        + error(esc(this.newError), !this.newError), 'new-plan card stack', true)
      : button('New plan', { variant: 'primary', id: 'new-plan' });
    const now = Date.now();
    const rows = this.plans.map(p => this.row(p, now)).join('');
    const list = !this.loaded ? hint('Loading plans…')
      : rows ? `<div class="plan-list">${rows}</div>`
        : emptyNote('No plans yet. Start one for your next job.');
    this.root.innerHTML = `<div class="plans">${head}${create}${list}</div>`;
    for (const [id, v] of values) { const el = this.root.querySelector<HTMLInputElement>(`#${CSS.escape(id)}`); if (el) el.value = v; }
    if (active) this.root.querySelector<HTMLInputElement>(`#${CSS.escape(active)}`)?.focus();
  }

  private row(p: PlanMeta, now: number): string {
    const id = esc(p.id);
    const compact = ['compact'];
    if (this.inline?.id === p.id && this.inline.kind === 'rename') {
      return listRow(p.id, [
        input(`rename-${p.id}`, { cls: 'plan-rename', ariaLabel: 'Address', value: p.address }),
        button('Save', { mods: compact, variant: 'primary', data: { act: 'rename-save' } }),
        button('Cancel', { mods: compact, data: { act: 'inline-cancel' } }),
        error('', true),
      ], 'editing');
    }
    if (this.inline?.id === p.id && this.inline.kind === 'delete') {
      return listRow(p.id, [
        `<p class="plan-confirm">Delete ${esc(p.address)}? This can't be undone.</p>`,
        button('Delete', { mods: compact, variant: 'danger', data: { act: 'delete-confirm' } }),
        button('Cancel', { mods: compact, data: { act: 'inline-cancel' } }),
      ], 'confirming');
    }
    const meta = this.opening === p.id ? 'Opening…' : editedAgo(p.updatedAt, now);
    return listRow(p.id, [
      button(`<span class="plan-address">${esc(p.address)}</span>`
        + `<span class="plan-meta">${esc(meta)}${p.pending ? ' · <span class="plan-pending">Not synced yet</span>' : ''}</span>`,
      { mods: ['plan-open'], data: { act: 'open' } }),
      button('Rename', { mods: compact, data: { act: 'rename' } }),
      button('Delete', { mods: compact, variant: 'danger', data: { act: 'delete' } }),
    ]);
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
      case 'new-pdf': this.armNew().click(); return;
      case 'create-plan': void this.create(); return;
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
      e.preventDefault(); this.root.querySelector<HTMLButtonElement>('#create-plan')?.click();
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

  /** While the New plan form is open, a picked file is held until Create plan. */
  private armNew(): HTMLInputElement {
    return armFilePicker(file => this.pick(file));
  }

  private setAddress(text: string) {
    const el = this.root.querySelector<HTMLInputElement>('#new-address');
    if (el) el.value = text; // render() restores field values from the DOM, so this survives list updates
  }

  private pick(file: File) {
    if (!this.newOpen || this.creating) return;
    try {
      checkPdf(file);
    } catch (err) {
      if (err instanceof PlanInputError) { this.newError = INPUT_MESSAGES[err.reason]; this.render(); return; }
      throw err;
    }
    this.picked = file; this.newError = ''; this.extracted = null;
    const seq = ++this.extractSeq;
    if (!this.userEdited) this.setAddress(fileNameToTitle(file.name));
    this.render();
    void this.extract(file, seq);
  }

  private async extract(file: File, seq: number) {
    try {
      const text = await this.opts.readPdfText?.(await file.arrayBuffer());
      if (seq !== this.extractSeq || !text) return;
      const found = extractAddress(text);
      if (!found) return;
      this.extracted = found;
      if (!this.userEdited) this.setAddress(found);
    } catch { /* the file name stays */ }
  }

  private async create() {
    const file = this.picked;
    if (!this.newOpen || this.creating || !file) return;
    const typed = this.root.querySelector<HTMLInputElement>('#new-address')?.value ?? '';
    this.creating = true; this.newError = ''; this.render();
    try {
      const id = await this.store.create(suggestName({ typed, extracted: this.extracted, fileName: file.name }), file);
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
