import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { MATERIALS, materialsByTrade } from './materials';
import { materialFill, patternDefs } from './patterns';

const tokens = JSON.parse(readFileSync(new URL('../design-system/tokens.json', import.meta.url), 'utf8'));
const tokenNames = new Set<string>(Object.values(tokens).flatMap((g: any) => (g?.tokens ?? []).map((t: any) => t.name)));
const token = (name: string) => Object.values(tokens).flatMap((g: any) => g?.tokens ?? []).find((t: any) => t.name === name);

describe('materials', () => {
  test('the starter list, in order, with unique ids', () => {
    const ids = MATERIALS.map(m => m.id);
    expect(ids).toEqual(['sod', 'turf', 'mulch', 'river-rock', 'decorative-rock', 'gravel', 'pavers', 'flagstone', 'concrete-brushed', 'concrete-stamped', 'decking']);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test('grouped by trade', () => {
    expect(materialsByTrade('hardscape').map(m => m.id)).toEqual(['gravel', 'pavers', 'flagstone', 'concrete-brushed', 'concrete-stamped', 'decking']);
    expect(materialsByTrade('softscape').map(m => m.id)).toEqual(['sod', 'turf', 'mulch', 'river-rock', 'decorative-rock']);
  });
  test('every colour is a defined token named after the material', () => {
    for (const m of MATERIALS) {
      expect(m.color).toBe(`color-material-${m.id}`);
      expect(tokenNames.has(m.color)).toBe(true);
    }
  });
  test('a fill pattern per material', () => {
    const defs = patternDefs();
    for (const m of MATERIALS) expect(defs).toContain(`id="material-${m.id}"`);
    expect(materialFill('pavers')).toBe('url(#material-pavers)');
  });
  test('surfaces being edited are see-through at 0.5', () => expect(token('opacity-surface-editing')?.value).toBe('0.5'));
});
