# Handoff-style right panel — design

Date: 2026-10-19 · Branch: `feat/handoff-panel` · Status: draft for review

## Goal
- The right panel reads like the customer handoff ("Annotations and plant list", Figma `dInKvof2isrTso3C8gb4T5`, node `117:12027`), so the contractor sees what the customer gets while drawing.
- Layers and the Plant list merge into one view; every row is a handoff-style card.
- Editing stays: eyes, tap-to-select, expanding cards, Add… pickers.

## Constraints
- Panel stays docked, 280 px wide; controls ≥ 44 px; works offline on tablets.
- Tokens only from `tokens.css` (never hand-edited); a new token also goes into the Plan Builder artifact.
- No model, storage or save changes.

## Decisions
- Whole panel, one merged view (not just the Plant list restyled).
- Layout A: every row is a handoff-style card; photo and (later) water table live in the expanded state.
- Water consumption is skipped for now (separate follow-up).

## Structure
- Undo/Redo, zoom − / + and Fit page move off the panel onto a floating bar on the canvas, so the panel is only the sheet.
- Section order: **Surfaces → Plants & objects → Lines → Outlines**. Today Lines sits above Plants & objects; this changes only the panel order, not the draw order on the plan.
- Plants & objects splits into **Plants / Objects / Utility markers** by sub-captions, as on the sheet.
- Sections keep chevron, count, eye and their "Add…" button.
- Lines and Outlines are not on the customer sheet, so they sit below.
- The separate Plant list panel goes away.

## Cards
- **Collapsed row (handoff row):** ~56 px plan-view art on the left; name with category in small caps beneath; big quantity on the right with its label ("QUANTITY"); eye per kind; hairline divider between rows.
- **Surfaces:** larger swatch and name only (sq ft quantities are not built yet).
- **Lines:** length and runs (from `plant-list.ts`, already computed).
- **Expanded card (tap a row):** the library photo at the top, then today's controls (size hint, Rotate, Delete). Surfaces, Lines and Outlines cards are unchanged.
- **Grouped rows:** tapping a kind selects its next placed instance, as today. The quantity is the group's count; the card is one instance, labelled "1 of N".

## Components and data flow
- Remove `plant-list-ui.ts` and the `#plant-list` mount (two `renderPlantList` calls in `main.ts`). Keep `plant-list.ts` (pure, tested); it still feeds line totals.
- `ui.ts`: add a handoff-row variant of `layerRow` (art, name, category, quantity, eye).
- `symbols-ui.ts`: render the sub-captions and the new row; add the photo to `card()`.
- `surfaces-ui.ts`, `lines-ui.ts`: use the larger swatch / line totals in their rows.
- `components.css`: new classes for the handoff row and photo.
- Data flow is unchanged: tool state re-renders each section.
- Photos load only when a card expands (not all 51 at once).

## Testing
- Unit (`npm test`): new pure helper for the row (name, category, quantity, "1 of N" label); section order; existing `plant-list.test.ts` and `sections.test.ts` keep passing.
- Browser: new `scripts/check-panel.mjs` on the Riesberg plan: place plants, objects and markers; sub-captions and quantities show; tapping steps through instances; the expanded card shows the photo; an eye hides a kind; `#plant-list` is gone; Surfaces, Lines and Outlines cards behave as before.
- Visual: screenshot at tablet width, compared with the handoff sheet.
- Check commands: `npm run lint`, `npm run typecheck`, `npm test`, plus the Riesberg Playwright checks.
- To verify: whether library photos are cached for offline use.

## Out of scope
- Water tables and data (follow-up: research all 51 plants with a source each, like `docs/symbol-sizes.md`).
- Surface sq ft quantities.
- PDF export of the sheet.
- A per-instance list.

## Docs to update
- PRD §6.1 (side panel), §6.10 (Plant list merged into Layers), §6.11 (section order).

## Workflow
- New branch off `main`. No push, PR or auto-merge until the user says so.
