# Top bar — design

Date: 2026-10-24 · Branch: `feat/top-bar-and-tools` · Status: draft for review
Amends `2026-10-20-panel-structure-design.md` (canvas controls, Edit | Sheet toggle location) and the plan header of PRD §6.9. Decisions and mockups: `docs/conversations/2026-10-20-handoff-panel-findings.md`.

## Goal
- One narrow bar across the top holds everything about the plan as a whole: where you are, what you're looking at, history, and getting the plan out.
- The canvas and the right panel keep only drawing controls and layers.

## Decisions
- A **top bar**, 48 px tall, across the full width above the canvas and the right panel; docked, always visible in the editor.
- **Left:** back (←, to Plans), the plan's address or name, and a **⋯ plan menu** (Rename, Archive, Delete).
- **Center:** the **Edit | Preview** switch (the old "Sheet" view is now called Preview).
- **Right:** **Undo** and **Redo** (icon-only), a hairline, and **Export**.
- **Export** is a placeholder button for now: tapping it shows a toast "Export is coming soon" (no disabled button).
- Moved out of other places: the plan header pill on the canvas (top-left) and the Undo/Redo bar (canvas top-right) are removed; the Edit | Sheet toggle leaves the panel header. The panel header keeps only "Layers".
- Stays: **zoom −/+ and Fit** at the canvas's bottom-right; the Snap and shape bar at the canvas's bottom; Square corners next to a selected outline (spec 2).

## Behavior
- **Back:** goes to the Plans screen; the plan autosaves as today, with no prompt.
- **Name:** the address or plan name from today's header, capped with an ellipsis; tapping it does nothing (rename lives in the ⋯ menu). Name rules, uniqueness and archived state stay as in PRD §6.9.
- **⋯ menu:** Rename (inline edit as today), Archive (returns to Plans with a message), Delete (inline confirm, returns to Plans). Archive is kept because it exists today; the user's list named Rename and Delete.
- **Edit | Preview:** Edit is the drawing view. Preview is the read-only view from the panel-structure spec, which also hides the uploaded plot plan and fits the drawn plan to the view; switching back restores the plan, zoom and pan. Undo, Redo and the drawing tools are inactive in Preview (dimmed, no action).
- **Undo / Redo:** unchanged behavior and ids (`undo`, `redo`); ⌘Z and ⇧⌘Z still work; Redo is faint when there is nothing to redo.
- **Responsive:** at 820 px the name truncates first, then Export shows its icon only; Undo and Redo and the switch never collapse. Touch targets 44 px.

## Components and data flow
- `index.html`: a `<header class="top-bar">` row above the `.canvas` + `aside` row; the `plan-head` header and the canvas Undo/Redo bar are removed; the buttons keep their ids.
- A new `top-bar.ts` renders the bar (back, name, menu, switch, Undo, Redo, Export) from the editor state and wires them; the plan-menu logic moves from the plan header code into it unchanged.
- `main.ts`: the Edit/Preview state (was Edit/Sheet) lives where it does today; the bar sets it.
- Styles: a `.top-bar` block in `components.css` with tokens only; the icon-only Undo/Redo style comes from the quiet-controls pass.
- No model, storage or save changes.

## Testing
- Unit: the bar's HTML for each state (Edit and Preview, Redo available or not, long name, archived plan); the Export handler shows its toast.
- Browser (Riesberg): the bar exists above both canvas and panel; Back returns to Plans; the ⋯ menu lists Rename, Archive, Delete and each works; the switch toggles views and Preview hides the plot plan and the controls dim; Undo and Redo work from the bar and by ⌘Z and ⇧⌘Z; Export shows the toast; no Undo/Redo or plan header remains on the canvas; at 820 px nothing overlaps.
- Existing scripts that read `#plan-head` or the Edit/Sheet toggle are updated.
- Checks: `npm run lint`, `npm run typecheck`, `npm test`, plus the Riesberg scripts.

## Out of scope
- The Export flow itself (a later spec), plan settings beyond Rename, Archive and Delete.

## Open items
- Whether Export opens a menu (PDF, share) when it is built.
- The exact name in the bar on small widths.

## Workflow
- Commit on `feat/top-bar-and-tools`. No push, PR or auto-merge until the user says so.
