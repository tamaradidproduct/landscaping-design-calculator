// The expanded layer card shared by the Outlines and Surfaces sections: the card while drawing, the common
// actions of a selected layer, its layer order, and the wiring of all of them to the outline tool.
import type { Outline } from './outline';
import type { OutlineTool } from './outline-ui';
import { button, esc, hint, iconButton, layerActions, layerCard, layerOrder, type Swatch } from './ui';

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

/** A selected layer's actions: a Redraw icon and (unless it's the plot boundary) a trash icon. Square corners moves to the canvas (Task 6); its act stays wired. */
export const editActions = (deletable: boolean, lead = '') => layerActions(
  lead,
  iconButton('replace', { ariaLabel: 'Redraw', data: { act: 'redraw' } }),
  deletable ? iconButton('trash', { ariaLabel: 'Delete', variant: 'danger', data: { act: 'delete' } }) : '');

/** Layer order ↑ ↓ within the layer's section (hidden when it's the only one there). Surfaces still use it until Task 5. */
export function orderControl(t: OutlineTool, id: string): string {
  const p = t.layerPosition(id);
  return p.first && p.last ? '' : layerOrder(p.first, p.last);
}

/** Wire a card's buttons, head (tap closes) and rename field; `extra` adds section-specific acts. */
export function wireLayerCard(card: HTMLElement, t: OutlineTool, extra: Record<string, () => void> = {}) {
  const id = card.dataset.card!;
  const act: Record<string, () => void> = {
    close: () => t.close(), cancel: () => t.cancel(), collapse: () => t.selectOutline(null),
    'square-all': () => t.squareAll(id), redraw: () => t.redraw(id), delete: () => t.deleteLayer(id),
    up: () => t.moveLayer(id, -1), down: () => t.moveLayer(id, 1), ...extra,
  };
  card.querySelectorAll<HTMLButtonElement>('[data-act]').forEach(b => { if (act[b.dataset.act!]) b.onclick = act[b.dataset.act!]; });
  card.querySelectorAll<HTMLButtonElement>('[data-nudge]').forEach(b => {
    b.onclick = () => { const [dx, dy] = b.dataset.nudge!.split(',').map(Number); t.nudge(dx, dy); };
  });
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
