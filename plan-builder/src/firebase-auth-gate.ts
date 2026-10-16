import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { getFirebase, persistStorageOnce } from './firebase';
import {
  SignInError,
  forgetInvite,
  rememberInvite,
  resolveInvite,
  wasInvited,
  type AuthGate,
  type AuthState,
  classifyInviteError,
  type InviteCheck,
} from './auth';

const POPUP_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/popup-blocked']);

async function checkInvite(email: string): Promise<InviteCheck> {
  try {
    const snap = await getDocFromServer(doc(getFirebase().db, 'invites', email.toLowerCase()));
    return snap.exists() ? 'invited' : 'not-invited';
  } catch (e) {
    const code = (e as { code?: string }).code;
    const { check, log } = classifyInviteError(code);
    if (log) console.error('invite check failed', e);
    return check;
  }
}

export class FirebaseAuthGate implements AuthGate {
  private cb: ((s: AuthState) => void) | null = null;
  private user: User | null = null;
  private seq = 0;
  private last: AuthState = { kind: 'loading' };

  watch(cb: (s: AuthState) => void): () => void {
    this.cb = cb;
    this.last = { kind: 'loading' };
    cb(this.last);
    const onOnline = () => {
      if (this.last.kind === 'signed-out' && this.last.offline && this.user) void this.evaluate();
    };
    window.addEventListener('online', onOnline);
    const off = onAuthStateChanged(getFirebase().auth, (user) => {
      this.user = user;
      void this.evaluate();
    });
    return () => {
      off();
      window.removeEventListener('online', onOnline);
      if (this.cb === cb) this.cb = null;
    };
  }

  /** Re-verifies with no head start: after permission-denied the remembered invite is in doubt. */
  recheck(): void {
    if (this.user) void this.evaluate(false);
  }

  /** `trustMemory`: a remembered invite emits ready at once (offline cold start); the server check then runs behind it. */
  private async evaluate(trustMemory = true): Promise<void> {
    const user = this.user;
    const n = ++this.seq;
    const emit = (s: AuthState) => {
      if (n !== this.seq) return;
      this.last = s;
      this.cb?.(s);
    };
    if (!user) return emit({ kind: 'signed-out' });
    const email = user.email ?? '';
    if (!email || !user.emailVerified) {
      forgetInvite(user.uid);
      return emit({ kind: 'not-invited', email });
    }
    const remembered = wasInvited(user.uid);
    const early = trustMemory && remembered;
    const ready = () => { emit({ kind: 'ready', uid: user.uid, email }); if (n === this.seq) persistStorageOnce(); };
    if (early) ready(); else emit({ kind: 'loading' });
    const verdict = resolveInvite(await checkInvite(email), remembered);
    if (verdict === 'invited') {
      rememberInvite(user.uid);
      if (!early) ready();
    } else if (verdict === 'not-invited') {
      forgetInvite(user.uid);
      emit({ kind: 'not-invited', email });
    } else {
      emit({ kind: 'signed-out', offline: true });
    }
  }

  async signIn(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(getFirebase().auth, provider);
      void this.evaluate(); // onAuthStateChanged does not fire for an unchanged uid
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (POPUP_CODES.has(code)) throw new SignInError('popup', e);
      if (code === 'auth/network-request-failed') throw new SignInError('offline', e);
      throw e;
    }
  }

  async signOut(): Promise<void> {
    await fbSignOut(getFirebase().auth);
  }
}
