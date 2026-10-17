# Plan Builder: surface textures from the Landscaping symbols library (2026-10-16)

## Decisions
- Zones now fill with the **29 area textures** of the Figma library instead of the 11 flat colours + patterns. Symbols (plants, objects) are a separate spec that comes next.
- **Area surfaces only** for now. Linear (fence, walls, edging, dry river), point (stepping stones) and utility-marker surfaces wait for the symbols spec, because they need line drawing, counting and a marker tool.
- Textures are **bundled tiles**, cut from the Figma Surfaces section by `scripts/build-surface-tiles.mjs`. They are not drawn in code. Duplicates in Figma (second Putting green, Breeze, an extra Pavers) were dropped.
- **True scale:** every texture repeats at 10 ft by default (2 ft, then 6 ft, looked far too small), and each zone can scale it and grows with zoom (not a fixed screen size like the old patterns). Without a scale yet a tile covers 24 page points (about 10 ft on a 1″ = 30′ sheet): the texture scale and zoom still work. Tiles never go below 4 px.
- **Picker** groups by family (six groups) with a texture thumbnail on each chip, replacing Hardscape / Softscape.
- **Saved plans** keep working: the 11 old ids map to the nearest texture when a plan loads (sod → Premium sod, gravel → Clear mountain granite, …). An unknown id makes the plan invalid.
- The 11 `color-material-*` tokens are gone. A zone's edge colour is the tile's average colour, kept as data.

## Texture scale and show/hide (same day)
- Default repeat is now **10 ft** (2 and 6 ft looked far too small).
- **Texture scale per zone**, saved with the zone: − / percent / + in the zone card, ×1.25 per press within 25%–400%, tap the percent to reset. One global slider was the alternative. Each zone draws with its own pattern.
- **Eyes** on every layer row and on the Surfaces and Outlines headers. Hidden layers aren't drawn, selected, tapped or snapped to, but still cut other layers. A header eye leaves each layer's own eye alone.
- Visibility is **saved with the plan** (session-only was the alternative), as `hiddenLayers` and `hiddenSections` next to `outlines` (not on the outlines, so undo can't bring a layer back). Not an undo step.
- The plot boundary belongs to the Outlines section. Only collapsed rows have an eye; a selected layer's card has none.

## Picker, sharper textures, rounding (same day)
- The material picker is a **list** (swatch + name rows under family captions), not chips. Selected zones stay solid; only the zone being drawn is see-through. The zone card is more compact.
- Textures are **688 px tiles** cut from Figma's 4× exports of each swatch (the raw source images have the wrong tint, so they were not used). Swatches use 64 px thumbnails, so the big tiles load only for zones.
- **Round all corners** takes ↑ ↓ (Shift: 2′) like a corner's radius field. The sharp corner's round handle moved out (22 → 34 px) and its hit area grew (13 → 18 px); on a rounded corner's arc it stays 13 px so the sides beside it stay grabbable. Rounding works on any shape, **also next to curved sides** (the rounding is tangent to the arc and trims it, so bending a side keeps its rounded corners). **Shift** while dragging a corner's round handle rounds every corner equally; letting go of Shift puts the others back.

## Later
- Tiles are 184 px (the size Figma gives); re-export larger if textures look soft at high zoom.
- Per-material tile sizes (some textures may want a bigger or smaller repeat than 10 ft).
