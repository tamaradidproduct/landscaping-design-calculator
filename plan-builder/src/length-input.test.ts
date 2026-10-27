import { describe, expect, test } from 'vitest';
import { filterLengthChars, filteredLengthCursor, hasKeyboardInput } from './length-input';

const mm = (matches: Record<string, boolean>) => ({ matchMedia: (q: string) => ({ matches: matches[q] ?? false }) });

describe('hasKeyboardInput', () => {
  test('a mouse or trackpad (hover + fine pointer) means a keyboard types the length', () =>
    expect(hasKeyboardInput(mm({ '(hover: hover) and (pointer: fine)': true }))).toBe(true));
  test('a touch-primary device (iPad) keeps the on-screen keypad', () =>
    expect(hasKeyboardInput(mm({}))).toBe(false));
  test('no matchMedia means the keypad', () => expect(hasKeyboardInput({})).toBe(false));
});

describe('filterLengthChars', () => {
  test('keeps the keypad characters plus the slash and spaces', () =>
    expect(filterLengthChars(`116' 5.5"`)).toBe(`116' 5.5"`));
  test('normalizes curly prime marks to the keypad marks', () =>
    expect(filterLengthChars('116′ 5″')).toBe(`116' 5"`));
  test('drops letters and other symbols', () => expect(filterLengthChars('12a-b,3e')).toBe('123'));
});

describe('filteredLengthCursor', () => {
  test('keeps the cursor position when normalizing a prime mark', () =>
    expect(filteredLengthCursor('12′', 3)).toBe(3));
  test('moves the cursor back by only the removed characters before it', () =>
    expect(filteredLengthCursor('1a2b3', 4)).toBe(2));
});
