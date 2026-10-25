import { describe, expect, test } from 'vitest';
import { applyKeypadKey, button, lineIcon, numericKeypad, segmented, type KeypadKey } from './ui';
import { parseFeet } from './outline';

const type = (keys: KeypadKey[]) => keys.reduce((v, k) => applyKeypadKey(v, k), '');

describe('applyKeypadKey (edge-length / zone-resize numeric keypad)', () => {
  test('builds up a decimal value key by key', () => {
    expect(type(['1', '1', '6', '.', '4', '5'])).toBe('116.45');
  });
  test('builds up a feet-inches value key by key, and it submits (parses) to the right length', () => {
    const value = type(['1', '1', '6', "'", '5', '"']);
    expect(value).toBe(`116'5"`);
    expect(parseFeet(value)).toBeCloseTo(116 + 5 / 12, 9);
  });
  test('backspace drops the last character typed', () => {
    expect(type(['1', '2', '3', 'back'])).toBe('12');
    expect(applyKeypadKey('', 'back')).toBe('');
  });
  test('clear empties the value outright', () => {
    expect(applyKeypadKey('116.45', 'clear')).toBe('');
  });
  test('done leaves the value as-is — the caller submits the form', () => {
    expect(applyKeypadKey('116.45', 'done')).toBe('116.45');
  });
});

describe('numericKeypad', () => {
  test('renders digits 0-9, the feet/inches/decimal marks, backspace, clear and done — one key each', () => {
    const html = numericKeypad();
    for (const k of '0123456789') expect(html).toContain(`data-key="${k}"`);
    expect(html).toContain('data-key="&#39;"'); // feet mark ( ' )
    expect(html).toContain('data-key="&quot;"'); // inches mark ( " )
    expect(html).toContain('data-key="."');
    expect(html).toContain('data-key="back"');
    expect(html).toContain('data-key="clear"');
    expect(html).toContain('data-key="done"');
  });
});

describe('title, lineIcon and segmented', () => {
  test('button carries a title', () => { expect(button('x', { title: 'Undo (⌘Z)' })).toContain('title="Undo (⌘Z)"'); });
  test('segmented marks the pressed option', () => {
    const h = segmented('s', 'View', 'view', [{ label: 'A', value: 'a', pressed: true }, { label: 'B', value: 'b', pressed: false }]);
    expect(h).toMatch(/data-view="a"[^>]*aria-pressed="true"/);
    expect(h).not.toMatch(/data-view="b"[^>]*aria-pressed/);
  });
  test('lineIcon draws the path', () => { expect(lineIcon('M0 0')).toContain('d="M0 0"'); });
});
