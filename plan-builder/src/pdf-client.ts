// Promise wrapper around the PDF worker.
import type { Matrix, WorkerRequest, WorkerResponse } from './pdf-protocol';

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: Error) => void };
type Distribute<T> = T extends unknown ? Omit<T, 'id'> : never;

export class PdfClient {
  private worker = new Worker(new URL('./pdf-worker.ts', import.meta.url), { type: 'module' });
  private nextId = 1;
  private pending = new Map<number, Pending>();

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
    void this.send({ type: 'warmup' })
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
   * Returns '' on any failure or after 3 s (a running worker call can't be interrupted, so a late reply is dropped).
   */
  async text(bytes: ArrayBuffer): Promise<string> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { id, promise } = this.sendWithId({ type: 'text', bytes }, [bytes]);
    const timeout = new Promise<string>(resolve => {
      timer = setTimeout(() => { this.pending.delete(id); resolve(''); }, 3000);
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
