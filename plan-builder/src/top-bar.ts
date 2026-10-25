// The editor's top bar: back, plan name and menu (left), Edit | Preview (centre), Undo, Redo and Export (right).
import { button, esc } from './ui';

export type EditorView = 'edit' | 'preview';
export interface TopBarState { name: string; view: EditorView; canUndo: boolean; canRedo: boolean }
export const EXPORT_NOTE = 'Export is coming soon';

const undoIcon = '<svg class="line-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3L2.5 6.5 6 10M3 6.5h6a4 4 0 010 8H6" /></svg>';
const redoIcon = '<svg class="line-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3l3.5 3.5L10 10M13.5 6.5H7a4 4 0 000 8h3" /></svg>';
const exportIcon = '<svg class="line-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10.5V2.5M5 5.5l3-3 3 3M3 9v4.5h10V9" /></svg>';

export function topBarHtml(s: TopBarState): string {
  const view = (v: EditorView, label: string) => button(label, { pressed: s.view === v, data: { view: v } });
  return `<div class="top-bar-inner"><div class="top-bar-left" id="top-bar-left">`
    + button('←', { mods: ['icon', 'small'], id: 'back-to-plans', ariaLabel: 'Back to Plans' })
    + `<h1 class="plan-title" id="plan-title" title="${esc(s.name)}">${esc(s.name)}</h1>`
    + button('⋯', { mods: ['icon', 'small'], id: 'plan-more', ariaLabel: 'Plan actions', expanded: false })
    + `</div><div class="segmented" id="view-switch" role="group" aria-label="View">${view('edit', 'Edit')}${view('preview', 'Preview')}</div>`
    + `<div class="top-bar-right">`
    + button(undoIcon, { mods: ['icon'], id: 'undo', ariaLabel: 'Undo', disabled: !s.canUndo }).replace('<button ', '<button title="Undo (⌘Z)" ')
    + button(redoIcon, { mods: ['icon'], id: 'redo', ariaLabel: 'Redo', disabled: !s.canRedo }).replace('<button ', '<button title="Redo (⇧⌘Z)" ')
    + `<span class="top-bar-sep" aria-hidden="true"></span>`
    + button(`${exportIcon}<span class="export-label">Export</span>`, { id: 'export', ariaLabel: 'Export' })
    + `</div></div>`;
}
