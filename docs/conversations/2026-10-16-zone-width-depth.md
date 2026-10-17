# Plan Builder: Width × Depth for surface zones (2026-10-16)

## Decisions
- A zone's card gets a **Size** row: **Width** and **Depth** of its bounding box (axis-aligned to the page, in true feet), typed like edge lengths.
- Available for **any zone**, not just rectangles. An irregular shape uses its rectangular boundary. This replaced the earlier idea of detecting "rectangle zones" or storing a rectangle flag, so there is no data change.
- Resizing is **from the center** of the bounding box, along the typed axis only. This replaced "from the first corner" in the original stage 2 spec.
- An optional **aspect lock** between the fields (off by default) scales both axes by the same factor. It is a session preference, not saved on the zone, and resets when another zone is selected.
- Curved sides keep passing through their scaled midpoints; the typed size includes their bulge. One undo step per entry. The scale and references never change.
- **Zones only.** Outlines (plot boundary, existing features) are excluded because their typed lengths set the plan's scale.
- **Card only:** no live Width × Depth while drawing a Rectangle (the original spec had it).

## Later
- Stage 3: move one corner as a second resize choice in the edge popover.
