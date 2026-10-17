// How new layers are drawn: Freehand for outlines (plot boundary, existing features), Rectangle for surfaces.
// A choice made while drawing is remembered per kind, on this device only.
import type { OutlineKind, OutlineShape } from './outline';

export type ShapeGroup = 'outline' | 'surface';
export type ShapePrefs = Record<ShapeGroup, OutlineShape>;

export const DEFAULT_SHAPES: ShapePrefs = { outline: 'freehand', surface: 'rect' };
export const shapeGroup = (kind: OutlineKind | null): ShapeGroup => kind === 'surface' ? 'surface' : 'outline';
export const shapeKey = (g: ShapeGroup) => `plan-builder.shape.${g}`;

/** The remembered choice per kind; anything missing, unreadable or unknown falls back to its default. */
export function loadShapes(read: (key: string) => string | null): ShapePrefs {
  const get = (g: ShapeGroup): OutlineShape => {
    let v: string | null = null;
    try { v = read(shapeKey(g)); } catch { /* storage blocked */ }
    return v === 'rect' || v === 'freehand' ? v : DEFAULT_SHAPES[g];
  };
  return { outline: get('outline'), surface: get('surface') };
}
