# Lines, stepping stones and utility markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drawn linear items (fence, walls, edging, dry river), four stepping stones and three utility markers, all counted in the Plant list.

**Architecture:** Stones and markers join the existing symbol library (markers get `kind: 'marker'` and a minimum on-screen size). Lines are a new plan field `lines` with a pure `LineLayer` (geometry, hit test, length), a string renderer `linesSvg`, and a "Lines" Layers section; `OutlineTool` owns the draft, selection, drags, undo and render order, as it does for symbols.

**Tech Stack:** TypeScript, Vite, vitest, sharp (asset build), Playwright checks (`?store=memory`), Figma MCP for art.

**Spec:** `docs/superpowers/specs/2026-10-18-lines-and-points-design.md`

All commands run in `plan-builder/`. Never push, open a PR or enable auto-merge (project CLAUDE.md).

## Global Constraints

- **Figma ruling:** 36 Figma px = 1 ft (`FIGMA_PX_PER_FT`), for every size taken from Figma.
- **Line widths:** 0.25–12 ft, steps of 0.25; defaults 0.33 ft (fence, veneer wall, retaining wall, white stone edging; Figma stroke 12 px), 0.55 ft (dry river; 20 px).
- **Stone footprints:** porcelain 2×2, concrete 2×2, flagstone 2×2, Colorado buff 3.56×2 ft. **Marker footprints:** gas and electric 0.42×1.03 ft, drainage 3.78×3.03 ft.
- **Markers:** minimum on-screen long side 20 px (`MARKER_MIN_PX`); symbols keep 6 px.
- **Ids:** lines `l1…`; symbols stay `y1…`. Additive optional field `lines`, `v: 1` kept; unknown item id, fewer than 2 points, non-finite numbers, width out of range, or `bulges` length ≠ segments is an invalid plan.
- **Draw order:** surfaces, lines, symbols, outline strokes, handles. **Group order:** `['surfaces', 'lines', 'symbols', 'outlines']`.
- **Tokens:** edit `design-system/tokens.json`, run `npm run tokens`, never hand-edit `src/styles/tokens.css`.
- **Commits** end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Ruling carried from the spec:** points are removed by the card's **Delete point** only (no drag-onto-neighbour).

## Review Focus

- A line whose draft has two taps on the same spot (zero length) must not save; a tap within 4 px of the last point is ignored.
- A plan with no scale: lines and markers draw at `UNSCALED_FT_PT`, and the list shows "no scale" rather than a wrong foot count.
- Calibrating or re-scaling a plan after lines exist: widths are in feet, so pixel widths and list lengths recompute.
- A saved plan from before this change (no `lines`) loads and saves unchanged; an unknown line item makes the plan invalid, not a crash.
- Hidden lines (own eye or the Lines section) are never selectable, never hit-tested, and still counted.
- Arming a symbol or starting an outline while a line is selected or being drawn: no stuck state; the draft is discarded like a placing-over-drawing.
- Undo/redo across draw, point move, bend, width change and delete; Esc mid-draft; a marker or stone at tiny zoom stays tappable.

---

### Task 1: Library data and art (stones, markers, line items)

**Files:**
- Create: `scripts/line-sources.mjs`, `scripts/line-sources.d.mts`, `scripts/build-lines.mjs`, `src/line-items.ts`, `src/line-items.test.ts`, `src/assets/lines/` (built)
- Modify: `scripts/symbol-sources.mjs` (+ `.d.mts`), `scripts/symbol-sizes.mjs`, `scripts/build-symbols.mjs` (NO_SHADOW / marker flags), `src/symbols.ts`, `src/symbol-sources.test.ts`, `src/symbol-sizes.test.ts`, `src/symbols.test.ts`

**Interfaces:**
- Produces:
  - `export const FIGMA_PX_PER_FT = 36` in `src/symbols.ts`.
  - `LibrarySymbol.kind: 'plant' | 'object' | 'marker'`; `LibrarySymbol.minPx?: number` (20 for markers).
  - `symbolFamilies(kind?: 'plant' | 'object' | 'marker')`.
  - `interface LineItem { id: string; name: string; family: string; art: string; thumb: string; artWidthPx: number; artLengthPx: number; defaultWidthFt: number; roundCaps: boolean; color: string }`.
  - `LINE_ITEMS: readonly LineItem[]`, `lineItemById(id): LineItem | undefined`, `searchLineItems(q): LineItem[]`.
  - `LINE_WIDTH_FT = { min: 0.25, max: 12, step: 0.25 }`, `clampLineWidth(ft: number): number`.

- [ ] **Step 1: Failing tests.**
  - `symbol-sources.test.ts`: 51 plants, **18 objects** (14 + 4 stones, family `Stepping stones` for the four; others `Objects`), **3 markers** (family `Utility markers`, category `''`); 72 unique ids/names/Figma ids; names `porcelain-pavers`, `concrete-pavers`, `flagstone-pavers`, `colorado-buff-stone`, `gas-line`, `electric-line`, `drainage-line` resolve to the canonical names.
  - `line-items.test.ts`: 5 items with ids `wood-privacy-fence`, `veneer-wall`, `retaining-wall`, `white-stone-edging`, `dry-river`; default widths `[0.33, 0.33, 0.33, 0.33, 0.55]`; every item has art, thumb, color `#rrggbb`; `clampLineWidth(0.1)` = 0.25, `(40)` = 12, `(1.13)` = 1.25.
  - `symbols.test.ts`: stone footprints (`size` w×d) equal Global Constraints within 0.02; marker `minPx` is 20 and plants/objects have none.
  - Run `npm test -- symbol-sources line-items symbols` → FAIL (missing data).
- [ ] **Step 2: Names and sizes.** Add the 7 symbols to `symbol-sources.mjs` (Figma card ids: porcelain `174:1360`, concrete `174:1397`, flagstone `174:1513`, Colorado buff `175:1550`, gas `174:1425`, electric `175:1577`, drainage `174:1526`; card titles drift, so confirm each card's displayed title with `use_figma` and map to the canonical name). Add `symbol-sizes.mjs` entries with `url: 'figma:0B2UpvIGBFOE1ZEDx8rXPR'`, `note: 'Figma size ÷ 36 px per ft'`. Write `line-sources.mjs` rows `{ id, name, family: 'Lines', figma, strokePx, roundCaps, strip }` (Figma card ids `173:4075`, `173:4045`, `173:4052`, `174:1470`, `173:4110`; `strip` = the pixel rectangle of the stroke inside the card, read with `use_figma` from the vector's `absoluteBoundingBox` minus the card's).
- [ ] **Step 3: Export art.** `download_assets` with `defaultScale: 4` on the plain card node ids (never instance paths) into a scratch folder (`art/<id>.png` for the 7 symbols, `<id>.png` for the 5 lines). Run `node scripts/build-symbols.mjs <dir>` for the 7 symbols (add stones to `NO_SHADOW`; markers use the flood-fill path unchanged; crop to the art's trimmed bounds so `symbols.json` aspects match the Figma proportions). Write `build-lines.mjs <dir>`: crop each `strip` (inset 6 px at 4× on each end to drop the round caps; dry river: the interior patch recorded in `strip`), save `src/assets/lines/<id>.webp` (quality 72) and `thumbs/<id>.webp` (64 px), record `{ w, h, color }` (mean colour) in `src/assets/lines/lines.json`.
- [ ] **Step 4: Library code.** `symbols.ts`: widen `kind`, add `minPx` (markers: 20), export `FIGMA_PX_PER_FT`; object sizes for stones come from `symbol-sizes.mjs` as before. `line-items.ts`: build `LINE_ITEMS` from `line-sources.mjs`, `lines.json` and `import.meta.glob` (as `symbols.ts` does); `artWidthPx`/`artLengthPx` come from `lines.json`.
- [ ] **Step 5: Contact sheet.** Montage the 5 line tiles and 7 symbol arts with sharp into the scratchpad and read it; fix a bad crop (`strip` or flags) before continuing. Expected: no title text, no dashed borders, no white boxes in any art.
- [ ] **Step 6: Run** `npm test && npm run typecheck && npm run lint` → PASS. Commit `feat(lines): library data and art for stones, markers and line items`.

### Task 2: Plan model, groups and stores for `lines`

**Files:**
- Modify: `src/plan-model.ts`, `src/plan-model.test.ts`, `src/sections.ts`, `src/sections.test.ts`, `src/firebase-plan-store.ts`, `src/memory-plan-store.ts` (only if it lists fields), `src/plan-store.contract.ts`

**Interfaces:**
- Consumes: `lineItemById`, `LINE_WIDTH_FT` (Task 1).
- Produces:
  - `interface PlacedLine { id: string; item: string; points: Point[]; bulges?: number[]; widthFt: number }`; `PlanState.lines?: Record<string, PlacedLine>`.
  - `Group = 'surfaces' | 'lines' | 'symbols' | 'outlines'`; `GROUPS` in that order; `isLineHidden(l: { id: string }, layers, groups): boolean`; `groupCounts(outlines, symbols = 0, lines = 0)`.

- [ ] **Step 1: Failing tests.** `plan-model.test.ts`: `fromDoc(toDoc(state))` round-trips `lines` (with and without `bulges`); a doc with no `lines` loads and `toDoc` emits no `lines` key; invalid for: unknown `item`, one point, `NaN` coordinate, `widthFt` 0.2 and 12.5, `bulges` of wrong length, `id` ≠ key; `hiddenLayers` may name a line id. `sections.test.ts`: `GROUPS` order, `isLineHidden` by own id or `lines` group, `groupCounts(outlines, 2, 3).lines` = 3, `readOpen(null).lines` = true. Contract test: a store round-trip keeps `lines` and clears it when absent (use the contract file's existing symbols case as the model). Run → FAIL.
- [ ] **Step 2: Implement** validation beside the `symbols` block (same `invalid(...)` helper), add `'lines'` to `OPTIONAL_EDITOR_FIELDS` and the `toDoc`/`planStateOf`/`editorFields` lists, extend `Group`, `GROUPS`, `readOpen`, `groupCounts`, and `isLineHidden`. Firestore: `lines` is written with the other editor fields and cleared with `deleteField` when absent.
- [ ] **Step 3: Run** `npm test && npm run typecheck` → PASS. Commit `feat(lines): plan model, groups and stores for lines`.

### Task 3: `LineLayer` (pure geometry)

**Files:**
- Create: `src/line-layer.ts`, `src/line-layer.test.ts`

**Interfaces:**
- Consumes: `PlacedLine`, `edgePoints`/`outlinePath`/`edgeLengthPt`/`bulgeToward`/`edgeMid`/`nearestEdge` from `src/outline.ts`, `UNSCALED_FT_PT`.
- Produces:
  - `lineWidthPt(widthFt: number, ftPerPt: number | null): number`.
  - `linePathPt(l: PlacedLine): Point[]` (the sampled run, `outlinePath(points, bulges, false)`).
  - `lineLengthPt(l: PlacedLine): number`; `lineLengthFt(l, ftPerPt: number | null): number | null` (null with no scale).
  - `class LineLayer { placed: Record<string, PlacedLine>; ordered(): PlacedLine[]; add(item: string, points: Point[], widthFt: number): string | null; movePoint(id, i, to: Point); insertPoint(id, afterIndex, p); removePoint(id, i): boolean; setBulge(id, seg, h); setWidth(id, ft); remove(id); hitTest(p: Point, shown, ftPerPt, pxPerPt): string | null; groups(): { item: string; ids: string[] }[] }`.

- [ ] **Step 1: Failing tests** (pure, no DOM):
  - `add` returns `l1`, then `l2`; fewer than 2 distinct points (consecutive points within 1e-6) returns `null` and stores nothing.
  - `lineWidthPt(2, 0.5)` = 4; `lineWidthPt(2, null)` = `2 * UNSCALED_FT_PT`.
  - `lineLengthFt` of (0,0)→(100,0) at `ftPerPt` 0.1 = 10; null for `ftPerPt` null; a bent segment is longer than its chord.
  - `setWidth` clamps to 0.25–12 and snaps to 0.25; `removePoint` refuses (returns false) at 2 points; `insertPoint` keeps `bulges` aligned (adds a 0 entry; splits nothing else).
  - `hitTest`: inside half-width hits; outside misses; a thin line is still hit within 7 px (`pxPerPt` 2 → 3.5 pt); a hidden line (`shown` false) is skipped; the topmost (highest id) wins on overlap.
  - `groups()` groups by item in `LINE_ITEMS` order.
  - Run `npm test -- line-layer` → FAIL.
- [ ] **Step 2: Implement** the file; `hitTest` measures distance to the sampled polyline with `max(widthPt / 2, 7 / pxPerPt)`.
- [ ] **Step 3: Run** → PASS. Commit `feat(lines): LineLayer geometry, length and hit test`.

### Task 4: `linesSvg` renderer

**Files:**
- Create: `src/lines-render.ts`, `src/lines-render.test.ts`
- Modify: `src/style.css` (`.line-halo`, `.line-draft`, `.line-handle`), `design-system/tokens.json` + `npm run tokens` (halo, draft, handle colours reuse existing outline tokens where one fits; add only what is missing)

**Interfaces:**
- Consumes: `LineLayer`/`linePathPt`/`lineWidthPt` (Task 3), `lineItemById`.
- Produces: `interface LinesSvgOptions { placed: PlacedLine[]; shown: (l: PlacedLine) => boolean; toScreen: (p: Point) => Point; ftPerPt: number | null; pxPerPt: number; selected: string | null; selectedPoint: number | null; draft?: { item: string; points: Point[]; widthFt: number; hover: Point | null } }`, `linesSvg(o): string`, `linesDefs(items: string[]): string` (one `<pattern id="line-<item>">` per used item).

- [ ] **Step 1: Failing tests** (string assertions): a 2-point line at 10 ft width at known scale renders a polygon whose perpendicular extent equals `widthPt × pxPerPt` (parse two points); a bent line renders one `<g>` with `data-id`; round-cap items add two `<circle>` of radius half the pixel width in the item's `color`, flat-cap (dry river) adds none; the pattern's tile width equals the pixel width and length `artLengthPx/artWidthPx × width`, with `patternTransform` rotate matching each segment angle (within 0.1°); hidden lines are absent; selected adds the halo path and (when `selectedPoint` set) point handles plus bend handles at segment midpoints; `draft` renders with class `line-draft` and a rubber-band to `hover`; changing `ftPerPt` changes the pixel width (calibration case).
- [ ] **Step 2: Implement.** Segment loop over the sampled run; join overlap of half a width at interior joins; handles are `<circle class="line-handle">` (points) and `<rect>` (bends) with `data-point` / `data-bend` attributes.
- [ ] **Step 3: Run** `npm test -- lines-render && npm run typecheck` → PASS. Commit `feat(lines): SVG renderer with textured stroke, caps and handles`.

### Task 5: Tool integration (draw, select, drag, bend, undo, hide)

**Files:**
- Modify: `src/outline-ui.ts`, `src/editor-state.ts` (if it types the state), `src/layers-ui.ts` (wiring only here; UI in Task 6)
- Create: `src/line-tool.test.ts` (tool-level behaviour via the existing `OutlineTool` test harness; copy how `editor-state.test.ts` or `history.test.ts` constructs a tool — if none constructs `OutlineTool` in vitest, test the new pure helpers instead and cover the tool in the Task 9 Playwright check)

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces on `OutlineTool`:
  - `lines = new LineLayer()`; `lineDraft: { item: string; points: Point[]; widthFt: number } | null`; `selectedLine: string | null`; `selectedLinePoint: number | null`.
  - `startLine(item: string)`, `finishLine()`, `cancelLine()`, `selectLine(id: string | null)`, `setLineWidth(id: string, ft: number)`, `removeLine(id)`, `removeLinePoint(id, i)`, `toggleLineGroup(item: string)`, `lineShown = (l: PlacedLine): boolean`.
  - `snapshot()`/`state()`/`load()` carry `lines`; `hiddenLayers` filter includes line ids.

- [ ] **Step 1: Behaviour list to implement (each with a test where the harness allows, else the Task 9 check).**
  - `startLine` discards a drawing outline and any armed symbol (like `startPlacing` does) and removes `lines` from `hiddenSections`; `startPlacing`/`begin()` (start outline) call `cancelLine()` first.
  - Tap while `lineDraft`: a tap within 4 px of the last point is ignored, else it appends a page point (45° constrain with Shift, reuse `constrain45`); `finishLine()` (Done, Enter, double-tap on the last point) calls `lines.add`, records one undo step, selects the new line; fewer than 2 points = cancel with no undo step; Esc = `cancelLine()`.
  - Pointer priority in `pointerDown`: armed placing/drawing/line draft; handles; **selected line's point or bend handle**; symbol; **line**; zone move; outline edge. A hidden line is skipped.
  - Drags: `{ type: 'line-point'; id; index }` (move a point, one undo step on release if moved), `{ type: 'line-bend'; id; seg }` (sets the segment's bulge with `bulgeToward`), a tap on a point selects it (`selectedLinePoint`).
  - `setLineWidth` (clamped), `removeLine` (also deletes its hidden state), `removeLinePoint` (keeps at least 2) each record one undo step; `toggleLineGroup` is not an undo step (as symbols).
  - `render()`: surfaces → `linesDefs` + `linesSvg` → symbols → other outlines → handles; selecting a line deselects zones and symbols and vice versa; `update()` notifies the Layers panel.
- [ ] **Step 2: Failing tests first** for what is testable in vitest (state round trip: `state()` then `load()` restores `lines`; undo restores a deleted line; `finishLine` with one point adds nothing).
- [ ] **Step 3: Implement**; keep new logic in small private methods next to the symbol ones.
- [ ] **Step 4: Run** `npm test && npm run typecheck` → PASS (existing outline/symbol tests unchanged). Commit `feat(lines): drawing, selecting, moving, bending and undo in the tool`.

### Task 6: Layers "Lines" section and card

**Files:**
- Create: `src/lines-ui.ts`, `src/lines-ui.test.ts`
- Modify: `src/layers-ui.ts`, `src/sections.ts` (section titles), `src/style.css`

**Interfaces:**
- Consumes: Task 5 tool API, `LINE_ITEMS`, `searchLineItems`, `clampLineWidth`.
- Produces: `class LinesSection { constructor(el: HTMLElement, tool: OutlineTool); render(): void }`, `linePickerList(query: string): string`.

- [ ] **Step 1: Failing tests** (pure list builder, like `pickerList`): `linePickerList('')` has a row with `data-line-item` for each of the 5 items; `linePickerList('fence')` only the fence; a query with no match returns the "No line matches." hint.
- [ ] **Step 2: Implement** `LinesSection` after `SymbolsSection`: header and eye on the section; one row per item with runs ("Wood privacy fence × 3" and an eye via `toggleLineGroup`); **Add line…** opens the picker (search + rows), choosing one calls `startLine`; while drafting, a card with the hint "Tap points along the run. Done or Esc stops." and **Done**; the selected line's card shows name, **Width** (− / typed feet / +, step 0.25, `parseFeet` for typing), length (feet, or "no scale"), **Delete point** (enabled when a point is selected and the line has more than 2), **Delete line**. Mount between the Surfaces and Plants & objects sections in `layers-ui.ts` with the group header, count and collapse state like the others.
- [ ] **Step 3: Run** `npm test && npm run typecheck`; then `npm run dev` and open `http://localhost:5180/?store=memory` to draw one line by hand and read the console for errors. Commit `feat(lines): Lines section with picker and card`.

### Task 7: Stones and markers in the symbol UI

**Files:**
- Modify: `src/symbols-ui.ts`, `src/symbols-render.ts`, `src/symbol-layer.ts`, `src/symbols-render.test.ts`, `src/symbol-layer.test.ts`, `src/symbols.ts` (picker grouping)

**Interfaces:**
- Consumes: `LibrarySymbol.minPx`, `symbolFamilies('marker')`.
- Produces: `symbolSizePx(size, ftPerPt, pxPerPt, minPx = 6)`; `hitTest` uses the symbol's `minPx` for its minimum half-size when larger than 14 px.

- [ ] **Step 1: Failing tests:** `symbolSizePx({ w: 0.42, d: 1.03 }, 0.5, 1, 20)` has long side 20 and keeps proportions; default still 6; a marker at tiny zoom is hit at 10 px from its centre but a plant of the same size still uses 14 px; `symbolsSvg` draws a marker at its minimum size and rotates it with `rot` (direction), stones draw like objects; the picker list shows "Stepping stones" and "Utility markers" captions after "Objects".
- [ ] **Step 2: Implement** the optional parameter and its use in `one()` and `hitTest`; the symbol card shows "Direction" (instead of "Rotate") for markers with the same − / + / typed-degree controls; markers hint "Arrow points along the run (0° = up)". Placed-symbol rows and counts need no change.
- [ ] **Step 3: Run** `npm test && npm run typecheck` → PASS. Commit `feat(symbols): stepping stones and utility markers with direction and minimum size`.

### Task 8: Plant list rows

**Files:**
- Modify: `src/plant-list.ts`, `src/plant-list.test.ts`, `src/plant-list-ui.ts`, `src/style.css`

**Interfaces:**
- Consumes: `LineLayer` helpers, `lineLengthFt`, `SYMBOLS`.
- Produces: `plantList(symbols, outlines, lines: Record<string, PlacedLine> = {}, ftPerPt: number | null = null): PlantList` where `PlantList` gains `lines: { item: LineItem; feet: number | null; ptLength: number; runs: number }[]` and `markers: { symbol: LibrarySymbol; quantity: number }[]`; `objects` still holds stones.

- [ ] **Step 1: Failing tests:** two fence runs of 100 pt at `ftPerPt` 0.1 total 20 ft in 2 runs; with `ftPerPt` null `feet` is null and `ptLength` is 200; items sort in `LINE_ITEMS` order; a gas marker counts under `markers` not `objects`; a stepping stone counts under `objects`; hidden items still count (the function never takes visibility); a plan with only lines is non-empty.
- [ ] **Step 2: Implement** the model; UI: "Lines" caption with a row per item (thumbnail, name, "62 ft · 3 runs" or "no scale · 3 runs"), "Utility markers" caption with the marker cards (no photo); update the empty-state test in the UI so lines alone render the list. Call sites pass `tool.lines.placed` and `tool.cal?.ftPerPt ?? null`.
- [ ] **Step 4: Run** `npm test && npm run typecheck` → PASS. Commit `feat(lines): lines, stones and markers in the Plant list`.

### Task 9: Playwright check, docs, tokens

**Files:**
- Create: `scripts/check-lines.mjs`, `docs/conversations/2026-10-18-lines-and-points.md`
- Modify: `docs/PRD.md` (new §6.11, step table row 5b done), `design-system/tokens.json` (if Task 4 added any), `docs/superpowers/plans/…` ledger not needed

- [ ] **Step 1: `check-lines.mjs`** (model on `check-symbols.mjs`, Riesberg plan, `?store=memory`): open Lines → Add → fence → tap 3 points → Done; assert one `g[data-id=l1]`; drag a point and assert the path changed; drag a segment handle (bend) and assert a curve; change width and assert the pixel width ratio; Delete point then undo; add a gas marker, rotate 90°, place a stone; hide the Lines section (line vanishes, still counted); reopen the plan and assert all persisted; Plant list shows feet and counts. Also assert starting a line while a symbol is armed leaves no stuck state.
- [ ] **Step 2: Run** `node scripts/check-lines.mjs` and the existing checks `check-symbols`, `check-surfaces`, `check-visibility`, `check-zone-edit`, `check-undo` → all PASS (start `npm run dev` first; use the preview tool, never a Bash dev server).
- [ ] **Step 3: Docs.** PRD §6.11 (what each does, ruling 36 px/ft, width defaults, counting); the decision summary lists the brainstorm decisions and the spec's out-of-scope list. Run `npm run tokens` if tokens changed.
- [ ] **Step 4: Full gate** `npm run lint && npm run typecheck && npm test` → PASS. Commit `docs(lines): Playwright check, PRD §6.11 and decision summary`.
