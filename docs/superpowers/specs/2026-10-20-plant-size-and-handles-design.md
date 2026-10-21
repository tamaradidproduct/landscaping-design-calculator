# Plant sizes, nursery pot sizes, and resizing and rotating on the plan

Date: 2026-10-20 · Status: draft for review · Builds on symbols (PR 34), layering and the Layers panel.

## Goal

Let the contractor size any placed plant or object, singly or several together, by dragging handles on a selection box, or by picking a **nursery pot size** (or Mature) in its card; and rotate by a handle on the box. The card's −/+ and typed-angle rotate control goes away. The Plant list counts plants by pot size, since that is how they are bought.

## Decisions (from the brainstorm)

- **Resize and rotate on the plan**, via a selection box: corner handles resize about the symbol's centre, a handle above the box rotates (Shift snaps to 15°). Applies to **all symbols** (plants, objects, utility markers); a marker's direction is set by the rotate handle.
- **Nursery pot sizes** as quick presets in the card, then **Mature** (today's researched size, still the default): each sets the plant's spread in one tap. Presets come from the plant's type (tree, shrub, perennial / grass / ground cover); objects and markers have no pots (only Mature and free resizing).
- **Several at once:** select several plants and one set of handles resizes them together (each about its own centre). A group selection does not rotate.
- **The card's rotate control is removed.** Arrow keys still nudge position; Delete still deletes.
- Out of scope: per-plant growth over time, pricing, rotating a group, snapping sizes to a grid, pot sizes for objects, changing the researched mature sizes.

## Model

- `PlacedSymbol` gains `scale?: number`, the size as a share of the library's mature size (absent = 1 = Mature). Valid range 0.05–3; anything else is an invalid plan. `rot` (degrees) stays. Additive, `v: 1`; plans without `scale` load unchanged.
- A plant's size on the plan is its mature spread × `scale` (a circle); an object's or marker's footprint × `scale` (both sides).
- The saved value is the share, not feet, so the library's mature size can be corrected later and every plant follows.

## Pot sizes

- `src/pot-sizes.ts` (pure): `POT_PRESETS` by plant type and `potSizesFor(symbol)` → the presets smaller than the plant's mature spread, then Mature; `scaleForPreset(symbol, preset)` = preset spread ÷ mature spread; `sizeLabel(symbol, scale)` → the preset's name when the scale matches one (within 2%), "Mature" at 1, else "x.x ft".
- Presets (assumed typical spread at planting, feet; **approximate**, shown as such, and the contractor should confirm against their nursery's stock; container sizes are classes, not exact volumes):

| Type | Presets |
|---|---|
| Trees (evergreen, deciduous, accent) | 15 gal · 5 ft; 2″ caliper · 8 ft |
| Shrubs (accent, privacy, large) | 1 gal · 1.25 ft; 5 gal · 2.5 ft; 15 gal · 4 ft |
| Perennials, ground covers, grasses, other | 1 gal · 1 ft; 5 gal · 2 ft |

  A preset equal to or larger than the plant's mature spread is not offered (the plant is Mature).
- Sources: container sizes are size classes (#1 ≈ 1 gal, #3 ≈ 2.5 gal, #15 for large shrubs and trees) per nursery and TxDOT landscape guidance; the spreads are assumptions recorded in `docs/pot-sizes.md` for review.

## Selection, handles and gestures

- **Selection** becomes a set of placed symbols (`selectedSymbols`); one symbol = today's selected symbol.
- **Single selection** shows the halo plus a **box** around the symbol (turned with it, square for objects by footprint, circle's bounding square for plants) with four **corner handles** and a **rotate handle** on a short stem above the top edge. All handles are at least 24 px apart from the box and hit-tested with a 28 px target.
  - Dragging a corner resizes uniformly about the centre: `scale` follows the distance from the centre to the pointer (clamped 0.05–3); a tip shows the size ("5 gal" when it matches a preset, else "3.2 ft").
  - Dragging the rotate handle turns the symbol to the pointer's angle; Shift snaps to 15°; a tip shows the degrees.
  - Each drag is one undo step.
- **Multiple selection** shows each halo plus one box around the group with four corner handles: dragging scales every selected symbol's `scale` by the same factor about its own centre (positions stay). No rotate handle.
- **Making a multi-selection:** Shift-tap (desktop); the Plants & objects section's **Select several** toggle (tablet: while on, each tap adds or removes a plant instead of selecting one); a kind's Layers row has **Select all**. Tap empty plan or Esc clears.
- Handles never take presses meant for lines, zones or outlines: they exist only while the symbols are selected; priority is handles, then symbols, then the rest (today's order).

## Card

- **One symbol:** name and category, **Size**: chips for each pot preset and Mature (the current one pressed) and a typed **Spread** field in feet (plants) or **Width** in feet (objects; depth follows), then Delete. No rotate control. Markers: a hint "Turn the arrow with the handle above it."
- **Several:** "3 selected", the shared preset chips (only when all are plants of one type; otherwise just Mature), and **Delete selected**.
- Typing a size or pressing a chip is one undo step.

## Plant list

- Plants and objects list by kind **and size**: "Boxwood · 5 gal × 3", "Boxwood · Mature × 1", "Hot tub · Mature × 1". Sorted as today (family, name, then larger sizes first). The existing photo and category stay.

## Tests

- **Unit:** `pot-sizes` (presets per family, hidden when not smaller than mature, `scaleForPreset`, `sizeLabel` incl. tolerance and custom); `PlacedSymbol.scale` validation (range, round trip, absent); `symbolSizePt` and `ordered()` with `scale` (stacking uses the scaled spread); hit test uses the scaled size; plant list rows by size; handle geometry helpers (`selectionBox`, `handlePositions`, `scaleFromDrag`, `angleFromDrag` with and without Shift snap, group factor).
- **Playwright (Riesberg):** `scripts/check-symbol-handles.mjs` — place a plant; selecting it shows the box, four corner handles and the rotate handle; drag a corner: the image width changes and the card shows the size; a preset chip sets the size and the list reads "5 gal"; drag the rotate handle: the image rotates (Shift snaps to 15°); ⌘Z undoes each; Shift-tap a second plant selects both, one handle drag resizes both; Select several toggle and Select all work; the card has no rotate control; a marker rotates by the handle; save, close and reopen keep sizes and angles. Existing checks still pass (the symbols check changes where it used the card's rotate control).
- **Docs:** PRD §6.10 (and §6.11 markers), decision summary `docs/conversations/2026-10-20-plant-sizes.md`, `docs/pot-sizes.md` with the assumed spreads for review.

## Risks

- **Selection refactor:** `selectedSymbol` is used across `outline-ui.ts` (halo, card, keys, nudge, deselect, undo); moving to a set must keep every single-selection path identical.
- **Pointer handling:** handles sit on top of other things; a press on a handle must win over a symbol or line beneath it, and a press elsewhere must still pan.
- **Presets are assumptions:** pot spreads are typical, not measured; the card marks them approximate and `docs/pot-sizes.md` lists them for review.
- **Tablet multi-select** relies on the Select several toggle (no Shift key).
