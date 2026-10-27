// The editor's top bar: back, plan name and menu (left), Edit | Preview (centre), Undo, Redo and Export (right).
import { button, esc, lucideIcon, segmented } from './ui';
import type { PlantSizeView } from './plant-size';

export type EditorView = 'edit' | 'preview';
export interface TopBarState { name: string; view: EditorView; canUndo: boolean; canRedo: boolean; /** Install | Mature; undefined hides the toggle. */ plantView?: PlantSizeView }
export const EXPORT_NOTE = 'Export is coming soon';

/** The left cluster: ← Plans, the plan's name, gear. PlanHead renders it too (and adds the menu card beneath). */
export const planBarHtml = (name: string) => `<div class="plan-bar">${button('←', { mods: ['icon', 'small'], id: 'back-to-plans', ariaLabel: 'Back to Plans' })}`
  + `<h1 class="plan-title" id="plan-title" title="${esc(name)}">${esc(name)}</h1>`
  + `${button(lucideIcon('settings'), { mods: ['icon', 'small'], id: 'plan-more', ariaLabel: 'Plan actions', expanded: false })}</div>`;

const both = (full: string, short: string) => `<span class="label-full">${full}</span><span class="label-short">${short}</span>`;
/** Install | Mature (short labels Now | Grown when narrow); empty when there is nothing to toggle. */
export const plantToggleHtml = (v: PlantSizeView | undefined) => v === undefined ? '' : segmented('plant-view-switch', 'Plant size view', 'plantview', [
  { label: both('Install', 'Now'), value: 'install', pressed: v === 'install' }, { label: both('Mature', 'Grown'), value: 'mature', pressed: v === 'mature' }]);

export function topBarHtml(s: TopBarState): string {
  return `<div class="top-bar-inner"><div class="top-bar-left" id="top-bar-left">${planBarHtml(s.name)}</div>`
    + segmented('view-switch', 'View', 'view', [{ label: 'Edit', value: 'edit', pressed: s.view === 'edit' }, { label: 'Preview', value: 'preview', pressed: s.view === 'preview' }])
    + plantToggleHtml(s.plantView)
    + `<div class="top-bar-right">`
    + button(lucideIcon('undo'), { mods: ['icon', 'quiet'], id: 'undo', ariaLabel: 'Undo', title: 'Undo (⌘Z)', disabled: !s.canUndo })
    + button(lucideIcon('redo'), { mods: ['icon', 'quiet'], id: 'redo', ariaLabel: 'Redo', title: 'Redo (⇧⌘Z)', disabled: !s.canRedo })
    + `<span class="top-bar-sep" aria-hidden="true"></span>`
    + button(`${lucideIcon('share')}<span class="export-label">Export</span>`, { mods: ['bar-action'], id: 'export', ariaLabel: 'Export' })
    + `</div></div>`;
}
