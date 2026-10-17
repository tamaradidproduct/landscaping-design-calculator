// Fill patterns for surfaces: one SVG <pattern> per material showing its texture tile, defined once in the document
// and used by the plan overlay and the Layers swatches alike. The plan's patterns repeat at the material's real-world
// size, so they are resized (scalePatterns) as the plan zooms; the swatch patterns keep a fixed screen size.
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

/** The <pattern> elements for every material (place inside an <svg><defs>). */
export function patternDefs(): string {
  return MATERIALS.map(m => pattern(`material-${m.id}`, m.tile, FALLBACK_TILE_PX) + pattern(`swatch-${m.id}`, m.tile, SWATCH_TILE_PX)).join('');
}

/**
 * Resizes the plan patterns under `root` to real-world scale and anchors them at `origin` (the plan's top-left on screen),
 * so a texture pans and zooms with its zone. `pxPerPt` is screen px per true-shape page point (what `ftPerPt` is per).
 */
export function scalePatterns(root: ParentNode, ftPerPt: number | null, pxPerPt: number, origin: { x: number; y: number }): void {
  root.querySelectorAll('pattern[id^="material-"]').forEach(p => {
    const px = String(tileSizePx(material(p.id.slice('material-'.length)).tileFt, ftPerPt, pxPerPt));
    p.setAttribute('width', px); p.setAttribute('height', px);
    p.setAttribute('x', String(origin.x)); p.setAttribute('y', String(origin.y));
    const img = p.querySelector('image');
    img?.setAttribute('width', px); img?.setAttribute('height', px);
  });
}

export const materialFill = (id: MaterialId) => `url(#material-${id})`;
export const swatchFill = (id: MaterialId) => `url(#swatch-${id})`;
