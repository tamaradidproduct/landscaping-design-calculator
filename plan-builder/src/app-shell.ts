// Routing between Sign-in, Plans and the editor; owns the session's store and autosave.
import { DevAuthGate, type AuthGate, type AuthState } from './auth';
import { Autosave } from './autosave';
import { MemoryPlanStore } from './memory-plan-store';
import { PlanFormatError, type PlanState } from './plan-model';
import { AccessDeniedError, PdfUnavailableError, PlanInputError, SizeWarning, checkPdf, type PlanStore } from './plan-store';
import { armFilePicker, planInputMessage, PlansScreen, renderLoading, renderNotInvited, renderSignIn } from './plans-ui';

/** What the shell needs from the editor in main.ts. */
export interface Editor {
  tool: { load(state: PlanState): void; state(): PlanState };
  /** Shows the PDF; `name` labels the plot plan layer. 'failed' keeps what was open and shows no message; 'stale': a later open or leaving the editor overtook it. */
  openBytes(bytes: ArrayBuffer, name: string): Promise<OpenResult>;
  /** Hides the plot plan (nothing open) and any editor message. */
  closePage(): void;
  toast(msg: string): void;
}
export type OpenResult = 'ok' | 'failed' | 'stale';
export interface Shell {
  /** ToolHost.changed(): called on every editor update. */
  changed(): void;
}

type Store = PlanStore & { dispose?(): void };
const CLOUD_TOAST_GAP_MS = 30_000;

export function startShell(ed: Editor): Shell {
  const $ = (id: string) => document.getElementById(id)!;
  const { tool, toast } = ed;
  const authRoot = $('screen-auth'), plansRoot = $('screen-plans');
  const memoryMode = import.meta.env.DEV && new URLSearchParams(location.search).get('store') === 'memory';
  let gate: AuthGate = new DevAuthGate();
  let session: { uid: string; store: Store; plans: PlansScreen } | null = null;
  let sessionUid: string | null = null; // set as soon as `ready` arrives, before the store has loaded
  let sessionSeq = 0;
  let current: { id: string; address: string } | null = null; // the plan open in the editor
  let lastSaved = '';
  let openSeq = 0;

  const autosave = new Autosave(id => {
    // State belongs only to the open plan, and every plan switch flushes first, so any other id is dropped
    if (session && current?.id === id) session.store.save(id, tool.state());
    else console.error('autosave for a plan that is no longer open', id);
  }, 1000);
  window.addEventListener('pagehide', () => autosave.flush());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autosave.flush(); });

  function showScreen(which: 'auth' | 'plans' | 'editor') {
    authRoot.hidden = which !== 'auth';
    if (which !== 'plans') session?.plans.hide();
    $('canvas').hidden = which !== 'editor'; $('sidebar').hidden = which !== 'editor';
    if (which === 'plans') session?.plans.show();
  }

  /** Leaves the editor: saves what's pending and clears the plan (no undo history carries over). */
  function closeEditor() {
    autosave.flush();
    current = null; openSeq++;
    ed.closePage();
    $('replace-confirm').hidden = true; armFilePicker(null);
    tool.load({ outlines: {}, refs: [] });
  }

  async function openPlan(id: string) {
    if (!session) return;
    const { store, plans } = session, seq = ++openSeq;
    plans.setOpening(id);
    try {
      const { meta, state } = await store.load(id);
      const bytes = await store.getPdf(id);
      if (seq !== openSeq || session?.store !== store) return;
      plans.setOpening(null);
      showScreen('editor');
      tool.load(state);
      lastSaved = JSON.stringify(tool.state());
      current = { id, address: meta.address };
      if ((await ed.openBytes(bytes, meta.address)) === 'failed' && seq === openSeq) {
        backToPlans(); // clears the editor's messages, so say why after it
        toast("This plan's PDF couldn't be opened. Delete it and start a new plan with a working PDF.");
      }
    } catch (e) {
      if (seq !== openSeq || session?.store !== store) return;
      plans.setOpening(null);
      if (e instanceof PdfUnavailableError) toast("This plan's PDF isn't on this device yet. Connect to the internet to open it.");
      else if (e instanceof PlanFormatError) toast('This plan was saved by a newer version of Plan Builder. Reload to update.');
      else if (e instanceof AccessDeniedError) gate.recheck();
      else { console.error('open failed', e); toast("Couldn't open this plan. Try again."); }
    }
  }

  function backToPlans() { closeEditor(); showScreen('plans'); }
  $('back-to-plans').onclick = backToPlans;

  // Replace plot plan: confirm in the side panel, then pick a PDF; outlines and surfaces stay.
  $('file-button').onclick = () => {
    if (!current) return;
    $('replace-text').textContent = `Replace the plot plan for ${current.address}? Your outlines and surfaces stay where they are.`;
    $('replace-confirm').hidden = false;
  };
  $('replace-cancel').onclick = () => { $('replace-confirm').hidden = true; armFilePicker(null); };
  $('replace-pick').onclick = () => {
    const plan = current, store = session?.store;
    if (!plan || !store) return;
    armFilePicker(async file => {
      armFilePicker(null);
      if (current !== plan) return;
      try { checkPdf(file); } catch (e) { if (e instanceof PlanInputError) { toast(planInputMessage(e)); return; } throw e; }
      // Open it before saving it, so a file that won't render never replaces a working plot plan
      const opened = await ed.openBytes(await file.arrayBuffer(), plan.address);
      if (opened === 'stale' || current !== plan) return;
      if (opened === 'failed') { toast("That file couldn't be opened as a PDF. Pick the plot plan PDF."); return; }
      $('replace-confirm').hidden = true;
      try {
        await store.replacePdf(plan.id, file);
      } catch (e) {
        if (e instanceof PlanInputError) toast(planInputMessage(e));
        else routeStoreError(e as Error);
      }
    }).click();
  };

  let lastCloudToast = -Infinity;
  function routeStoreError(e: Error) {
    if (e instanceof SizeWarning) toast('This plan is getting large. Split very detailed outlines into simpler ones.');
    else if (e instanceof AccessDeniedError) gate.recheck();
    else {
      console.error(e);
      // Offline uploads can fail over and over: say it once in a while, not on every retry
      if (Date.now() - lastCloudToast < CLOUD_TOAST_GAP_MS) return;
      lastCloudToast = Date.now();
      toast("Couldn't save to the cloud. Your changes are kept on this device.");
    }
  }
  window.addEventListener('online', () => { void session?.store.flushUploads(); });

  function endSession() {
    if (!session && !sessionUid) return;
    closeEditor();
    session?.plans.hide();
    session?.store.dispose?.();
    session = null; sessionUid = null; sessionSeq++;
  }

  async function startSession(uid: string, email: string) {
    const seq = ++sessionSeq;
    sessionUid = uid;
    let store: Store;
    if (memoryMode) store = new MemoryPlanStore();
    else {
      const { FirebasePlanStore } = await import('./firebase-plan-store');
      if (seq !== sessionSeq) return;
      store = new FirebasePlanStore(uid);
    }
    const route = (e: Error) => { if (session?.store === store) routeStoreError(e); };
    store.onError(route);
    const plans = new PlansScreen(plansRoot, store, {
      email,
      onOpen: id => void openPlan(id),
      onSignOut: () => { void gate.signOut(); },
      onError: route,
    });
    session = { uid, store, plans };
    showScreen('plans');
  }

  function onAuth(s: AuthState) {
    // recheck() re-emits loading → ready for the same account: keep whatever screen is up
    if (s.kind === 'loading') { if (!sessionUid) { renderLoading(authRoot); showScreen('auth'); } return; }
    if (s.kind === 'ready') {
      if (sessionUid === s.uid) return;
      endSession();
      void startSession(s.uid, s.email).catch(e => { console.error('could not load plans', e); toast("Couldn't open your plans. Reload to try again."); });
      return;
    }
    endSession();
    if (s.kind === 'signed-out') renderSignIn(authRoot, gate, { offline: s.offline });
    else renderNotInvited(authRoot, s.email, gate);
    showScreen('auth');
  }

  async function start() {
    if (!memoryMode) {
      renderLoading(authRoot); showScreen('auth');
      const { FirebaseAuthGate } = await import('./firebase-auth-gate');
      gate = new FirebaseAuthGate();
    }
    gate.watch(onAuth);
  }
  void start().catch(e => { console.error('could not start', e); toast("Couldn't start Plan Builder. Reload to try again."); });

  return {
    changed() {
      if (!current) return;
      // Save only when what would be saved changed (not on hover, selection or view moves)
      const s = JSON.stringify(tool.state());
      if (s === lastSaved) return;
      lastSaved = s;
      autosave.changed(current.id);
    },
  };
}
