import { describe, expect, test } from 'vitest';
import { edgeChip } from './edge-chip';

const base = { text: '115.00′', editing: false, menu: [], menuOpen: false, tip: 'x' };

describe('edgeChip', () => {
  test('shows the length as a button; no menu button without items', () => {
    const html = edgeChip(base);
    expect(html).toContain('115.00′');
    expect(html).toContain('data-act="edit-length"');
    expect(html).not.toContain('data-act="menu"');
  });
  test('a menu button appears when there are items', () =>
    expect(edgeChip({ ...base, menu: [{ act: 'straighten', label: 'Make straight' }] })).toContain('data-act="menu"'));
  test('an open menu lists the items', () =>
    expect(edgeChip({ ...base, menu: [{ act: 'straighten', label: 'Make straight' }], menuOpen: true })).toContain('data-act="straighten"'));
  test('editing swaps the length for the readonly field and the keypad', () => {
    const html = edgeChip({ ...base, editing: true, field: { value: '', placeholder: 'e.g. 116.45' } });
    expect(html).toContain('id="edge-len"');
    expect(html).toContain('readonly');
    expect(html).toContain('keypad');
    expect(html).not.toContain('data-act="edit-length"');
  });
  test('the info button carries the tip', () => expect(edgeChip({ ...base, tip: 'Drag the square' })).toContain('title="Drag the square"'));
});
