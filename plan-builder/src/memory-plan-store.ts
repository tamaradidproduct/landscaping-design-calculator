// In-memory PlanStore for dev builds (?store=memory) and the contract suite.
import { cleanAddress, fromDoc, sortPlans, toDoc, type PlanMeta, type PlanState } from './plan-model';
import { NOT_FOUND, PdfUnavailableError, PlanInputError, checkPdf, type PlanStore } from './plan-store';

interface Entry { meta: PlanMeta; state: PlanState; bytes: ArrayBuffer }

const copy = <T>(v: T): T => structuredClone(v);

export class MemoryPlanStore implements PlanStore {
  private plans = new Map<string, Entry>();
  private watchers = new Set<(plans: PlanMeta[]) => void>();
  private errorCbs: Array<(e: Error) => void> = [];

  private get(id: string): Entry {
    const e = this.plans.get(id);
    if (!e) throw new Error(NOT_FOUND);
    return e;
  }
  private list = () => sortPlans([...this.plans.values()].map(e => copy(e.meta)));
  private emit(e: Error) { this.errorCbs.forEach(cb => cb(e)); }
  private notify() { this.watchers.forEach(w => w(this.list())); }

  watchPlans(onPlans: (plans: PlanMeta[]) => void): () => void {
    this.watchers.add(onPlans);
    onPlans(this.list());
    return () => { this.watchers.delete(onPlans); };
  }

  async create(address: string, pdf: File): Promise<string> {
    const clean = cleanAddress(address);
    if (!clean) throw new PlanInputError('address');
    checkPdf(pdf);
    const bytes = await pdf.arrayBuffer();
    const id = crypto.randomUUID();
    const now = Date.now();
    this.plans.set(id, {
      meta: { id, address: clean, createdAt: now, updatedAt: now, pdf: { name: pdf.name, size: bytes.byteLength, rev: 1, uploaded: true }, pending: false },
      state: { outlines: {}, refs: [] },
      bytes,
    });
    this.notify();
    return id;
  }

  async load(id: string) {
    const e = this.get(id);
    return { meta: copy(e.meta), state: copy(e.state) };
  }

  save(id: string, state: PlanState): void {
    const e = this.plans.get(id);
    if (!e) { this.emit(new Error(NOT_FOUND)); return; }
    // Same check as load: never store a state (e.g. a NaN point) that couldn't be read back
    try { fromDoc(toDoc(state, { address: e.meta.address, createdAt: e.meta.createdAt, updatedAt: Date.now(), pdf: e.meta.pdf })); } catch (err) { this.emit(err as Error); return; }
    e.state = copy(state);
    e.meta.updatedAt = Date.now();
    this.notify();
  }

  async rename(id: string, address: string): Promise<void> {
    const e = this.get(id);
    const clean = cleanAddress(address);
    if (!clean) throw new PlanInputError('address');
    e.meta.address = clean;
    e.meta.updatedAt = Date.now();
    this.notify();
  }

  async replacePdf(id: string, pdf: File): Promise<void> {
    const e = this.get(id);
    checkPdf(pdf);
    const bytes = await pdf.arrayBuffer();
    e.bytes = bytes;
    e.meta.pdf = { name: pdf.name, size: bytes.byteLength, rev: e.meta.pdf.rev + 1, uploaded: true };
    e.meta.updatedAt = Date.now();
    this.notify();
  }

  async remove(id: string): Promise<void> {
    this.get(id);
    this.plans.delete(id);
    this.notify();
  }

  async getPdf(id: string): Promise<ArrayBuffer> {
    const e = this.plans.get(id);
    if (!e) throw new PdfUnavailableError();
    return e.bytes.slice(0);
  }

  async flushUploads(): Promise<void> {}

  onError(cb: (e: Error) => void): void { this.errorCbs.push(cb); }
}
