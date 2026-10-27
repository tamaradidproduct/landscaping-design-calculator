# Plant sizes (install and mature) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plants draw at their nursery install size by default, with a plan-wide Install | Mature toggle, a per-plant container or custom size, and Apply to all.

**Architecture:** A pure resolver (`plant-size.ts`) turns a placed plant, its library entry and the plan's view into a diameter in feet; every place that reads `lib.size` for plants (drawing, hit test, card, sheet) goes through it. The plan stores one optional field (`plantSizeView`) and each placed plant at most one of `container` or `customInstall`. UI pieces (top bar toggle, plant card, canvas handle, first-open prompt, sheet rows) sit on top of that.

**Tech Stack:** TypeScript, Vite, Vitest, Playwright (`playwright-core`) check scripts, Firestore plan store. All commands run in `plan-builder/`.

**Spec:** `docs/superpowers/specs/2026-10-26-plant-sizes-design.md`

## Global Constraints

- Check commands before every commit that touches `src/`: `npm run lint`, `npm run typecheck`, `npm test`.
- Controls are at least **44 px** tall (PRD §6.6). The toggle's buttons use 44 px (the top bar task for #84 sets the bar to 52 px; if it has not landed, set the toggle's own `min-height` to 44 px and leave the bar alone).
- Toggle labels: **Install | Mature**; at 900 px and below **Now | Grown**.
- First-open prompt copy: title "Show plants at install size?", buttons **Install size** and **Keep mature**; Esc and the backdrop keep Mature.
- Sheet footnote: "Sizes shown at install. Switch to Mature to see grown sizes." in the Install view; "Sizes shown at mature. Switch to Install to see nursery sizes." in the Mature view.
- Plants never rotate. Sizes never change quantities. An install diameter never exceeds the mature spread (`SYMBOL_SIZES[id].w`).
- Never hand-edit `src/styles/tokens.css`; new tokens go in `design-system/tokens.json` then `npm run tokens`.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not push, open a PR or enable auto-merge.
- Work on a feature branch cut from `origin/main` (not `docs/plant-sizes-spec`).

## Review Focus

- A saved plan with plants and no `plantSizeView` that reaches the editor without the prompt (reload, second device) draws at mature size, never shrinks: pinned in Task 2 (`effectiveView`) and Task 8.
- The first plant placed into an empty plan with no `plantSizeView` stores `'install'`, so the next open does not prompt: pinned in Task 4.
- A stored `container` that is no longer in the library, or a `customInstall` that is zero, negative, NaN or above mature, loads without error and falls back or clamps: pinned in Task 3.
- Apply to all with one plant of the species, with the selected plant on a custom size, and undo afterwards (one step restores every plant): pinned in Task 5.
- Corn and Vegetable plants (no containers): the toggle changes nothing for them, no chips and no handle are offered: pinned in Tasks 5 and 6.

---

### Task 1: Install-size data (shrub 5 gal rows)

**Files:**
- Modify: `plan-builder/scripts/plant-install-sizes.mjs`, `plan-builder/scripts/plant-install-sizes.d.mts`, `plan-builder/src/plant-install-sizes.test.ts` (all three exist untracked in the main checkout; commit them with this task, copying them into the branch first)

**Interfaces:**
- Produces: `PLANT_INSTALL_SIZES[id].install: { container: string; d: number }[]`, ordered smallest to largest; the **last** entry is the plant's default container. Trees have two entries (mid size last), shrubs with a 5 gal row have `1 gal` then `5 gal`, everything else one entry, `corn` and `vegetable-plants` none.

- [ ] **Step 1: Update the test.** Replace the "trees list two…" test with `'default is the last entry; trees and 5 gal shrubs have two entries'`: for each plant, every tree (`/trees$/` family) has 2 entries; every plant with a `5 gal` entry and a `1 gal` entry has them in that order; `corn` and `vegetable-plants` have 0; no plant has more than 2; container labels are unique per plant. Keep the other three tests as they are.
- [ ] **Step 2: Run** `npx vitest run src/plant-install-sizes.test.ts`. Expected: FAIL (shrubs have one entry; the new rule asserts the 5 gal rows exist for `lilacs`, `dogwood`, `lavender`, `hydrangea`, `fernbush`, `japanese-fern`, `panchito-manzanita`, `mugo-pine`, `rubber-rabbitbrush`, `boxwood`, `globe-pine`, `golden-bamboo`; add that list to the test as `SHRUBS_WITH_5_GAL`).
- [ ] **Step 3: Add the `5 gal` entry** to each plant in `SHRUBS_WITH_5_GAL` in `plant-install-sizes.mjs`, derived by the research doc's shrub rule (`docs/plant-nursery-sizes.md`: 5 gal ≈ 2–3 ft across, scaled down for compact plants): `d = min(2.5, mature spread)`, raised to just above the existing `1 gal` size if that is not larger; if the mature spread is not above the `1 gal` size, leave the plant with one entry and drop it from `SHRUBS_WITH_5_GAL`. Mark each new row's plant `approximate: true`.
- [ ] **Step 4: Run** `npx vitest run src/plant-install-sizes.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(plants): add 5 gal install sizes for shrubs`.

### Task 2: The size resolver

**Files:**
- Create: `plan-builder/src/plant-size.ts`
- Test: `plan-builder/src/plant-size.test.ts`

**Interfaces:**
- Consumes: `PLANT_INSTALL_SIZES` (Task 1), `symbolById(id)?.size.w` as the mature spread.
- Produces (all pure):
  - `type PlantSizeView = 'install' | 'mature'`
  - `interface SizeChoice { container?: string; customInstall?: number }`
  - `containersFor(symbolId: string): readonly { container: string; d: number }[]` (empty for objects, markers and Corn and Vegetable plants)
  - `defaultContainer(symbolId: string): { container: string; d: number } | null` (the last entry)
  - `clampCustom(symbolId: string, ft: number): number | null` (null if `ft` is not a finite number above 0 or the plant has no containers; else `min(ft, mature spread)`)
  - `plantDiameter(symbolId: string, choice: SizeChoice, view: PlantSizeView): number` (feet)
  - `sizeLabel(symbolId: string, choice: SizeChoice, view: PlantSizeView): string`
  - `effectiveView(view: PlantSizeView | undefined, hasPlants: boolean): PlantSizeView` (`view ?? (hasPlants ? 'mature' : 'install')`)
  - `normalizeChoice(symbolId: string, choice: SizeChoice): SizeChoice` (drops an unknown `container`, drops a non-positive or non-finite `customInstall`, clamps the rest to mature, keeps only `customInstall` if both survive)

- [ ] **Step 1: Write the failing tests** in `plant-size.test.ts` (use `blue-diamond-spruce`, `lavender`, `corn`, `oak`, `firepit`):
  - `plantDiameter` in `'mature'` equals `SYMBOL_SIZES[id].w` for each; in `'install'` with `{}` equals the default (last) container's `d`; with `{ container: first.container }` equals the first entry's `d`; with `{ customInstall: 6 }` for the spruce equals `6`; with an unknown container equals the default; `corn` equals its mature spread in both views.
  - `clampCustom('blue-diamond-spruce', 99)` equals `10` (mature); `clampCustom('lavender', 0)`, `-1`, `NaN` are `null`; `clampCustom('corn', 1)` is `null`.
  - `sizeLabel` for the spruce at default in Install is `"6 ft B&B (4.5 ft)"`; with `{ customInstall: 6 }` is `"Custom 6 ft"`; in Mature is `"10 ft"`; for `corn` is `"1 ft"` in both. `firepit` (an object) returns the empty string.
  - `effectiveView(undefined, true)` is `'mature'`, `(undefined, false)` is `'install'`, `('install', true)` is `'install'`.
  - `normalizeChoice('lavender', { container: 'nope', customInstall: 0 })` is `{}`; `normalizeChoice('lavender', { container: '1 gal', customInstall: 50 })` is `{ customInstall: <lavender mature> }`.
- [ ] **Step 2: Run** `npx vitest run src/plant-size.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the functions above in `plant-size.ts`; number formatting in `sizeLabel` drops a trailing `.0` (4.5 stays `4.5`, 6 becomes `6`).
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Commit** `feat(plants): size resolver for install and mature views`.

### Task 3: Model and storage

**Files:**
- Modify: `plan-builder/src/plan-model.ts` (`PlacedSymbol`, `PlanState`, `PlanDoc`, `toDoc`, `planStateOf`, `OPTIONAL_EDITOR_FIELDS`, `fromDoc`)
- Test: `plan-builder/src/plan-model.test.ts`, `plan-builder/src/plan-store.contract.ts` (one round-trip case)

**Interfaces:**
- Consumes: `PlantSizeView`, `normalizeChoice` (Task 2).
- Produces: `PlacedSymbol` gains `container?: string; customInstall?: number`; `PlanState` and `PlanDoc` gain `plantSizeView?: PlantSizeView`; the field is saved by `toDoc`, returned by `planStateOf`, written (or cleared when absent) by `editorFields` through `OPTIONAL_EDITOR_FIELDS`.

- [ ] **Step 1: Write the failing tests** in `plan-model.test.ts`:
  - A doc with `plantSizeView: 'install'` round-trips through `toDoc`, `fromDoc`, `planStateOf`.
  - `fromDoc` rejects `plantSizeView: 'big'` with a `PlanFormatError` (`invalid`).
  - `fromDoc` on a symbol `{ id: 'y1', symbol: 'lavender', x: 1, y: 1, container: 'nope', customInstall: -3 }` loads and the symbol has neither field; a `customInstall: 99` on `blue-diamond-spruce` loads clamped to `10`; a symbol with both `container` and `customInstall` keeps only `customInstall`.
  - `fromDoc` on a pre-change doc (no new fields) is unchanged (`plantSizeView` absent).
  - `editorFields` lists `plantSizeView` in `clear` when the plan has none, and in `write` when it has one.
- [ ] **Step 2: Run** `npx vitest run src/plan-model.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the types, the four function changes, the `plantSizeView` validation, and in `fromDoc` a pass over `doc.symbols` that replaces each symbol's choice fields with `normalizeChoice` output (deleting dropped keys).
- [ ] **Step 4: Add a contract case** in `plan-store.contract.ts`: save a plan with `plantSizeView: 'mature'` and a symbol with `customInstall`, reload, compare equal; run `npx vitest run src/plan-model.test.ts src/plan-store.test.ts src/memory-plan-store.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(plan): store plantSizeView and per-plant size choice`.

### Task 4: Editor state and size-aware drawing

**Files:**
- Modify: `plan-builder/src/outline-ui.ts` (`Snapshot`, `snapshot`, `restore`, `load`, `state`, `placeSymbolAt`/place path, the render call at ~line 1337, hit test call at ~line 292), `plan-builder/src/symbol-layer.ts` (`hitTest`), `plan-builder/src/symbols-render.ts` (`SymbolsSvgOptions`, `one`)
- Test: `plan-builder/src/symbol-layer.test.ts`, `plan-builder/src/outline-ui.test.ts`

**Interfaces:**
- Consumes: `effectiveView`, `plantDiameter`, `PlantSizeView` (Task 2); model fields (Task 3).
- Produces on `OutlineTool`: `plantSizeView: PlantSizeView | undefined`; `get plantView(): PlantSizeView` (`effectiveView(this.plantSizeView, any placed symbol)`); `setPlantView(v: PlantSizeView): void` (one undo step; no-op if unchanged); `symbolSizeFt(s: PlacedSymbol): { w: number; d: number }` (a plant is a circle of `plantDiameter(...)`; an object or marker keeps `lib.size`). `SymbolLayer.hitTest(p, shown, ftPerPt, pxPerPt, sizeOf?: (s: PlacedSymbol) => { w: number; d: number })` (default `lib.size`). `SymbolsSvgOptions` gains `sizeOf: (p: PlacedSymbol) => { w: number; d: number }` used for the art, the halo and the ghost (a ghost uses the default container size in the current view).

- [ ] **Step 1: Write the failing tests:**
  - `symbol-layer.test.ts`: with a spruce placed and `sizeOf` returning a 4.5 ft circle, a point 2 ft from the centre hits and a point 3 ft away does not (scale: `ftPerPt` 1, `pxPerPt` 1, so points are feet); without `sizeOf` the point 3 ft away hits (mature radius 5 ft).
  - `outline-ui.test.ts` (follow the file's existing tool setup): `plantView` is `'install'` for an empty tool and `'mature'` after `load()` of a state with plants and no `plantSizeView`; `setPlantView('mature')` then `undo()` restores `'install'`; `state().plantSizeView` is `undefined` before any change and `'mature'` after; placing the first plant into an empty tool with no `plantSizeView` sets `state().plantSizeView` to `'install'` (so reload does not prompt); placing a second plant does not change an existing value; `symbolSizeFt` of a placed lavender is its default container's `d` in Install and its mature spread in Mature.
- [ ] **Step 2: Run** `npx vitest run src/symbol-layer.test.ts src/outline-ui.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `Snapshot` and `snapshot()`/`restore()` carry `plantSizeView`; `load()` and `state()` read and write it (omit when undefined); the place path sets it to `'install'` when it was undefined and the plan had no placed symbols; the render call passes `sizeOf: s => this.symbolSizeFt(s)` and the hit test passes the same; `symbols-ui.ts` card sub-line stays as is until Task 5.
- [ ] **Step 4: Run** the two test files plus `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(plants): draw plants at install or mature size`.

### Task 5: Plant card (container, Custom, Apply to all)

**Files:**
- Modify: `plan-builder/src/symbols-ui.ts` (`card`, `wire`), `plan-builder/src/outline-ui.ts` (three methods), `plan-builder/src/styles/components.css` (chip row, if no existing chip style fits)
- Test: `plan-builder/src/outline-ui.test.ts`, `plan-builder/src/symbols-ui` has no test file today: add `plan-builder/src/symbols-ui.test.ts` for the card HTML

**Interfaces:**
- Consumes: `containersFor`, `sizeLabel`, `clampCustom` (Task 2); `OutlineTool.plantView`, `symbolSizeFt` (Task 4).
- Produces on `OutlineTool`: `setContainer(id: string, container: string): void` (one undo step; stores `container`, deletes `customInstall`), `setCustomInstall(id: string, ft: number): void` (stores `clampCustom` result, deletes `container`; ignores a null result; **no undo step of its own**, so a handle drag can call it repeatedly inside one `record()`), `applyToSpecies(id: string): number` (copies the plant's `container` or `customInstall` to every other placed plant of the same `symbol`, one undo step, returns how many plants it changed; if the plant has neither field it clears both on the others).

- [ ] **Step 1: Write the failing tests** (`outline-ui.test.ts`): `setContainer` stores the label and `undo()` restores the previous state; `setContainer` after `setCustomInstall` leaves only `container`; `applyToSpecies` with three spruces (one changed to `'5 gal'`) sets the other two and returns `2`, leaves a placed lavender untouched, and one `undo()` restores both; `applyToSpecies` on a lone plant returns `0` and records no undo step; with the source on a custom size the others get `customInstall` and no `container`; `setCustomInstall` on `corn` does nothing. In `symbols-ui.test.ts` (build the card via the tool, as the other UI tests do): the Install-view card for a spruce contains one chip per container plus a `Custom` chip with the default one marked `aria-pressed="true"`, the text `Apply to all Blue Diamond Spruces (3)` when three are placed, and a trash button; in the Mature view the chips have `disabled` and the hint `Switch to Install to change the container`; the `corn` card has no chip row and no Apply button; every chip and button has `min-height` from the 44 px control rule (assert the class, not pixels).
- [ ] **Step 2: Run** the two test files. Expected: FAIL.
- [ ] **Step 3: Implement** the three tool methods and the card: sub-line `Install 4.5 ft across · mature 10 ft` (or `Custom 6 ft across · mature 10 ft`), the chip row, the hint "Drag the handle on the plan to set a custom size." (Install view only), **Apply to all <name> (N)** shown only when N is above 1, and the existing trash. Chips call `setContainer`; Apply calls `applyToSpecies`. Objects and markers keep their current card.
- [ ] **Step 4: Run** both files and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(plants): container chips and Apply to all in the plant card`.

### Task 6: Canvas size handle

**Files:**
- Modify: `plan-builder/src/symbols-render.ts` (the handle element on the selected plant's halo), `plan-builder/src/outline-ui.ts` (pointer down, move and up for the handle; follow how the corner and symbol drags set `dragBefore = this.snapshot()` at ~lines 520–620 and commit one `history.record(dragBefore)` on release)
- Test: `plan-builder/src/symbols-render.test.ts`, `plan-builder/src/outline-ui.test.ts`

**Interfaces:**
- Consumes: `setCustomInstall` (Task 5), `plantView`, `symbolSizeFt` (Task 4).
- Produces: `SymbolsSvgOptions.handle?: boolean`; when true and the selected symbol is a plant, the SVG contains `<circle class="symbol-handle" data-handle="size" …>` on the halo at the right edge. The handle is offered only when `plantView === 'install'`, the selected plant has containers, and the plan is not in Preview.

- [ ] **Step 1: Write the failing tests:** `symbols-render.test.ts`: the handle circle is present for a selected spruce with `handle: true`, absent with `handle: false`, absent for a selected object, absent for a selected `corn`. `outline-ui.test.ts`: simulate a drag of the handle from the plant's right edge outward by 1 ft (use the file's existing pointer helpers) and expect the plant's `customInstall` to equal the new diameter, one `undo()` to restore the original choice, and a drag past mature to clamp at the mature spread; no handle in the Mature view (the drag does nothing); a handle drag below 0.25 ft stops at `0.25`.
- [ ] **Step 2: Run** the two files. Expected: FAIL.
- [ ] **Step 3: Implement** the handle (radius for a 44 px target; it follows the halo and moves with zoom) and the drag: diameter = twice the distance from the plant's centre to the pointer in feet, floored at `0.25`, through `setCustomInstall`; one `record()` at drag start.
- [ ] **Step 4: Run** both files and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(plants): drag a handle to set a custom install size`.

### Task 7: Top bar toggle

**Files:**
- Modify: `plan-builder/src/top-bar.ts` (`TopBarState`, `topBarHtml`), `plan-builder/src/main.ts` (where `topBarHtml` is rendered and the view switch is wired; search for `view-switch` and `topBarHtml`), `plan-builder/src/styles/components.css` (narrow labels at 900 px, 44 px height)
- Test: `plan-builder/src/top-bar.test.ts`

**Interfaces:**
- Consumes: `OutlineTool.plantView`, `setPlantView` (Task 4).
- Produces: `TopBarState.plantView?: PlantSizeView` (undefined hides the toggle). `topBarHtml` renders `segmented('plant-view-switch', 'Plant size view', 'plantview', [...])` between the Edit | Preview switch and the right cluster, each button containing `<span class="label-full">Install</span><span class="label-short">Now</span>` (and `Mature` / `Grown`); `components.css` shows `.label-short` and hides `.label-full` at `max-width: 900px`.

- [ ] **Step 1: Write the failing tests** in `top-bar.test.ts`: with `plantView: 'install'` the HTML has the switch with Install pressed and both label spans; with `'mature'` Mature is pressed; with `plantView` undefined there is no `plant-view-switch`.
- [ ] **Step 2: Run** `npx vitest run src/top-bar.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the markup and CSS; in `main.ts` pass `plantView` only while the tool has at least one placed symbol that is a plant with containers, and on a click call `tool.setPlantView(value)` then re-render the bar and the sheet.
- [ ] **Step 4: Run** `npx vitest run src/top-bar.test.ts` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(top-bar): Install | Mature toggle`.

### Task 8: First-open prompt

**Files:**
- Create: `plan-builder/src/plant-size-prompt.ts`
- Modify: `plan-builder/src/app-shell.ts` (after a plan is loaded into the tool; search for `.load(`)
- Test: `plan-builder/src/plant-size-prompt.test.ts`

**Interfaces:**
- Consumes: `OutlineTool.plantSizeView` (Task 4).
- Produces: `needsPlantSizePrompt(state: { plantSizeView?: PlantSizeView; symbols?: Record<string, unknown> }): boolean` (true when `plantSizeView` is undefined and at least one placed symbol exists); `askPlantSize(): Promise<PlantSizeView>` (resolves `'install'` for **Install size**, `'mature'` for **Keep mature**, the backdrop or Esc). After the answer the tool's `plantSizeView` is set through a new `OutlineTool.setPlantViewSilently(v: PlantSizeView): void` (no undo step, bumps the revision so the plan autosaves).

- [ ] **Step 1: Write the failing tests:** `needsPlantSizePrompt` is false for a new plan, false when the field is set, false with no plants, true for plants and no field. `askPlantSize` (jsdom): clicking **Install size** resolves `'install'`, **Keep mature** `'mature'`, pressing Escape `'mature'`; the modal has the title "Show plants at install size?" and buttons at the 44 px control size; focus lands on **Install size**.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement** the modal (faux overlay in normal flow like the app's other dialogs; copy from Global Constraints) and call it from `app-shell.ts` right after a plan loads, before the first render the user can interact with; the answer is stored in the plan and autosaved.
- [ ] **Step 4: Run** the test and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(plants): ask once whether an existing plan shows install size`.

### Task 9: Sheet and Preview rows

**Files:**
- Modify: `plan-builder/src/plant-list.ts` (`plantList` signature and `plants` entries), `plan-builder/src/sheet-ui.ts` (`card`, `sheetHtml`, `renderSheet`)
- Test: `plan-builder/src/plant-list.test.ts`, `plan-builder/src/sheet-ui.test.ts`

**Interfaces:**
- Consumes: `sizeLabel`, `plantDiameter` (Task 2); `OutlineTool.plantView` (Task 4).
- Produces: `plantList(symbols, outlines, lines, ftPerPt, areas, view: PlantSizeView = 'mature')`: `plants` entries become `{ symbol: LibrarySymbol; quantity: number; size?: string }`, one entry per species **and** size label for plants (`size` is `sizeLabel(...)`), one per species for objects and markers (no `size`). Entries sort as before, then by diameter within a species. `sheetHtml(l, sel, view)` shows each plant's `size` under its name and ends the Plants block with the footnote from Global Constraints. The default `view` keeps existing callers and tests unchanged.

- [ ] **Step 1: Write the failing tests:** `plant-list.test.ts`: three spruces (two at default, one `customInstall: 6`) in Install give two spruce entries (quantities 2 and 1, sizes `"6 ft B&B (4.5 ft)"` and `"Custom 6 ft"`); the same plan in Mature gives one entry of quantity 3 with size `"10 ft"`; a lone `corn` has size `"1 ft"` in both views; objects have no `size`. `sheet-ui.test.ts`: the Install HTML contains the install footnote text, the Mature HTML the mature one; a plan with no plants has neither.
- [ ] **Step 2: Run** the two files. Expected: FAIL.
- [ ] **Step 3: Implement** the grouping (key `symbol + sizeLabel`) and the rendering; `renderSheet` passes `tool.plantView`; re-render the sheet when the view flips (Task 7 already triggers it).
- [ ] **Step 4: Run** the two files, `npm test` and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(sheet): show plant sizes for the active view`.

### Task 10: Browser check and docs

**Files:**
- Create: `plan-builder/scripts/check-plant-sizes.mjs` (model it on `scripts/check-symbols.mjs` and `scripts/lib/open-plan.mjs`; usage `node scripts/check-plant-sizes.mjs ../samples/riesberg-plot-plan.pdf [url] [outDir]`)
- Modify: `docs/PRD.md` (the plants section), create `docs/conversations/2026-10-26-plant-sizes.md` (decision summary: the seven decisions from the spec and the sheet-layout choice)

**Interfaces:**
- Consumes: everything above; the dev server at `?store=memory`.

- [ ] **Step 1: Write the check script** with these assertions, each logged as `ok`/`FAIL`: after setting the scale, placing a Blue Diamond Spruce draws a smaller circle than after flipping to Mature; the toggle appears only after a plant exists; choosing another container chip changes the circle; dragging the handle shows `Custom` in the card; the handle is absent in Mature; **Apply to all** changes a second spruce; the sheet shows the footnote and two rows when sizes differ; reloading the page state keeps the view; a plan loaded with plants and no view shows the prompt and **Keep mature** keeps the mature size; at 900 px the toggle reads `Now | Grown`. Capture screenshots at 1180 px and 820 px to `outDir` (do not commit regenerated tracked PNGs).
- [ ] **Step 2: Run** the script against `npx vite --host=localhost --port=<free port>` from `plan-builder/`. Expected: all `ok`. Discard regenerated tracked PNGs with `git checkout -- <file>`.
- [ ] **Step 3: Update the PRD** plants section and write the decision summary.
- [ ] **Step 4: Run** `npm run lint`, `npm run typecheck`, `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `test(plants): browser check for plant sizes; docs`.
