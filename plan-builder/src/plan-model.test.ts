import { describe, expect, test } from 'vitest';
import { PlanFormatError, cleanAddress, docBytes, downloadTimeoutMs, editedAgo, editorFields, fromDoc, planStateOf, sortPlans, toDoc, type PlanMeta, type PlanState } from './plan-model';

const pdf = { name: 'plot.pdf', size: 1234, rev: 1, uploaded: true };
const meta = { address: '12 Elm St', createdAt: 1000, updatedAt: 2000, pdf };
const surface = { id: 's1', kind: 'surface' as const, name: 'Sod', pts: [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 5 }], closed: true, bulges: [0, 4, 0], radii: [0, 2, 0], material: 'premium-sod' as const };
const state: PlanState = { outlines: { s1: surface }, refs: [{ id: 's1', i: 0, feet: 12 }] };
const valid = () => JSON.parse(JSON.stringify(toDoc(state, meta)));
const reasonOf = (data: unknown) => { try { fromDoc(data); } catch (e) { return e instanceof PlanFormatError ? e.reason : 'other'; } return null; };

describe('placed symbols', () => {
  const placed = { y1: { id: 'y1', symbol: 'blue-diamond-spruce', x: 10, y: 20 }, y2: { id: 'y2', symbol: 'hot-tub', x: 30.5, y: 40, rot: 90 } };
  test('round-trip through toDoc / fromDoc', () => {
    const doc = fromDoc(toDoc({ ...state, symbols: placed }, meta));
    expect(doc.symbols).toEqual(placed);
  });
  test('a plan without symbols opens', () => expect(fromDoc(valid()).symbols).toBeUndefined());
  test.each([
    ['an unknown library id', (d: any) => { d.symbols.y1.symbol = 'nope'; }],
    ['a non-finite x', (d: any) => { d.symbols.y1.x = null; }],
    ['a non-finite y', (d: any) => { d.symbols.y1.y = 'a'; }],
    ['a non-finite rot', (d: any) => { d.symbols.y2.rot = NaN; }],
    ['an id that differs from its key', (d: any) => { d.symbols.y1.id = 'y9'; }],
    ['a missing id', (d: any) => { delete d.symbols.y1.id; }],
    ['symbols that are not an object', (d: any) => { d.symbols = []; }],
  ])('%s is an invalid plan', (_, mutate) => {
    const doc = JSON.parse(JSON.stringify(toDoc({ ...state, symbols: placed }, meta))); mutate(doc);
    expect(reasonOf(doc)).toBe('invalid');
  });
  test('hiding the symbols section is valid', () => {
    const doc = valid(); doc.hiddenSections = ['symbols'];
    expect(fromDoc(doc).hiddenSections).toEqual(['symbols']);
  });
});

describe('the plot fill', () => {
  const b = { id: 'boundary', kind: 'boundary' as const, name: 'Plot boundary', pts: [{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 9, y: 9 }], closed: true };
  const fill = { id: 'fill', kind: 'surface' as const, name: 'Plot fill', pts: b.pts, closed: true, material: 'premium-sod' as const, base: true as const };
  const withFill = (over: any = {}) => JSON.parse(JSON.stringify(toDoc({ ...state, outlines: { boundary: b, fill: { ...fill, ...over } } }, meta)));
  test('round-trips through toDoc / fromDoc', () => expect(fromDoc(withFill()).outlines.fill.base).toBe(true));
  test('a plan without a fill is unchanged', () => expect(fromDoc(valid()).outlines.s1.base).toBeUndefined());
  test.each([
    ['base on a feature', (d: any) => { d.outlines.fill.kind = 'feature'; delete d.outlines.fill.material; }],
    ['base: false', (d: any) => { d.outlines.fill.base = false; }],
    ['base that is not a boolean', (d: any) => { d.outlines.fill.base = 'yes'; }],
    ['two fills', (d: any) => { d.outlines.fill2 = { ...d.outlines.fill, id: 'fill2' }; }],
  ])('%s is an invalid plan', (_, mutate) => {
    const doc = withFill(); mutate(doc); expect(reasonOf(doc)).toBe('invalid');
  });
});

describe('placed lines', () => {
  const lines = {
    l1: { id: 'l1', item: 'wood-privacy-fence', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 30 }], widthFt: 0.33 },
    l2: { id: 'l2', item: 'dry-river', points: [{ x: 5, y: 5 }, { x: 40, y: 9 }], bulges: [3], widthFt: 4 },
  };
  test('round-trip through toDoc / fromDoc, with and without bulges', () => {
    const doc = fromDoc(toDoc({ ...state, lines }, meta));
    expect(doc.lines).toEqual(lines);
  });
  test('a plan without lines opens and saves no lines key', () => {
    expect(fromDoc(valid()).lines).toBeUndefined();
    expect('lines' in valid()).toBe(false);
  });
  test.each([
    ['an unknown item', (d: any) => { d.lines.l1.item = 'nope'; }],
    ['one point', (d: any) => { d.lines.l1.points = [{ x: 0, y: 0 }]; }],
    ['a non-finite coordinate', (d: any) => { d.lines.l1.points[1].x = null; }],
    ['a point that is not an object', (d: any) => { d.lines.l1.points[0] = 5; }],
    ['a width below 0.25', (d: any) => { d.lines.l1.widthFt = 0.2; }],
    ['a width above 12', (d: any) => { d.lines.l1.widthFt = 12.5; }],
    ['bulges of the wrong length', (d: any) => { d.lines.l2.bulges = [1, 2]; }],
    ['a non-finite bulge', (d: any) => { d.lines.l2.bulges = [NaN]; }],
    ['an id that differs from its key', (d: any) => { d.lines.l1.id = 'l9'; }],
    ['lines that are not an object', (d: any) => { d.lines = []; }],
  ])('%s is an invalid plan', (_, mutate) => {
    const doc = JSON.parse(JSON.stringify(toDoc({ ...state, lines }, meta))); mutate(doc);
    expect(reasonOf(doc)).toBe('invalid');
  });
  test('hiding the lines section and a line id is valid', () => {
    const doc = JSON.parse(JSON.stringify(toDoc({ ...state, lines }, meta))); doc.hiddenSections = ['lines']; doc.hiddenLayers = ['l1'];
    expect(fromDoc(doc).hiddenSections).toEqual(['lines']);
  });
});

describe('texture scale and visibility', () => {
  test('texScale, hiddenLayers and hiddenSections round-trip', () => {
    const st: PlanState = { outlines: { s1: { ...surface, texScale: 1.5 } }, refs: [], hiddenLayers: ['s1'], hiddenSections: ['surfaces', 'outlines'] };
    const doc = fromDoc(toDoc(st, meta));
    expect(doc.outlines.s1.texScale).toBe(1.5);
    expect(doc.hiddenLayers).toEqual(['s1']);
    expect(doc.hiddenSections).toEqual(['surfaces', 'outlines']);
  });
  test('a plan without them still opens', () => {
    const doc = fromDoc(valid());
    expect(doc.hiddenLayers).toBeUndefined();
    expect(doc.hiddenSections).toBeUndefined();
  });
  test.each([['0', 0], ['too big', 5], ['too small', 0.1], ['text', 'x'], ['NaN', null]])('texScale %s is an invalid plan', (_, v) => {
    const doc = valid(); doc.outlines.s1.texScale = v;
    expect(reasonOf(doc)).toBe('invalid');
  });
  test.each([['not a list', 'x'], ['not strings', [1]]])('hiddenLayers %s is an invalid plan', (_, v) => {
    const doc = valid(); doc.hiddenLayers = v;
    expect(reasonOf(doc)).toBe('invalid');
  });
  test('an unknown hidden section is an invalid plan', () => {
    const doc = valid(); doc.hiddenSections = ['lot'];
    expect(reasonOf(doc)).toBe('invalid');
  });
});

describe('toDoc / fromDoc', () => {
  test('an old material id is remapped when loaded', () => {
    const doc = valid(); doc.outlines.s1.material = 'sod';
    expect(fromDoc(doc).outlines.s1.material).toBe('premium-sod');
  });
  test('an unknown material id is an invalid plan', () => {
    const doc = valid(); doc.outlines.s1.material = 'nope';
    expect(reasonOf(doc)).toBe('invalid');
  });
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
    expect(reasonOf({ ...valid(), archived: 'yes' })).toBe('invalid');
    expect(reasonOf({ ...valid(), archived: true })).toBeNull();
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
  const p = (id: string, address: string, updatedAt: number): PlanMeta => ({ id, address, createdAt: 0, updatedAt, pdf, pending: false, archived: false });
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

describe('what the editor saves and loads', () => {
  const full: PlanState = {
    outlines: { s1: surface }, refs: [], hiddenLayers: ['s1', 'y1'], hiddenSections: ['symbols'],
    symbols: { y1: { id: 'y1', symbol: 'hot-tub', x: 1, y: 2, rot: 45 } },
    lines: { l1: { id: 'l1', item: 'dry-river', points: [{ x: 0, y: 0 }, { x: 9, y: 9 }], widthFt: 2 } },
    plantSizeView: 'install',
  };
  test('planStateOf returns every editor field of a document, as copies', () => {
    const doc = fromDoc(toDoc(full, meta)), st = planStateOf(doc);
    expect(st).toEqual(full);
    expect(st.symbols).not.toBe(doc.symbols); expect(st.outlines).not.toBe(doc.outlines);
  });
  test('a plan without the optional fields loads without them', () => {
    expect(planStateOf(fromDoc(valid()))).toEqual({ outlines: state.outlines, refs: state.refs });
  });
  test('editorFields lists what to write and which optional fields to clear', () => {
    const f = editorFields(toDoc(full, meta));
    expect(Object.keys(f.write).sort()).toEqual(['hiddenLayers', 'hiddenSections', 'lines', 'outlines', 'plantSizeView', 'refs', 'symbols', 'updatedAt', 'v']);
    expect(f.clear).toEqual([]);
    const bare = editorFields(toDoc(state, meta));
    expect(Object.keys(bare.write).sort()).toEqual(['outlines', 'refs', 'updatedAt', 'v']);
    expect(bare.clear.sort()).toEqual(['hiddenLayers', 'hiddenSections', 'lines', 'plantSizeView', 'symbols']);
  });
});

describe('plant size view and per-plant size choice', () => {
  const sym = (over: any) => ({ id: 'y1', symbol: 'lavender', x: 1, y: 1, ...over });
  const withSyms = (symbols: any, extra: any = {}) => ({ ...valid(), ...extra, symbols });
  test.each(['install', 'mature'] as const)('plantSizeView %s round-trips', v => {
    const doc = fromDoc(toDoc({ ...state, plantSizeView: v }, meta));
    expect(doc.plantSizeView).toBe(v);
    expect(planStateOf(doc).plantSizeView).toBe(v);
  });
  test('a bad plantSizeView is an invalid plan', () => expect(reasonOf({ ...valid(), plantSizeView: 'big' })).toBe('invalid'));
  test('a pre-change plan loads without a plantSizeView', () => {
    const doc = fromDoc(valid());
    expect(doc.plantSizeView).toBeUndefined();
    expect('plantSizeView' in planStateOf(doc)).toBe(false);
  });
  test('a bad container or customInstall is dropped, not an error', () => {
    const doc = fromDoc(withSyms({ y1: sym({ container: 'nope', customInstall: -3 }) }));
    expect(doc.symbols!.y1).toEqual({ id: 'y1', symbol: 'lavender', x: 1, y: 1 });
    expect('container' in doc.symbols!.y1).toBe(false);
    expect('customInstall' in doc.symbols!.y1).toBe(false);
  });
  test('customInstall is clamped to the mature size', () => {
    const doc = fromDoc(withSyms({ y1: sym({ symbol: 'blue-diamond-spruce', customInstall: 99 }) }));
    expect(doc.symbols!.y1.customInstall).toBe(10);
  });
  test('with both container and customInstall only customInstall is kept', () => {
    const doc = fromDoc(withSyms({ y1: sym({ symbol: 'blue-diamond-spruce', container: '5 gal', customInstall: 4 }) }));
    expect(doc.symbols!.y1.customInstall).toBe(4);
    expect('container' in doc.symbols!.y1).toBe(false);
  });
  test('editorFields clears plantSizeView when absent and writes it when present', () => {
    expect(editorFields(toDoc(state, meta)).clear).toContain('plantSizeView');
    const f = editorFields(toDoc({ ...state, plantSizeView: 'mature' }, meta));
    expect(f.write.plantSizeView).toBe('mature');
    expect(f.clear).not.toContain('plantSizeView');
  });
});

describe('surfaces without a material', () => {
  const bare = { id: 's2', kind: 'surface' as const, name: 'Surface', pts: [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 5 }], closed: true };
  test('validate and round-trip through toDoc / fromDoc unchanged', () => {
    const doc = fromDoc(toDoc({ outlines: { s1: surface, s2: bare }, refs: state.refs }, meta));
    expect(doc.outlines.s2).toEqual(bare); expect('material' in doc.outlines.s2!).toBe(false);
    expect(doc.outlines.s1!.material).toBe('premium-sod');
  });
  test('an unknown material id is still invalid', () => {
    const d = valid(); d.outlines.s1.material = 'nope'; expect(reasonOf(d)).toBe('invalid');
  });
});
