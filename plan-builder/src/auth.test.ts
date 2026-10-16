import { afterEach, describe, expect, it, vi } from 'vitest';
import { DevAuthGate, forgetInvite, rememberInvite, resolveInvite, wasInvited } from './auth';

function stubStorage(): Map<string, string> {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  return m;
}

afterEach(() => vi.unstubAllGlobals());

describe('resolveInvite', () => {
  it('trusts an online invited check', () => expect(resolveInvite('invited', false)).toBe('invited'));
  it('online revocation wins over memory', () => expect(resolveInvite('not-invited', true)).toBe('not-invited'));
  it('offline + remembered is invited', () => expect(resolveInvite('offline', true)).toBe('invited'));
  it('offline + never invited is unknown', () => expect(resolveInvite('offline', false)).toBe('unknown'));
});

describe('invite memory', () => {
  it('remembers and forgets per uid', () => {
    const m = stubStorage();
    expect(wasInvited('u1')).toBe(false);
    rememberInvite('u1');
    expect(m.get('plan-builder.invited.u1')).toBe('1');
    expect(wasInvited('u1')).toBe(true);
    expect(wasInvited('u2')).toBe(false);
    forgetInvite('u1');
    expect(wasInvited('u1')).toBe(false);
  });
  it('never throws when localStorage throws', () => {
    const boom = () => { throw new Error('denied'); };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom });
    expect(wasInvited('u1')).toBe(false);
    expect(() => rememberInvite('u1')).not.toThrow();
    expect(() => forgetInvite('u1')).not.toThrow();
  });
});

describe('DevAuthGate', () => {
  it('emits ready dev user', () => {
    const cb = vi.fn();
    const off = new DevAuthGate().watch(cb);
    expect(cb).toHaveBeenCalledWith({ kind: 'ready', uid: 'dev', email: 'dev@localhost' });
    expect(() => off()).not.toThrow();
  });
});
