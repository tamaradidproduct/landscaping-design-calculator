import { describe, expect, test } from 'vitest';
import { SYMBOL_SOURCES } from '../scripts/symbol-sources.mjs';
import { SYMBOL_SIZES } from '../scripts/symbol-sizes.mjs';
import { PLANT_INSTALL_SIZES } from '../scripts/plant-install-sizes.mjs';

const SHRUBS_WITH_5_GAL = ['lilacs', 'dogwood', 'lavender', 'hydrangea', 'fernbush', 'japanese-fern', 'panchito-manzanita', 'mugo-pine', 'rubber-rabbitbrush', 'boxwood', 'globe-pine', 'golden-bamboo'];
const plants = SYMBOL_SOURCES.filter(s => s.kind === 'plant');

describe('plant install sizes', () => {
  test('every plant has an entry and nothing else does', () => {
    expect(Object.keys(PLANT_INSTALL_SIZES).sort()).toEqual(plants.map(s => s.id).sort());
  });
  test('default is the last entry; trees and 5 gal shrubs have two entries', () => {
    for (const s of plants) {
      const install = PLANT_INSTALL_SIZES[s.id].install;
      const names = install.map(x => x.container);
      expect(new Set(names).size, s.id).toBe(names.length);
      expect(install.length, s.id).toBeLessThanOrEqual(2);
      if (/trees$/.test(s.family)) expect(install.length, s.id).toBe(2);
      if (['corn', 'vegetable-plants'].includes(s.id)) expect(install.length, s.id).toBe(0);
      if (names.includes('5 gal') && names.includes('1 gal')) expect(names, s.id).toEqual(['1 gal', '5 gal']);
    }
    for (const id of SHRUBS_WITH_5_GAL) expect(PLANT_INSTALL_SIZES[id].install.map(x => x.container), id).toEqual(['1 gal', '5 gal']);
  });
  test('install sizes grow and stay under the mature spread', () => {
    for (const s of plants) {
      const sizes = PLANT_INSTALL_SIZES[s.id].install.map(x => x.d);
      sizes.forEach((d, i) => { expect(d, s.id).toBeGreaterThan(0); if (i) expect(d, s.id).toBeGreaterThan(sizes[i - 1]); });
      if (sizes.length) expect(Math.max(...sizes), s.id).toBeLessThanOrEqual(SYMBOL_SIZES[s.id].w);
    }
  });
  test('every install size names its container', () => {
    for (const [id, p] of Object.entries(PLANT_INSTALL_SIZES)) for (const x of p.install) expect(x.container.length, id).toBeGreaterThan(0);
  });
});
