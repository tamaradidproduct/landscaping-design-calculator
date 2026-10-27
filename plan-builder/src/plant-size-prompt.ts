// One-time question for an existing plan that has plants but no stored plant-size view.
import type { PlantSizeView } from './plant-size';
import { symbolById } from './symbols';
import { button } from './ui';

/** True when the plan has no stored view yet and at least one placed symbol is a library plant. */
export function needsPlantSizePrompt(state: { plantSizeView?: PlantSizeView; symbols?: Record<string, { symbol: string }> }): boolean {
  if (state.plantSizeView !== undefined) return false;
  return Object.values(state.symbols ?? {}).some(s => symbolById(s.symbol)?.kind === 'plant');
}

/** The answer an interaction gives: a button, Escape or the backdrop (both keep Mature); undefined means ignore. */
export function plantSizeChoice(e: { choice?: PlantSizeView; key?: string; backdrop?: boolean }): PlantSizeView | undefined {
  if (e.choice) return e.choice;
  if (e.key === 'Escape' || e.backdrop) return 'mature';
  return undefined;
}

export function plantSizePromptHtml(): string {
  const install = button('Install size', { variant: 'primary', data: { choice: 'install' } }).replace('<button ', '<button autofocus ');
  return '<div class="modal-backdrop" data-backdrop>'
    + '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="plant-size-title">'
    + '<h2 id="plant-size-title" class="modal-title">Show plants at install size?</h2>'
    + '<p>This plan draws plants at their mature size. You can switch any time from the top bar.</p>'
    + `<div class="row split">${install}${button('Keep mature', { data: { choice: 'mature' } })}</div>`
    + '</div></div>';
}

/** The modal's keyboard: Escape keeps Mature, Tab cycles its buttons, and no key reaches the editor behind it
 *  (Esc deselect, Cmd+Z, Delete, arrows, x); other keys keep their default, so Enter and Space press the focused button. */
export function handlePromptKey(
  e: { key: string; shiftKey: boolean; preventDefault(): void; stopPropagation(): void },
  ctx: { done(v: PlantSizeView): void; focus(step: 1 | -1): void },
): void {
  e.stopPropagation();
  const v = plantSizeChoice({ key: e.key });
  if (v) { e.preventDefault(); ctx.done(v); }
  else if (e.key === 'Tab') { e.preventDefault(); ctx.focus(e.shiftKey ? -1 : 1); } // keep focus inside the dialog
}

/** Shows the question and resolves with the answer. */
export function askPlantSize(): Promise<PlantSizeView> {
  return new Promise(resolve => {
    const host = document.createElement('div');
    host.innerHTML = plantSizePromptHtml();
    const previous = document.activeElement as HTMLElement | null;
    const done = (v: PlantSizeView) => { document.removeEventListener('keydown', onKey, true); host.remove(); previous?.focus?.(); resolve(v); };
    const focus = (step: 1 | -1) => {
      const btns = [...host.querySelectorAll<HTMLElement>('button')], i = btns.indexOf(document.activeElement as HTMLElement);
      btns[(i + step + btns.length) % btns.length]?.focus();
    };
    const onKey = (e: KeyboardEvent) => handlePromptKey(e, { done, focus });
    host.addEventListener('click', e => {
      const t = e.target as HTMLElement, c = t.closest<HTMLElement>('[data-choice]')?.dataset.choice as PlantSizeView | undefined;
      const v = plantSizeChoice({ choice: c, backdrop: t.hasAttribute('data-backdrop') });
      if (v) done(v);
    });
    document.addEventListener('keydown', onKey, true);
    document.body.append(host);
    host.querySelector<HTMLElement>('[data-choice="install"]')?.focus();
  });
}
