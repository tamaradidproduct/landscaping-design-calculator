import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { LEGACY_MATERIAL_IDS, MATERIALS, materialsByFamily, normalizeMaterialId } from './materials';

const tokens = JSON.parse(readFileSync(new URL('../design-system/tokens.json', import.meta.url), 'utf8'));
const token = (name: string) => Object.values(tokens).flatMap((g: any) => g?.tokens ?? []).find((t: any) => t.name === name);

describe('materials', () => {
  test('29 library textures with unique ids and names', () => {
    expect(MATERIALS).toHaveLength(29);
    expect(new Set(MATERIALS.map(m => m.id)).size).toBe(29);
    expect(new Set(MATERIALS.map(m => m.name)).size).toBe(29);
  });
  test('grouped by family, in picker order', () => {
    const groups = materialsByFamily();
    expect(groups.map(g => g.family)).toEqual(['Turf & seed', 'Mulch & soil', 'Rock & gravel', 'Pavers & stone', 'Concrete', 'Decking']);
    groups.forEach(g => expect(g.materials.length).toBeGreaterThan(0));
    expect(groups.flatMap(g => g.materials)).toHaveLength(29);
  });
  test('every material has a tile, a thumbnail, a 10 ft repeat and an edge colour', () => {
    for (const m of MATERIALS) {
      expect(m.tile).toBeTruthy();
      expect(m.thumb).toBeTruthy();
      expect(m.tileFt).toBe(10);
      expect(m.edge).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  test('the 11 old ids map to valid materials', () => {
    expect(LEGACY_MATERIAL_IDS).toEqual({
      sod: 'premium-sod', turf: 'festival-turf', mulch: 'wood-mulch', 'river-rock': 'white-river-rock',
      'decorative-rock': 'mesa-cobble-stone', gravel: 'clear-mountain-granite', pavers: 'pavers-classic', flagstone: 'red-flagstone',
      'concrete-brushed': 'brushed-concrete', 'concrete-stamped': 'stamped-concrete', decking: 'deck-wood',
    });
    const ids = new Set(MATERIALS.map(m => m.id));
    Object.values(LEGACY_MATERIAL_IDS).forEach(id => expect(ids.has(id)).toBe(true));
  });
  test('normalizeMaterialId maps old ids, keeps current ones, rejects unknown', () => {
    expect(normalizeMaterialId('sod')).toBe('premium-sod');
    expect(normalizeMaterialId('sand')).toBe('sand');
    expect(normalizeMaterialId('nope')).toBeNull();
  });
  test('the flat material colours are gone from the tokens; the shade and edge mix stay', () => {
    for (const id of Object.keys(LEGACY_MATERIAL_IDS)) expect(token(`color-material-${id}`)).toBeUndefined();
    expect(token('color-material-shade')).toBeDefined();
    expect(token('mix-material-edge')).toBeDefined();
  });
  test('surfaces being edited are see-through at 0.5', () => expect(token('opacity-surface-editing')?.value).toBe('0.5'));
});
