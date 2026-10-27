import { describe, expect, it } from 'vitest';
import { needsPlantSizePrompt, plantSizePromptHtml, plantSizeChoice } from './plant-size-prompt';
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
