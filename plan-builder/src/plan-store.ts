// Storage seam for saved plans: FirebasePlanStore in production, MemoryPlanStore for dev/tests.
import type { PlanMeta, PlanState } from './plan-model';

export interface PlanStore {
  watchPlans(onPlans: (plans: PlanMeta[]) => void, onError: (e: Error) => void): () => void;
  create(address: string, pdf: File): Promise<string>;
  load(id: string): Promise<{ meta: PlanMeta; state: PlanState }>;
  /** Fire-and-forget; failures go to onError. */
  save(id: string, state: PlanState): void;
  rename(id: string, address: string): Promise<void>;
  /** Archived plans stay in the list (meta.archived) and keep their updatedAt. */
  setArchived(id: string, archived: boolean): Promise<void>;
  replacePdf(id: string, pdf: File): Promise<void>;
  remove(id: string): Promise<void>;
  getPdf(id: string): Promise<ArrayBuffer>;
  flushUploads(): Promise<void>;
  onError(cb: (e: Error) => void): void;
}

export const NOT_FOUND = 'Plan not found';

/** 'device-storage': offline, and the PDF couldn't be kept on the device, so the plan would have no PDF anywhere. */
export class PlanInputError extends Error {
  constructor(public reason: 'address' | 'not-pdf' | 'too-big' | 'device-storage', message?: string) { super(message ?? reason); this.name = 'PlanInputError'; }
}
export class PdfUnavailableError extends Error {
  constructor(message = 'PDF unavailable') { super(message); this.name = 'PdfUnavailableError'; }
}

export const MAX_PDF_BYTES = 25 * 1024 * 1024;

// A plot plan is a PDF, or (first slice of #20) a JPG/PNG rendered as a single flat image layer —
// no pages, no text to extract, no perspective correction. HEIC and photo/perspective correction
// are explicit follow-ups, not handled here. iPad Files sometimes gives an empty MIME type, so a
// recognized extension is accepted too.
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const IMAGE_EXT = /\.(jpe?g|png)$/i;
const PDF_EXT = /\.pdf$/i;

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || PDF_EXT.test(file.name);
}
export function isImageFile(file: File): boolean {
  return IMAGE_MIME_TYPES.has(file.type) || IMAGE_EXT.test(file.name);
}

/** PDF, JPG or PNG only; anything else (including HEIC) is rejected with a clear reason. */
export function checkPdf(file: File): void {
  if (!isPdfFile(file) && !isImageFile(file)) throw new PlanInputError('not-pdf');
  if (file.size > MAX_PDF_BYTES) throw new PlanInputError('too-big');
}

/**
 * The plot plan's real type, sniffed from its own bytes (not the File's possibly-empty/wrong
 * `type`): used once only `getPdf()`'s raw bytes are in hand, with no File object alongside them.
 */
export function sniffPlanFileType(bytes: ArrayBuffer): 'application/pdf' | 'image/jpeg' | 'image/png' {
  const head = new Uint8Array(bytes.slice(0, 8));
  if (head[0] === 0xff && head[1] === 0xd8) return 'image/jpeg';
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'image/png';
  return 'application/pdf';
}

/** Sent to onError when a saved doc nears Firestore's 1 MB limit; the save still goes ahead. */
export class SizeWarning extends Error {
  constructor(public bytes: number) { super(`Plan is ${Math.round(bytes / 1000)} KB; the limit is 1 MB`); this.name = 'SizeWarning'; }
}
/** Firestore `permission-denied` / Storage `storage/unauthorized`: re-run the invite check. */
export class AccessDeniedError extends Error {
  constructor(options?: ErrorOptions) { super('Access denied', options); this.name = 'AccessDeniedError'; }
}
