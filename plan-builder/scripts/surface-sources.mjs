// The area surfaces taken from the Figma "Landscaping symbols" library (file 0B2UpvIGBFOE1ZEDx8rXPR, Surfaces
// section 170:1977; each surface is a symbol whose swatch image fill is exported at its source resolution, see
// build-surface-tiles.mjs). Order = picker order (family by family).
const FAMILIES = {
  turf: 'Turf & seed', mulch: 'Mulch & soil', rock: 'Rock & gravel', pavers: 'Pavers & stone', concrete: 'Concrete', decking: 'Decking',
};
const s = (id, name, family, trade) => ({ id, name, family: FAMILIES[family], trade });

export const SURFACE_SOURCES = [
  s('premium-sod', 'Premium sod', 'turf', 'softscape'),
  s('putting-green', 'Putting green', 'turf', 'softscape'),
  s('festival-turf', 'Festival turf', 'turf', 'softscape'),
  s('native-seed', 'Native seed', 'turf', 'softscape'),
  s('hydroseed-clover', 'Hydroseed clover', 'turf', 'softscape'),
  s('wood-mulch', 'Wood mulch', 'mulch', 'softscape'),
  s('rubber-mulch', 'Rubber mulch', 'mulch', 'softscape'),
  s('sand', 'Sand', 'mulch', 'softscape'),
  s('garden-soil', 'Garden soil', 'mulch', 'softscape'),
  s('white-river-rock', 'White river rock', 'rock', 'softscape'),
  s('white-glacier-river-rock', 'White glacier river rock', 'rock', 'softscape'),
  s('mesa-cobble-stone', 'Mesa cobble stone', 'rock', 'softscape'),
  s('colorado-buff-rock', 'Colorado buff rock', 'rock', 'softscape'),
  s('blue-glacier-cobble', 'Blue glacier cobble', 'rock', 'softscape'),
  s('clear-mountain-granite', 'Clear mountain granite', 'rock', 'hardscape'),
  s('mountain-granite-rock', 'Mountain granite rock', 'rock', 'hardscape'),
  s('black-granite-rock', 'Black granite rock', 'rock', 'softscape'),
  s('polished-black-rock', 'Polished black rock', 'rock', 'softscape'),
  s('white-quartz', 'White quartz', 'rock', 'softscape'),
  s('granite-fines', 'Granite fines', 'rock', 'hardscape'),
  s('white-pavers', 'White pavers', 'pavers', 'hardscape'),
  s('dark-gray-pavers', 'Dark gray pavers', 'pavers', 'hardscape'),
  s('belgard-pavers', 'Belgard pavers', 'pavers', 'hardscape'),
  s('pavers-classic', 'Pavers (classic)', 'pavers', 'hardscape'),
  s('red-flagstone', 'Red flagstone', 'pavers', 'hardscape'),
  s('red-crushed-concrete', 'Red crushed concrete', 'pavers', 'hardscape'),
  s('brushed-concrete', 'Brushed concrete', 'concrete', 'hardscape'),
  s('stamped-concrete', 'Stamped concrete', 'concrete', 'hardscape'),
  s('deck-wood', 'Deck wood', 'decking', 'hardscape'),
];
