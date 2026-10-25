/** Pure helpers behind the slimmer cards and overlays. */
import { parseRadius } from './outline';

/** "2 of 3": the selection's 1-based place among its siblings; null for a lone or unknown selection. */
export function instanceLabel(selectedId: string | null, ids: readonly string[]): string | null {
  const at = selectedId === null ? -1 : ids.indexOf(selectedId);
  return at < 0 || ids.length < 2 ? null : `${at + 1} of ${ids.length}`;
}

/** What the corner-radius field shows for the selected corners: their shared radius, or blank with a hint. */
export function radiusDisplay(radiiFt: readonly number[]): { value: string; placeholder: string } {
  if (!radiiFt.length || radiiFt.every(r => r === 0)) return { value: '', placeholder: '0′' };
  const first = radiiFt[0]!;
  return first > 0 && radiiFt.every(r => r === first) ? { value: String(first), placeholder: '0′' } : { value: '', placeholder: 'Mixed' };
}

export type EdgeKind = 'boundary' | 'feature' | 'surface';
export interface EdgeMenuItem { act: 'straighten' | 'unref' | 'swap'; label: string }

/** The actions an edge's menu offers, in order. */
export function edgeMenuItems(e: { kind: EdgeKind; curved: boolean; hasRef: boolean }): EdgeMenuItem[] {
  const items: EdgeMenuItem[] = [];
  if (e.curved) items.push({ act: 'straighten', label: 'Make straight' });
  if (e.hasRef && e.kind !== 'surface') items.push({ act: 'unref', label: 'Remove this length' });
  if (e.kind === 'surface') items.push({ act: 'swap', label: 'Swap fixed end' });
  return items;
}

/** Top-left of a chip centred under `mid` (flipped above near the stage bottom), kept `margin` inside the stage. */
export function chipPosition(
  mid: { x: number; y: number }, chip: { w: number; h: number }, stage: { w: number; h: number }, gap: number, margin: number,
): { left: number; top: number } {
  const clamp = (v: number, size: number, max: number) => Math.max(margin, Math.min(v, max - size - margin));
  const below = mid.y + gap, top = below + chip.h + margin > stage.h ? mid.y - gap - chip.h : below;
  return { left: clamp(mid.x - chip.w / 2, chip.w, stage.w), top: clamp(top, chip.h, stage.h) };
}

/** What Enter or Done in the Corner radius field applies: null (nothing) for a blank field, which is how mixed radii show; "0" squares. */
export function roundAllRequest(text: string): number | null {
  return text.trim() === '' ? null : parseRadius(text);
}

/** The canvas nudge pad is a touch aid: shown only for something nudgeable on a coarse pointer (desktop uses the arrow keys). */
export function nudgePadVisible(nudgeable: boolean, coarse: boolean): boolean {
  return nudgeable && coarse;
}
