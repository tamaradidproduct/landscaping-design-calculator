// Contract suite every PlanStore must pass. Uses only the PlanStore interface and File objects.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { PdfUnavailableError, PlanInputError, MAX_PDF_BYTES, type PlanStore } from './plan-store';
import type { PlanMeta, PlanState } from './plan-model';

const pdfFile = (bytes: number[] | number = 4, name = 'plan.pdf', type = 'application/pdf') =>
  new File([new Uint8Array(Array.isArray(bytes) ? bytes : new Array<number>(bytes).fill(7))], name, { type });
const state = (): PlanState => ({
  outlines: { a: { id: 'a', kind: 'boundary', name: 'Lot', closed: true, pts: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] } },
  refs: [{ id: 'r', i: 0, feet: 10 }],
});
const tick = (ms = 1000) => vi.setSystemTime(Date.now() + ms);

/** Resolves with the first emission satisfying pred; always unsubscribes. */
function waitForPlans(store: PlanStore, pred: (plans: PlanMeta[]) => boolean, timeoutMs = 2000): Promise<PlanMeta[]> {
  return new Promise((resolve, reject) => {
    let off: (() => void) | null = null;
    let finished = false;
    const finish = (fn: () => void) => { if (finished) return; finished = true; clearTimeout(timer); if (off) off(); fn(); };
    const timer = setTimeout(() => finish(() => reject(new Error('waitForPlans timed out'))), timeoutMs);
    off = store.watchPlans(p => { if (pred(p)) finish(() => resolve(p)); }, e => finish(() => reject(e)));
    if (finished) off();
  });
}
const inputReason = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e instanceof PlanInputError ? e.reason : e; } return null; };

export function runPlanStoreContract(make: () => PlanStore) {
  describe('PlanStore contract', () => {
    afterEach(() => { vi.useRealTimers(); });
    // Fake Date: stores stamp updatedAt with client Date.now() (spec 3.1), not server timestamps.
    const fresh = () => { vi.useFakeTimers({ toFake: ['Date'] }); return make(); };

    it('create then list', async () => {
      const s = fresh();
      const id = await s.create('12 Elm St', pdfFile());
      const plans = await waitForPlans(s, p => p.some(m => m.id === id));
      expect(plans).toHaveLength(1);
      expect(plans[0]).toMatchObject({ id, address: '12 Elm St', pdf: { rev: 1, name: 'plan.pdf', size: 4 } });
    });

    it('create rejects blank address, an unsupported file type and oversize', async () => {
      const s = fresh();
      expect(await inputReason(s.create('   ', pdfFile()))).toBe('address');
      expect(await inputReason(s.create('x', pdfFile(4, 'a.gif', 'image/gif')))).toBe('not-pdf');
      const big = pdfFile(4);
      Object.defineProperty(big, 'size', { value: MAX_PDF_BYTES + 1 });
      expect(await inputReason(s.create('x', big))).toBe('too-big');
      expect(await waitForPlans(s, p => p.length === 0)).toHaveLength(0);
    });

    it('accepts a .pdf name with an empty type', async () => {
      const s = fresh();
      const id = await s.create('x', pdfFile(4, 'Plan.PDF', ''));
      expect(await waitForPlans(s, p => p.some(m => m.id === id))).toHaveLength(1);
    });

    it('accepts a JPG or PNG plot plan (#20)', async () => {
      const s = fresh();
      const jpg = await s.create('x', pdfFile(4, 'plan.jpg', 'image/jpeg'));
      const png = await s.create('y', pdfFile(4, 'plan.png', 'image/png'));
      expect((await waitForPlans(s, p => p.length === 2)).map(m => m.id).sort()).toEqual([jpg, png].sort());
    });

    it('save then load returns the state', async () => {
      const s = fresh();
      const id = await s.create('x', pdfFile());
      s.save(id, state());
      await s.flushUploads();
      const { meta, state: loaded } = await s.load(id);
      expect(loaded).toEqual(state());
      expect(meta.id).toBe(id);
    });

    it('save of an unreadable state (NaN point) keeps the last good one and reports it', async () => {
      const s = fresh();
      const errors: Error[] = [];
      s.onError(e => errors.push(e));
      const id = await s.create('x', pdfFile());
      s.save(id, state());
      const bad = state();
      bad.outlines.a.pts[1] = { x: NaN, y: 0 };
      s.save(id, bad);
      await s.flushUploads();
      expect((await s.load(id)).state).toEqual(state());
      expect(errors).toHaveLength(1);
    });

    it('save bumps updatedAt', async () => {
      const s = fresh();
      const id = await s.create('x', pdfFile());
      const before = (await waitForPlans(s, p => p.some(m => m.id === id)))[0];
      tick();
      s.save(id, state());
      const after = (await waitForPlans(s, p => p.some(m => m.id === id && m.updatedAt > before.updatedAt)))[0];
      expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
    });

    it('load returns a copy', async () => {
      const s = fresh();
      const id = await s.create('x', pdfFile());
      s.save(id, state());
      (await s.load(id)).state.refs.push({ id: 'z', i: 1, feet: 1 });
      expect((await s.load(id)).state.refs).toHaveLength(1);
    });

    it('rename updates address and updatedAt', async () => {
      const s = fresh();
      const id = await s.create('old', pdfFile());
      const before = (await waitForPlans(s, p => p.some(m => m.id === id)))[0];
      tick();
      await s.rename(id, '  34   Oak Ave ');
      const after = (await waitForPlans(s, p => p.some(m => m.address === '34 Oak Ave')))[0];
      expect(after.address).toBe('34 Oak Ave');
      expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
      expect(await inputReason(s.rename(id, ' '))).toBe('address');
    });

    it('setArchived flags the plan, keeps it listed and leaves updatedAt alone', async () => {
      const s = fresh();
      const id = await s.create('x', pdfFile());
      const before = (await waitForPlans(s, p => p.some(m => m.id === id)))[0];
      expect(before.archived).toBe(false);
      tick();
      await s.setArchived(id, true);
      const after = (await waitForPlans(s, p => p[0]?.archived === true))[0];
      expect(after.updatedAt).toBe(before.updatedAt);
      expect((await s.load(id)).meta.archived).toBe(true);
      s.save(id, state());
      await s.flushUploads();
      expect((await s.load(id)).meta.archived).toBe(true); // an edit doesn't unarchive
      await s.setArchived(id, false);
      expect(await waitForPlans(s, p => p[0]?.archived === false)).toHaveLength(1);
    });

    it('replacePdf bumps rev and getPdf returns the new bytes; outlines unchanged', async () => {
      const s = fresh();
      const id = await s.create('x', pdfFile([1, 2, 3]));
      const before = (await waitForPlans(s, p => p.some(m => m.id === id)))[0];
      s.save(id, state());
      tick();
      await s.replacePdf(id, pdfFile([9, 8], 'new.pdf'));
      const meta = (await waitForPlans(s, p => p[0]?.pdf.rev === 2))[0];
      expect(meta.updatedAt).toBeGreaterThan(before.updatedAt);
      expect(meta.pdf).toMatchObject({ rev: 2, name: 'new.pdf', size: 2 });
      expect([...new Uint8Array(await s.getPdf(id))]).toEqual([9, 8]);
      expect((await s.load(id)).state).toEqual(state());
    });

    it('getPdf returns a copy', async () => {
      const s = fresh();
      const id = await s.create('x', pdfFile([1, 2, 3]));
      new Uint8Array(await s.getPdf(id)).fill(0);
      expect([...new Uint8Array(await s.getPdf(id))]).toEqual([1, 2, 3]);
    });

    it('remove drops it from the list and getPdf throws PdfUnavailableError', async () => {
      const s = fresh();
      const id = await s.create('x', pdfFile());
      await s.remove(id);
      expect(await waitForPlans(s, p => !p.some(m => m.id === id))).toHaveLength(0);
      await expect(s.getPdf(id)).rejects.toBeInstanceOf(PdfUnavailableError);
    });

    it('unknown id: load and getPdf throw, others reject', async () => {
      const s = fresh();
      await expect(s.load('nope')).rejects.toThrow();
      await expect(s.getPdf('nope')).rejects.toBeInstanceOf(PdfUnavailableError);
      await expect(s.rename('nope', 'x')).rejects.toThrow('Plan not found');
      await expect(s.replacePdf('nope', pdfFile())).rejects.toThrow('Plan not found');
      await expect(s.remove('nope')).rejects.toThrow('Plan not found');
    });

    it('list is newest-edited first', async () => {
      const s = fresh();
      const a = await s.create('A', pdfFile());
      tick();
      const b = await s.create('B', pdfFile());
      expect((await waitForPlans(s, p => p.length === 2)).map(p => p.id)).toEqual([b, a]);
      tick();
      await s.rename(a, 'A2');
      expect((await waitForPlans(s, p => p[0]?.id === a)).map(p => p.id)).toEqual([a, b]);
    });

    it('watchPlans emits again after changes until unsubscribed', async () => {
      const s = fresh();
      const seen: number[] = [];
      const off = s.watchPlans(p => seen.push(p.length), () => {});
      await vi.waitFor(() => expect(seen).toEqual([0]));
      await s.create('x', pdfFile());
      await vi.waitFor(() => expect(seen.at(-1)).toBe(1));
      off();
      const n = seen.length;
      await s.create('y', pdfFile());
      await new Promise(r => setTimeout(r, 0));
      expect(seen).toHaveLength(n);
    });
  });
}
