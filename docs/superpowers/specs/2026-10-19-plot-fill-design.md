# Plot fill and surface quantities

Date: 2026-10-19 · Status: draft for review · Builds on surfaces (PR 19, 33), the plot boundary and the Plant list (PR 34, 40).

## Goal

Let the contractor fill the whole plot with one surface (a lawn, gravel…) in one step, with that fill following the plot boundary when it changes. Count every surface by what is **visible** of it: clipped to the lot, with the house, features and any surface placed on top cut out. PRD: "default lot material" and "quantities (sq ft per material)", both listed as later.

## Decisions (from the brainstorm)

- **The fill follows the boundary** (not a one-time copy): reshape, bend or redraw the boundary and the fill re-fits.
- **One fill per plan.** It is the lowest surface; everything drawn on it cuts it out.
- **What cuts a surface's area:** the house and other existing features (Outlines, as today), and any surface above it in Layers, all clipped to the plot boundary. **Not** plants, objects, lines or markers (decided: "just the surfaces").
- Quantities show in the **Plant list**, per material, for every surface (not only the fill). Hidden layers still count, like every other list entry.
- Out of scope: several fills, a fill that ignores the boundary, filling inside a feature, a default material set per plan, per-zone areas in the zone card.

## Model

- `Outline` gains optional `base?: true`, valid only on `kind: 'surface'`; at most one per plan; anything else is an invalid plan. `v: 1` kept; plans without it load and save unchanged.
- The fill is an ordinary surface outline (`name: 'Plot fill'`, material, `texScale`) whose `pts`, `bulges` and `radii` are copies of the boundary's. It is saved with the other outlines, so the stores need no change.

## Staying in sync

- `OutlineTool.syncBase()` copies the boundary's shape onto the fill. It runs at the start of every `update()` and after `load()`, `restore()` (undo/redo) and any boundary edit, so the fill can never disagree with the boundary on screen or in a save.
- While the boundary is being drawn or redrawn (`drawing === 'boundary'`, not closed) the fill keeps its last shape and re-fits when the boundary closes. With no boundary the fill is removed.
- Sync is not an undo step of its own: it is part of whatever changed the boundary.

## Layering

- Within Surfaces, listed earlier = higher = cuts the ones after it. The fill is always **last** (lowest): adding a fill appends it; every later add or reorder keeps it last (`keepBaseLast()` moves it to the end of the key order).
- A new zone drawn wholly inside the fill is already placed above it by the existing `containers` rule; a zone drawn partly outside is appended and then the fill is moved back to last.
- Move up / Move down are disabled for the fill, and no zone can be moved below it.

## UI

- **Layers → Surfaces → Fill the plot…** (shown when the boundary is closed and there is no fill). It opens the same material picker as Add surface; picking one creates the fill (one undo step) and selects it.
- **The fill's card:** name, material with Change, Texture scale, the note "Follows the plot boundary", Delete. Hidden because the boundary owns the shape: Width × Depth, Round all corners, nudge pad, Redraw, Move up/down. Dragging the fill on the plan does not move or reshape it (corners, sides and the zone body are not draggable); a tap still selects it.
- **Delete** removes it (one undo step); Fill the plot… returns.
- Its row sits last in Surfaces with a "Plot fill" name and the material swatch, with the usual eye.

## Quantities (Plant list → Surfaces)

- `plantList(...)` gains `areas`: for each material used, the **sum of the visible areas** of its zones, in square feet.
- A zone's visible area = `shapeArea(visibleShapes(outlines).get(id))` (already clipped to the lot and cut by features and higher surfaces) × the plan's feet-per-point squared and stretch correction (the same conversion as `areaSqft`).
- Rows read "Premium sod · 1,240 sq ft" (rounded to whole feet, thousands separated); two zones of one material add up. With no plan scale the row shows the material only ("no scale").
- A zone that is wholly covered counts 0 sq ft and still lists.

## Tests

- **Unit:** `base` validation (surface only, one only, boolean); `syncBase` copies points/bulges/radii and follows a boundary change, keeps the last shape while the boundary is redrawn, removes the fill with no boundary; `keepBaseLast` after add and reorder; moveInSection refuses to cross the fill; `plantList` areas: fill minus house = lot area minus house area; zone on top reduces the fill and adds to its own; same material sums; no scale gives no area; wholly covered gives 0; hidden still counts.
- **Playwright (Riesberg):** `scripts/check-plot-fill.mjs` — outline a boundary, Fill the plot with sod, the fill appears and the Plant list shows its area; drag a boundary corner and the fill and the area follow; add a patio zone and the fill's area drops by the patio's; undo/redo; the fill's card has no size fields and cannot be dragged; Delete and refill; reopen the plan. Existing checks still pass.
- **Docs:** PRD (§6.8 surfaces: plot fill and quantities, step table), decision summary `docs/conversations/2026-10-19-plot-fill.md`.

## Risks

- **Clipper cost:** `visibleShapes` already runs per change; the list now calls it too. Reuse the tool's cached `visible` map for the list instead of recomputing.
- **Sync during drags:** copying the boundary on every pointer move redraws the fill live (wanted), but must not record undo steps; it is called from `update()` only.
- **Stretched plans:** areas use the same correction as `areaSqft`, so they match the boundary's own area (a fill with nothing on top equals the lot area).
