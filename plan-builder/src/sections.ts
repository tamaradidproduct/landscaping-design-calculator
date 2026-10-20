// Collapsible Layers sections (Surfaces, Outlines): what each shows when collapsed, and when one opens by itself.
import { sectionOf, type Outline } from './outline';

export type Group = 'surfaces' | 'lines' | 'symbols' | 'outlines';
export type OpenState = Record<Group, boolean>;

export const GROUPS: readonly Group[] = ['surfaces', 'lines', 'symbols', 'outlines'];
/** The sections' order from the top of the Layers panel (and of the plan's stacking) to the bottom. */
export const DEFAULT_SECTION_ORDER: readonly Group[] = ['symbols', 'outlines', 'lines', 'surfaces'];
/** The order with `group` swapped with its neighbour above (-1) or below (+1); null at the ends or for an unknown group. */
export function moveSection(order: readonly Group[], group: Group, dir: -1 | 1): Group[] | null {
  const at = order.indexOf(group), to = at + dir;
  if (at < 0 || to < 0 || to >= order.length) return null;
  const next = [...order]; [next[at], next[to]] = [next[to], next[at]];
  return next;
}
const GROUP_NAMES: Record<Group, string> = { symbols: 'Plants & objects', outlines: 'Outlines', lines: 'Lines', surfaces: 'Surfaces' };
/** The label of a section's move button: "Move Lines up". */
export const moveLabel = (g: Group, dir: -1 | 1): string => `Move ${GROUP_NAMES[g]} ${dir < 0 ? 'up' : 'down'}`;
/** The order the plan paints in: bottom to top (the panel's order, reversed). */
export const paintOrder = (order: readonly Group[]): Group[] => [...order].reverse();
/** Whether a value is a section order: each of the four groups exactly once. */
export const isSectionOrder = (v: unknown): v is Group[] =>
  Array.isArray(v) && v.length === GROUPS.length && GROUPS.every(g => v.includes(g)) && new Set(v).size === v.length;
export const groupOf = (o: Outline): Group => sectionOf(o.kind) === 'surfaces' ? 'surfaces' : 'outlines';

/** Whether a layer is hidden: its own eye is off, or its whole section's is. A section's eye leaves each layer's own state alone. */
/** Whether a placed symbol is hidden: its own eye is off, or the Plants & objects section's is. */
export const isSymbolHidden = (p: { id: string }, layers: ReadonlySet<string>, groups: ReadonlySet<Group>): boolean => layers.has(p.id) || groups.has('symbols');
/** Whether a drawn line is hidden: its own eye is off, or the Lines section's is. */
export const isLineHidden = (l: { id: string }, layers: ReadonlySet<string>, groups: ReadonlySet<Group>): boolean => layers.has(l.id) || groups.has('lines');
export const isHidden = (o: Outline, layers: ReadonlySet<string>, groups: ReadonlySet<Group>): boolean => layers.has(o.id) || groups.has(groupOf(o));

/** Layers per section for the collapsed header: Outlines = the plot boundary + features (not the plot plan). */
export function groupCounts(outlines: Outline[], symbols = 0, lines = 0): Record<Group, number> {
  const n = { outlines: 0, surfaces: 0, symbols, lines };
  for (const o of outlines) n[groupOf(o)]++;
  return n;
}

/** The section to open when the active layer (being drawn, else selected) changes to `next`; null if none. */
export function groupToOpen(prev: string | null, next: string | null, outlines: Record<string, Outline>): Group | null {
  const o = next && next !== prev ? outlines[next] : undefined;
  return o ? groupOf(o) : null;
}

/** Saved open/closed state (both open by default; anything unreadable is ignored). */
export function readOpen(saved: string | null): OpenState {
  const open: OpenState = { outlines: true, surfaces: true, symbols: true, lines: true };
  try {
    const v = JSON.parse(saved ?? '{}');
    for (const g of GROUPS) if (typeof v?.[g] === 'boolean') open[g] = v[g];
  } catch { /* keep the defaults */ }
  return open;
}
