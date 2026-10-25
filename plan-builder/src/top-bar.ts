// The editor's top bar: back, plan name and menu (left), Edit | Preview (centre), Undo, Redo and Export (right).
import { button, esc, lineIcon, segmented } from './ui';

export type EditorView = 'edit' | 'preview';
export interface TopBarState { name: string; view: EditorView; canUndo: boolean; canRedo: boolean }
export const EXPORT_NOTE = 'Export is coming soon';

/** The left cluster: ← Plans, the plan's name, ⋯. PlanHead renders it too (and adds the menu card beneath). */
export const planBarHtml = (name: string) => `<div class="plan-bar">${button('←', { mods: ['icon', 'small'], id: 'back-to-plans', ariaLabel: 'Back to Plans' })}`
  + `<h1 class="plan-title" id="plan-title" title="${esc(name)}">${esc(name)}</h1>`
  + `${button('⋯', { mods: ['icon', 'small'], id: 'plan-more', ariaLabel: 'Plan actions', expanded: false })}</div>`;

export function topBarHtml(s: TopBarState): string {
  return `<div class="top-bar-inner"><div class="top-bar-left" id="top-bar-left">${planBarHtml(s.name)}</div>`
    + segmented('view-switch', 'View', 'view', [{ label: 'Edit', value: 'edit', pressed: s.view === 'edit' }, { label: 'Preview', value: 'preview', pressed: s.view === 'preview' }])
    + `<div class="top-bar-right">`
    + button(lineIcon('M6 3L2.5 6.5 6 10M3 6.5h6a4 4 0 010 8H6'), { mods: ['icon', 'quiet'], id: 'undo', ariaLabel: 'Undo', title: 'Undo (⌘Z)', disabled: !s.canUndo })
    + button(lineIcon('M10 3l3.5 3.5L10 10M13.5 6.5H7a4 4 0 000 8h3'), { mods: ['icon', 'quiet'], id: 'redo', ariaLabel: 'Redo', title: 'Redo (⇧⌘Z)', disabled: !s.canRedo })
    + `<span class="top-bar-sep" aria-hidden="true"></span>`
    + button(`${lineIcon('M8 10.5V2.5M5 5.5l3-3 3 3M3 9v4.5h10V9')}<span class="export-label">Export</span>`, { mods: ['bar-action'], id: 'export', ariaLabel: 'Export' })
    + `</div></div>`;
}
