# Panel structure — design

Date: 2026-10-20 · Branch: `feat/handoff-panel` · Status: draft for review
Supersedes the section order and Plant list handling in `2026-10-19-handoff-panel-design.md`. Findings behind it: `docs/conversations/2026-10-20-handoff-panel-findings.md`.

## Goal
- The right panel is quiet while editing and guides a new plan through: outline the plot boundary, set the scale, outline the house and other existing features, then add surfaces, plants and objects, and edges and walls.
- One global Add replaces per-section empty states and Add buttons.
- The customer sheet is a separate view of the same data, and the source for export.

## Decisions
- Section order: **Plants & objects → Edges & walls → Surfaces → Outlines**. "Lines" is renamed **Edges & walls**. Draw order on the plan does not change.
- Until the plot boundary is outlined, it is the only available step.
- Plants & objects, Edges & walls, Surfaces and the global Add appear once the **scale is set**.
- Empty sections are hidden until their first item. No per-section hints or Add buttons.
- Global **+ Add** at the top of the panel opens a type menu (Plant or object, Surface, Edges & walls); the chosen type's picker opens in place.
- Plant list is removed from Layers. Layers rows stay compact; the rich handoff cards live in a read-only **Sheet** view behind an Edit | Sheet toggle.
- Undo/Redo move to the canvas top-right; zoom −/+ and Fit move to the canvas bottom-right.

## Panel states
- **No closed boundary:** the panel shows the Outlines section only, with the hint "Outline the plot boundary." Nothing else.
- **Boundary closed, no scale:** Outlines only, with hints: tap an edge and type its printed length to set the scale; then outline the house and other existing features.
- **Scale set:** the full panel (below).
- **Older plans:** a plan that already has items but no scale (saved before this change) shows its sections and Add as if unlocked, so nothing placed is hidden. Rule: unlocked = scale set OR any placed item exists.

## Layout when unlocked (top to bottom)
- **Header row:** "Layers" and the Edit | Sheet toggle.
- **+ Add:** primary button. Menu items: Plant or object, Surface, Edges & walls. Each opens its picker in place, replacing the menu; the surface picker and material list follow the surface-entry spec.
- **Sections** in the fixed order. Header: chevron, name, count, eye. The eye appears once the section has items.
- **Outlines:** always visible, with its existing plot boundary, House and Custom outline behavior and the Plot plan layer.

## Rows and cards
- **Compact row:** art or swatch, name, count (× N), eye. Selecting a row expands its card.
- **Cards** are slimmed in a separate spec (edge card, outline card, plant card, round-corners value).
- Rows keep their `data-*` hooks and ids used by the browser check scripts.

## Sheet view
- Read-only. Fed by `plantList()` (one source of quantity for the panel counts, the sheet and export).
- Groups: Plants, Objects, Utility markers, Edges & walls (length, runs; "no scale" without a scale), Surfaces (name now; area when the calculator exists).
- Each card: plan-view art, name, category in small caps, big quantity, photo.
- Selecting a card selects and highlights that item on the plan.
- Water table: out of scope.

## Canvas controls
- **Top-right:** Undo, Redo; icon-only, muted until pressed, tooltips and aria-labels; a faint disabled state.
- **Bottom-right:** zoom −, + and Fit; same treatment.
- **Keyboard shortcuts stay:** ⌘Z undoes and ⇧⌘Z redoes (Ctrl on Windows/Linux), unchanged by the move. Tooltips show the shortcut; a browser check presses both.
- Ids stay `undo`, `redo`, `zoom-in`, `zoom-out`, `fit`; 44 px hit areas. Clear of the plan header (top-left) and the Snap chip.

## Components and data flow
- A pure `panelState(plan)` returns `locked | needs-scale | ready` and which sections show, from the closed boundary, scale and placed items. Unit-tested.
- `index.html` and `main.ts`: one Layers panel with the header row, Add, and mounts for the sections in the new order; the sections render themselves hidden when empty. `GROUPS` in `sections.ts` takes the new order.
- `plant-list-ui.ts` and the `#plant-list` mount are removed. The Sheet view is a new module reading `plantList()`.
- No model, storage or save changes.

## Testing
- Unit: `panelState` for each state including the older-plan rule; section order; empty sections hidden; `plantList()` unchanged.
- Browser (Riesberg): ⌘Z and ⇧⌘Z still undo and redo; only Outlines before the boundary and scale; Add appears after the scale; each type opens its picker; a section appears on its first item; the Sheet toggle shows grouped cards and selecting one selects on the plan; controls exist in the canvas corners and none in the sidebar.
- Visual: screenshots at 1180 px and 820 px.
- Checks: `npm run lint`, `npm run typecheck`, `npm test`, plus the Riesberg Playwright scripts.

## Out of scope (own specs)
- Card and overlay slimming; surface entry and material list; surface calculator; plant and object sizes; export.

## Open items
- Exact wording of the locked and needs-scale hints.
- Edit | Sheet toggle fit in the 280 px header.
- Where Export lives (likely the Sheet view).

## Workflow
- Commit on `feat/handoff-panel`. No push, PR or auto-merge until the user says so.
