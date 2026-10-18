import { describe, expect, test } from 'vitest';
import { LINE_ITEMS, LINE_WIDTH_FT, clampLineWidth, lineItemById, searchLineItems, stepLineWidth } from './line-items';

describe('line items', () => {
  test('five items in picker order', () => {
    expect(LINE_ITEMS.map(i => i.id)).toEqual(['wood-privacy-fence', 'veneer-wall', 'retaining-wall', 'white-stone-edging', 'dry-river']);
  });
  test('default widths come from the Figma stroke at 36 px per ft', () => {
    expect(LINE_ITEMS.map(i => i.defaultWidthFt)).toEqual([0.33, 0.33, 0.33, 0.33, 0.55]);
  });
  test('every item has art, a thumbnail, a #rrggbb colour and positive art size; only the dry river has flat caps', () => {
    for (const i of LINE_ITEMS) {
      expect(i.art, i.id).toBeTruthy(); expect(i.thumb, i.id).toBeTruthy(); expect(i.color, i.id).toMatch(/^#[0-9a-f]{6}$/);
      expect(i.artWidthPx, i.id).toBeGreaterThan(0); expect(i.artLengthPx, i.id).toBeGreaterThan(0);
      expect(i.roundCaps, i.id).toBe(i.id !== 'dry-river');
    }
  });
  test('lineItemById and searchLineItems', () => {
    expect(lineItemById('dry-river')?.name).toBe('Dry river'); expect(lineItemById('nope')).toBeUndefined();
    expect(searchLineItems('FENCE').map(i => i.id)).toEqual(['wood-privacy-fence']);
    expect(searchLineItems('')).toHaveLength(5); expect(searchLineItems('zzz')).toEqual([]);
  });
  test('clampLineWidth keeps 0.25–12 ft in 0.25 steps', () => {
    expect(LINE_WIDTH_FT).toEqual({ min: 0.25, max: 12, step: 0.25 });
    expect(clampLineWidth(0.1)).toBe(0.25); expect(clampLineWidth(40)).toBe(12); expect(clampLineWidth(1.13)).toBe(1.25); expect(clampLineWidth(Number.NaN)).toBe(0.25);
  });
  test('stepLineWidth moves onto the next 0.25 ft step, within the limits', () => {
    expect(stepLineWidth(0.33, 1)).toBe(0.5); expect(stepLineWidth(0.33, -1)).toBe(0.25);
    expect(stepLineWidth(1, 1)).toBe(1.25); expect(stepLineWidth(1, -1)).toBe(0.75);
    expect(stepLineWidth(12, 1)).toBe(12); expect(stepLineWidth(0.25, -1)).toBe(0.25);
  });
});
