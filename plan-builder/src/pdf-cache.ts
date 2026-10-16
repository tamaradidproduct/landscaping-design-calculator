// On-device PDF cache. Best effort: any IndexedDB failure degrades to a miss.
export interface CachedPdf {
  rev: number;
  bytes: ArrayBuffer;
}

const DB_NAME = 'plan-builder-pdfs';
const STORE = 'pdfs';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    const p: Promise<IDBDatabase> = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => {
        const db = req.result;
        // The browser can close the connection (storage cleared, another tab upgrading): reopen next time
        const drop = () => { if (dbPromise === p) dbPromise = null; };
        db.onclose = drop;
        db.onversionchange = () => { db.close(); drop(); };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('indexedDB open blocked'));
    }).catch((e) => {
      if (dbPromise === p) dbPromise = null; // let a later call retry
      throw e;
    });
    dbPromise = p;
  }
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, retry = true): Promise<T> {
  const db = await openDb();
  let tx: IDBTransaction;
  try {
    tx = db.transaction(STORE, mode);
  } catch (e) {
    // A connection closed without onclose (e.g. by us elsewhere) throws InvalidStateError: reopen once
    if (!retry || (e as { name?: unknown } | null)?.name !== 'InvalidStateError') throw e;
    dbPromise = null;
    return run(mode, fn, false);
  }
  return new Promise<T>((resolve, reject) => {
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
}

export const pdfCache = {
  async get(planId: string): Promise<CachedPdf | null> {
    try {
      return ((await run('readonly', (s) => s.get(planId))) as CachedPdf | undefined) ?? null;
    } catch (e) {
      console.warn('pdfCache.get failed', e);
      return null;
    }
  },
  /** Resolves false when the PDF couldn't be kept on the device. */
  async put(planId: string, rev: number, bytes: ArrayBuffer): Promise<boolean> {
    try {
      await run('readwrite', (s) => s.put({ rev, bytes } satisfies CachedPdf, planId));
      return true;
    } catch (e) {
      console.warn('pdfCache.put failed', e);
      return false;
    }
  },
  async delete(planId: string): Promise<void> {
    try {
      await run('readwrite', (s) => s.delete(planId));
    } catch (e) {
      console.warn('pdfCache.delete failed', e);
    }
  },
};
