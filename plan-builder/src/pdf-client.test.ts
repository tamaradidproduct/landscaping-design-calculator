import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PdfClient, TEXT_TIMEOUT_MS } from './pdf-client';

class FakeWorker {
  static last: FakeWorker;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  posted: { id: number; type: string }[] = [];
  constructor() { FakeWorker.last = this; }
  postMessage(msg: { id: number; type: string }) { this.posted.push(msg); }
  reply(data: unknown) { this.onmessage?.({ data }); }
  idOf(type: string) { return this.posted.find(m => m.type === type)!.id; }
}

describe('PdfClient.text timing', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('Worker', FakeWorker); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  const textReply = (w: FakeWorker, text: string) => w.reply({ type: 'text', id: w.idOf('text'), text });

  it('starts the extraction budget only after the warm-up finishes', async () => {
    const c = new PdfClient(), w = FakeWorker.last;
    c.warmup();
    const p = c.text(new ArrayBuffer(8));
    await vi.advanceTimersByTimeAsync(10_000); // engine start-up takes longer than the budget
    expect(w.posted.some(m => m.type === 'text')).toBe(false);
    w.reply({ type: 'ready', id: w.idOf('warmup') });
    await vi.advanceTimersByTimeAsync(TEXT_TIMEOUT_MS - 100);
    textReply(w, 'hello');
    expect(await p).toBe('hello');
  });

  it("returns '' when the reply comes later than the budget after warm-up, and ignores it", async () => {
    const c = new PdfClient(), w = FakeWorker.last;
    c.warmup();
    const p = c.text(new ArrayBuffer(8));
    w.reply({ type: 'ready', id: w.idOf('warmup') });
    await vi.advanceTimersByTimeAsync(TEXT_TIMEOUT_MS + 100);
    expect(await p).toBe('');
    expect(() => textReply(w, 'late')).not.toThrow();
  });

  it('skips the wait when warmup() was never called', async () => {
    const c = new PdfClient(), w = FakeWorker.last;
    const p = c.text(new ArrayBuffer(8));
    await vi.advanceTimersByTimeAsync(0);
    textReply(w, 'now');
    expect(await p).toBe('now');
  });
});
