import { describe, expect, test } from 'vitest';
import { topBarHtml, plantToggleHtml, EXPORT_NOTE } from './top-bar';
import { showPlantToggle } from './plant-size';

const base = { name: '12 Oak St', view: 'edit' as const, canUndo: false, canRedo: false };

describe('topBarHtml', () => {
  test('has back, undo, redo and export', () => {
    const h = topBarHtml(base);
    for (const id of ['back-to-plans', 'plan-title', 'plan-more', 'view-switch', 'undo', 'redo', 'export']) expect(h).toContain(`id="${id}"`);
  });
  test('undo and redo are disabled from the state', () => {
    expect(topBarHtml(base)).toMatch(/id="undo"[^>]*disabled/);
    expect(topBarHtml({ ...base, canUndo: true })).not.toMatch(/id="undo"[^>]*disabled/);
    expect(topBarHtml({ ...base, canRedo: true })).not.toMatch(/id="redo"[^>]*disabled/);
  });
  test('the active view is pressed', () => {
    expect(topBarHtml({ ...base, view: 'preview' })).toMatch(/data-view="preview"[^>]*aria-pressed="true"/);
    expect(topBarHtml(base)).toMatch(/data-view="edit"[^>]*aria-pressed="true"/);
  });
  test('escapes the name', () => {
    expect(topBarHtml({ ...base, name: '<b>' })).toContain('&lt;b&gt;');
  });
  test('export note', () => { expect(EXPORT_NOTE).toBe('Export is coming soon'); });
  describe('plant size toggle', () => {
    test('install is pressed, with full and short labels, between the view switch and the right cluster', () => {
      const h = topBarHtml({ ...base, plantView: 'install' });
      expect(h).toContain('id="plant-view-switch"');
      expect(h).toMatch(/data-plantview="install"[^>]*aria-pressed="true"/);
      expect(h).not.toMatch(/data-plantview="mature"[^>]*aria-pressed/);
      expect(h).toContain('<span class="label-full">Install</span><span class="label-short">Now</span>');
      expect(h).toContain('<span class="label-full">Mature</span><span class="label-short">Grown</span>');
      expect(h.indexOf('id="view-switch"')).toBeLessThan(h.indexOf('id="plant-view-switch"'));
      expect(h.indexOf('id="plant-view-switch"')).toBeLessThan(h.indexOf('class="top-bar-right"'));
    });
    test('mature is pressed', () => {
      expect(topBarHtml({ ...base, plantView: 'mature' })).toMatch(/data-plantview="mature"[^>]*aria-pressed="true"/);
    });
    test('hidden without a plantView', () => {
      expect(topBarHtml(base)).not.toContain('plant-view-switch');
      expect(plantToggleHtml(undefined)).toBe('');
    });
  });
});
describe('showPlantToggle', () => {
  test('needs a plant with containers', () => {
    expect(showPlantToggle([])).toBe(false);
    expect(showPlantToggle(['no-such-symbol'])).toBe(false);
  });
});
