// Promise wrapper around the PDF worker.
import type { Matrix, WorkerRequest, WorkerResponse } from './pdf-protocol';

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void };
type Distribute<T> = T extends unknown ? Omit<T, 'id'> : never;

/** Longest `text()` waits for the engine to start (measured ~14 s on a dev Mac); a hung start-up can't block forever. */
export const WARMUP_WAIT_MS = 30_000;
/** Budget for the extraction itself, counted once the engine is ready. */
export const TEXT_TIMEOUT_MS = 3000;

export class PdfClient {
  private worker = new Worker(new URL('./pdf-worker.ts', import.meta.url), { type: 'module' });
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private ready: Promise<void> | null = null; // settles (never rejects) when the engine start-up ends

  constructor() {
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const p = this.pending.get(e.data.id); if (!p) return;
      this.pending.delete(e.data.id);
      if (e.data.type === 'error') p.reject(new Error(e.data.message)); else p.resolve(e.data);
    };
  }

  private send(req: Distribute<WorkerRequest>, transfer: Transferable[] = []): Promise<WorkerResponse> {
    return this.sendWithId(req, transfer).promise;
  }

  private sendWithId(req: Distribute<WorkerRequest>, transfer: Transferable[] = []) {
    const id = this.nextId++;
    const promise = new Promise<WorkerResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...req, id }, transfer);
    });
    return { id, promise };
  }

  /** Start loading the PDF engine now, so opening a file later is instant. */
  warmup() {
    const t0 = performance.now();
    this.ready = this.send({ type: 'warmup' })
      .then(() => console.debug(`[open] engine ready after ${Math.round(performance.now() - t0)} ms`))
      .catch(err => console.warn('PDF engine failed to load', err));
  }

  async open(bytes: ArrayBuffer) {
    const r = await this.send({ type: 'open', bytes }, [bytes]);
    if (r.type !== 'opened') throw new Error('Unexpected reply');
    return { pageCount: r.pageCount, pageSize: r.pageSize };
  }

  /**
   * Text of page 1, read from a separate copy of the file so the open document is untouched.
   * Waits for a started warm-up (up to WARMUP_WAIT_MS), then returns '' on any failure or after TEXT_TIMEOUT_MS
   * (a running worker call can't be interrupted, so a late reply is dropped).
   */
  async text(bytes: ArrayBuffer): Promise<string> {
    if (this.ready) {
      let wait: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([this.ready, new Promise<void>(r => { wait = setTimeout(r, WARMUP_WAIT_MS); })]);
      clearTimeout(wait);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { id, promise } = this.sendWithId({ type: 'text', bytes }, [bytes]);
    const timeout = new Promise<string>(resolve => {
      timer = setTimeout(() => { this.pending.delete(id); resolve(''); }, TEXT_TIMEOUT_MS);
    });
    try {
      return await Promise.race([
        promise.then(r => (r.type === 'text' ? r.text : '')),
        timeout,
      ]);
    } catch {
      return '';
    } finally {
      clearTimeout(timer);
    }
  }

  /** RGBA pixels of page 1: page point (x, y) lands at (a·x + c·y + e, b·x + d·y + f). */
  async render(width: number, height: number, matrix: Matrix): Promise<ImageData> {
    const r = await this.send({ type: 'render', width, height, matrix });
    if (r.type !== 'rendered') throw new Error('Unexpected reply');
    return new ImageData(r.pixels, r.width, r.height);
  }
}
