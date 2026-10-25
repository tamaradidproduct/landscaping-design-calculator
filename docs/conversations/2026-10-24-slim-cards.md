# Plan Builder: slimmer cards and overlays (2026-10-24)

Spec: `docs/superpowers/specs/2026-10-24-slim-cards-design.md`. Decisions behind it: `docs/conversations/2026-10-20-handoff-panel-findings.md`. Branch `claude/slim-cards-build-161fd4`; not pushed.

## Decided
- Cards and overlays get quiet and short: card height targets of about 110 px (outline), 110 px (plant) and 150 px (surface, closed).
- **Redo** is renamed **Redraw** and is an icon-only button (new `replace` icon with an aria-label).
- **Delete** is a trash icon (aria-label "Delete"), never a full-width button; the plot boundary has none. The card's **×** goes: it closes by tapping its head, tapping empty plan, or Escape.
- **Square corners** (user amendment) is a **floating canvas button** on every device while an outline or zone is selected, not a card button.
- **Nudge arrows** (user amendment) leave the cards. Keyboard arrows are unchanged; a **touch-only floating nudge pad** (coarse pointer) shows only while a corner, or a finished zone with no corner, can be nudged.
- **Layer order** becomes a **grip on each row** (Outlines features, Surfaces); **Alt+↑ / Alt+↓** on the grip is the keyboard path.
- **Corner radius** shows its value (`2`), or **Mixed** when corners differ; a blank field changes nothing.
- The surface card's **Shape and texture** disclosure holds Size, Corner radius and Texture and is **closed by default**.
- The **edge chip** replaces the edge popover: length, ⓘ, ⋯; the length opens the numeric keypad (#28) and its Done key saves.
- Plant card: no photo, no rotation for plants (objects and markers keep a Rotate row), `N of M` with ‹ › and a trash icon.

## Built
- Outline card: header (swatch, name or boundary area, eye) and one action row (Redraw, trash). Drawing state keeps the step hint, Close shape and Cancel.
- Plant and object card: size in the header sub-line ("Evergreen tree · 10 ft wide"), one body row (`N of M`, ‹ ›, trash). Also fixed a bug: tapping a plant row did nothing (a `data-symbolrow` vs `data-symbol-row` mismatch).
- Surface card: header with area, the disclosure, and an action row with Material (aria-label Change material), Redraw and trash. `OutlineTool.cornerRadiiFt` and the pure `radiusDisplay` / `roundAllRequest` helpers back the radius field.
- Drag to reorder: `OutlineTool.moveLayerTo` (one undo step, no-op adds none); Escape or a lost pointer cancels; grips are 48 px with `touch-action: none`; touch drag works.
- Canvas: nudge pad (`nudgePadVisible`), floating Square corners button, edge chip (`edge-chip.ts`, `chipPositionAvoiding` keeps it inside the plan and clear of the Square corners button). The ⋯ menu lists Make straight (curved edges only), Remove this length (edges with a reference) and Swap fixed end (zone edges).
- Browser checks: `scripts/check-slim-cards.mjs` (151 checks, absorbs the reorder, nudge-pad and edge-chip scripts); the other check scripts updated for the chip, keypad, Redraw and grips. Lint, typecheck and vitest pass.
- PRD updated: §6.1 (cards, reorder, nudge pad, edge chip), §6.2, §6.3, §6.7, §6.8 (surface card) and §6.10 (plant card).

## Deviations from the plan
- **Card heights miss the targets.** Measured at 1180 px and 820 px (panel card 252 px wide): outline 119 px (target 110), plant 116 px (110), surface closed 171 px (150). Controls stay at 44 to 48 px, so three rows plus card padding cannot reach 150 without removing a row.
- **Zone edge with no scale shows "No scale"** and the length button is disabled (no keypad). The plan said the chip would set a length; typing on a zone edge resizes the zone, which needs a scale.
- **Square corners is not in the cards** (the plan kept it in the action row): moved to the floating canvas button on the user's amendment.
- **The ⓘ tip is a tooltip only** (title and aria-label), so touch has no way to read it yet.
- The nudge pad sits one control row above the bottom dock (at 820 px it overlapped the Snap toggle).
- The Alt+Arrow path works on a focused grip; the selected row's expanded card has no grip, so it cannot be dragged while open.
- Surfaces drag-reorder was verified in the same browser check as Outlines (grip drag, Escape, Alt+Arrow, one undo).
- Pre-existing, untouched: at Fit zoom a small zone's corner click can miss; zoom in to select it.

## Deferred
- Rotate and resize handles (zones, objects, lines, markers at 15°; plant size and the nursery container picker).
- Plant sizes and containers (install vs mature; research in `docs/plant-nursery-sizes.md`).
- Plan label style.
- Material grid and entry (shape-first surfaces).
- Surface calculator and Quantities in the Sheet view.
- Floating canvas tools replacing the panel's + Add and Make surface (spec 3).
- Tap-to-show edge tip on touch (the ⓘ tooltip today).
- Card height compaction to reach the 110 and 150 px targets.
