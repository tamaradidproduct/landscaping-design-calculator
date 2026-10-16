export type AuthState =
  | { kind: 'loading' }
  | { kind: 'signed-out'; offline?: boolean }
  | { kind: 'not-invited'; email: string }
  | { kind: 'ready'; uid: string; email: string };

export interface AuthGate {
  watch(cb: (s: AuthState) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** Re-run the invite check for the current user (e.g. after permission-denied). */
  recheck(): void;
}

export type InviteCheck = 'invited' | 'not-invited' | 'offline';

/** Online answer wins (revocation); offline falls back to the per-device memory. */
export function resolveInvite(check: InviteCheck, remembered: boolean): 'invited' | 'not-invited' | 'unknown' {
  if (check === 'offline') return remembered ? 'invited' : 'unknown';
  return check;
}

export class SignInError extends Error {
  constructor(readonly reason: 'popup' | 'offline', cause?: unknown) {
    super(`sign-in failed: ${reason}`, { cause });
    this.name = 'SignInError';
  }
}

const key = (uid: string) => `plan-builder.invited.${uid}`;

export function rememberInvite(uid: string): void {
  try { localStorage.setItem(key(uid), '1'); } catch { /* storage unavailable */ }
}

export function wasInvited(uid: string): boolean {
  try { return localStorage.getItem(key(uid)) === '1'; } catch { return false; }
}

export function forgetInvite(uid: string): void {
  try { localStorage.removeItem(key(uid)); } catch { /* storage unavailable */ }
}

/** Local dev: no Firebase, always signed in. */
export class DevAuthGate implements AuthGate {
  watch(cb: (s: AuthState) => void): () => void {
    cb({ kind: 'ready', uid: 'dev', email: 'dev@localhost' });
    return () => {};
  }
  async signIn(): Promise<void> {}
  async signOut(): Promise<void> {}
  recheck(): void {}
}
