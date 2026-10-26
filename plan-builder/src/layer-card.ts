// The expanded layer card shared by the Outlines and Surfaces sections: the card while drawing, the common
// actions of a selected layer, drag-to-reorder, and the wiring of all of them to the outline tool.
import type { Outline } from './outline';
import type { OutlineTool } from './outline-ui';
import { button, esc, hint, iconButton, layerActions, layerCard, type Swatch } from './ui';

const compact = ['compact'];

/** The card of the layer being drawn: its step, Close shape and Cancel. */
export function drawingCard(t: OutlineTool, o: Outline, swatch: Swatch, subject: string): string {
  const n = o.pts.length, what = `<b>${esc(subject)}</b>`;
  const step = t.shape === 'rect'
    ? (n ? 'Now drag or tap to the opposite corner.' : `Drag from one corner of the ${what} to the opposite corner.`)
    : n >= 3 ? `${n} corners. Tap the first corner or double-tap to finish.` : `Tap each corner of the ${what} · ${n} placed`;
  return layerCard({ id: o.id, swatch, name: o.name, meta: 'Drawing…', body: `${hint(step)}${layerActions(
    t.shape === 'rect' ? '' : button('Close shape', { variant: 'primary', mods: compact, disabled: n < 3, data: { act: 'close' } }),
    button('Cancel', { mods: compact, data: { act: 'cancel' } }))}` });
}

/** A selected layer's header actions: a Redraw icon, Duplicate as surface (a custom outline only) and (unless it's the plot
 * boundary) a trash icon. (Square corners is a floating canvas button, not part of the card.) */
export const editActions = (deletable: boolean, duplicable = false) =>
  iconButton('replace', { ariaLabel: 'Redraw', data: { act: 'redraw' } })
  + (duplicable ? iconButton('copy', { ariaLabel: 'Duplicate as surface', data: { act: 'duplicate-surface' } }) : '')
  + (deletable ? iconButton('trash', { ariaLabel: 'Delete', variant: 'danger', data: { act: 'delete' } }) : '');

/**
 * Drag-to-reorder for a section's rows: only a grip (`[data-grip]`) starts a drag, so panel scrolling is untouched.
 * While dragging, a drop line shows before the row under the pointer; releasing calls `moveLayerTo`; pointercancel or
 * Escape changes nothing. Only rows with a grip in this list are drop targets, so a layer never leaves its section.
 * A focused grip also takes Alt+↑ / Alt+↓ (one step). Call after every render of the list.
 */
export function wireReorder(listEl: HTMLElement, t: OutlineTool) {
  const items = () => [...listEl.querySelectorAll<HTMLElement>('.layer-item')].filter(i => i.querySelector('[data-grip]'));
  const idOf = (i: HTMLElement) => i.querySelector<HTMLElement>('[data-grip]')!.dataset.grip!;
  listEl.querySelectorAll<HTMLElement>('[data-grip]').forEach(grip => {
    const id = grip.dataset.grip!;
    grip.title = 'Drag, or Alt+↑/↓'; grip.setAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown');
    grip.onkeydown = e => {
      if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault(); e.stopPropagation(); // the tool's own key handler would also nudge the selection
      t.moveLayer(id, e.key === 'ArrowUp' ? -1 : 1);
      listEl.querySelector<HTMLElement>(`[data-grip="${CSS.escape(id)}"]`)?.focus(); // the list was redrawn
    };
    grip.onpointerdown = down => {
      if (down.button !== 0 && down.pointerType === 'mouse') return;
      down.preventDefault();
      const row = grip.closest<HTMLElement>('.layer-item')!;
      let before: string | null | undefined; // undefined = not over a target yet
      const mark = (y: number) => {
        const others = items().filter(i => i !== row);
        const next = others.find(i => { const r = i.getBoundingClientRect(); return y < r.top + r.height / 2; });
        before = next ? idOf(next) : null;
        items().forEach(i => i.classList.remove('drop-before', 'drop-end'));
        (next ?? others[others.length - 1])?.classList.add(next ? 'drop-before' : 'drop-end');
      };
      const finish = (apply: boolean) => {
        grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', cancel);
        grip.removeEventListener('lostpointercapture', cancel); window.removeEventListener('keydown', key, true);
        row.classList.remove('dragging'); items().forEach(i => i.classList.remove('drop-before', 'drop-end'));
        if (grip.hasPointerCapture(down.pointerId)) grip.releasePointerCapture(down.pointerId);
        if (apply && before !== undefined) t.moveLayerTo(id, before);
      };
      const move = (e: PointerEvent) => mark(e.clientY);
      const up = () => finish(true);
      const cancel = () => finish(false);
      const key = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (!grip.isConnected) { finish(false); return; } e.preventDefault(); e.stopImmediatePropagation(); finish(false); };
      grip.setPointerCapture(down.pointerId);
      row.classList.add('dragging');
      grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', cancel);
      grip.addEventListener('lostpointercapture', cancel); window.addEventListener('keydown', key, true);
    };
  });
}

/** Wire a card's buttons, head (tap closes) and rename field; `extra` adds section-specific acts. */
export function wireLayerCard(card: HTMLElement, t: OutlineTool, extra: Record<string, () => void> = {}) {
  const id = card.dataset.card!;
  const act: Record<string, () => void> = {
    close: () => t.close(), cancel: () => t.cancel(), collapse: () => t.selectOutline(null),
    redraw: () => t.redraw(id), delete: () => t.deleteLayer(id),
    ...extra,
  };
  card.querySelectorAll<HTMLButtonElement>('[data-act]').forEach(b => { if (act[b.dataset.act!]) b.onclick = act[b.dataset.act!]; });
  // Tapping the head (not its name field or buttons) closes the card, like tapping a row again.
  card.querySelector<HTMLElement>('.layer-head')!.onclick = e => {
    if (!(e.target as Element).closest('input, button') && !t.drawing) t.selectOutline(null);
  };
  const rename = card.querySelector<HTMLInputElement>('input.layer-rename');
  if (rename) {
    rename.onchange = () => t.renameLayer(id, rename.value);
    rename.onkeydown = e => {
      if (e.key === 'Enter') rename.blur();
      else if (e.key === 'Escape') { rename.value = t.outlines[id]?.name ?? rename.value; rename.blur(); }
    };
  }
}
