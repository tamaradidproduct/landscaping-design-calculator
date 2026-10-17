// Collapsible Layers sections (Surfaces, Outlines): what each shows when collapsed, and when one opens by itself.
import { sectionOf, type Outline } from './outline';

export type Group = 'surfaces' | 'outlines';
export type OpenState = Record<Group, boolean>;

export const GROUPS: readonly Group[] = ['surfaces', 'outlines'];
export const groupOf = (o: Outline): Group => sectionOf(o.kind) === 'surfaces' ? 'surfaces' : 'outlines';

/** Whether a layer is hidden: its own eye is off, or its whole section's is. A section's eye leaves each layer's own state alone. */
export const isHidden = (o: Outline, layers: ReadonlySet<string>, groups: ReadonlySet<Group>): boolean => layers.has(o.id) || groups.has(groupOf(o));

/** Layers per section for the collapsed header: Outlines = the plot boundary + features (not the plot plan). */
export function groupCounts(outlines: Outline[]): Record<Group, number> {
  const n = { outlines: 0, surfaces: 0 };
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
  const open: OpenState = { outlines: true, surfaces: true };
  try {
    const v = JSON.parse(saved ?? '{}');
    for (const g of ['outlines', 'surfaces'] as const) if (typeof v?.[g] === 'boolean') open[g] = v[g];
  } catch { /* keep the defaults */ }
  return open;
}
