// Fill patterns for surfaces. Each zone has its own SVG <pattern> (its material's tile, repeating at the material's
// real-world size times the zone's texture scale), resized (scalePatterns) as the plan zooms. The picker and Layers
// swatches use one fixed-size pattern per material.
import { MATERIALS, material, type MaterialId } from './materials';

/** Smallest tile on screen, so zoomed-out textures don't turn to noise. */
export const MIN_TILE_PX = 4;
/** Tile size on screen while the plan has no scale yet. */
export const FALLBACK_TILE_PX = 64;
/** Tile size in the picker and Layers swatches. */
export const SWATCH_TILE_PX = 24;

/** Screen px a tile of `tileFt` feet covers, given the plan's feet per PDF point (null: not known) and screen px per PDF point. */
export function tileSizePx(tileFt: number, ftPerPt: number | null, pxPerPt: number): number {
  if (ftPerPt === null || !Number.isFinite(ftPerPt) || ftPerPt <= 0) return FALLBACK_TILE_PX;
  return Math.max(MIN_TILE_PX, tileFt / ftPerPt * pxPerPt);
}

const pattern = (id: string, href: string, px: number) =>
  `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${px}" height="${px}"><image href="${href}" width="${px}" height="${px}" preserveAspectRatio="none"/></pattern>`;

/** Feet a zone's tile covers: its material's repeat times the zone's texture scale. */
export const zoneTileFt = (id: MaterialId, texScale = 1): number => material(id).tileFt * texScale;

/** The fixed-size swatch <pattern>s for every material (place inside an <svg><defs>). */
export const patternDefs = (): string => MATERIALS.map(m => pattern(`swatch-${m.id}`, m.thumb, SWATCH_TILE_PX)).join('');

/** One plan <pattern> per zone, at the fallback size until scalePatterns sizes it. */
export const zonePatternDefs = (zones: { id: string; material: MaterialId }[]): string =>
  zones.map(z => pattern(`zone-${z.id}`, material(z.material).tile, FALLBACK_TILE_PX)).join('');

/**
 * Resizes the zone patterns under `root` to real-world scale and anchors them at `origin` (the plan's top-left on screen),
 * so a texture pans and zooms with its zone. `tileFt` is each zone's tile in feet; `pxPerPt` is screen px per
 * true-shape page point (what `ftPerPt` is per).
 */
export function scalePatterns(root: ParentNode, tileFt: ReadonlyMap<string, number>, ftPerPt: number | null, pxPerPt: number, origin: { x: number; y: number }): void {
  root.querySelectorAll('pattern').forEach(p => {
    const ft = tileFt.get(p.id.slice('zone-'.length));
    if (ft === undefined) return;
    const px = String(tileSizePx(ft, ftPerPt, pxPerPt));
    p.setAttribute('width', px); p.setAttribute('height', px);
    p.setAttribute('x', String(origin.x)); p.setAttribute('y', String(origin.y));
    const img = p.querySelector('image');
    img?.setAttribute('width', px); img?.setAttribute('height', px);
  });
}

export const zoneFill = (zoneId: string) => `url(#zone-${zoneId})`;
export const swatchFill = (id: MaterialId) => `url(#swatch-${id})`;
