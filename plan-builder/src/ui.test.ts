import { describe, expect, test } from 'vitest';
import { applyKeypadKey, canvasNudgePad, disclosure, iconButton, layerRow, numericKeypad, type KeypadKey } from './ui';
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

describe('slim-card primitives', () => {
  test('iconButton carries its label, title, danger class and an inline icon', () => {
    const html = iconButton('trash', { ariaLabel: 'Delete', variant: 'danger', data: { act: 'delete' } });
    expect(html).toContain('aria-label="Delete"');
    expect(html).toContain('title="Delete"');
    expect(html).toMatch(/class="[^"]*\bdanger\b/);
    expect(html).toContain('<svg class="line-icon"');
    expect(html).toContain('data-act="delete"');
  });
  test('iconButton can be pressed', () => {
    expect(iconButton('info', { ariaLabel: 'Info', pressed: true })).toContain('aria-pressed="true"');
  });
  test('layerRow with a grip prefixes a reorder handle inside a layer-item', () => {
    const html = layerRow('Lawn', { swatch: 'feature', grip: true, data: { layer: 'o1' } });
    expect(html).toContain('data-grip="o1"');
    expect(html).toContain('aria-label="Reorder Lawn"');
    expect(html).toContain('class="layer-item"');
  });
  test('layerRow grip uses the zone id when there is no layer', () => {
    expect(layerRow('Sod', { swatch: 'feature', grip: true, data: { zone: 'z9' } })).toContain('data-grip="z9"');
  });
  test('disclosure shows its body only when open', () => {
    const closed = disclosure('adjust', 'Adjust shape and texture', false, '<p>x</p>');
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain('data-disclosure="adjust"');
    expect(closed).not.toContain('<p>x</p>');
    const open = disclosure('adjust', 'Adjust shape and texture', true, '<p>x</p>');
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain('<p>x</p>');
  });
  test('canvasNudgePad has four nudge buttons', () => {
    const html = canvasNudgePad();
    expect(html.match(/data-nudge="/g)).toHaveLength(4);
    expect(html).toContain('class="nudge-pad"');
  });
});
