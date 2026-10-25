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
  test('with a keyboard the field is typeable, there is no keypad, and Done submits', () => {
    const html = edgeChip({ ...base, editing: true, keyboard: true, field: { value: '', placeholder: 'e.g. 116.45' } });
    expect(html).toContain('id="edge-len"');
    expect(html).not.toContain('readonly');
    expect(html).not.toContain('keypad');
    expect(html).toContain('inputmode="decimal"');
    expect(html).toMatch(/<button type="submit"[^>]*>Done<\/button>/);
  });
  test('the info button carries the tip', () => expect(edgeChip({ ...base, tip: 'Drag the square' })).toContain('title="Drag the square"'));
  test('the info button toggles the tip: aria-expanded, and the tip text shows only while open', () => {
    const closed = edgeChip({ ...base, tip: 'Drag the square' }), open = edgeChip({ ...base, tip: 'Drag the square', tipOpen: true });
    expect(closed).toContain('data-act="tip"'); expect(closed).toContain('aria-expanded="false"'); expect(closed).not.toContain('class="edge-tip"');
    expect(open).toContain('aria-expanded="true"'); expect(open).toMatch(/class="edge-tip"[^>]*>Drag the square</);
  });
  test('the tip also shows while editing', () =>
    expect(edgeChip({ ...base, editing: true, tipOpen: true, tip: 'Drag the square', field: { value: '', placeholder: '' } })).toContain('class="edge-tip"'));
});
