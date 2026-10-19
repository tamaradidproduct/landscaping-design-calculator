// The linear items of the Figma "Landscaping symbols" library (file 0B2UpvIGBFOE1ZEDx8rXPR, Surfaces section 170:1977): each card holds a
// one-dimensional "Wall feature" (or "Dry river") vector with an image stroke, so the stroke weight is its width (36 Figma px = 1 ft).
// `strip` is the stroke's own pixels inside the card, in 1× card coordinates { x, y, w, h } (round caps trimmed off), cut out by
// build-lines.mjs and tiled along a drawn run. Order = picker order.
// `tileWidths`: the tile's edge in stroke widths (a strip is the stroke itself: 1; the dry river's stone texture is a square image
// fill scaled to about 2.2 widths, read off the Figma render). The dry river has no strip: its tile is the fill's raw source image.
const l = (id, name, figma, strokePx, roundCaps, strip, tileWidths = 1) => ({ id, name, family: 'Lines', figma, strokePx, roundCaps, strip, tileWidths });

export const LINE_SOURCES = [
  l('wood-privacy-fence', 'Wood privacy fence', '173:4075', 12, true, { x: 87, y: 50, w: 10, h: 144 }),
  l('veneer-wall', 'Decorative veneer wall', '173:4045', 12, true, { x: 87, y: 50, w: 10, h: 144 }),
  l('retaining-wall', 'Allen block retaining wall', '173:4052', 12, true, { x: 87, y: 72, w: 10, h: 144 }),
  l('white-stone-edging', 'White stone edging', '174:1470', 12, true, { x: 87, y: 90, w: 10, h: 64 }),
  l('dry-river', 'Dry river', '173:4110', 20, false, null, 2.2),
];
