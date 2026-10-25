# Add tools and material grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the panel's + Add and the three separate pickers with a row of four tools (Add, Surface, Edge, Plant), one search with category tags, and a grid of large thumbnails; surfaces can start from the shape or the material.

**Architecture:** A pure `search-index.ts` builds one list from `MATERIALS`, `SYMBOLS` and `LINE_ITEMS`; `tool-row.ts` renders the row and the popover (search, tags, grid) and tells the existing tool what was chosen (`startSurface`, arm placing, start a line). A surface may have no material (unassigned); `outline-ui.ts` gains `duplicateAsSurface`.

**Tech Stack:** TypeScript, Vite, Vitest, HTML-string UI builders, Playwright check scripts (`plan-builder/scripts/`).

**Spec:** `docs/superpowers/specs/2026-10-24-add-tools-and-materials-design.md`

**Prerequisites:** build after `feat/handoff-panel` (PR 51), the slim-cards branch and the plot-fill merge have landed, so the outline card (Task 6) and "Fill the plot" (Task 6) exist. If any is missing, stop and report.

All paths are relative to `plan-builder/` unless they start with `docs/`. Run commands there.

## Global Constraints

- Panel stays 280 px; controls at least 44 px; tokens only from `src/styles/tokens.css`; works offline.
- Tools are dimmed with a hint until the scale is set (`panelState` is `ready`); Outlines stays available. Tapping a dimmed tool shows the hint, never an error.
- A tap on a material, plant or line item applies at once and is undoable (one undo step).
- Recent is kept on the device in `localStorage` (wrapped in try/catch), not in the plan.
- The only storage change: a surface's `material` may be absent (unassigned); old plans load unchanged.
- Sentence case, no terminal punctuation on labels. Keep ids `undo`, `redo`, `zoom-in`, `zoom-out`, `fit`.
- Check commands: `npm run lint`, `npm run typecheck`, `npm test`; Riesberg checks need `../samples/riesberg-plot-plan.pdf` and the dev server on 5180.
- Do not push or enable auto-merge; commit with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A non-empty query searches every category whatever tag is active — Task 1 test.
- Recent never exceeds its limit, never repeats an item, and a corrupt or blocked `localStorage` leaves the grid working — Task 1 test.
- An unassigned surface never counts in quantities, the Sheet or Preview, and a saved plan with one reloads — Task 2 tests.
- Dismissing the grid after Close shape keeps the zone (hatched, "Not counted yet"), not deleting it — Task 5 check.
- Duplicate as surface leaves the original outline untouched and is absent on the House — Task 6 test.
- Starting a tool while another is active (or while drawing) switches cleanly without a stuck draft — Task 4 check.

---

### Task 1: Search index and Recent (pure)

**Files:**
- Create: `src/search-index.ts`, `src/search-index.test.ts`

**Interfaces:**
- Produces:
  - `type Category = 'surfaces' | 'symbols' | 'lines'`
  - `interface SearchEntry { id: string; category: Category; name: string; family: string; thumb: string }`
  - `searchEntries(): SearchEntry[]` — one entry per material (family from the material), per symbol (family from the symbol; plants, objects, markers), per line item.
  - `tagsFor(category: Category | 'all'): string[]` — `'all'` → `['All','Recent','Surfaces','Plants & objects','Edges & walls']`; a category → `['All','Recent', ...its families]` (Surfaces: the six material families).
  - `search(query: string, tag: string, entries: SearchEntry[], recent: string[]): SearchEntry[]` — empty query: `tag` All = every entry, Recent = the entries whose ids are in `recent` in that order, a category or family tag filters to it; a non-empty query ignores `tag` and matches `name` and `family` case-insensitively, name matches first.
  - `pushRecent(recent: string[], id: string, limit?: number): string[]` (default limit 8, newest first, no duplicates); `loadRecent(): string[]` and `saveRecent(r: string[]): void` over `localStorage` key `recent-picks`, both wrapped in try/catch and returning `[]` or doing nothing on failure.

- [ ] **Step 1: Write failing tests**: `search('sod','Pavers & stone',…)` returns Premium sod (tag ignored); `search('', 'Recent', …, ['b','a'])` returns `b` then `a`; a family tag returns only that family; `tagsFor('surfaces')` ends with the six family names; `pushRecent(['a','b'],'b')` → `['b','a']`; with 9 distinct ids the length is 8; `loadRecent` returns `[]` when `localStorage` throws.
- [ ] **Step 2: Run** `npx vitest run src/search-index.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the functions as specified.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tools): search index, tags and Recent`.

### Task 2: Unassigned surfaces

**Files:**
- Modify: `src/outline.ts` (the `Outline` type: `material?: MaterialId`), `src/plan-model.ts`, `src/plan-model.test.ts`, `src/plant-list.ts`, `src/plant-list.test.ts`, `src/outline-ui.ts` and the surface render code (hatched fill), `src/styles/*.css`

**Interfaces:**
- Produces: `isAssigned(o: Outline): boolean` in `outline.ts` — true when `o.kind !== 'surface'` or `o.material` is a known material id.
- Behavior: validation and `normalize` accept a surface with no material; every `material!` use in the surface code paths handles absence (swatch falls back to a neutral hatched look, label "Not counted yet" in the card); `plantList` and the Sheet count only assigned surfaces; the plot-fill surface is always assigned.

- [ ] **Step 1: Write failing tests.** `plan-model.test.ts`: a plan whose surface has no material validates and round-trips through `normalize`; `plant-list.test.ts`: a zone without a material is absent from `plantList().surfaces`; `outline.test.ts`: `isAssigned` false for a surface with no or unknown material, true for a feature.
- [ ] **Step 2: Run** `npx vitest run src/plan-model.test.ts src/plant-list.test.ts src/outline.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the type change and handle absence wherever TypeScript now complains (`npm run typecheck` lists the sites); add the hatched fill pattern to the surface renderer using a token for its colours.
- [ ] **Step 4: Run** the tests, `npm run typecheck`, `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(surfaces): surfaces can exist without a material`.

### Task 3: Tool row and popover (replaces + Add)

**Files:**
- Create: `src/tool-row.ts`, `src/tool-row.test.ts`
- Modify: `index.html`, `src/main.ts`, `src/styles/components.css`; delete `src/add-menu.ts` and the `#add` mount

**Interfaces:**
- Consumes: `searchEntries`, `tagsFor`, `search`, `pushRecent`, `loadRecent`, `saveRecent` (Task 1); `panelState` (existing).
- Produces (`src/tool-row.ts`):
  - `type ToolId = 'add' | 'surfaces' | 'lines' | 'symbols'`
  - `toolRowHtml(o: { active: ToolId | null; ready: boolean }): string` — four `button.tool` in the order Add, Surface, Edge, Plant (`data-tool`), each with an icon and a short label; `aria-pressed` from `active`; when not `ready`, `aria-disabled="true"` and the `dim` class (they stay focusable).
  - `popoverHtml(o: { query: string; tag: string; tags: string[]; results: SearchEntry[]; hint?: string }): string` — a search `input#tool-search`, the tag chips (`data-tag`, the active one `aria-pressed`), and a two-column grid of `button.grid-cell[data-pick]` (large thumbnail, name below), or `hint` text when `results` is empty.
  - `class ToolRow { constructor(el: HTMLElement, pick: (e: SearchEntry) => void); setReady(ready: boolean): void; open(tool: ToolId): void; close(): void }` — owns query, tag and active tool; preselects the tag for the tool (`Add` → All, others → their category's first tag after Recent, i.e. the category tag itself).

- [ ] **Step 1: Write failing tests** in `tool-row.test.ts`: `toolRowHtml` lists four tools in order with the active one `aria-pressed="true"`; not ready → every tool has `aria-disabled="true"`; `popoverHtml` renders one `grid-cell` per result and escapes a name of `'<b>'`; with no results shows the hint.
- [ ] **Step 2: Run** `npx vitest run src/tool-row.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the builders and `ToolRow`; mount it under the "Layers" title in `index.html` (replacing `<div id="add">`); `main.ts` constructs it, calls `setReady` from `panelState(...) === 'ready'` on every update, and removes the `AddMenu` code; CSS for `.tool`, `.dim`, `.grid-cell`, the thumbnail size (about 84 px tall) and the two-column grid with tokens.
- [ ] **Step 4: Verify** `npm run lint && npm run typecheck && npx vitest run`. In the preview: the row shows, dimmed before the scale; tapping Surface after the scale opens search, tags and a grid; typing "sod" filters across categories.
- [ ] **Step 5: Commit** `feat(tools): tool row and search popover replace + Add`.

### Task 4: What each choice does

**Files:**
- Modify: `src/main.ts`, `src/surfaces-ui.ts`, `src/symbols-ui.ts`, `src/lines-ui.ts`, `src/outline-ui.ts` (small entry points only)

**Interfaces:**
- Consumes: `ToolRow` pick callback (Task 3); the existing `OutlineTool.startSurface(m: MaterialId)`, symbol arming and line start used by today's pickers.
- Produces: `OutlineTool.startSurfaceDrawing(): void` — starts drawing a surface with no material chosen yet (the tool the Surface button selects at once); `OutlineTool.pendingMaterial: MaterialId | null` — set when a material is picked before drawing and applied to the next closed shape.
- Behavior: tapping Surface calls `startSurfaceDrawing()` and opens the popover (Surfaces tag); picking a material sets `pendingMaterial` (or applies it to a shape just closed, Task 5) and records Recent; picking a plant or object arms placing; picking a line item starts that line; picking from the Add search routes by `entry.category`. Starting any tool cancels a draft of another kind cleanly (reuse `cancel()`).

- [ ] **Step 1: Implement** `startSurfaceDrawing` and `pendingMaterial` in `outline-ui.ts` and the pick routing in `main.ts`; delete each section's old picker (`Add…` rows, `picker`, `pickerList`, search forms) and the `openPicker` hooks, keeping their rows, cards and wiring.
- [ ] **Step 2: Verify** `npm run typecheck && npx vitest run` (update tests that referenced the old pickers). In the preview: Surface then a material then a drag draws that material; a plant pick arms placing; an Edge pick starts a fence; the Add search finds both "sod" and "maple".
- [ ] **Step 3: Commit** `feat(tools): picking from the grid starts drawing, placing or a line`.

### Task 5: Shape first and Change material

**Files:**
- Modify: `src/surfaces-ui.ts`, `src/outline-ui.ts`

**Interfaces:**
- Consumes: `isAssigned` (Task 2), `pendingMaterial` (Task 4), the popover grid (Task 3).
- Behavior: Close shape on a surface with no `pendingMaterial` creates the zone unassigned and opens the grid inside its card (an "Assign material" line with the grid); picking assigns it (one undo step); dismissing keeps the hatched zone, the card says "Not counted yet" with an Assign material button that reopens the grid. The surface card's Change material opens the same grid and a tap applies at once.

- [ ] **Step 1: Write a failing test** (`src/surfaces-ui.test.ts`, same style as `lines-ui.test.ts`): the card of an unassigned zone contains "Not counted yet" and an `Assign material` button; an assigned zone's card does not.
- [ ] **Step 2: Run** `npx vitest run src/surfaces-ui.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the flow; reuse `popoverHtml` for the in-card grid.
- [ ] **Step 4: Run** the test and `npx vitest run`. Expected: PASS. In the preview: draw first, pick later; dismiss and reopen; the Sheet and Preview omit the unassigned zone until assigned.
- [ ] **Step 5: Commit** `feat(surfaces): shape first, unassigned fill, shared grid for Change material`.

### Task 6: Duplicate as surface and Fill the plot

**Files:**
- Modify: `src/outline-ui.ts` (`duplicateAsSurface`), `src/layer-card.ts` / `src/layers-ui.ts` (outline card action), `src/tool-row.ts` (Fill the plot cell)

**Interfaces:**
- Produces: `OutlineTool.duplicateAsSurface(id: string): string | null` — copies the outline's `pts` and `bulges` into a new surface (no material, placed above the surfaces in layer order), selects it and returns its id; returns null for the House (`kind` feature named House) or an unknown id; the original is untouched; one undo step.
- Outline card: an icon button `data-act="duplicate-surface"` (aria-label and title "Duplicate as surface") beside the replace icon and trash; absent on the House. On the plot boundary the same slot reads "Fill the plot" and calls the plot-fill entry that `feat/plot-fill` provides; the Surface grid shows "Fill the plot" as its first cell once the boundary is closed.

- [ ] **Step 1: Write failing tests** (in `outline.test.ts` or the `OutlineTool` test file): `duplicateAsSurface` on a custom outline returns a new surface id with the same points, leaves the original, and `undo()` removes only the copy; on the House it returns null.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement** `duplicateAsSurface`, the card action and the Fill the plot cell, reusing the plot-fill function rather than copying it.
- [ ] **Step 4: Run** the test and `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(surfaces): duplicate an outline as a surface; Fill the plot from the grid`.

### Task 7: Browser checks and docs

**Files:**
- Modify: scripts that used the old pickers or `+ Add` (find with `grep -n "add-surface\|data-act=add\|#add\|symbol-search\|Add surface\|Add line\|add-button\|picker\|data-material\|data-symbol=" scripts/*.mjs`; known: `check-panel.mjs`, `check-surfaces.mjs`, `check-symbols.mjs`, `check-lines.mjs`, `check-visibility.mjs`, `check-collapse.mjs`, `check-undo.mjs`, `check-zone-edit.mjs`, `check-zone-size.mjs`, `check-step2a.mjs`, `check-step2c.mjs`, `check-stretch.mjs`, `check-shape-default.mjs`)
- Create: `scripts/check-tools.mjs`
- Modify: `docs/PRD.md` (§6.1, §6.8, §6.10, §6.11), create `docs/conversations/2026-10-24-add-tools.md`

- [ ] **Step 1: Add a helper** `addVia(page, tool, name)` to the scripts' shared harness (or inline it) that taps the tool, types `name` in `#tool-search` and taps `[data-pick]` for it; update every script to use it instead of the old pickers.
- [ ] **Step 2: Write** `check-tools.mjs` (each `check(name, ok, got)`): tools dimmed before the scale and active after; Surface starts drawing and opens the grid; material first then draw gives that material; draw first then pick gives an assigned zone; dismissing leaves a hatched zone with "Not counted yet" that the Sheet omits; the Add search finds a plant and a material with one query each; a non-empty query ignores the active tag; Recent shows the last picks; Edge starts a fence; Plant arms placing; Duplicate as surface on a custom outline leaves the outline and adds a zone, and is absent on the House; Fill the plot is offered only with a closed boundary; no `+ Add` or old picker remains.
- [ ] **Step 3: Run** `npm run dev`, then `check-tools` and every updated script. Expected: no `FAIL` or `STOPPED`. Discard regenerated `*.png` files.
- [ ] **Step 4: Screenshot** the panel at 1180 px and 820 px with each tool open; note visual gaps for the user.
- [ ] **Step 5: Update** the PRD and write the decision summary.
- [ ] **Step 6: Final verification** `npm run lint && npm run typecheck && npm test`. Expected: PASS.
- [ ] **Step 7: Commit** `test(tools): browser checks for the add tools; docs`.
