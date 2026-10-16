// Firestore + Cloud Storage PlanStore. Firestore writes resolve only on server ack, so they are
// never awaited in user-facing paths: the persistent cache applies them locally and queues them.
import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { deleteObject, getBytes, ref as storageRef, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { getFirebase } from './firebase';
import { cleanAddress, docBytes, fromDoc, sortPlans, toDoc, SIZE_WARN_BYTES, type PlanDoc, type PlanMeta, type PlanState } from './plan-model';
import { AccessDeniedError, PdfUnavailableError, PlanInputError, SizeWarning, checkPdf, type PlanStore } from './plan-store';
import { pdfCache } from './pdf-cache';

const NOT_FOUND = 'Plan not found';
const PDF_META = { contentType: 'application/pdf' }; // iPad files can have an empty type; rules require this

const code = (e: unknown) => (e as { code?: unknown } | null)?.code;
const isDenied = (e: unknown) => code(e) === 'permission-denied' || code(e) === 'storage/unauthorized';
const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

const toMeta = (id: string, d: PlanDoc, hasPendingWrites: boolean): PlanMeta =>
  ({ id, address: d.address, createdAt: d.createdAt, updatedAt: d.updatedAt, pdf: { ...d.pdf }, pending: hasPendingWrites || !d.pdf.uploaded });

export class FirebasePlanStore implements PlanStore {
  private db: Firestore;
  private storage: FirebaseStorage;
  /** Latest known doc per id: from the snapshot listener, getDoc, and our own local writes. */
  private known = new Map<string, PlanDoc>();
  /** Rev of the upload in flight per id, so flushes don't start a duplicate. */
  private uploading = new Map<string, number>();
  private errorCbs: Array<(e: Error) => void> = [];
  private onOnline = () => { void this.flushUploads(); };

  constructor(private uid: string) {
    ({ db: this.db, storage: this.storage } = getFirebase());
    window.addEventListener('online', this.onOnline);
    setTimeout(this.onOnline, 0); // after the caller has registered onError
  }

  dispose(): void { window.removeEventListener('online', this.onOnline); }

  private plans = () => collection(this.db, 'users', this.uid, 'plans');
  private docRef = (id: string) => doc(this.plans(), id);
  private pdfRef = (id: string) => storageRef(this.storage, `users/${this.uid}/plans/${id}/plan.pdf`);

  /** Wraps permission errors in AccessDeniedError and sends them to onError; returns the error to throw. */
  private wrap(e: unknown): Error {
    if (!isDenied(e)) return asError(e);
    const err = new AccessDeniedError({ cause: e });
    this.emit(err);
    return err;
  }
  private emit(e: Error) { this.errorCbs.forEach(cb => cb(e)); }
  /** Background failure: no caller to reject, so everything goes to onError. */
  private report = (e: unknown) => { const err = this.wrap(e); if (!(err instanceof AccessDeniedError)) this.emit(err); };

  private async current(id: string): Promise<PlanDoc> {
    const hit = this.known.get(id);
    if (hit) return hit;
    const snap = await getDoc(this.docRef(id)).catch(e => { throw this.wrap(e); });
    if (!snap.exists()) throw new Error(NOT_FOUND);
    const d = fromDoc(snap.data());
    this.known.set(id, d);
    return d;
  }

  watchPlans(onPlans: (plans: PlanMeta[]) => void, onError: (e: Error) => void): () => void {
    return onSnapshot(this.plans(), { includeMetadataChanges: true }, qs => {
      // Not clear(): an early from-cache snapshot may lack a doc that load just fetched
      qs.docChanges().forEach(c => { if (c.type === 'removed') this.known.delete(c.doc.id); });
      const list: PlanMeta[] = [];
      qs.docs.forEach(s => {
        const data = s.data();
        try {
          const d = fromDoc(data);
          this.known.set(s.id, d);
          list.push(toMeta(s.id, d, s.metadata.hasPendingWrites));
        } catch (e) {
          const address = (data as { address?: unknown } | undefined)?.address;
          if (typeof address !== 'string' || !address) { console.warn('Skipping unreadable plan', s.id, e); return; }
          // Listed so it can be opened (load shows the format error) or deleted
          const num = (v: unknown) => (typeof v === 'number' ? v : 0);
          const raw = data as Record<string, unknown>;
          list.push({ id: s.id, address, createdAt: num(raw.createdAt), updatedAt: num(raw.updatedAt), pdf: { name: '', size: 0, rev: 0, uploaded: true }, pending: s.metadata.hasPendingWrites });
        }
      });
      onPlans(sortPlans(list));
    }, e => onError(this.wrap(e)));
  }

  async create(address: string, pdf: File): Promise<string> {
    const clean = cleanAddress(address);
    if (!clean) throw new PlanInputError('address');
    checkPdf(pdf);
    const bytes = await pdf.arrayBuffer();
    const ref = doc(this.plans());
    const now = Date.now();
    const d = toDoc({ outlines: {}, refs: [] }, { address: clean, createdAt: now, updatedAt: now, pdf: { name: pdf.name, size: bytes.byteLength, rev: 1, uploaded: false } });
    setDoc(ref, d).catch(this.report);
    this.known.set(ref.id, d);
    await pdfCache.put(ref.id, 1, bytes);
    void this.upload(ref.id, 1, bytes).catch(this.report);
    return ref.id;
  }

  async load(id: string): Promise<{ meta: PlanMeta; state: PlanState }> {
    // getDoc falls back to the persistent cache when the server can't be reached
    const snap = await getDoc(this.docRef(id)).catch(e => { throw this.wrap(e); });
    if (!snap.exists()) throw new Error(NOT_FOUND);
    const d = fromDoc(snap.data());
    this.known.set(id, d);
    return { meta: toMeta(id, d, snap.metadata.hasPendingWrites), state: structuredClone({ outlines: d.outlines, refs: d.refs }) };
  }

  save(id: string, state: PlanState): void {
    const prev = this.known.get(id);
    if (!prev) { this.emit(new Error(NOT_FOUND)); return; }
    const next = toDoc(state, { address: prev.address, createdAt: prev.createdAt, updatedAt: Date.now(), pdf: prev.pdf });
    const bytes = docBytes(next);
    if (bytes > SIZE_WARN_BYTES) this.emit(new SizeWarning(bytes));
    // Only the editor's fields: a full set could clobber a newer pdf/address from another device.
    // updateDoc replaces each named field whole (no deep merge), so removed outlines go away.
    updateDoc(this.docRef(id), { v: 1, outlines: next.outlines, refs: next.refs, updatedAt: next.updatedAt }).catch(this.report);
    this.known.set(id, next);
  }

  async rename(id: string, address: string): Promise<void> {
    const prev = await this.current(id);
    const clean = cleanAddress(address);
    if (!clean) throw new PlanInputError('address');
    const updatedAt = Date.now();
    updateDoc(this.docRef(id), { address: clean, updatedAt }).catch(this.report);
    this.known.set(id, { ...prev, address: clean, updatedAt });
  }

  async replacePdf(id: string, pdf: File): Promise<void> {
    const prev = await this.current(id);
    checkPdf(pdf);
    const bytes = await pdf.arrayBuffer();
    const rev = prev.pdf.rev + 1;
    const info = { name: pdf.name, size: bytes.byteLength, rev, uploaded: false };
    const updatedAt = Date.now();
    updateDoc(this.docRef(id), { pdf: info, updatedAt }).catch(this.report);
    this.known.set(id, { ...prev, pdf: info, updatedAt });
    await pdfCache.put(id, rev, bytes);
    void this.upload(id, rev, bytes).catch(this.report);
  }

  async remove(id: string): Promise<void> {
    await this.current(id);
    deleteDoc(this.docRef(id)).catch(this.report);
    // Storage has no offline queue; an offline delete leaves the PDF behind (reported via onError)
    deleteObject(this.pdfRef(id)).catch(e => { if (code(e) !== 'storage/object-not-found') this.report(e); });
    this.known.delete(id);
    await pdfCache.delete(id);
  }

  async getPdf(id: string): Promise<ArrayBuffer> {
    const d = await this.current(id).catch(e => {
      if (e instanceof AccessDeniedError) throw e;
      throw new PdfUnavailableError();
    });
    const cached = await pdfCache.get(id);
    if (cached && cached.rev >= d.pdf.rev) return cached.bytes;
    try {
      const bytes = await getBytes(this.pdfRef(id));
      await pdfCache.put(id, d.pdf.rev, bytes);
      return bytes;
    } catch (e) {
      const err = this.wrap(e);
      throw err instanceof AccessDeniedError ? err : new PdfUnavailableError();
    }
  }

  async flushUploads(): Promise<void> {
    if (!navigator.onLine) return;
    try {
      const qs = await getDocs(this.plans());
      for (const s of qs.docs) {
        let d: PlanDoc;
        try { d = fromDoc(s.data()); } catch { continue; }
        if (d.pdf.uploaded) continue;
        const cached = await pdfCache.get(s.id);
        if (cached?.rev !== d.pdf.rev) continue; // not this device's PDF, or an older one
        const k = this.known.get(s.id);
        if (!k || k.pdf.rev < d.pdf.rev) this.known.set(s.id, d);
        await this.upload(s.id, d.pdf.rev, cached.bytes);
      }
    } catch (e) { this.report(e); }
  }

  onError(cb: (e: Error) => void): void { this.errorCbs.push(cb); }

  private async upload(id: string, rev: number, bytes: ArrayBuffer): Promise<void> {
    if (this.uploading.get(id) === rev) return;
    this.uploading.set(id, rev);
    try {
      await uploadBytes(this.pdfRef(id), bytes, PDF_META);
    } finally {
      if (this.uploading.get(id) === rev) this.uploading.delete(id);
    }
    // A replace since this upload started owns the flag now
    const cur = this.known.get(id);
    if (!cur || cur.pdf.rev !== rev) return;
    updateDoc(this.docRef(id), { 'pdf.uploaded': true }).catch(this.report);
    this.known.set(id, { ...cur, pdf: { ...cur.pdf, uploaded: true } });
  }
}
