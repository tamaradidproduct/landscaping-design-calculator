# Plan Builder: lines, stepping stones and utility markers (2026-10-18)

## Decisions
- **Linear items are drawn by clicking points, then Done**; a point drags, a segment bends into an arc (the outline editor's handle), the width is editable per line. A tap close to the last point is ignored.
- **Stepping stones and utility markers place one per tap**, like symbols; a marker's rotation is its direction.
- **Sizes come from Figma at 36 px per ft** (kept as drawn, not researched): stones 2 × 2 ft (Colorado buff 3.56 × 2), markers 0.42 × 1.03 ft (gas, electric) and 3.78 × 3.03 ft (drainage), line widths from the stroke weight (12 px = 0.33 ft, dry river 20 px = 0.55 ft). Widths are editable.
- **Counting joins the Plant list**: feet and runs per line item, stones under Objects, a Utility markers section.
- Lines are saved as `lines` (additive, `v: 1`); hidden state reuses `hiddenLayers` and `hiddenSections` (new `lines` group between Surfaces and Plants & objects).

## Build rulings
- A run is segments textured with the item's tile (the Figma stroke's pixels, cut from the 4× card export; the dry river uses its raw stone image at 2.2 widths), each pattern turned to the segment, with a continuous offset along the run.
- Utility markers keep Figma's dashed outline; stepping stones keep their Figma drop shadow.
- Points are removed with the card's **Delete point** only; no whole-line move.
- Two tokens added: `opacity-line-halo` and `opacity-line-draft` (the design-system artifact still needs them, plus last round's changes).

## Later
- Stones repeating along a path, fence posts and gates, widths per segment, utility depth and length, snapping lines to outlines.
