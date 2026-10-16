import { describe, expect, test } from 'vitest';
import { History } from './history';

describe('History', () => {
  test('undo returns the state before the last change; redo returns it back', () => {
    const h = new History<number>();
    h.record(1); // state was 1, about to become 2
    h.record(2); // 2 → 3
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBe(1);
    expect(h.undo(1)).toBeNull();
    expect(h.redo(1)).toBe(2);
    expect(h.redo(2)).toBe(3);
    expect(h.redo(3)).toBeNull();
  });
  test('a new change after undo clears redo', () => {
    const h = new History<string>();
    h.record('a'); h.record('b');
    expect(h.undo('c')).toBe('b');
    h.record('b'); // new change from b
    expect(h.canRedo).toBe(false);
    expect(h.undo('d')).toBe('b');
  });
  test('reports what can be undone or redone', () => {
    const h = new History<number>();
    expect([h.canUndo, h.canRedo]).toEqual([false, false]);
    h.record(0);
    expect([h.canUndo, h.canRedo]).toEqual([true, false]);
    h.undo(1);
    expect([h.canUndo, h.canRedo]).toEqual([false, true]);
  });
  test('keeps at most `limit` steps', () => {
    const h = new History<number>(3);
    for (let i = 0; i < 5; i++) h.record(i);
    expect(h.undo(5)).toBe(4);
    expect(h.undo(4)).toBe(3);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBeNull();
  });
  test('clear empties undo and redo', () => {
    const h = new History<number>();
    h.record(0); h.record(1); h.undo(2);
    h.clear();
    expect([h.canUndo, h.canRedo]).toEqual([false, false]);
  });
});
