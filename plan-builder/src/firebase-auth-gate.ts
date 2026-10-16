import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { getFirebase } from './firebase';
import {
  SignInError,
  forgetInvite,
  rememberInvite,
  resolveInvite,
  wasInvited,
  type AuthGate,
  type AuthState,
  type InviteCheck,
} from './auth';

const POPUP_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/popup-blocked']);

async function checkInvite(email: string): Promise<InviteCheck> {
  try {
    const snap = await getDocFromServer(doc(getFirebase().db, 'invites', email.toLowerCase()));
    return snap.exists() ? 'invited' : 'not-invited';
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'permission-denied') return 'not-invited';
    return 'offline'; // unavailable / network / anything else we cannot confirm
  }
}

export class FirebaseAuthGate implements AuthGate {
  private cb: ((s: AuthState) => void) | null = null;
  private user: User | null = null;
  private seq = 0;

  watch(cb: (s: AuthState) => void): () => void {
    this.cb = cb;
    cb({ kind: 'loading' });
    const off = onAuthStateChanged(getFirebase().auth, (user) => {
      this.user = user;
      void this.evaluate();
    });
    return () => {
      off();
      if (this.cb === cb) this.cb = null;
    };
  }

  recheck(): void {
    if (this.user) void this.evaluate();
  }

  private async evaluate(): Promise<void> {
    const user = this.user;
    const n = ++this.seq;
    const emit = (s: AuthState) => { if (n === this.seq) this.cb?.(s); };
    if (!user) return emit({ kind: 'signed-out' });
    const email = user.email ?? '';
    if (!email) return emit({ kind: 'not-invited', email });
    const verdict = resolveInvite(await checkInvite(email), wasInvited(user.uid));
    if (verdict === 'invited') {
      rememberInvite(user.uid);
      emit({ kind: 'ready', uid: user.uid, email });
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
