import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pdfCache } from './pdf-cache';

const bytes = (n: number) => new Uint8Array(n).fill(7).buffer;

describe('pdfCache', () => {
  afterEach(() => vi.restoreAllMocks());

  it('put then get returns the rev and bytes', async () => {
    expect(await pdfCache.put('a', 1, bytes(5))).toBe(true);
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
      await expect(fresh.put('x', 1, bytes(1))).resolves.toBe(false);
      await expect(fresh.delete('x')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reopens after its connection is closed', async () => {
    vi.resetModules();
    const opened: IDBOpenDBRequest[] = [];
    const realOpen = indexedDB.open.bind(indexedDB);
    vi.spyOn(indexedDB, 'open').mockImplementation((...a) => { const r = realOpen(...a); opened.push(r); return r; });
    const fresh = (await import('./pdf-cache')).pdfCache;
    await fresh.put('d', 1, bytes(4));
    opened[0].result.close(); // no onclose event: the next transaction throws InvalidStateError
    expect((await fresh.get('d'))?.rev).toBe(1);
    expect(await fresh.put('d', 2, bytes(4))).toBe(true);
    expect(opened).toHaveLength(2);
  });

  it('lets the database be deleted, then starts over', async () => {
    await pdfCache.put('e', 1, bytes(4));
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('plan-builder-pdfs');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked: the cache kept its connection open'));
    });
    expect(await pdfCache.get('e')).toBeNull();
    expect(await pdfCache.put('e', 2, bytes(4))).toBe(true);
    expect((await pdfCache.get('e'))?.rev).toBe(2);
  });
});
