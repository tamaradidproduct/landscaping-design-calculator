// Firestore + Cloud Storage PlanStore. Firestore writes resolve only on server ack, so they are
// never awaited in user-facing paths: the persistent cache applies them locally and queues them.
import {
  collection, deleteDoc, doc, getDoc, getDocFromCache, getDocs, onSnapshot, query, setDoc, updateDoc, where,
  type Firestore,
} from 'firebase/firestore';
import { deleteObject, getBytes, ref as storageRef, uploadBytesResumable, type FirebaseStorage, type UploadTask } from 'firebase/storage';
import { getFirebase } from './firebase';
import { cleanAddress, docBytes, downloadTimeoutMs, fromDoc, sortPlans, toDoc, SIZE_WARN_BYTES, type PlanDoc, type PlanMeta, type PlanState } from './plan-model';
import { AccessDeniedError, NOT_FOUND, PdfUnavailableError, PlanInputError, SizeWarning, checkPdf, type PlanStore } from './plan-store';
import { pdfCache } from './pdf-cache';

const CONTENT_TYPE = 'application/pdf'; // iPad files can have an empty type; rules require this

const code = (e: unknown) => (e as { code?: unknown } | null)?.code;
const isDenied = (e: unknown) => code(e) === 'permission-denied' || code(e) === 'storage/unauthorized';
const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

const toMeta = (id: string, d: PlanDoc, hasPendingWrites: boolean): PlanMeta =>
  ({ id, address: d.address, createdAt: d.createdAt, updatedAt: d.updatedAt, pdf: { ...d.pdf }, pending: hasPendingWrites || !d.pdf.uploaded, archived: d.archived === true });

export class FirebasePlanStore implements PlanStore {
  private db: Firestore;
  private storage: FirebaseStorage;
  /** Latest known doc per id: from the snapshot listener, getDoc, and our own local writes. */
  private known = new Map<string, PlanDoc>();
  /** Per-id upload queue: one upload at a time, so an older PDF can't land after a newer one. */
  private uploadQueue = new Map<string, Promise<void>>();
  private inFlight = new Map<string, { rev: number; task: UploadTask }>();
  /** This device's not-yet-uploaded PDF per id, so an upload or open never depends on the cache write. */
  private pendingPdf = new Map<string, { rev: number; bytes: ArrayBuffer }>();
  /** Ids currently over SIZE_WARN_BYTES, so the warning fires once per crossing. */
  private oversize = new Set<string>();
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

  private static toError = (e: unknown): Error => (isDenied(e) ? new AccessDeniedError({ cause: e }) : asError(e));
  /** Wraps permission errors in AccessDeniedError and sends them to onError; returns the error to throw. */
  private wrap(e: unknown): Error {
    const err = FirebasePlanStore.toError(e);
    if (err instanceof AccessDeniedError) this.emit(err);
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
          list.push({ id: s.id, address, createdAt: num(raw.createdAt), updatedAt: num(raw.updatedAt), pdf: { name: '', size: 0, rev: 0, uploaded: true }, pending: s.metadata.hasPendingWrites, archived: raw.archived === true });
        }
      });
      onPlans(sortPlans(list));
    }, e => onError(FirebasePlanStore.toError(e)));
  }

  async create(address: string, pdf: File): Promise<string> {
    const clean = cleanAddress(address);
    if (!clean) throw new PlanInputError('address');
    checkPdf(pdf);
    const bytes = await pdf.arrayBuffer();
    const ref = doc(this.plans());
    await this.keepPdf(ref.id, 1, bytes);
    const now = Date.now();
    const d = toDoc({ outlines: {}, refs: [] }, { address: clean, createdAt: now, updatedAt: now, pdf: { name: pdf.name, size: bytes.byteLength, rev: 1, uploaded: false } });
    setDoc(ref, d).catch(this.report);
    this.known.set(ref.id, d);
    void this.upload(ref.id).catch(this.report);
    return ref.id;
  }

  /** Holds the PDF for upload; offline with no device copy it would be nowhere, so that refuses before any doc write. */
  private async keepPdf(id: string, rev: number, bytes: ArrayBuffer): Promise<void> {
    if (!(await pdfCache.put(id, rev, bytes)) && !navigator.onLine) throw new PlanInputError('device-storage');
    this.pendingPdf.set(id, { rev, bytes });
  }

  async load(id: string): Promise<{ meta: PlanMeta; state: PlanState }> {
    // Cache first (the plans listener keeps it current); getDoc asks the server, then falls back to the cache
    const cached = await getDocFromCache(this.docRef(id)).catch(() => null);
    const snap = cached?.exists() ? cached : await getDoc(this.docRef(id)).catch(e => { throw this.wrap(e); });
    if (!snap.exists()) throw new Error(NOT_FOUND);
    const d = fromDoc(snap.data());
    this.known.set(id, d);
    return { meta: toMeta(id, d, snap.metadata.hasPendingWrites), state: structuredClone({ outlines: d.outlines, refs: d.refs }) };
  }

  save(id: string, state: PlanState): void {
    const prev = this.known.get(id);
    if (!prev) { this.emit(new Error(NOT_FOUND)); return; }
    const next = toDoc(state, { address: prev.address, createdAt: prev.createdAt, updatedAt: Date.now(), pdf: prev.pdf, archived: prev.archived });
    // Never write what load couldn't read back (e.g. a NaN point becomes null): that would lock the plan
    try { fromDoc(next); } catch (e) { this.emit(asError(e)); return; }
    const bytes = docBytes(next);
    if (bytes <= SIZE_WARN_BYTES) this.oversize.delete(id);
    else if (!this.oversize.has(id)) { this.oversize.add(id); this.emit(new SizeWarning(bytes)); }
    // Only the editor's fields: a full set could clobber a newer pdf/address from another device.
    // updateDoc replaces each named field whole (no deep merge), so removed outlines go away.
    updateDoc(this.docRef(id), { v: 1, outlines: next.outlines, refs: next.refs, updatedAt: next.updatedAt }).catch(this.report);
    this.known.set(id, next);
  }

  async rename(id: string, address: string): Promise<void> {
    // No fromDoc check: an unreadable plan can still be renamed (rules only need v and address)
    const clean = cleanAddress(address);
    if (!clean) throw new PlanInputError('address');
    const updatedAt = Date.now();
    updateDoc(this.docRef(id), { address: clean, updatedAt }).catch(this.report);
    const prev = this.known.get(id);
    if (prev) this.known.set(id, { ...prev, address: clean, updatedAt });
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    // By id, without fromDoc, like rename; updatedAt stays so "Edited …" still means an edit
    updateDoc(this.docRef(id), { archived }).catch(this.report);
    const prev = this.known.get(id);
    if (prev) this.known.set(id, { ...prev, archived });
  }

  async replacePdf(id: string, pdf: File): Promise<void> {
    const prev = await this.current(id);
    checkPdf(pdf);
    const bytes = await pdf.arrayBuffer();
    const rev = prev.pdf.rev + 1;
    await this.keepPdf(id, rev, bytes);
    const info = { name: pdf.name, size: bytes.byteLength, rev, uploaded: false };
    const updatedAt = Date.now();
    updateDoc(this.docRef(id), { pdf: info, updatedAt }).catch(this.report);
    this.known.set(id, { ...prev, pdf: info, updatedAt });
    void this.upload(id).catch(this.report);
  }

  async remove(id: string): Promise<void> {
    // By id, without fromDoc, so unreadable plans can be deleted
    deleteDoc(this.docRef(id)).catch(this.report);
    // Storage has no offline queue; an offline delete leaves the PDF behind (reported via onError)
    deleteObject(this.pdfRef(id)).catch(e => { if (code(e) !== 'storage/object-not-found') this.report(e); });
    this.known.delete(id);
    this.oversize.delete(id);
    this.pendingPdf.delete(id);
    this.inFlight.get(id)?.task.cancel();
    await pdfCache.delete(id);
  }

  async getPdf(id: string): Promise<ArrayBuffer> {
    const d = await this.current(id).catch(e => {
      if (e instanceof AccessDeniedError) throw e;
      throw new PdfUnavailableError();
    });
    const mine = this.pendingPdf.get(id);
    if (mine && mine.rev >= d.pdf.rev) return mine.bytes.slice(0);
    const cached = await pdfCache.get(id);
    if (cached && cached.rev >= d.pdf.rev) return cached.bytes;
    // Storage still holds an older rev (another device hasn't uploaded yet), or we're offline
    if (!d.pdf.uploaded || !navigator.onLine) throw new PdfUnavailableError();
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      // Storage otherwise retries for up to 2 min
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new PdfUnavailableError()), downloadTimeoutMs(d.pdf.size)); });
      const bytes = await Promise.race([getBytes(this.pdfRef(id)), timeout]).finally(() => clearTimeout(timer));
      await pdfCache.put(id, d.pdf.rev, bytes);
      return bytes;
    } catch (e) {
      const err = this.wrap(e);
      throw err instanceof AccessDeniedError ? err : new PdfUnavailableError();
    }
  }

  async flushUploads(): Promise<void> {
    if (!navigator.onLine) return;
    let docs;
    try { docs = (await getDocs(query(this.plans(), where('pdf.uploaded', '==', false)))).docs; } catch (e) { this.report(e); return; }
    for (const s of docs) {
      let d: PlanDoc;
      try { d = fromDoc(s.data()); } catch { continue; }
      const k = this.known.get(s.id);
      if (!k || k.pdf.rev < d.pdf.rev) this.known.set(s.id, d);
      // One plan's failure doesn't stop the rest
      try { await this.upload(s.id); } catch (e) { this.report(e); }
    }
  }

  onError(cb: (e: Error) => void): void { this.errorCbs.push(cb); }

  /** Queues an upload of the plan's latest rev; a newer rev cancels the older one in flight. */
  private upload(id: string): Promise<void> {
    const rev = this.known.get(id)?.pdf.rev;
    const running = this.inFlight.get(id);
    if (running && rev !== undefined && running.rev < rev) running.task.cancel();
    const run = (this.uploadQueue.get(id) ?? Promise.resolve()).then(() => this.uploadLatest(id));
    const tail = run.catch(() => {});
    this.uploadQueue.set(id, tail);
    void tail.then(() => { if (this.uploadQueue.get(id) === tail) this.uploadQueue.delete(id); });
    return run;
  }

  private async uploadLatest(id: string): Promise<void> {
    const cur = this.known.get(id);
    if (!cur || cur.pdf.uploaded) return;
    const mine = this.pendingPdf.get(id);
    if (mine && mine.rev < cur.pdf.rev) this.pendingPdf.delete(id); // another device replaced it
    const local = mine?.rev === cur.pdf.rev ? mine : await pdfCache.get(id);
    if (local?.rev !== cur.pdf.rev) return; // not this device's PDF, or an older one
    const rev = local.rev;
    const task = uploadBytesResumable(this.pdfRef(id), local.bytes, { contentType: CONTENT_TYPE, customMetadata: { rev: String(rev) } });
    this.inFlight.set(id, { rev, task });
    try {
      await task;
    } catch (e) {
      if (code(e) === 'storage/canceled') return; // superseded; the newer rev's upload is queued
      throw e;
    } finally {
      if (this.inFlight.get(id)?.task === task) this.inFlight.delete(id);
    }
    if (this.pendingPdf.get(id)?.rev === rev) this.pendingPdf.delete(id);
    // Flip the flag only if no replace happened while this rev was uploading
    const now = this.known.get(id);
    if (!now || now.pdf.rev !== rev || now.pdf.uploaded) return;
    updateDoc(this.docRef(id), { 'pdf.uploaded': true }).catch(this.report);
    this.known.set(id, { ...now, pdf: { ...now.pdf, uploaded: true } });
  }
}
