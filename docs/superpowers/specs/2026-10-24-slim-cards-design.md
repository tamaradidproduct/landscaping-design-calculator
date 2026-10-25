# Slimmer cards and overlays — design

Date: 2026-10-24 · Branch: `feat/slim-cards` (off `feat/handoff-panel`, PR 51) · Status: draft for review
Builds on `2026-10-20-panel-structure-design.md`. Decisions and the card inventories are in `docs/conversations/2026-10-20-handoff-panel-findings.md`.

## Goal
- Cards and overlays are quiet and short, so the plan stays visible and the panel stays scannable.
- Rare and destructive actions stop competing with the main ones.
- Nothing is lost on a tablet: whatever leaves a card has a touch path on the canvas.

## Scope
- In: the edge overlay, the outline card, the plant and object card, the surface card, the floating nudge pad, drag-to-reorder, the "Round all corners" value.
- Out (separate specs): rotate and resize handles (rotation of zones, objects, lines and markers at 15° steps; plant size and the nursery container picker), plan label style, surface entry and the material grid, the surface calculator. Plan labels also overlap with the unmerged `feat/move-lines` branch.

## Decisions
- Card height target: outline card about 110 px, surface card about 150 px closed, plant card about 110 px.
- Rare actions go to a **⋯ menu** or become icons; **Square corners stays visible** on outline and surface cards.
- "Redo" is renamed **Redraw** everywhere (it redraws the outline; it is not an undo).
- **Delete** is a trash icon, never a full-width button. The plot boundary has none.
- The card's **×** goes; a card closes by tapping its row again, tapping empty plan, or Escape (as today).
- **Layer order** moves to a **drag handle (grip) on each row**; ↑ ↓ remain as a keyboard fallback.
- **Nudge arrows leave the cards.** Keyboard arrow keys still nudge (unchanged); touch gets a **floating nudge pad** on the canvas.
- Text follows `CDS content` rules: sentence case, no terminal punctuation on labels.

## Edge overlay (replaces the edge popover)
- A compact **chip** at the selected edge's midpoint, replacing the popover for outline and zone edges: `115.00′`  ⓘ  ⋯.
- Tap the length: it becomes an inline field with the **existing numeric keypad** (#28), Done saves. No title row, no permanent hint, no Remove button.
- **ⓘ** shows a small tooltip with the guidance that is permanent text today ("Drag the square to curve this edge", "Lengths on other edges also correct a stretched plan"; for zones, which end stays put).
- **⋯ menu:** *Make straight* (only when the edge is curved); *Remove this length* (only when a reference length exists, plot and feature edges); *Swap fixed end* (zone edges).
- Meaning of the typed value is unchanged: on a plot or feature edge it is a printed length (calibrates the scale; before a scale it reads "Set length"); on a zone edge it resizes the zone.
- The chip sits clear of the edge it describes and flips inside the canvas near its borders. The Snap control no longer collides, because the chip is small.

## Outline card (plot boundary, house, custom outline)
- **Header:** swatch, name (tap to rename; the plot boundary's name is fixed and shows its area as a sub-line), eye.
- **Action row:** `Square corners`, `Redraw`, and a trash icon (features only).
- **While drawing:** the step hint, `Close shape` and `Cancel` as today; the nudge pad is no longer in the card.
- No Layer order row; reordering is the row grip (features only, within Outlines).

## Plant and object card
- **Header:** swatch, name wrapped over lines (no truncation), category in small caps, eye.
- **Body:** the size line ("12 ft wide"), `1 of N` with ‹ › to step through placed copies, trash icon. No photo (the photo stays in the Sheet view), no rotation control.
- Objects and utility markers use the same card, with their footprint as the size line.

## Surface card
- **Header:** swatch, name, area (as the zone is drawn; the calculator spec later swaps in net area), eye.
- **Body:** `Change material` (opens the picker in place), a collapsed **Adjust shape and texture** row, the action row (`Square corners`, `Redraw`, trash).
- **Adjust shape and texture** (collapsed by default, session-only open state): Width and Depth with the aspect lock (needs a scale); **Corner radius** field that **shows the current value** (`uniformRadius`), "Mixed" when corners differ, Apply on Enter or Done; Texture − / % / +.

## Nudge pad
- A small four-arrow pad on the canvas, shown only while a corner (or a zone with no corner selected) can be nudged, hidden otherwise.
- Position: fixed at the canvas's bottom-left, clear of the zoom controls and the Snap bar; 44 px buttons; same step as the arrow keys (`nudge()` in `outline-ui.ts`). The corner chip's Square and Round fields stay where they are.

## Drag to reorder
- A grip at the start of each row in Outlines (features) and Surfaces; drag within the section; the plan updates live; one drag is one undo step.
- Dragging must not hijack panel scrolling: only the grip starts a drag; hit area 44 px.
- Keyboard: focus a row, Alt+↑ / Alt+↓ moves it; the existing `moveLayer` and `layerPosition` provide the behavior.

## Components and data flow
- `layer-card.ts`: `editActions` becomes `Square corners`, `Redraw`, and an icon trash; `drawingCard` loses `nudgePad()`; `wireLayerCard` drops the `up`/`down` acts and the head-tap handling stays.
- `layers-ui.ts`, `surfaces-ui.ts`, `symbols-ui.ts`: new card bodies; rows gain the grip (`ui.ts` `layerRow`).
- `ui.ts`: remove `nudgePad` from cards; add a canvas-level `nudge-pad`, an icon-button helper, and a disclosure helper; `layerOrder` goes.
- `outline-ui.ts`: replace `renderPopover` and `renderSurfacePopover` with the chip (`edge-chip.ts`, with `positionPopover` logic reused), keeping `setEdgeLength`, `resizeEdge`, the keypad wiring and `straighten` / `unref` / `swap`.
- New pure helpers with unit tests: chip placement (midpoint, flip, clamp), the corner-radius display ("2′", "Mixed", ""), the ⋯ menu items for an edge, row reorder from a drag.
- No model, storage or save changes.

## Testing
- Unit: radius display, menu items per edge kind, chip placement, reorder result.
- Browser (Riesberg): chip appears on edge tap and edits with the keypad; scale set from a plot edge; zone edge resizes; ⋯ items show only when relevant; outline card shows header and action row only (and no arrows); keyboard arrows still nudge; nudge pad nudges a corner; plant card steps through copies; surface card disclosure; corner radius shows its value; drag a row to reorder (plan updates, one undo); Alt+↑/↓ reorders.
- Visual: screenshots at 1180 px and 820 px next to the findings mockups.
- Existing scripts updated for removed controls (`Redo` → `Redraw`, ×, Layer order, popover selectors).
- Checks: `npm run lint`, `npm run typecheck`, `npm test`, plus the Riesberg scripts.

## Open items
- Chip details: a drag handle to move it, and its hit area on very short edges.
- Whether a collapsed disclosure should remember its state per plan.
- Whether the nudge pad appears for keyboard users (default off for fine pointers).
- The plan label style, rotation and plant resize handles are specified separately and must not collide with the chip and pad.

## Workflow
- Commit on `feat/slim-cards`. No push, PR or auto-merge until the user says so.
