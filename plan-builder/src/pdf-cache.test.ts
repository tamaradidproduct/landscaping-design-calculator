import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pdfCache } from './pdf-cache';

const bytes = (n: number) => new Uint8Array(n).fill(7).buffer;

describe('pdfCache', () => {
  afterEach(() => vi.restoreAllMocks());

  it('put then get returns the rev and bytes', async () => {
    await pdfCache.put('a', 1, bytes(5));
    const got = await pdfCache.get('a');
    expect(got?.rev).toBe(1);
    expect(got?.bytes.byteLength).toBe(5);
  });

  it('put with a higher rev replaces the entry', async () => {
    await pdfCache.put('b', 1, bytes(3));
    await pdfCache.put('b', 2, bytes(9));
    const got = await pdfCache.get('b');
    expect(got?.rev).toBe(2);
    expect(got?.bytes.byteLength).toBe(9);
  });

  it('delete removes the entry', async () => {
    await pdfCache.put('c', 1, bytes(2));
    await pdfCache.delete('c');
    expect(await pdfCache.get('c')).toBeNull();
  });

  it('get of an unknown plan is null', async () => {
    expect(await pdfCache.get('nope')).toBeNull();
  });

  it('is best effort when indexedDB is unavailable', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const fresh = (await import('./pdf-cache')).pdfCache;
      expect(await fresh.get('x')).toBeNull();
      await expect(fresh.put('x', 1, bytes(1))).resolves.toBeUndefined();
      await expect(fresh.delete('x')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
