import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { handlePromptKey, needsPlantSizePrompt, plantSizePromptHtml, plantSizeChoice } from './plant-size-prompt';
import { SYMBOLS } from './symbols';

const plant = SYMBOLS.find(s => s.kind === 'plant')!.id;
const object = SYMBOLS.find(s => s.kind !== 'plant')!.id;
const placed = (...ids: string[]) => Object.fromEntries(ids.map((symbol, i) => [`s${i}`, { symbol }]));

describe('needsPlantSizePrompt', () => {
  it('is false for a new plan', () => expect(needsPlantSizePrompt({})).toBe(false));
  it('is false when the field is set', () => {
    expect(needsPlantSizePrompt({ plantSizeView: 'mature', symbols: placed(plant) })).toBe(false);
    expect(needsPlantSizePrompt({ plantSizeView: 'install', symbols: placed(plant) })).toBe(false);
  });
  it('is false for an objects-only plan', () => expect(needsPlantSizePrompt({ symbols: placed(object) })).toBe(false));
  it('is true for plants and no field', () => {
    expect(needsPlantSizePrompt({ symbols: placed(plant) })).toBe(true);
    expect(needsPlantSizePrompt({ symbols: placed(object, plant) })).toBe(true);
  });
});

describe('plantSizePromptHtml', () => {
  const html = plantSizePromptHtml();
  it('has the title, body and both buttons', () => {
    expect(html).toContain('Show plants at install size?');
    expect(html).toContain('This plan draws plants at their mature size. You can switch any time from the top bar.');
    expect(html).toContain('Install size');
    expect(html).toContain('Keep mature');
  });
  it('is a dialog with Install size autofocused and default (44 px) buttons', () => {
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toMatch(/<button(?=[^>]*autofocus)[^>]*data-choice="install"/);
    expect(html).not.toMatch(/class="[^"]*compact/);
  });
});

describe('plantSizeChoice', () => {
  it('maps clicks, Escape and the backdrop', () => {
    expect(plantSizeChoice({ choice: 'install' })).toBe('install');
    expect(plantSizeChoice({ choice: 'mature' })).toBe('mature');
    expect(plantSizeChoice({ key: 'Escape' })).toBe('mature');
    expect(plantSizeChoice({ backdrop: true })).toBe('mature');
    expect(plantSizeChoice({ key: 'a' })).toBeUndefined();
  });
});

describe('handlePromptKey', () => {
  const run = (key: string, shiftKey = false) => {
    const e = { key, shiftKey, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    const ctx = { done: vi.fn(), focus: vi.fn() };
    handlePromptKey(e, ctx);
    return { e, ctx };
  };
  it('Escape keeps Mature and the editor behind never sees it', () => {
    const { e, ctx } = run('Escape');
    expect(ctx.done).toHaveBeenCalledWith('mature');
    expect(e.preventDefault).toHaveBeenCalled();
    expect(e.stopPropagation).toHaveBeenCalled();
  });
  it('Tab and Shift+Tab move focus within the dialog, and stop there', () => {
    const t = run('Tab'), b = run('Tab', true);
    expect(t.ctx.focus).toHaveBeenCalledWith(1); expect(b.ctx.focus).toHaveBeenCalledWith(-1);
    expect(t.e.stopPropagation).toHaveBeenCalled(); expect(t.e.preventDefault).toHaveBeenCalled();
  });
  it('every other key stops at the dialog (no undo, delete, nudge or shortcut behind it) but keeps its default (Enter presses the button)', () => {
    for (const k of ['z', 'Delete', 'Backspace', 'ArrowLeft', 'x', 'Enter', ' ']) {
      const { e, ctx } = run(k);
      expect(e.stopPropagation).toHaveBeenCalled();
      expect(e.preventDefault).not.toHaveBeenCalled();
      expect(ctx.done).not.toHaveBeenCalled();
    }
  });
});

describe('modal styles', () => {
  const css = readFileSync(new URL('./styles/plans.css', import.meta.url), 'utf8');
  const rule = css.match(/\.modal-backdrop \{[^}]*\}/)?.[0] ?? '';
  it('use tokens for the layer and the scrim', () => {
    expect(rule).toMatch(/z-index: [^;]*var\(--z-/);
    expect(rule).not.toMatch(/rgb\(|rgba\(/);
  });
});
