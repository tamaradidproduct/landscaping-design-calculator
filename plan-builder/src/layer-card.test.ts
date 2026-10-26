import { describe, expect, test } from 'vitest';
import { editActions } from './layer-card';

describe('editActions', () => {
  test('a custom outline gets Redraw, Duplicate as surface and Delete, in that order', () => {
    const h = editActions(true, true);
    const acts = [...h.matchAll(/data-act="([\w-]+)"/g)].map(m => m[1]);
    expect(acts).toEqual(['redraw', 'duplicate-surface', 'delete']);
    expect(h).toMatch(/data-act="duplicate-surface" aria-label="Duplicate as surface" title="Duplicate as surface"/);
  });
  test('without the flag (the House, surfaces) there is no Duplicate as surface', () => {
    expect(editActions(true)).not.toContain('duplicate-surface');
    expect(editActions(false)).not.toContain('duplicate-surface');
  });
});
