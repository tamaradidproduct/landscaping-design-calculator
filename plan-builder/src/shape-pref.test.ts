import { describe, expect, test } from 'vitest';
import { DEFAULT_SHAPES, loadShapes, shapeGroup, shapeKey } from './shape-pref';

describe('shape preferences', () => {
  test('outlines default to Freehand, surfaces to Rectangle', () => {
    expect(loadShapes(() => null)).toEqual({ outline: 'freehand', surface: 'rect' });
    expect(DEFAULT_SHAPES).toEqual({ outline: 'freehand', surface: 'rect' });
  });
  test('each kind remembers its own choice', () => {
    const store: Record<string, string> = { [shapeKey('surface')]: 'freehand', [shapeKey('outline')]: 'rect' };
    expect(loadShapes(k => store[k] ?? null)).toEqual({ outline: 'rect', surface: 'freehand' });
  });
  test('the old shared key and junk values are ignored', () => {
    const store: Record<string, string> = { 'plan-builder.shape': 'rect', [shapeKey('outline')]: 'blob' };
    expect(loadShapes(k => store[k] ?? null)).toEqual(DEFAULT_SHAPES);
  });
  test('blocked storage gives the defaults', () => {
    expect(loadShapes(() => { throw new Error('blocked'); })).toEqual(DEFAULT_SHAPES);
  });
  test('boundary and features are outlines; zones are surfaces', () => {
    expect(['boundary', 'feature', null].map(k => shapeGroup(k as never))).toEqual(['outline', 'outline', 'outline']);
    expect(shapeGroup('surface')).toBe('surface');
  });
});
