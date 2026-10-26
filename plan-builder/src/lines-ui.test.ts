import { describe, expect, test } from 'vitest';
import { lengthText } from './lines-ui';

describe('lengthText', () => {
  test('feet to one decimal when scaled, "no scale" otherwise', () => {
    expect(lengthText(62.04)).toBe('62 ft'); expect(lengthText(8.46)).toBe('8.5 ft'); expect(lengthText(null)).toBe('no scale');
  });
});
