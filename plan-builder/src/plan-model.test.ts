import { describe, expect, test } from 'vitest';
import { PlanFormatError, cleanAddress, docBytes, downloadTimeoutMs, editedAgo, fromDoc, sortPlans, toDoc, type PlanMeta, type PlanState } from './plan-model';

const pdf = { name: 'plot.pdf', size: 1234, rev: 1, uploaded: true };
const meta = { address: '12 Elm St', createdAt: 1000, updatedAt: 2000, pdf };
const surface = { id: 's1', kind: 'surface' as const, name: 'Sod', pts: [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 5 }], closed: true, bulges: [0, 4, 0], radii: [0, 2, 0], material: 'sod' as const };
const state: PlanState = { outlines: { s1: surface }, refs: [{ id: 's1', i: 0, feet: 12 }] };
const valid = () => JSON.parse(JSON.stringify(toDoc(state, meta)));
const reasonOf = (data: unknown) => { try { fromDoc(data); } catch (e) { return e instanceof PlanFormatError ? e.reason : 'other'; } return null; };

describe('toDoc / fromDoc', () => {
  test('round-trips a surface with bulges and radii', () => {
    const doc = fromDoc(toDoc(state, meta));
    expect({ outlines: doc.outlines, refs: doc.refs }).toEqual(state);
    expect(doc).toMatchObject({ v: 1, ...meta });
  });
  test('drops undefined fields', () => {
    const o = { id: 'o1', kind: 'feature' as const, name: 'House', pts: [{ x: 0, y: 0 }], closed: false, material: undefined, bulges: undefined };
    const doc = toDoc({ outlines: { o1: o }, refs: [] }, meta);
    expect('material' in doc.outlines.o1).toBe(false);
    expect('bulges' in doc.outlines.o1).toBe(false);
  });
  test('has no nested arrays', () => {
    const walk = (v: unknown): boolean => Array.isArray(v) ? v.some(e => Array.isArray(e) || walk(e)) : v && typeof v === 'object' ? Object.values(v).some(walk) : false;
    expect(walk(toDoc(state, meta))).toBe(false);
  });
  test('does not share objects with the input', () => {
    const doc = toDoc(state, meta);
    expect(doc.outlines.s1).not.toBe(surface);
    expect(doc.outlines.s1.pts).not.toBe(surface.pts);
  });
  test('fromDoc rejects bad documents', () => {
    expect(reasonOf({ ...valid(), v: 2 })).toBe('newer');
    const { outlines: _o, ...noOutlines } = valid();
    expect(reasonOf(noOutlines)).toBe('invalid');
    const bad = valid(); bad.outlines.s1.pts[0] = { x: NaN, y: 1 };
    expect(reasonOf(bad)).toBe('invalid');
    expect(reasonOf({ ...valid(), address: '' })).toBe('invalid');
    expect(reasonOf(null)).toBe('invalid');
    const kind = valid(); kind.outlines.s1.kind = 'moat';
    expect(reasonOf(kind)).toBe('invalid');
    const ref = valid(); ref.refs[0].feet = Infinity;
    expect(reasonOf(ref)).toBe('invalid');
    expect(reasonOf(valid())).toBeNull();
  });
});

describe('cleanAddress', () => {
  test('trims, collapses whitespace, caps length, rejects empty', () => {
    expect(cleanAddress('  12  Elm St ')).toBe('12 Elm St');
    expect(cleanAddress('   ')).toBeNull();
    expect(cleanAddress('a'.repeat(500))).toHaveLength(200);
  });
});

describe('docBytes', () => {
  test('counts UTF-8 bytes of the JSON', () => {
    const doc = toDoc(state, meta);
    expect(docBytes(doc)).toBe(new TextEncoder().encode(JSON.stringify(doc)).length);
    expect(docBytes({ ...doc, address: 'é' })).toBe(docBytes({ ...doc, address: 'e' }) + 1);
  });
});

describe('downloadTimeoutMs', () => {
  test('is 15 s for small files', () => { expect(downloadTimeoutMs(0)).toBe(15_000); expect(downloadTimeoutMs(500_000)).toBe(15_000); });
  test('allows 50 KB/s for big files', () => expect(downloadTimeoutMs(5 * 1024 * 1024)).toBe(102_400));
});

describe('sortPlans', () => {
  const p = (id: string, address: string, updatedAt: number): PlanMeta => ({ id, address, createdAt: 0, updatedAt, pdf, pending: false });
  test('newest first, ties by address', () => {
    const sorted = sortPlans([p('a', 'B St', 5), p('b', 'A St', 5), p('c', 'Z St', 9)]);
    expect(sorted.map(x => x.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('editedAgo', () => {
  const now = new Date(2026, 9, 15, 12).getTime();
  test('relative wording', () => {
    expect(editedAgo(now - 30_000, now)).toBe('Edited just now');
    expect(editedAgo(now - 5 * 60_000, now)).toBe('Edited 5 min ago');
    expect(editedAgo(now - 2 * 3_600_000, now)).toBe('Edited 2 h ago');
    expect(editedAgo(now - 30 * 3_600_000, now)).toBe('Edited yesterday');
  });
  test('older dates use a short date', () => {
    expect(editedAgo(new Date(2026, 9, 3, 9).getTime(), now)).toBe('Edited Oct 3');
  });
});
