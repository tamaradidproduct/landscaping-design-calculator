// Pure model for a saved plan document (Firestore). No Firebase imports.
import { TEX_SCALE, type Outline, type OutlineKind } from './outline';
import { GROUPS, type Group } from './sections';
import { symbolById } from './symbols';
import { LINE_WIDTH_FT, lineItemById } from './line-items';
import type { Reference } from './scale';
import { normalizeMaterialId } from './materials';

export interface PdfInfo { name: string; size: number; rev: number; uploaded: boolean }
/** `hiddenLayers` (outline ids) and `hiddenSections` are absent when nothing is hidden. */
/** A plant or object dropped on the plan: where its centre is (page points) and how far it is turned (degrees, absent = 0). */
export interface PlacedSymbol { id: string; symbol: string; x: number; y: number; rot?: number }
/** A run drawn on the plan (a fence, a wall, edging, a dry river): its points (page points), a bend per segment (as an outline's bulges) and its width in feet. */
export interface PlacedLine { id: string; item: string; points: { x: number; y: number }[]; bulges?: number[]; widthFt: number }
export interface PlanState { outlines: Record<string, Outline>; refs: Reference[]; hiddenLayers?: string[]; hiddenSections?: Group[]; symbols?: Record<string, PlacedSymbol>; lines?: Record<string, PlacedLine> }
/** `archived` is absent on plans that were never archived. */
export interface PlanDoc extends PlanState { v: 1; address: string; createdAt: number; updatedAt: number; pdf: PdfInfo; archived?: boolean }
export interface PlanMeta { id: string; address: string; createdAt: number; updatedAt: number; pdf: PdfInfo; pending: boolean; archived: boolean }

export const SIZE_WARN_BYTES = 800_000;
const ADDRESS_MAX = 200;
const KINDS: OutlineKind[] = ['boundary', 'feature', 'surface'];

export class PlanFormatError extends Error {
  constructor(public reason: 'newer' | 'invalid', message: string) { super(message); this.name = 'PlanFormatError'; }
}

export function cleanAddress(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, ' ').slice(0, ADDRESS_MAX).trim();
  return s || null;
}

/** Deep copy; JSON drops `undefined` keys, which Firestore rejects. */
const strip = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export const toDoc = (state: PlanState, meta: Omit<PlanDoc, 'v' | 'outlines' | 'refs' | 'hiddenLayers' | 'hiddenSections' | 'symbols' | 'lines'>): PlanDoc =>
  strip({ v: 1, ...meta, outlines: state.outlines, refs: state.refs, hiddenLayers: state.hiddenLayers, hiddenSections: state.hiddenSections, symbols: state.symbols, lines: state.lines });

const invalid = (what: string): never => { throw new PlanFormatError('invalid', `Invalid plan: ${what}`); };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, what: string) => { if (typeof v !== 'number' || !Number.isFinite(v)) invalid(what); };
const numArray = (v: unknown, what: string) => { if (!Array.isArray(v)) invalid(what); (v as unknown[]).forEach(n => num(n, what)); };

function checkOutline(key: string, o: unknown) {
  if (!isObj(o)) return invalid(`outline ${key}`);
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.closed !== 'boolean') invalid(`outline ${key}`);
  if (!KINDS.includes(o.kind as OutlineKind)) invalid(`outline ${key} kind`);
  if (!Array.isArray(o.pts)) invalid(`outline ${key} pts`);
  (o.pts as unknown[]).forEach(p => { if (!isObj(p)) invalid(`outline ${key} point`); num((p as Record<string, unknown>).x, `outline ${key} x`); num((p as Record<string, unknown>).y, `outline ${key} y`); });
  if (o.bulges !== undefined) numArray(o.bulges, `outline ${key} bulges`);
  if (o.radii !== undefined) numArray(o.radii, `outline ${key} radii`);
  if (o.material !== undefined && typeof o.material !== 'string') invalid(`outline ${key} material`);
  if (o.texScale !== undefined && !(typeof o.texScale === 'number' && o.texScale >= TEX_SCALE.min && o.texScale <= TEX_SCALE.max)) invalid(`outline ${key} texScale`);
}

/** The editor's part of a document (what the tool loads), as copies. */
export const planStateOf = (d: PlanDoc): PlanState => structuredClone({
  outlines: d.outlines, refs: d.refs,
  ...(d.hiddenLayers ? { hiddenLayers: d.hiddenLayers } : {}), ...(d.hiddenSections ? { hiddenSections: d.hiddenSections } : {}), ...(d.symbols ? { symbols: d.symbols } : {}), ...(d.lines ? { lines: d.lines } : {}),
});

const OPTIONAL_EDITOR_FIELDS = ['hiddenLayers', 'hiddenSections', 'symbols', 'lines'] as const;
/**
 * The fields a save writes: only the editor's (a full set could clobber a newer pdf or address from another device). An
 * optional field the plan no longer has is listed in `clear`, so the stored one is removed, not left behind.
 */
export function editorFields(next: PlanDoc): { write: Record<string, unknown>; clear: string[] } {
  const write: Record<string, unknown> = { v: 1, outlines: next.outlines, refs: next.refs, updatedAt: next.updatedAt }, clear: string[] = [];
  for (const k of OPTIONAL_EDITOR_FIELDS) if (next[k] !== undefined) write[k] = next[k]; else clear.push(k);
  return { write, clear };
}

/** Validates by hand and returns the data typed; throws PlanFormatError. */
export function fromDoc(data: unknown): PlanDoc {
  if (!isObj(data)) return invalid('not an object');
  if (typeof data.v === 'number' && data.v > 1) throw new PlanFormatError('newer', 'This plan was saved by a newer version of the app');
  if (data.v !== 1) invalid('version');
  if (typeof data.address !== 'string' || !data.address) invalid('address');
  num(data.createdAt, 'createdAt'); num(data.updatedAt, 'updatedAt');
  if (data.archived !== undefined && typeof data.archived !== 'boolean') invalid('archived');
  const pdf = data.pdf;
  if (!isObj(pdf) || typeof pdf.name !== 'string' || typeof pdf.uploaded !== 'boolean') return invalid('pdf');
  num(pdf.size, 'pdf size'); num(pdf.rev, 'pdf rev');
  if (!isObj(data.outlines)) return invalid('outlines');
  Object.entries(data.outlines).forEach(([k, o]) => checkOutline(k, o));
  if (data.hiddenLayers !== undefined && !(Array.isArray(data.hiddenLayers) && data.hiddenLayers.every(x => typeof x === 'string'))) invalid('hiddenLayers');
  if (data.hiddenSections !== undefined && !(Array.isArray(data.hiddenSections) && data.hiddenSections.every(x => GROUPS.includes(x as Group)))) invalid('hiddenSections');
  if (data.symbols !== undefined) {
    if (!isObj(data.symbols)) return invalid('symbols');
    Object.entries(data.symbols).forEach(([k, p]) => {
      if (!isObj(p) || p.id !== k || typeof p.symbol !== 'string' || !symbolById(p.symbol)) return invalid(`symbol ${k}`);
      num(p.x, `symbol ${k} x`); num(p.y, `symbol ${k} y`);
      if (p.rot !== undefined) num(p.rot, `symbol ${k} rot`);
    });
  }
  if (data.lines !== undefined) {
    if (!isObj(data.lines)) return invalid('lines');
    Object.entries(data.lines).forEach(([k, l]) => {
      if (!isObj(l) || l.id !== k || typeof l.item !== 'string' || !lineItemById(l.item)) return invalid(`line ${k}`);
      if (!Array.isArray(l.points) || l.points.length < 2) return invalid(`line ${k} points`);
      l.points.forEach(p => { if (!isObj(p)) return invalid(`line ${k} point`); num(p.x, `line ${k} x`); num(p.y, `line ${k} y`); });
      num(l.widthFt, `line ${k} width`);
      if ((l.widthFt as number) < LINE_WIDTH_FT.min || (l.widthFt as number) > LINE_WIDTH_FT.max) invalid(`line ${k} width`);
      if (l.bulges !== undefined) { numArray(l.bulges, `line ${k} bulges`); if ((l.bulges as unknown[]).length !== l.points.length - 1) invalid(`line ${k} bulges`); }
    });
  }
  if (!Array.isArray(data.refs)) return invalid('refs');
  data.refs.forEach(r => {
    if (!isObj(r) || typeof r.id !== 'string') return invalid('reference');
    num(r.i, 'reference i'); num(r.feet, 'reference feet');
  });
  const doc = strip(data) as unknown as PlanDoc;
  for (const o of Object.values(doc.outlines)) {
    if (o.material === undefined) continue;
    const id = normalizeMaterialId(o.material);
    if (!id) return invalid(`outline ${o.id} material`);
    o.material = id;
  }
  return doc;
}

/** Whole-download timeout for a PDF of `size` bytes: 15 s, or longer at 50 KB/s for big files. */
export const downloadTimeoutMs = (size: number): number => Math.max(15_000, Math.ceil(size / 51.2));

/** UTF-8 length of the JSON; an estimate of Firestore's stored size. */
export const docBytes = (doc: PlanDoc): number => new TextEncoder().encode(JSON.stringify(doc)).length;

export const sortPlans = (plans: PlanMeta[]): PlanMeta[] =>
  [...plans].sort((a, b) => b.updatedAt - a.updatedAt || a.address.localeCompare(b.address));

export function editedAgo(updatedAt: number, now: number): string {
  const min = Math.floor((now - updatedAt) / 60_000);
  if (min < 1) return 'Edited just now';
  if (min < 60) return `Edited ${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Edited ${h} h ago`;
  if (h < 48) return 'Edited yesterday';
  return `Edited ${new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
