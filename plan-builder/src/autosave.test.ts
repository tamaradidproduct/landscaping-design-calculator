import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autosave } from './autosave';

describe('Autosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('saves once 1000 ms after the last change', () => {
    const save = vi.fn();
    const a = new Autosave(save);
    a.changed('a');
    vi.advanceTimersByTime(400);
    a.changed('a');
    vi.advanceTimersByTime(400);
    a.changed('a');
    vi.advanceTimersByTime(999);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('a');
    expect(a.pending).toBe(false);
  });

  it('flush saves immediately and clears pending', () => {
    const save = vi.fn();
    const a = new Autosave(save);
    a.changed('a');
    expect(a.pending).toBe(true);
    a.flush();
    expect(save).toHaveBeenCalledWith('a');
    expect(a.pending).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(save).toHaveBeenCalledTimes(1);
    a.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('switching plans saves the previous plan first', () => {
    const save = vi.fn();
    const a = new Autosave(save);
    a.changed('a');
    vi.advanceTimersByTime(200);
    a.changed('b');
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenLastCalledWith('a');
    vi.advanceTimersByTime(999);
    expect(save).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('b');
  });

  it('cancel drops the pending save', () => {
    const save = vi.fn();
    const a = new Autosave(save);
    a.changed('a');
    a.cancel();
    expect(a.pending).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it('clears pending and rethrows from flush when save throws', () => {
    const save = vi.fn(() => {
      throw new Error('boom');
    });
    const a = new Autosave(save);
    a.changed('a');
    expect(() => a.flush()).toThrow('boom');
    expect(a.pending).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('logs and clears pending when save throws in the timer path', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const save = vi.fn(() => {
      throw new Error('boom');
    });
    const a = new Autosave(save);
    a.changed('a');
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(err).toHaveBeenCalled();
    expect(a.pending).toBe(false);
    err.mockRestore();
  });
});
