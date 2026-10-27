import { describe, expect, test } from 'vitest';
import { topBarHtml, EXPORT_NOTE } from './top-bar';

const base = { name: '12 Oak St', view: 'edit' as const, canUndo: false, canRedo: false };

describe('topBarHtml', () => {
  test('has back, undo, redo and export', () => {
    const h = topBarHtml(base);
    for (const id of ['back-to-plans', 'plan-title', 'plan-more', 'view-switch', 'undo', 'redo', 'export']) expect(h).toContain(`id="${id}"`);
  });
  test('back and plan actions use full-size icon tap targets', () => {
    const h = topBarHtml(base);
    for (const id of ['back-to-plans', 'plan-more']) {
      expect(h).toMatch(new RegExp(`<button[^>]*id="${id}"[^>]*class="icon"`));
    }
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
});
