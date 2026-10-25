// The plot fill: one surface that covers the whole plot and follows the plot boundary's shape. It is an ordinary surface outline
// flagged `base`, kept last (lowest) among the surfaces so everything drawn on it cuts it out. Pure helpers; OutlineTool calls
// syncFill on every update.
import type { MaterialId } from './materials';
import type { Outline } from './outline';

export const FILL_ID = 'fill';
const BOUNDARY = 'boundary';

/** The boundary's shape as copies (points, bends, corner radii), for a fill to wear. */
const shapeOf = (b: Outline): Pick<Outline, 'pts' | 'bulges' | 'radii'> => ({
  pts: b.pts.map(p => ({ ...p })), ...(b.bulges ? { bulges: [...b.bulges] } : {}), ...(b.radii ? { radii: [...b.radii] } : {}),
});

const samePoints = (a: Outline['pts'], b: Outline['pts']): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  }
  return true;
};

const sameNumbers = (a?: number[], b?: number[]): boolean => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

/** A new plot fill of a material, in the boundary's shape. */
export const fillOutline = (boundary: Outline, material: MaterialId): Outline =>
  ({ id: FILL_ID, kind: 'surface', name: 'Plot fill', closed: true, base: true, material, ...shapeOf(boundary) });

/** The map with the fill's key last (the others keep their order); the same map when there is no fill or it is already last. */
export function keepFillLast(outlines: Record<string, Outline>): Record<string, Outline> {
  const keys = Object.keys(outlines);
  if (!outlines[FILL_ID] || keys[keys.length - 1] === FILL_ID) return outlines;
  const { [FILL_ID]: fill, ...rest } = outlines;
  return { ...rest, [FILL_ID]: fill };
}

/**
 * The outlines with the fill in step with the boundary: it takes the boundary's points, bends and radii and goes last; with no
 * boundary it is removed; while the boundary is being redrawn (or is not closed) it keeps its last shape. No fill: the same map.
 */
export function syncFill(outlines: Record<string, Outline>, boundaryDrawing: boolean): Record<string, Outline> {
  const fill = outlines[FILL_ID];
  if (!fill?.base) return outlines;
  const b = outlines[BOUNDARY];
  if (!b) { const { [FILL_ID]: _gone, ...rest } = outlines; return rest; }
  if (boundaryDrawing || !b.closed) return outlines;
  if (samePoints(fill.pts, b.pts) && sameNumbers(fill.bulges, b.bulges) && sameNumbers(fill.radii, b.radii)) return keepFillLast(outlines);
  const shape = shapeOf(b);
  const { bulges: _b, radii: _r, ...kept } = fill;
  return keepFillLast({ ...outlines, [FILL_ID]: { ...kept, ...shape } });
}
