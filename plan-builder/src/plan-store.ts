// Storage seam for saved plans: FirebasePlanStore in production, MemoryPlanStore for dev/tests.
import type { PlanMeta, PlanState } from './plan-model';

export interface PlanStore {
  watchPlans(onPlans: (plans: PlanMeta[]) => void, onError: (e: Error) => void): () => void;
  create(address: string, pdf: File): Promise<string>;
  load(id: string): Promise<{ meta: PlanMeta; state: PlanState }>;
  /** Fire-and-forget; failures go to onError. */
  save(id: string, state: PlanState): void;
  rename(id: string, address: string): Promise<void>;
  replacePdf(id: string, pdf: File): Promise<void>;
  remove(id: string): Promise<void>;
  getPdf(id: string): Promise<ArrayBuffer>;
  flushUploads(): Promise<void>;
  onError(cb: (e: Error) => void): void;
}

export class PlanInputError extends Error {
  constructor(public reason: 'address' | 'not-pdf' | 'too-big', message?: string) { super(message ?? reason); this.name = 'PlanInputError'; }
}
export class PdfUnavailableError extends Error {
  constructor(message = 'PDF unavailable') { super(message); this.name = 'PdfUnavailableError'; }
}

export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export function checkPdf(file: File): void {
  // iPad Files sometimes gives an empty MIME type
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) throw new PlanInputError('not-pdf');
  if (file.size > MAX_PDF_BYTES) throw new PlanInputError('too-big');
}
/** Sent to onError when a saved doc nears Firestore's 1 MB limit; the save still goes ahead. */
export class SizeWarning extends Error {
  constructor(public bytes: number) { super(`Plan is ${Math.round(bytes / 1000)} KB; the limit is 1 MB`); this.name = 'SizeWarning'; }
}
/** Firestore `permission-denied` / Storage `storage/unauthorized`: re-run the invite check. */
export class AccessDeniedError extends Error {
  constructor(options?: ErrorOptions) { super('Access denied', options); this.name = 'AccessDeniedError'; }
}
