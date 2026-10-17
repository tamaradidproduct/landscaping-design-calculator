// The built-in materials for surfaces (hardscape and softscape zones): the area textures of the Landscaping symbols
// library (Figma 0B2UpvIGBFOE1ZEDx8rXPR), cut into tiles by scripts/build-surface-tiles.mjs. Pure data; each tile repeats
// at a real-world size, so a texture scales with the plan.
import { SURFACE_SOURCES, type Family, type SurfaceSource } from '../scripts/surface-sources.mjs';
import edges from './assets/surfaces/edges.json';

export type { Family };
/** A material's id: kebab-case of its name (see scripts/surface-sources.mjs). Check unknown text with normalizeMaterialId. */
export type MaterialId = string;
export type Trade = SurfaceSource['trade'];

export interface Material {
  id: MaterialId; name: string; family: Family; trade: Trade;
  /** URL of the texture tile. */
  tile: string;
  /** Feet the tile covers, across and down, before it repeats. */
  tileFt: number;
  /** The tile's average colour: a zone's edge, handle and label colour. */
  edge: string;
}

const tiles = import.meta.glob<string>('./assets/surfaces/*.webp', { eager: true, query: '?url', import: 'default' });
const TILE_FT = 10;

export const MATERIALS: readonly Material[] = SURFACE_SOURCES.map(({ id, name, family, trade }) => ({
  id, name, family, trade, tile: tiles[`./assets/surfaces/${id}.webp`], tileFt: TILE_FT, edge: (edges as Record<string, string>)[id],
}));

export const material = (id: MaterialId): Material => MATERIALS.find(x => x.id === id)!;

/** The picker's groups, in order. */
export function materialsByFamily(): { family: Family; materials: Material[] }[] {
  const groups: { family: Family; materials: Material[] }[] = [];
  for (const m of MATERIALS) {
    const g = groups.find(x => x.family === m.family);
    if (g) g.materials.push(m); else groups.push({ family: m.family, materials: [m] });
  }
  return groups;
}

/** The first 11 materials (flat colours) and what they became. */
export const LEGACY_MATERIAL_IDS: Record<string, MaterialId> = {
  sod: 'premium-sod', turf: 'festival-turf', mulch: 'wood-mulch', 'river-rock': 'white-river-rock',
  'decorative-rock': 'mesa-cobble-stone', gravel: 'clear-mountain-granite', pavers: 'pavers-classic', flagstone: 'red-flagstone',
  'concrete-brushed': 'brushed-concrete', 'concrete-stamped': 'stamped-concrete', decking: 'deck-wood',
};

/** A current id as is, an old one mapped to its replacement, anything else null. */
export function normalizeMaterialId(id: string): MaterialId | null {
  if (MATERIALS.some(m => m.id === id)) return id;
  return Object.hasOwn(LEGACY_MATERIAL_IDS, id) ? LEGACY_MATERIAL_IDS[id] : null;
}
