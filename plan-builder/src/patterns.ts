// Fill patterns for surfaces: one SVG <pattern> per material, defined once in the document and used by the plan
// overlay and the Layers swatches alike. Drawn in screen pixels, so they don't grow with zoom.
import { MATERIALS, type MaterialId, type PatternId } from './materials';

/** Tile size and marks per pattern; marks use `currentColor` (the material shaded with color-material-shade at mix-material-edge). */
const TILES: Record<PatternId, { w: number; h: number; marks: string }> = {
  plain: { w: 8, h: 8, marks: '' },
  lines: { w: 6, h: 6, marks: '<path d="M0 3H6" stroke="currentColor" stroke-width="0.6"/>' },
  speckle: { w: 10, h: 10, marks: '<circle cx="2" cy="3" r="0.9"/><circle cx="7" cy="1.5" r="0.7"/><circle cx="5" cy="7.5" r="0.9"/><circle cx="9" cy="6" r="0.6"/>' },
  pebbles: { w: 12, h: 12, marks: '<g fill="none" stroke="currentColor" stroke-width="0.7"><ellipse cx="3" cy="3" rx="2.2" ry="1.6"/><ellipse cx="9" cy="5" rx="1.8" ry="1.4"/><ellipse cx="5" cy="9.5" rx="2" ry="1.5"/></g>' },
  dots: { w: 5, h: 5, marks: '<circle cx="1.5" cy="1.5" r="0.6"/><circle cx="4" cy="3.8" r="0.5"/>' },
  brick: { w: 12, h: 8, marks: '<path d="M0 0.5H12M0 4.5H12M3 0.5V4.5M9 4.5V8.5" fill="none" stroke="currentColor" stroke-width="0.7"/>' },
  cells: { w: 16, h: 16, marks: '<path d="M0 6L7 4L9 0M7 4L10 11L16 9M10 11L6 16M0 6L2 13L6 16" fill="none" stroke="currentColor" stroke-width="0.7"/>' },
  grid: { w: 10, h: 10, marks: '<path d="M0 0.5H10M0.5 0V10" fill="none" stroke="currentColor" stroke-width="0.7"/>' },
  boards: { w: 6, h: 20, marks: '<path d="M0.5 0V20M3.5 13V17" fill="none" stroke="currentColor" stroke-width="0.7"/>' },
};

/** The <pattern> elements for every material (place inside an <svg><defs>). */
export function patternDefs(): string {
  return MATERIALS.map(m => {
    const t = TILES[m.pattern], c = `var(--${m.color})`;
    return `<pattern id="material-${m.id}" patternUnits="userSpaceOnUse" width="${t.w}" height="${t.h}"`
      + ` style="color: color-mix(in srgb, ${c} var(--mix-material-edge), var(--color-material-shade)); fill: currentColor">`
      + `<rect width="${t.w}" height="${t.h}" style="fill: ${c}"/>${t.marks}</pattern>`;
  }).join('');
}

export const materialFill = (id: MaterialId) => `url(#material-${id})`;
