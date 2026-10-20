// How much of each material the plan uses: the VISIBLE part of every surface (clipped to the plot boundary, with the house, existing
// features and any surface above it cut out), summed per material. Pure; square points (see OutlineTool.surfaceAreasSqft for feet).
import { shapeArea, type Shape } from './overlap';
import type { Outline } from './outline';

/** Visible area in square points per material id, over the closed surfaces that have a material (a wholly covered one counts 0). */
export function surfaceAreasPt2(outlines: readonly Outline[], visible: ReadonlyMap<string, Shape>): Map<string, number> {
  const out = new Map<string, number>();
  for (const o of outlines) {
    if (o.kind !== 'surface' || !o.closed || !o.material) continue;
    const shape = visible.get(o.id);
    out.set(o.material, (out.get(o.material) ?? 0) + (shape ? Math.max(0, shapeArea(shape)) : 0));
  }
  return out;
}
