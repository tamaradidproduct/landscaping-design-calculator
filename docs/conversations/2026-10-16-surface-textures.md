# Plan Builder: surface textures from the Landscaping symbols library (2026-10-16)

## Decisions
- Zones now fill with the **29 area textures** of the Figma library instead of the 11 flat colours + patterns. Symbols (plants, objects) are a separate spec that comes next.
- **Area surfaces only** for now. Linear (fence, walls, edging, dry river), point (stepping stones) and utility-marker surfaces wait for the symbols spec, because they need line drawing, counting and a marker tool.
- Textures are **bundled tiles**, cut from the Figma Surfaces section by `scripts/build-surface-tiles.mjs`. They are not drawn in code. Duplicates in Figma (second Putting green, Breeze, an extra Pavers) were dropped.
- **True scale:** every texture repeats at 10 ft by default (2 ft, then 6 ft, looked far too small), and each zone can scale it and grows with zoom (not a fixed screen size like the old patterns). Without a scale the texture shows at a fixed size. Tiles never go below 4 px.
- **Picker** groups by family (six groups) with a texture thumbnail on each chip, replacing Hardscape / Softscape.
- **Saved plans** keep working: the 11 old ids map to the nearest texture when a plan loads (sod → Premium sod, gravel → Clear mountain granite, …). An unknown id makes the plan invalid.
- The 11 `color-material-*` tokens are gone. A zone's edge colour is the tile's average colour, kept as data.

## Texture scale and show/hide (same day)
- Default repeat is now **10 ft** (2 and 6 ft looked far too small).
- **Texture scale per zone**, saved with the zone: − / percent / + in the zone card, ×1.25 per press within 25%–400%, tap the percent to reset. One global slider was the alternative. Each zone draws with its own pattern.
- **Eyes** on every layer row and on the Surfaces and Outlines headers. Hidden layers aren't drawn, selected, tapped or snapped to, but still cut other layers. A header eye leaves each layer's own eye alone.
- Visibility is **saved with the plan** (session-only was the alternative), as `hiddenLayers` and `hiddenSections` next to `outlines` (not on the outlines, so undo can't bring a layer back). Not an undo step.
- The plot boundary belongs to the Outlines section. Only collapsed rows have an eye; a selected layer's card has none.

## Later
- Tiles are 184 px (the size Figma gives); re-export larger if textures look soft at high zoom.
- Per-material tile sizes (some textures may want a bigger or smaller repeat than 10 ft).
