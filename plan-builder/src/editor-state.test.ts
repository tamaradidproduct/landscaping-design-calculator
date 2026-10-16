import { describe, expect, test } from 'vitest';
import { committedOutlines } from './editor-state';
import type { Outline } from './outline';

const o = (id: string, name = id): Outline => ({ id, kind: 'feature', name, pts: [], closed: true });

describe('committedOutlines', () => {
  const all = { a: o('a'), b: o('b', 'new') };
  test('keeps everything when nothing is being drawn', () => {
    expect(committedOutlines(all, null, null)).toEqual(all);
  });
  test('drops an outline still being drawn', () => {
    expect(Object.keys(committedOutlines(all, 'b', null))).toEqual(['a']);
  });
  test('puts back the outline being redrawn', () => {
    expect(committedOutlines(all, 'b', o('b', 'old')).b!.name).toBe('old');
  });
  test('returns deep copies', () => {
    const r = committedOutlines(all, null, null);
    expect(r.a).not.toBe(all.a);
  });
});
