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
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('indexedDB open blocked'));
    }).catch((e) => {
      dbPromise = null; // let a later call retry
      throw e;
    });
  }
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
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
  async put(planId: string, rev: number, bytes: ArrayBuffer): Promise<void> {
    try {
      await run('readwrite', (s) => s.put({ rev, bytes } satisfies CachedPdf, planId));
    } catch (e) {
      console.warn('pdfCache.put failed', e);
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
