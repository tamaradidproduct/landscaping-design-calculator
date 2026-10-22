// What the Layers panel offers: only Outlines until the plot boundary is closed and the scale is set (or the plan already has items).
import { GROUPS, type Group } from './sections';

export type PanelState = 'locked' | 'needs-scale' | 'ready';

/** `placed` = surface zones + plants/objects + lines. Unlocked = scale set OR anything placed (so older plans keep their sections). */
export function panelState(p: { boundaryClosed: boolean; scaleSet: boolean; placed: number }): PanelState {
  if (p.scaleSet || p.placed > 0) return 'ready';
  return p.boundaryClosed ? 'needs-scale' : 'locked';
}

/** Sections to show, in order: Outlines always; the rest once ready and not empty. */
export const visibleGroups = (state: PanelState, counts: Record<Group, number>): Group[] =>
  GROUPS.filter(g => g === 'outlines' || (state === 'ready' && counts[g] > 0));

/** The Outlines section's guidance for the current state (quiet while drawing). */
export function outlinesHints(state: PanelState, drawing: boolean): string[] {
  if (drawing) return [];
  if (state === 'locked') return ['Outline the plot boundary.'];
  if (state === 'needs-scale') return ['Tap an edge and type its printed length to set the scale.', 'Then outline the house and other existing features.'];
  return [];
}
