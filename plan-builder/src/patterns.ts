// Fill patterns for surfaces. Each zone has its own SVG <pattern> (its material's tile, repeating at the material's
// real-world size times the zone's texture scale), resized (scalePatterns) as the plan zooms. The picker and Layers
// swatches use one fixed-size pattern per material.
import { MATERIALS, material, type MaterialId } from './materials';

/** Smallest tile on screen, so zoomed-out textures don't turn to noise. */
export const MIN_TILE_PX = 4;
/** Tile size on screen before a pattern is first sized. */
export const FALLBACK_TILE_PX = 64;
/** Page points a tile covers while the plan has no scale yet (about 10 ft on a 1″ = 30′ sheet); it still follows zoom. */
export const UNSCALED_TILE_PT = 24;
/** Tile size in the picker and Layers swatches. */
export const SWATCH_TILE_PX = 24;

/**
 * Screen px a tile of `tileFt` feet covers (times the zone's texture scale), given the plan's feet per PDF point (null: not
 * known yet) and screen px per PDF point. Without a scale the tile is a fixed number of page points, so the texture scale
 * still works.
 */
export function tileSizePx(tileFt: number, ftPerPt: number | null, pxPerPt: number, texScale = 1): number {
  if (ftPerPt === null || !Number.isFinite(ftPerPt) || ftPerPt <= 0) return Math.max(MIN_TILE_PX, UNSCALED_TILE_PT * texScale * pxPerPt);
  return Math.max(MIN_TILE_PX, tileFt * texScale / ftPerPt * pxPerPt);
}

const pattern = (id: string, href: string, px: number) =>
  `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${px}" height="${px}"><image href="${href}" width="${px}" height="${px}" preserveAspectRatio="none"/></pattern>`;

/** The one hatched pattern for surfaces with no material yet: neutral tokens only, a fixed size on screen (swatch, card and plan). */
export const UNASSIGNED_HATCH_ID = 'unassigned-hatch';
export const UNASSIGNED_FILL = `url(#${UNASSIGNED_HATCH_ID})`;
const HATCH_PX = 8;
const hatchPattern = () =>
  `<pattern id="${UNASSIGNED_HATCH_ID}" patternUnits="userSpaceOnUse" width="${HATCH_PX}" height="${HATCH_PX}" patternTransform="rotate(45)">`
  + `<rect width="${HATCH_PX}" height="${HATCH_PX}" style="fill:var(--color-feature-fill)"/>`
  + `<line x1="0" y1="0" x2="0" y2="${HATCH_PX}" style="stroke:var(--color-feature-stroke);stroke-width:2"/></pattern>`;

/** The fixed-size swatch <pattern>s for every material, plus the unassigned hatch (place inside an <svg><defs>). */
export const patternDefs = (): string => MATERIALS.map(m => pattern(`swatch-${m.id}`, m.thumb, SWATCH_TILE_PX)).join('') + hatchPattern();

/** One plan <pattern> per zone, at the fallback size until scalePatterns sizes it. */
export const zonePatternDefs = (zones: { id: string; material: MaterialId }[]): string =>
  zones.map(z => pattern(`zone-${z.id}`, material(z.material).tile, FALLBACK_TILE_PX)).join('');

/**
 * Resizes the zone patterns under `root` to real-world scale and anchors them at `origin` (the plan's top-left on screen),
 * so a texture pans and zooms with its zone. `zones` gives each zone's material repeat in feet and texture scale; `pxPerPt` is screen px per
 * true-shape page point (what `ftPerPt` is per).
 */
export function scalePatterns(root: ParentNode, zones: ReadonlyMap<string, { tileFt: number; texScale: number }>, ftPerPt: number | null, pxPerPt: number, origin: { x: number; y: number }): void {
  root.querySelectorAll('pattern').forEach(p => {
    const z = zones.get(p.id.slice('zone-'.length));
    if (!z) return;
    const px = String(tileSizePx(z.tileFt, ftPerPt, pxPerPt, z.texScale));
    p.setAttribute('width', px); p.setAttribute('height', px);
    p.setAttribute('x', String(origin.x)); p.setAttribute('y', String(origin.y));
    const img = p.querySelector('image');
    img?.setAttribute('width', px); img?.setAttribute('height', px);
  });
}

export const zoneFill = (zoneId: string) => `url(#zone-${zoneId})`;
export const swatchFill = (id: MaterialId) => `url(#swatch-${id})`;
