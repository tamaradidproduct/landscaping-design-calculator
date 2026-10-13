// Promise wrapper around the PDF worker.
import type { WorkerRequest, WorkerResponse } from './pdf-protocol';

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
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...req, id }, transfer);
    });
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

  /** RGBA pixels of page 1: page point p lands at (p * scale + tx, p * scale + ty). */
  async render(width: number, height: number, scale: number, tx: number, ty: number): Promise<ImageData> {
    const r = await this.send({ type: 'render', width, height, scale, tx, ty });
    if (r.type !== 'rendered') throw new Error('Unexpected reply');
    return new ImageData(r.pixels, r.width, r.height);
  }
}
