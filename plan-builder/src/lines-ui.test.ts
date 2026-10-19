import { describe, expect, test } from 'vitest';
import { linePickerList, lengthText } from './lines-ui';

describe('line picker', () => {
  test('lists every item with a data-line-item row', () => {
    const html = linePickerList('');
    for (const id of ['wood-privacy-fence', 'veneer-wall', 'retaining-wall', 'white-stone-edging', 'dry-river']) expect(html).toContain(`data-line-item="${id}"`);
  });
  test('a query narrows the rows; no match says so', () => {
    const fence = linePickerList('fence');
    expect(fence).toContain('data-line-item="wood-privacy-fence"'); expect(fence).not.toContain('data-line-item="dry-river"');
    expect(linePickerList('zzz')).toContain('No line matches.');
  });
});

describe('lengthText', () => {
  test('feet to one decimal when scaled, "no scale" otherwise', () => {
    expect(lengthText(62.04)).toBe('62 ft'); expect(lengthText(8.46)).toBe('8.5 ft'); expect(lengthText(null)).toBe('no scale');
  });
});
