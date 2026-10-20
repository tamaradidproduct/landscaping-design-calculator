# Layering: section order and automatic plant stacking

Date: 2026-10-19 · Status: draft for review · Builds on the Layers panel sections (PR 33, 34, 40).

## Goal

Make stacking on the plan predictable and controllable: **Plants & objects is the top group by default**, the four Layers sections (Plants & objects, Outlines, Lines, Surfaces) can be **moved up and down** and the plan stacks in that order, and **plants stack automatically by type and size** (trees on top, then shrubs, then perennials) instead of by placing order.

## Decisions (from the brainstorm)

- **Automatic stacking by type, then size**, with no manual override (no Bring to front / Send to back).
- **Reorder the four sections**, not rows inside them; the panel's top-to-bottom order is the plan's top-to-bottom stacking.
- Default order, top to bottom: **Plants & objects, Outlines, Lines, Surfaces** (today the plan stacks Outlines over Plants and the panel lists Surfaces first).
- Out of scope: reordering rows inside a section (zones keep today's up/down), per-plant manual stacking, plant sizes and calibers (the next feature), changing what cuts what (houses and features still cut surfaces; areas are unchanged).

## Section order

- Plan state gains `sectionOrder?: Group[]` (top to bottom), a permutation of `['symbols', 'outlines', 'lines', 'surfaces']`; anything else (duplicates, a missing or unknown group) is an invalid plan; absent means the default. `v: 1` kept; plans without it load unchanged.
- Saved with the plan like the visibility state (`hiddenSections`): not an undo step.
- `DEFAULT_SECTION_ORDER` and `moveSection(order, group, dir)` (pure, in `src/sections.ts`): swaps with the neighbour, null at the ends.
- **UI:** each section header gets ↑ and ↓ icon buttons beside its eye (disabled at the ends, labelled "Move Lines up"). The panel's section blocks reorder to match.

## Paint order

- The overlay paints each group as one block, bottom to top by `sectionOrder`: the group's runs, symbols, or outline shapes (with the outline labels), then the handles of the selected layer on top of everything, as today. What cuts what is unchanged (`visibleShapes`).
- **Tapping** keeps today's priority (plants and objects, then lines, then zones and outlines). Following the section order for taps is a later change.

## Automatic plant stacking

- Within Plants & objects, symbols paint bottom to top by **tier, then size, then placing order**:
  1. utility markers (lowest), 2. objects (stepping stones, hot tub…), 3. perennials, ground covers, ornamental grasses and other plants, 4. shrubs (accent, privacy, large), 5. trees (evergreen, deciduous, accent; highest).
  - Within a tier a **larger mature spread is below a smaller one** (so a small plant is never buried by a big one); equal sizes keep placing order (the id number).
- Tiers come from the library family: `tierOf(symbol)` is a pure function in `src/symbols.ts` over `family` and `kind`.
- `SymbolLayer.ordered()` returns this stacking order (replacing id order), so the renderer, the hit test (topmost first) and the layers rows' stepping all follow it. Ids keep going past the highest, so new symbols are never renumbered.
- The ids no longer give the stacking: the id-order test and the spec line "z-order by id" (symbols spec) are superseded.

## Tests

- **Unit:** `tierOf` for every library family (3 tree families → 5, 3 shrub families → 4, perennials/ground covers/grasses/other → 3, objects → 2, markers → 1); `ordered()` puts a tree above a shrub above a perennial whatever the placing order, a smaller plant above a larger of the same tier, ties by id; `hitTest` picks the tree over a perennial under the same point; `moveSection` swaps/ends/identity; `sectionOrder` validation (permutation only), round trip, absent loads unchanged; `groupOrder` default.
- **Playwright (Riesberg):** `scripts/check-layering.mjs` — place a perennial, then a tree, then a shrub overlapping: the drawn image order is perennial, shrub, tree; tapping the overlap selects the tree; the default panel order is Plants & objects, Outlines, Lines, Surfaces; moving Lines up swaps the blocks in the panel and the paint order on the plan; the order survives closing and reopening the plan; plants paint over a House outline by default and under it after moving Outlines above Plants & objects.
- **Docs:** PRD (§6.8, §6.10, §6.11, step table), decision summary `docs/conversations/2026-10-19-layering.md`; update the symbols spec's z-order line.

## Risks

- **Render refactor:** `OutlineTool.render` builds one string with interleaved pieces; splitting it per group must keep the selected layer's handles, hover edge highlights and labels exactly where they are.
- **Hit-test order:** the stacking function must be cheap (called per pointer move); cache the sorted list per placed-symbols revision.
- **Existing plans:** plants that sat under an outline now sit above it by default (the spec's intent).
