# Slimmer cards and overlays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shorten the outline, plant and surface cards, replace the edge popover with a small chip, and move nudging, reordering and corner-radius display to where they belong.

**Architecture:** Pure helpers (`card-helpers.ts`, `moveInSectionTo` in `outline.ts`) carry the logic and are unit-tested; `ui.ts` gets the small primitives (icon button, grip, disclosure, canvas nudge pad); the section classes re-render with the new card bodies; the chip is a new module (`edge-chip.ts`) that `outline-ui.ts` mounts in place of `renderPopover` / `renderSurfacePopover`, keeping the numeric keypad.

**Tech Stack:** TypeScript, Vite, Vitest, HTML-string UI builders, Playwright check scripts (`plan-builder/scripts/`).

**Spec:** `docs/superpowers/specs/2026-10-24-slim-cards-design.md` (builds on `2026-10-20-panel-structure-design.md`).

All paths are relative to `plan-builder/` unless they start with `docs/`. Run commands there.

## Global Constraints

- Controls at least 44 px; panel stays 280 px; works offline. Tokens only from `src/styles/tokens.css` (never hand-edited; a new token means `npm run tokens` and an update to the Plan Builder artifact).
- No model, storage or save changes. No water data.
- "Redo" becomes **Redraw** everywhere. Delete is an icon (aria-label "Delete"); the plot boundary has none.
- Card height targets: outline about 110 px, plant about 110 px, surface about 150 px closed.
- Sentence case, no terminal punctuation on labels (CDS content rules).
- Keep keyboard behavior: ⌘Z / ⇧⌘Z, arrow keys nudge a corner, Escape deselects. Keep element ids `undo`, `redo`, `zoom-in`, `zoom-out`, `fit`.
- Check commands: `npm run lint`, `npm run typecheck`, `npm test`. Riesberg checks need `../samples/riesberg-plot-plan.pdf` and the dev server on 5180.
- Do not push or enable auto-merge; commit on `feat/slim-cards` with the trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Corner radius with mixed values shows "Mixed" (never "0") and a typed value applies to every corner — Task 1 and Task 4 tests.
- A cancelled or no-op drag leaves the order unchanged and adds no undo step; the plot boundary never moves; a surface never lands in another section — Task 1 and Task 5 tests.
- The chip stays fully inside the canvas near its edges and on short edges — Task 1 test.
- An edge with no scale shows "Set length" (plot, feature) or "No scale" (zone) and still opens the keypad where it applies — Task 7 check.
- Removing the card's × and arrows must not leave a card that cannot close: row tap, empty plan and Escape still close it — Task 3 check.
- Objects and markers lose no way to rotate before the canvas rotate handle exists (they keep the compact Rotate row; plants do not) — Task 3 check.

---

### Task 1: Pure helpers

**Files:**
- Create: `src/card-helpers.ts`, `src/card-helpers.test.ts`
- Modify: `src/outline.ts` (add `moveInSectionTo` beside `moveInSection`), `src/outline.test.ts`

**Interfaces:**
- Produces (`src/card-helpers.ts`):
  - `instanceLabel(selectedId: string | null, ids: readonly string[]): string | null` — `"2 of 3"` (1-based position of `selectedId` in `ids`); null when `selectedId` is not in `ids` or `ids.length < 2`.
  - `radiusDisplay(radiiFt: readonly number[]): { value: string; placeholder: string }` — all equal and above 0 → `{ value: String(r), placeholder: '0′' }`; all 0 or empty → `{ value: '', placeholder: '0′' }`; differing → `{ value: '', placeholder: 'Mixed' }`.
  - `type EdgeKind = 'boundary' | 'feature' | 'surface'`; `interface EdgeMenuItem { act: 'straighten' | 'unref' | 'swap'; label: string }`
  - `edgeMenuItems(e: { kind: EdgeKind; curved: boolean; hasRef: boolean }): EdgeMenuItem[]` — `straighten` ("Make straight") when curved; `unref` ("Remove this length") when `hasRef` and kind is not `surface`; `swap` ("Swap fixed end") when kind is `surface`; in that order.
  - `chipPosition(mid: { x: number; y: number }, chip: { w: number; h: number }, stage: { w: number; h: number }, gap: number, margin: number): { left: number; top: number }` — centred on `mid.x` and below it by `gap`; flips above when it would pass the stage bottom; clamped to `margin` inside the stage on every side.
- Produces (`src/outline.ts`): `moveInSectionTo(keys: string[], outlines: Record<string, Outline>, id: string, beforeId: string | null): string[] | null` — new key order with `id` placed directly before `beforeId` (null = end of its own section), or null when `id` is the boundary, `beforeId` is in another section, or the order would not change.

- [ ] **Step 1: Write failing tests.** In `card-helpers.test.ts`: `instanceLabel('b', ['a','b','c'])` → `'2 of 3'`; `('a', ['a'])`, `(null, ['a','b'])` and `('z', ['a','b'])` → `null`; `radiusDisplay([2,2,2,2])` → `{ value: '2', placeholder: '0′' }`; `radiusDisplay([])` and `[0,0]` → empty value; `radiusDisplay([2,0,2,2])` and `[2,3]` → `placeholder: 'Mixed'`; `edgeMenuItems` for a curved feature edge with a reference → `['straighten','unref']`; a straight boundary edge with none → `[]`; a curved surface edge → `['straighten','swap']`, and a surface never offers `unref`; `chipPosition({x:100,y:50},{w:120,h:34},{w:400,h:300},8,6)` → `{ left: 40, top: 58 }`; near the bottom (`y: 290`) `top` is `290 - 8 - 34`; near the left (`x: 10`) `left` is `6`; near the right never exceeds `400 - 120 - 6`. In `outline.test.ts`: `moveInSectionTo` moves the last of three features before the first; returns null for the boundary, for a `beforeId` in another section, and when already in place; `beforeId: null` moves a feature to the section's end.
- [ ] **Step 2: Run** `npx vitest run src/card-helpers.test.ts src/outline.test.ts`. Expected: FAIL (missing exports).
- [ ] **Step 3: Implement** the four functions as specified; reuse the existing section ordering inside `moveInSection` to find a key's section.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(cards): pure helpers for radius display, edge menu, chip placement, reorder`.

### Task 2: UI primitives in `ui.ts`

**Files:**
- Modify: `src/ui.ts`, `src/ui.test.ts`, `src/styles/components.css`

**Interfaces:**
- Produces (`src/ui.ts`):
  - `iconButton(icon: 'trash' | 'info' | 'more' | 'chevron-left' | 'chevron-right', o: { ariaLabel: string; data?: Record<string, string>; variant?: 'danger'; pressed?: boolean }): string` — a `button.icon` with an inline SVG from the existing `line-icon` style (no new asset), `aria-label` and `title` set.
  - `LayerRowOptions.grip?: boolean` — when true, `layerRow` prefixes the item with `<span class="grip" role="button" tabindex="0" aria-label="Reorder {name}" data-grip="{data-layer or data-zone id}">` (44 px hit area) and wraps in `layer-item`.
  - `disclosure(id: string, label: string, open: boolean, bodyHtml: string): string` — a `button[aria-expanded]` row (label and a chevron) followed by the body only when open; the button has `data-disclosure="{id}"`.
  - `canvasNudgePad(): string` — a `div.nudge-pad` of four 44 px icon buttons keeping `data-nudge="dx,dy"`, no label.
- Removes: `layerOrder`, `nudgePad` (all callers are changed in Tasks 3 to 6; leave them until Task 6 deletes them).

- [ ] **Step 1: Write failing tests** in `ui.test.ts`: `iconButton('trash', { ariaLabel: 'Delete', variant: 'danger' })` contains `aria-label="Delete"` and a `danger` class; `layerRow(..., { grip: true, data: { layer: 'o1' } })` contains `data-grip="o1"` and `aria-label="Reorder`; `disclosure('adjust', 'Adjust shape and texture', false, '<p>x</p>')` contains `aria-expanded="false"` and not `<p>x</p>`, and with `open: true` contains both `aria-expanded="true"` and the body; `canvasNudgePad()` has four `data-nudge` buttons.
- [ ] **Step 2: Run** `npx vitest run src/ui.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the four helpers; add `.grip`, `.disclosure`, `.nudge-pad` rules to `components.css` (tokens only; `.nudge-pad` is `position: absolute`, bottom-left of the canvas).
- [ ] **Step 4: Run** the test, then `npm run typecheck && npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(cards): icon button, grip, disclosure and canvas nudge pad primitives`.

### Task 3: Outline and plant cards

**Files:**
- Modify: `src/layer-card.ts`, `src/layers-ui.ts`, `src/symbols-ui.ts`, `src/ui.ts` (`layerCard`)

**Interfaces:**
- Consumes: `iconButton`, `layerRow` `grip` option (Task 2); `instanceLabel` (Task 1).
- Produces: `editActions(deletable: boolean): string` renders `Square corners` and `Redraw` compact buttons plus, when deletable, `iconButton('trash', { ariaLabel: 'Delete', variant: 'danger', data: { act: 'delete' } })`. `LayerCardOptions.done` stays optional but no section passes it; `layerCard` renders no pencil icon (the rename field stays tappable, underlined). `drawingCard` no longer includes `nudgePad()` and keeps the step hint, Close shape and Cancel.
- Plant and object card body: size line, `1 of N` with ‹ › iconButtons (`data-act="prev"` / `"next"`) when the kind has more than one placed, a trash `iconButton` (`data-act="delete-symbol"`); no photo. Plants have no rotation control. **Objects and markers keep the existing compact Rotate row** (− / degrees / +) until the canvas rotate handle ships (separate spec).

- [ ] **Step 1: Implement** `editActions`, `drawingCard` and the `layerCard` change; remove the `orderControl` call and `nudgePad()` from `layers-ui.ts`; give feature rows `grip: true` (wired in Task 5).
- [ ] **Step 2: Implement** the plant and object card in `symbols-ui.ts` as specified (`instanceLabel` from `card-helpers.ts`, Task 1; the ids are the kind's placed ids from `t.symbols.groups()`).
- [ ] **Step 3: Verify** `npm run typecheck && npx vitest run`. Expected: PASS. In the preview (`npm run dev`, `?store=memory`): select a House row: header plus one action row, no arrows, no Layer order; tap the row, empty plan, Escape each close it; a plant card steps with ‹ ›; a planter card still has Rotate; a plant card has none.
- [ ] **Step 4: Commit** `feat(cards): slimmer outline and plant cards`.

### Task 4: Surface card

**Files:**
- Modify: `src/surfaces-ui.ts`, `src/outline-ui.ts` (add `cornerRadiiFt(id: string): number[]`)

**Interfaces:**
- Consumes: `disclosure`, `iconButton` (Task 2); `radiusDisplay` (Task 1); `editActions` (Task 3).
- Produces: `OutlineTool.cornerRadiiFt(id: string): number[]` — each corner's radius in feet (0 for sharp), `[]` without a scale.
- Surface card: header (swatch, name field, area text via `formatArea(areaSqft)` as a `sub` line), `Change material` (opens the picker as today), the `Adjust shape and texture` disclosure (open state kept in the section instance, closed by default, reset when the selection changes) containing Size (Width, Depth, aspect lock; scale only), Corner radius (`input('round-all', …)` with `value` and `placeholder` from `radiusDisplay(t.cornerRadiiFt(id))`, label "Corner radius", Enter or Done applies via `t.roundAll`), Texture − / % / +; then `editActions(true)`.

- [ ] **Step 1: Write a failing test** in `src/surfaces-ui.test.ts` (new, same style as `lines-ui.test.ts`): the card HTML of a zone with uniform radius 2 contains `value="2"`; with mixed radii contains `placeholder="Mixed"`; the disclosure body (`zone-width`, `round-all`, `tex-down`) is absent while closed and present after clicking `[data-disclosure=adjust]`.
- [ ] **Step 2: Run** `npx vitest run src/surfaces-ui.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `cornerRadiiFt` (feet = radii × `ftPerPt`, rounded to 0.01) and the new card body; the ArrowUp/Down stepping on the radius field stays and now steps from the displayed value (`'Mixed'` steps from 0).
- [ ] **Step 4: Run** the test, then `npm run typecheck && npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(cards): collapsed shape and texture controls; corner radius shows its value`.

### Task 5: Drag to reorder

**Files:**
- Modify: `src/outline-ui.ts` (`moveLayerTo`), `src/layers-ui.ts`, `src/surfaces-ui.ts`, `src/layer-card.ts` (remove up/down acts and `orderControl`), `src/styles/components.css`

**Interfaces:**
- Consumes: `moveInSectionTo` (Task 1), `layerRow` `grip` option (Task 2).
- Produces: `OutlineTool.moveLayerTo(id: string, beforeId: string | null): void` — applies `moveInSectionTo`, one `record()` for the whole move, then `update()`; no-op (no undo step) when it returns null. `OutlineTool.layerPosition` and `moveLayer` stay (the keyboard path uses them).
- A shared `wireReorder(listEl: HTMLElement, tool: OutlineTool): void` in `layer-card.ts`: pointerdown on a `[data-grip]` starts a drag of its row; while dragging, rows show a drop line before the row under the pointer; pointerup calls `tool.moveLayerTo(id, beforeId)`; pointercancel or Escape cancels with no change; only the grip starts a drag, so panel scrolling is untouched. Focused grip: Alt+ArrowUp / Alt+ArrowDown call `tool.moveLayer(id, -1 | 1)`.

- [ ] **Step 1: Write a failing test** in `src/outline.test.ts` or `src/editor-state.test.ts` (wherever `OutlineTool` is already exercised): after `moveLayerTo('f3','f1')` the order is `f3, f1, f2` and one `undo()` restores `f1, f2, f3`; `moveLayerTo` on the boundary or an unchanged order leaves `undo` unavailable.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement** `moveLayerTo`, `wireReorder` (called from `OutlinesSection` and `SurfacesSection` after each render) and the CSS for the grip and drop line; delete `orderControl` and the `up`/`down` acts.
- [ ] **Step 4: Run** the test and `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(cards): drag handles reorder layers; Alt+arrows for keyboard`.

### Task 6: Canvas nudge pad

**Files:**
- Modify: `index.html`, `src/main.ts`, `src/outline-ui.ts` (`get nudgeable`), `src/ui.ts` (delete `nudgePad`), `src/styles/components.css`

**Interfaces:**
- Consumes: `canvasNudgePad` (Task 2).
- Produces: `OutlineTool.nudgeable: boolean` — true while a corner is selected or a zone is selected with no corner (the cases `nudge()` already handles).

- [ ] **Step 1: Mount** `canvasNudgePad()` markup inside `.canvas` in `index.html` (hidden by default); in `main.ts`, wire each `[data-nudge]` button to `tool.nudge(dx, dy)` and toggle the pad's `hidden` from `tool.nudgeable` on every update, next to where the other canvas controls refresh.
- [ ] **Step 2: Remove** `nudgePad()` from `ui.ts` and any remaining call.
- [ ] **Step 3: Verify** `npm run typecheck && npx vitest run`. In the preview: select a corner → the pad shows at the canvas's bottom-left and nudges it; deselect → hidden; the keyboard arrows still nudge; the pad does not overlap zoom or Snap at 820 px width.
- [ ] **Step 4: Commit** `feat(cards): floating nudge pad on the canvas`.

### Task 7: Edge chip

**Files:**
- Create: `src/edge-chip.ts`, `src/edge-chip.test.ts`
- Modify: `src/outline-ui.ts` (replace `renderPopover` / `renderSurfacePopover` / `positionPopover`), `src/styles/components.css`

**Interfaces:**
- Consumes: `edgeMenuItems`, `chipPosition` (Task 1); `iconButton` (Task 2); `numericKeypad`, `wireLengthKeypad` (existing).
- Produces (`src/edge-chip.ts`): `edgeChip(o: { text: string; editing: boolean; field?: { value: string; placeholder: string }; menu: EdgeMenuItem[]; menuOpen: boolean; tip: string }): string` — a `div.edge-chip` showing the length as a button (`data-act="edit-length"`), an info `iconButton` whose `title` is `tip`, and, when `menu` is non-empty, a more `iconButton` (`data-act="menu"`); when `menuOpen` a `ul` of the items (each `data-act` = the item's `act`); when `editing` the length is replaced by the readonly `#edge-len` field, the numeric keypad and a Done key, inside a `form`.
- Chip text rules: with a scale `formatFeet(ft)`; no scale on a plot or feature edge `Set length`; no scale on a zone edge `No scale`. `tip` holds the old hints: "Drag the square in the middle of the edge to curve it, or tap the + to add a corner." plus, for plot and feature edges with a scale, "Lengths on edges running across and down also correct a stretched plan."; for zone edges, "The marked end stays put."
- Behavior kept from the popover: submit on a plot or feature edge calls `setEdgeLength`; on a zone edge `resizeEdge`; `straighten`, `unref` (`removeReference`) and `swap` (`swapFixedEnd`) behave as today; the chip closes with the edge selection (Escape, tap elsewhere).

- [ ] **Step 1: Write failing tests** in `edge-chip.test.ts`: `edgeChip({ text: '115.00′', editing: false, menu: [], menuOpen: false, tip: 'x' })` contains `115.00′` and `data-act="edit-length"` and not `data-act="menu"`; with a one-item menu contains `data-act="menu"`; with `menuOpen: true` contains the item's `data-act="straighten"`; with `editing: true` contains `id="edge-len"`, `readonly` and `keypad`.
- [ ] **Step 2: Run** `npx vitest run src/edge-chip.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `edgeChip`, then in `outline-ui.ts` replace the two popover renderers with one chip renderer that builds `edgeChip(...)` per the rules above, mounts it in the existing `.popover` element (rename the class to `edge-chip` in CSS), positions it with `chipPosition` from the edge midpoint (`this.host.toScreen`), and re-wires the keypad and menu actions. Delete `cardHead`, `figure` and `positionPopover` usages that become unused.
- [ ] **Step 4: Run** the test, `npm run typecheck`, `npm run lint`, `npx vitest run`. Expected: PASS. In the preview: tap a plot edge → chip `Set length`; tap it → field plus keypad; type 100 and Done → the scale is set; the chip then reads `100.00′`.
- [ ] **Step 5: Commit** `feat(cards): edge chip replaces the edge popover`.

### Task 8: Browser checks and docs

**Files:**
- Modify: every script that references the removed controls. Find with `grep -n "Redo\b\|Layer order\|data-act=up\|data-act=down\|data-nudge\|\.popover\|Nudge\|rot-up\|symbol-rotation\|\[data-act=delete\]" scripts/*.mjs` (known: `check-step2b.mjs`, `check-step3.mjs`, `check-zone-edit.mjs`, `check-zone-size.mjs`, `check-surfaces.mjs`, `check-symbols.mjs`, `check-lines.mjs`, `check-undo.mjs`, `check-visibility.mjs`).
- Create: `scripts/check-slim-cards.mjs` (same harness as `check-panel.mjs`: `openPlan`, memory store, Riesberg, viewport 1180×1000)
- Modify: `docs/PRD.md` (§6.3 to §6.6 outline and surface cards, §6.10 plant card, §6.1 edge chip), create `docs/conversations/2026-10-24-slim-cards.md`

- [ ] **Step 1: Update** the existing scripts: `Redo` → `Redraw`; the chip replaces the popover (`.popover` → `.edge-chip`, `button[type=submit]` → the keypad's Done key); arrows and rotation selectors go through `.nudge-pad [data-nudge]` and the object card's Rotate row; delete clicks use the trash `aria-label="Delete"`.
- [ ] **Step 2: Write** `check-slim-cards.mjs` with checks (each `check(name, ok, got)`): outline card has only header and action row (no `.nudge`, no `.layer-order`); `Redraw` present and `Redo` absent; boundary card has no trash; a feature card's trash deletes it; the card closes by row tap, by empty plan and by Escape; a surface card is collapsed (no `#zone-width`) and `[data-disclosure=adjust]` opens it; Corner radius shows `2` after Round all 2′, and `Mixed` after rounding one corner; the edge chip shows `Set length` before the scale and `100.00′` after typing 100; ⋯ lists Make straight only on a curved edge; the nudge pad moves a selected corner by one step and hides when nothing is selected; keyboard arrows still nudge; dragging the grip of the last feature above the first reorders it and one ⌘Z restores; Alt+ArrowUp on a grip moves a feature; a plant card has no rotation and a planter card does.
- [ ] **Step 3: Run** `npm run dev`, then `node scripts/check-slim-cards.mjs ../samples/riesberg-plot-plan.pdf` and every updated script plus `check-panel`, `check-collapse`, `check-undo`. Expected: no `FAIL` or `STOPPED`. Discard regenerated `*.png` files with `git checkout -- *.png` and delete untracked ones.
- [ ] **Step 4: Screenshot** the three cards and the chip at 1180 px and 820 px beside the mockups in the findings note; note any visual gap for the user.
- [ ] **Step 5: Update** the PRD sections above and write the decision summary (what was decided and built; deferred: rotate and resize handles, plant sizes, plan labels, material grid).
- [ ] **Step 6: Final verification** `npm run lint && npm run typecheck && npm test`. Expected: PASS.
- [ ] **Step 7: Commit** `test(cards): browser checks for the slimmer cards; docs`.
