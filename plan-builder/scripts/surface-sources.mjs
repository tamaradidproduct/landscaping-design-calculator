// The area surfaces taken from the Figma "Landscaping symbols" library (file 0B2UpvIGBFOE1ZEDx8rXPR, Surfaces
// section 170:1977). Each swatch sits at (x, y) inside that section: the card title takes the top 30 px, then a
// 184 × 184 image. Order = picker order (family by family).
const FAMILIES = {
  turf: 'Turf & seed', mulch: 'Mulch & soil', rock: 'Rock & gravel', pavers: 'Pavers & stone', concrete: 'Concrete', decking: 'Decking',
};
const s = (id, name, family, trade, x, y) => ({ id, name, family: FAMILIES[family], trade, x, y });

export const SURFACE_SOURCES = [
  s('premium-sod', 'Premium sod', 'turf', 'softscape', 21, 29),
  s('putting-green', 'Putting green', 'turf', 'softscape', 245, 29),
  s('festival-turf', 'Festival turf', 'turf', 'softscape', 477, 29),
  s('native-seed', 'Native seed', 'turf', 'softscape', 693, 29),
  s('hydroseed-clover', 'Hydroseed clover', 'turf', 'softscape', 917, 29),
  s('wood-mulch', 'Wood mulch', 'mulch', 'softscape', 1141, 29),
  s('rubber-mulch', 'Rubber mulch', 'mulch', 'softscape', 1589, 29),
  s('sand', 'Sand', 'mulch', 'softscape', 1365, 29),
  s('garden-soil', 'Garden soil', 'mulch', 'softscape', 21, 1688),
  s('white-river-rock', 'White river rock', 'rock', 'softscape', 30, 377),
  s('white-glacier-river-rock', 'White glacier river rock', 'rock', 'softscape', 1141, 377),
  s('mesa-cobble-stone', 'Mesa cobble stone', 'rock', 'softscape', 469, 377),
  s('colorado-buff-rock', 'Colorado buff rock', 'rock', 'softscape', 693, 377),
  s('blue-glacier-cobble', 'Blue glacier cobble', 'rock', 'softscape', 917, 377),
  s('clear-mountain-granite', 'Clear mountain granite', 'rock', 'hardscape', 238, 377),
  s('mountain-granite-rock', 'Mountain granite rock', 'rock', 'hardscape', 1813, 377),
  s('black-granite-rock', 'Black granite rock', 'rock', 'softscape', 1589, 377),
  s('polished-black-rock', 'Polished black rock', 'rock', 'softscape', 1365, 377),
  s('white-quartz', 'White quartz', 'rock', 'softscape', 2030, 377),
  s('granite-fines', 'Granite fines', 'rock', 'hardscape', 1589, 670),
  s('white-pavers', 'White pavers', 'pavers', 'hardscape', 469, 670),
  s('dark-gray-pavers', 'Dark gray pavers', 'pavers', 'hardscape', 693, 670),
  s('belgard-pavers', 'Belgard pavers', 'pavers', 'hardscape', 1141, 670),
  s('pavers-classic', 'Pavers (classic)', 'pavers', 'hardscape', 1813, 670),
  s('red-flagstone', 'Red flagstone', 'pavers', 'hardscape', 917, 670),
  s('red-crushed-concrete', 'Red crushed concrete', 'pavers', 'hardscape', 1365, 670),
  s('brushed-concrete', 'Brushed concrete', 'concrete', 'hardscape', 21, 670),
  s('stamped-concrete', 'Stamped concrete', 'concrete', 'hardscape', 245, 670),
  s('deck-wood', 'Deck wood', 'decking', 'hardscape', 693, 1688),
];
