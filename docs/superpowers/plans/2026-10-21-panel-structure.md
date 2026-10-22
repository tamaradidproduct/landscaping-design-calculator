# Panel structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the right Layers panel per the panel-structure spec: guided unlock, global Add, new section order, empty sections hidden, read-only Sheet view, split canvas controls.

**Architecture:** A pure `panel-state.ts` decides the unlock state, which sections show and the Outlines hints. `main.ts` applies it on every `changed()`. Sections keep their own pickers; a new `AddMenu` opens them via `openPicker()`. A new `sheet-ui.ts` replaces `plant-list-ui.ts`, fed by `plantList()`. Undo/Redo and zoom/Fit move to canvas corners with unchanged ids.

**Tech Stack:** Vite, TypeScript, vitest, playwright-core scripts in `plan-builder/scripts/`.

**Spec:** `docs/superpowers/specs/2026-10-20-panel-structure-design.md` (supersedes section order and Plant list in `2026-10-19-handoff-panel-design.md`).

## Global Constraints

- Run everything in `plan-builder/`; checks: `npm run lint`, `npm run typecheck`, `npm test`.
- Tokens only from `src/styles/tokens.css` (never edited); no model, storage or save changes.
- Section order: **Plants & objects → Edges & walls → Surfaces → Outlines**; "Lines" renamed **Edges & walls** (group key stays `lines`).
- Unlocked = scale set OR any placed item (surface zone, symbol, line) exists.
- Ids kept: `undo`, `redo`, `zoom-in`, `zoom-out`, `fit`; 44 px hit areas; ⌘Z / ⇧⌘Z unchanged.
- No push, PR or auto-merge. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Older plan (items, no scale) must show sections and Add — pinned in Task 1.
- Boundary drawn but not closed: still `locked`, no Add — Task 1.
- Closed boundary reopened by undo drops back to locked — Task 1 (pure function re-evaluated each change).
- A section that is empty but whose picker is open stays visible until the pick completes or is cancelled — Task 2.
- Sheet with no scale shows "no scale" for edges, and an empty plan shows a quiet empty note — Task 3.

---

### Task 1: `panelState`, section visibility, hints, new order

**Files:**
- Create: `src/panel-state.ts`, `src/panel-state.test.ts`
- Modify: `src/sections.ts` (GROUPS order), `src/sections.test.ts`

**Interfaces:**
- Produces:
  - `type PanelState = 'locked' | 'needs-scale' | 'ready'`
  - `panelState(p: { boundaryClosed: boolean; scaleSet: boolean; placed: number }): PanelState` — `placed` = surface zones + symbols + lines.
  - `visibleGroups(state: PanelState, counts: Record<Group, number>): Group[]` — in `GROUPS` order; `outlines` always; the others only when `ready` and count > 0.
  - `outlinesHints(state: PanelState, drawing: boolean): string[]` — locked and not drawing: `['Outline the plot boundary.']`; needs-scale and not drawing: `['Tap an edge and type its printed length to set the scale.', 'Then outline the house and other existing features.']`; otherwise `[]`.

- [ ] **Step 1: Write failing tests** in `panel-state.test.ts`: `panelState({boundaryClosed:false,scaleSet:false,placed:0})` → `locked`; `{true,false,0}` → `needs-scale`; `{true,true,0}` → `ready`; older plan `{true,false,3}` → `ready`; `{false,false,2}` → `ready` (items win); `visibleGroups('locked', all 5)` → `['outlines']`; `visibleGroups('ready', {symbols:0,lines:2,surfaces:0,outlines:1})` → `['lines','outlines']`; `visibleGroups('ready', all >0)` → `['symbols','lines','surfaces','outlines']`; the three hint cases and `[]` while drawing. In `sections.test.ts` add `expect(GROUPS).toEqual(['symbols','lines','surfaces','outlines'])`.
- [ ] **Step 2: Run** `npx vitest run src/panel-state.test.ts src/sections.test.ts` → FAIL.
- [ ] **Step 3: Implement** `panel-state.ts` per Interfaces; change `GROUPS` in `sections.ts`.
- [ ] **Step 4: Run** same command → PASS.
- [ ] **Step 5: Commit** `feat: panelState, visible sections, new section order`.

### Task 2: Global Add, hidden empty sections, guided Outlines

**Files:**
- Create: `src/add-menu.ts`
- Modify: `index.html`, `src/main.ts`, `src/symbols-ui.ts`, `src/lines-ui.ts`, `src/surfaces-ui.ts`, `src/layers-ui.ts`, `src/styles/components.css`

**Interfaces:**
- Consumes: Task 1 functions.
- Produces:
  - `SymbolsSection|LinesSection|SurfacesSection`: `openPicker(): void` (sets picking, deselects, renders, focuses the search) and `get pickerOpen(): boolean`. Their per-section empty hints and "Add …" suggest rows are removed (Surfaces' "Outline the plot boundary first." too).
  - `class AddMenu { constructor(el: HTMLElement, choose: (g: 'symbols'|'lines'|'surfaces') => void); render(visible: boolean): void }` — `#add` mount: primary `+ Add` button (`id="add-button"`, `aria-expanded`); when open, three buttons `data-add="symbols|lines|surfaces"` labelled "Plant or object", "Edges & walls", "Surface", then closes.
  - `OutlinesSection`: empty-plan hint and scale hint replaced by `outlinesHints(...)` lines.

- [ ] **Step 1: index.html** — wrap each group's `.group-line` + `.group-body` in `<div class="layer-group" id="section-<group>">`, reorder to symbols, lines, surfaces, outlines; rename Lines title to "Edges &amp; walls" and eye labels in `main.ts` (`'edges and walls'`); add `<div id="add">` under the Layers header.
- [ ] **Step 2: Implement** `openPicker`/`pickerOpen` and remove empty hints/Add rows in the three sections; `OutlinesSection` hints via `outlinesHints(panelState(...), !!t.drawing)`.
- [ ] **Step 3: Implement** `AddMenu` and wire in `main.ts` `updateGroups()`: compute `panelState` from `tool.boundaryClosed`, `!!tool.cal`, placed count; `section-<g>.hidden = !visible.includes(g) && !section.pickerOpen && !(tool.drawing/placing/lineDraft for that group)`; hide each section's eye while its count is 0; `add.render(state === 'ready')`.
- [ ] **Step 4: Verify** `npm run typecheck && npm test` pass; in the preview (`?store=memory`) the empty plan shows only Outlines with "Outline the plot boundary."
- [ ] **Step 5: Commit** `feat: global Add, guided unlock, empty sections hidden`.

### Task 3: Sheet view, Plant list removed

**Files:**
- Create: `src/sheet-ui.ts`, `src/sheet-ui.test.ts`
- Delete: `src/plant-list-ui.ts`
- Modify: `index.html`, `src/main.ts`, `src/styles/components.css` (drop `.plant-list > summary`, add `.sheet` / toggle rules)

**Interfaces:**
- Produces: `sheetHtml(list: PlantList, selected: { symbol?: string; line?: string; material?: string }): string` (pure) and `renderSheet(el: HTMLElement, tool: OutlineTool): void` which also wires card taps: plant/object/marker → `tool.selectSymbol(firstPlacedId)`, edge → `tool.selectLine(firstId)`, surface → `tool.selectOutline(firstZoneId)`; selected card gets `.selected`.
- Header row: "Layers" + `.segmented#layers-view` with `button[data-view=edit]` "Edit" and `button[data-view=sheet]` "Sheet" (aria-pressed); `#layers-edit` holds Add + sections, `#layers-sheet` the sheet. Not persisted.

- [ ] **Step 1: Failing tests** in `sheet-ui.test.ts`: `sheetHtml` of an empty `PlantList` contains the note "Nothing on the plan yet."; with one plant (quantity 3) contains group caption "Plants", its name and `>3<`; an edge with `feet: null` contains "no scale"; markers under "Utility markers"; group order Plants, Objects, Utility markers, Edges & walls, Surfaces; a selected symbol id adds `selected`.
- [ ] **Step 2: Run** `npx vitest run src/sheet-ui.test.ts` → FAIL.
- [ ] **Step 3: Implement** `sheetHtml` (reuse the old card/row markup and classes from `plant-list-ui.ts`, with `data-sheet-symbol|line|material` hooks, cards as buttons) and `renderSheet`.
- [ ] **Step 4: Run** → PASS. Remove `plant-list-ui.ts`, the `#plant-list` details block and its `renderPlantList` calls; toggle swaps `#layers-edit` / `#layers-sheet` and re-renders the sheet from `changed()` while open.
- [ ] **Step 5: Commit** `feat: read-only Sheet view replaces Plant list`.

### Task 4: Canvas controls

**Files:** Modify `index.html`, `src/styles/plan.css` (or `components.css`), `src/main.ts` only if ids move (they do not).

- [ ] **Step 1:** Remove the two undo/redo and zoom/Fit `side-section`s. Add `<div class="canvas-controls top-right">` with `#undo`, `#redo` and `<div class="canvas-controls bottom-right">` with `#zoom-out`, `#zoom-in`, `#fit`, inside `#canvas` after `.dock`. Buttons: `class="icon"` with SVG glyphs (`line-icon`), `aria-label` + `title` ("Undo (⌘Z)", "Redo (⇧⌘Z)", "Zoom out", "Zoom in", "Fit page"), `disabled` for undo/redo initially.
- [ ] **Step 2:** CSS: absolute corners (top-right offset by `--space-6` and safe-area insets, bottom-right by `--space-8`), `--color-surface` background, `--color-muted` glyph, `--shadow-sm`, `:disabled` faint via `--opacity-layer-off`, 48 px (`--control-md`). Tokens only.
- [ ] **Step 3:** Verify in the preview at 1180 and 820 px: no overlap with `.plan-head` or the Snap/shape dock; `document.querySelector('#sidebar #undo')` is null.
- [ ] **Step 4: Commit** `feat: undo/redo top-right, zoom/fit bottom-right on the canvas`.

### Task 5: Check scripts and final verification

**Files:** Modify `scripts/check-lines.mjs`, `scripts/check-symbols.mjs`, and any script that clicks removed per-section Add rows (`grep -n "add-symbol\|add-line\|add-surface\|plant-list" scripts/*.mjs`), changing them to open the picker through `#add-button` + `[data-add=…]` (and to set a scale first where needed) and the Sheet toggle for plant counts (`#layers-sheet .plant-count`).

- [ ] **Step 1:** Update selectors; add a new `scripts/check-panel.mjs`: empty plan shows only Outlines; after a closed boundary + typed edge length `#add-button` and `Add` menu appear; each `data-add` opens its picker; a section appears on its first item; Sheet toggle shows grouped cards and tapping one selects on the plan; ⌘Z / ⇧⌘Z work; controls live in the canvas corners.
- [ ] **Step 2:** Run `npm run lint && npm run typecheck && npm test`, then the touched Riesberg scripts against `test-fixtures/address-text.pdf` with the dev server on 5180. Expected: all pass.
- [ ] **Step 3:** Screenshots at 1180 and 820 px; commit `test: update Riesberg checks for the new panel`.
