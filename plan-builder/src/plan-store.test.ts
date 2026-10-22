import { describe, expect, it } from 'vitest';
import { checkPdf, isImageFile, isPdfFile, MAX_PDF_BYTES, PlanInputError, sniffPlanFileType } from './plan-store';

const file = (name: string, type: string, bytes: number[] | number = 4) =>
  new File([new Uint8Array(Array.isArray(bytes) ? bytes : new Array<number>(bytes).fill(1))], name, { type });

const reason = (fn: () => void) => { try { fn(); return null; } catch (e) { return e instanceof PlanInputError ? e.reason : e; } };

describe('checkPdf', () => {
  it('accepts a PDF by MIME type or extension', () => {
    expect(reason(() => checkPdf(file('plan.pdf', 'application/pdf')))).toBeNull();
    expect(reason(() => checkPdf(file('Plan.PDF', '')))).toBeNull(); // iPad Files: empty MIME, right extension
  });

  it('accepts a JPG or PNG by MIME type or extension (#20)', () => {
    expect(reason(() => checkPdf(file('plan.jpg', 'image/jpeg')))).toBeNull();
    expect(reason(() => checkPdf(file('plan.jpeg', 'image/jpeg')))).toBeNull();
    expect(reason(() => checkPdf(file('plan.png', 'image/png')))).toBeNull();
    expect(reason(() => checkPdf(file('Plan.JPG', '')))).toBeNull();
    expect(reason(() => checkPdf(file('Plan.PNG', '')))).toBeNull();
  });

  it('rejects anything else (e.g. HEIC, GIF) with a clear reason', () => {
    expect(reason(() => checkPdf(file('photo.heic', 'image/heic')))).toBe('not-pdf');
    expect(reason(() => checkPdf(file('a.gif', 'image/gif')))).toBe('not-pdf');
    expect(reason(() => checkPdf(file('notes.txt', 'text/plain')))).toBe('not-pdf');
    expect(reason(() => checkPdf(file('no-extension', '')))).toBe('not-pdf');
  });

  it('rejects an oversize file of an otherwise-accepted type', () => {
    const big = file('plan.png', 'image/png');
    Object.defineProperty(big, 'size', { value: MAX_PDF_BYTES + 1 });
    expect(reason(() => checkPdf(big))).toBe('too-big');
  });
});

describe('isPdfFile / isImageFile', () => {
  it('agree with checkPdf on kind', () => {
    expect(isPdfFile(file('a.pdf', 'application/pdf'))).toBe(true);
    expect(isImageFile(file('a.pdf', 'application/pdf'))).toBe(false);
    expect(isPdfFile(file('a.jpg', 'image/jpeg'))).toBe(false);
    expect(isImageFile(file('a.jpg', 'image/jpeg'))).toBe(true);
    expect(isPdfFile(file('a.gif', 'image/gif'))).toBe(false);
    expect(isImageFile(file('a.gif', 'image/gif'))).toBe(false);
  });
});

describe('sniffPlanFileType', () => {
  const bytesOf = (...head: number[]) => new Uint8Array([...head, ...new Array(4).fill(0)]).buffer;

  it('recognizes a JPEG header', () => {
    expect(sniffPlanFileType(bytesOf(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
  });

  it('recognizes a PNG header', () => {
    expect(sniffPlanFileType(bytesOf(0x89, 0x50, 0x4e, 0x47))).toBe('image/png');
  });

  it('falls back to PDF for anything else (e.g. an actual %PDF header)', () => {
    expect(sniffPlanFileType(bytesOf(0x25, 0x50, 0x44, 0x46))).toBe('application/pdf');
  });
});
