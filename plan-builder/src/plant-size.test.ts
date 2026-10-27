import { describe, expect, test } from 'vitest';
import { SYMBOL_SIZES } from '../scripts/symbol-sizes.mjs';
import { symbolById } from './symbols';
import { clampCustom, containersFor, defaultContainer, effectiveView, normalizeChoice, plantDiameter, sizeLabel } from './plant-size';

const IDS = ['blue-diamond-spruce', 'lavender', 'corn', 'oak', 'firepit'];

describe('plantDiameter', () => {
  test('mature equals the mature spread', () => {
    for (const id of IDS.filter(i => i !== 'firepit')) expect(plantDiameter(id, {}, 'mature'), id).toBe(SYMBOL_SIZES[id].w);
    // objects are fitted to their art aspect, so use the library symbol width
    expect(plantDiameter('firepit', {}, 'mature')).toBe(symbolById('firepit')!.size.w);
  });
  test('install defaults to the last container', () => {
    const list = containersFor('blue-diamond-spruce');
    expect(plantDiameter('blue-diamond-spruce', {}, 'install')).toBe(list[list.length - 1].d);
    expect(defaultContainer('blue-diamond-spruce')).toEqual(list[list.length - 1]);
  });
  test('install honours a chosen container', () => {
    const first = containersFor('blue-diamond-spruce')[0];
    expect(plantDiameter('blue-diamond-spruce', { container: first.container }, 'install')).toBe(first.d);
  });
  test('install honours a custom size', () => {
    expect(plantDiameter('blue-diamond-spruce', { customInstall: 6 }, 'install')).toBe(6);
  });
  test('unknown container falls back to default', () => {
    expect(plantDiameter('blue-diamond-spruce', { container: 'nope' }, 'install')).toBe(defaultContainer('blue-diamond-spruce')!.d);
  });
  test('corn uses mature spread in both views', () => {
    expect(plantDiameter('corn', {}, 'install')).toBe(SYMBOL_SIZES.corn.w);
    expect(plantDiameter('corn', {}, 'mature')).toBe(SYMBOL_SIZES.corn.w);
  });
});

describe('containers and clamp', () => {
  test('no containers for corn or objects', () => {
    expect(containersFor('corn')).toEqual([]);
    expect(containersFor('firepit')).toEqual([]);
    expect(defaultContainer('corn')).toBeNull();
  });
  test('clampCustom', () => {
    expect(clampCustom('blue-diamond-spruce', 99)).toBe(10);
    expect(clampCustom('lavender', 0)).toBeNull();
    expect(clampCustom('lavender', -1)).toBeNull();
    expect(clampCustom('lavender', NaN)).toBeNull();
    expect(clampCustom('corn', 1)).toBeNull();
  });
});

describe('sizeLabel', () => {
  test('spruce labels', () => {
    expect(sizeLabel('blue-diamond-spruce', {}, 'install')).toBe('6 ft B&B (4.5 ft)');
    expect(sizeLabel('blue-diamond-spruce', { customInstall: 6 }, 'install')).toBe('Custom 6 ft');
    expect(sizeLabel('blue-diamond-spruce', {}, 'mature')).toBe('10 ft');
  });
  test('corn and objects', () => {
    expect(sizeLabel('corn', {}, 'install')).toBe('1 ft');
    expect(sizeLabel('corn', {}, 'mature')).toBe('1 ft');
    expect(sizeLabel('firepit', {}, 'install')).toBe('');
  });
});

describe('effectiveView', () => {
  test('defaults by whether plants exist', () => {
    expect(effectiveView(undefined, true)).toBe('mature');
    expect(effectiveView(undefined, false)).toBe('install');
    expect(effectiveView('install', true)).toBe('install');
  });
});

describe('normalizeChoice', () => {
  test('drops invalid values', () => {
    expect(normalizeChoice('lavender', { container: 'nope', customInstall: 0 })).toEqual({});
  });
  test('custom wins and clamps', () => {
    expect(normalizeChoice('lavender', { container: '1 gal', customInstall: 50 })).toEqual({ customInstall: SYMBOL_SIZES.lavender.w });
  });
});
