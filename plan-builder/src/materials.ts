// The built-in starter materials for surfaces (hardscape and softscape zones). Pure data: the Servin library's
// textures can replace the look later without changing how zones work. Colours are design tokens.
export type MaterialId = 'sod' | 'turf' | 'mulch' | 'river-rock' | 'decorative-rock' | 'gravel' | 'pavers' | 'flagstone'
  | 'concrete-brushed' | 'concrete-stamped' | 'decking';
export type Trade = 'hardscape' | 'softscape';
export type PatternId = 'plain' | 'lines' | 'speckle' | 'pebbles' | 'dots' | 'brick' | 'cells' | 'grid' | 'boards';

export interface Material { id: MaterialId; name: string; trade: Trade; color: string; pattern: PatternId }

const m = (id: MaterialId, name: string, trade: Trade, pattern: PatternId): Material => ({ id, name, trade, color: `color-material-${id}`, pattern });

export const MATERIALS: readonly Material[] = [
  m('sod', 'Sod', 'softscape', 'plain'),
  m('turf', 'Artificial turf', 'softscape', 'lines'),
  m('mulch', 'Mulch', 'softscape', 'speckle'),
  m('river-rock', 'River rock', 'softscape', 'pebbles'),
  m('decorative-rock', 'Decorative rock', 'softscape', 'pebbles'),
  m('gravel', 'Gravel', 'hardscape', 'dots'),
  m('pavers', 'Pavers', 'hardscape', 'brick'),
  m('flagstone', 'Flagstone', 'hardscape', 'cells'),
  m('concrete-brushed', 'Brushed concrete', 'hardscape', 'lines'),
  m('concrete-stamped', 'Stamped concrete', 'hardscape', 'grid'),
  m('decking', 'Decking', 'hardscape', 'boards'),
];

export const material = (id: MaterialId): Material => MATERIALS.find(x => x.id === id)!;
export const materialsByTrade = (trade: Trade): Material[] => MATERIALS.filter(x => x.trade === trade);
