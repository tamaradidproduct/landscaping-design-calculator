# Handoff-style right panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge Layers and the Plant list into one right panel whose rows are handoff-style cards, and move Undo/Redo/zoom/Fit onto a floating canvas bar.

**Architecture:** Each Layers section keeps its own class and wiring; only the row markup changes (a `handoff` variant of `layerRow` in `ui.ts`). The separate Plant list panel is deleted; `plant-list.ts` (pure) stays and feeds the Lines totals. Pure helpers live in a new `handoff-row.ts`.

**Tech Stack:** TypeScript, Vite, Vitest, HTML-string UI builders, Playwright check scripts (`plan-builder/scripts/`).

**Spec:** `docs/superpowers/specs/2026-10-19-handoff-panel-design.md`

All paths below are relative to `plan-builder/` unless they start with `docs/`. Run commands there.

## Global Constraints

- Panel stays docked, `--width-sidebar` (280 px); controls at least 44 px; works offline.
- Tokens only from `src/styles/tokens.css` (never hand-edited). Reuse `--width-plant-art` for the 56 px art. If a new token proves necessary: `npm run tokens` flow and update the Plan Builder artifact too.
- No model, storage or save changes. No water data.
- Section order: **Surfaces → Plants & objects → Lines → Outlines**.
- Keep element ids `undo`, `redo`, `zoom-in`, `zoom-out`, `fit` (scripts rely on them).
- Check commands: `npm run lint`, `npm run typecheck`, `npm test`.
- Do not push, open a PR or enable auto-merge until the user says so. Commit on `feat/handoff-panel`; end commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A kind hidden with its eye still counts in the quantity (hidden symbols count today) — Task 1 test.
- Deleting instances while a card is open: "3 of 3" must not linger when the group shrinks to 1 (no label) or the selection leaves the group — Task 1 test.
- Objects and markers have no photo: the expanded card must render no `<img>`, never a broken one — Task 1 test.
- A long name in 280 px must ellipsize without pushing the quantity out of the row — Task 6 browser check.
- Lines with no plan scale show "no scale" instead of a length — Task 4 browser check.
- Library photos must be in the offline precache — Task 3 verification step.

---

### Task 1: Pure helpers and section order

**Files:**
- Create: `src/handoff-row.ts`, `src/handoff-row.test.ts`
- Modify: `src/sections.ts:7` (`GROUPS`), `src/sections.test.ts`

**Interfaces:**
- Produces (`src/handoff-row.ts`):
  - `interface KindGroup { symbol: string; ids: string[] }`
  - `splitByKind(groups: KindGroup[]): { plants: KindGroup[]; objects: KindGroup[]; markers: KindGroup[] }` — by `symbolById(g.symbol).kind` (`'plant' | 'object' | 'marker'`), keeping input order; groups whose symbol is unknown are dropped.
  - `instanceLabel(selectedId: string | null, ids: readonly string[]): string | null` — `"2 of 3"`; `null` when `selectedId` is not in `ids` or `ids.length < 2`.
  - `photoHtml(photo: string | undefined): string` — `<img class="layer-photo" loading="lazy" src="…" alt="">` (src escaped with `esc`), or `''` when `photo` is undefined.
- Produces: `GROUPS` is `['surfaces', 'symbols', 'lines', 'outlines']`.

- [ ] **Step 1: Write the failing tests** in `src/handoff-row.test.ts` (names and assertions):
  - `splitByKind puts each kind in its own list, in input order`: take one id per kind from `SYMBOLS` (`SYMBOLS.find(s => s.kind === 'plant')!.id`, etc.); `splitByKind([{symbol: marker, ids:['m1']}, {symbol: plant, ids:['p1','p2']}, {symbol: object, ids:['o1']}])` gives `plants[0].ids` of length 2, `objects` length 1, `markers` length 1.
  - `splitByKind keeps every id, so hidden instances still count`: the plant group above keeps both ids (`plants[0].ids` equals `['p1','p2']`); the row's quantity is `ids.length`, never filtered by visibility.
  - `splitByKind drops unknown symbols`: `splitByKind([{symbol: 'nope', ids: ['x']}])` equals `{ plants: [], objects: [], markers: [] }`.
  - `instanceLabel`: `('b', ['a','b','c'])` → `'2 of 3'`; `('a', ['a'])` → `null`; `(null, ['a','b'])` → `null`; `('z', ['a','b'])` → `null`.
  - `photoHtml`: `photoHtml(undefined)` → `''`; `photoHtml('/p.webp?a=1&b=2')` contains `loading="lazy"` and `src="/p.webp?a=1&amp;b=2"`.
- [ ] **Step 2:** In `src/sections.test.ts` add `test('panel order follows the handoff: surfaces, plants & objects, lines, outlines', () => expect([...GROUPS]).toEqual(['surfaces', 'symbols', 'lines', 'outlines']))`.
- [ ] **Step 3: Run** `npx vitest run src/handoff-row.test.ts src/sections.test.ts`. Expected: FAIL (module missing; order differs).
- [ ] **Step 4: Implement** the three functions in `src/handoff-row.ts` (import `symbolById` from `./symbols`, `esc` from `./ui`) and change `GROUPS` in `src/sections.ts`.
- [ ] **Step 5: Run** the same command. Expected: PASS.
- [ ] **Step 6: Commit** `feat(panel): handoff row helpers and section order`.

### Task 2: Handoff row variant in `ui.ts`

**Files:**
- Modify: `src/ui.ts` (`LayerRowOptions`, `layerRow`)
- Create: `src/ui.test.ts`

**Interfaces:**
- Produces: `LayerRowOptions.handoff?: { category?: string; quantity?: { value: string; label: string } }`. With `handoff` set, `layerRow` emits the row button with classes `layer-row handoff` (then `selected`/`off` as today), the swatch, a `layer-text` holding `layer-name` and, when given, `<span class="layer-category">`, and, when `quantity` is given, `<span class="handoff-qty"><b>{value}</b><small>{label}</small></span>` instead of `layer-meta`. The eye wrapper is unchanged. All text goes through `esc`.

- [ ] **Step 1: Write the failing test** in `src/ui.test.ts`: `layerRow('Blue Diamond Spruce', { swatch: { symbol: '/a.webp' }, handoff: { category: 'Evergreen tree', quantity: { value: '3', label: 'Quantity' } }, eye: { id: 'x', hidden: false } })` contains `layer-row handoff`, `<span class="layer-category">Evergreen tree</span>`, `<span class="handoff-qty"><b>3</b><small>Quantity</small></span>`; a second case with name `'<b>'` contains `&lt;b&gt;`; a third without `handoff` does not contain `handoff`.
- [ ] **Step 2: Run** `npx vitest run src/ui.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the variant in `layerRow`; reuse `layerName` for the text, adding the category line only in the handoff case.
- [ ] **Step 4: Run** the test. Expected: PASS. Then `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(panel): handoff variant of layerRow`.

### Task 3: Plants & objects section

**Files:**
- Modify: `src/symbols-ui.ts` (`SymbolsSection.render`, `card`), `vite.config.ts` (only if photos are not precached)

**Interfaces:**
- Consumes: `splitByKind`, `instanceLabel`, `photoHtml` (Task 1); `layerRow` `handoff` option (Task 2).
- Produces: rows grouped under `caption('Plants')`, `caption('Objects')`, `caption('Utility markers')` (a caption only when its list is non-empty); row = `layerRow(lib.name, { swatch: { symbol: lib.thumb }, handoff: { category: lib.category || undefined, quantity: { value: String(g.ids.length), label: 'Quantity' } }, selected, data: { symbolRow }, eye })`. The expanded `card()` starts its body with `photoHtml(lib.photo)`, sets `meta: instanceLabel(id, idsOfThisKind)` (the group's ids), then keeps the size hint, Rotate and Delete.

- [ ] **Step 1: Implement** the sub-captions and row change in `render()` (keep the empty-state hint, the placing card, the Add… picker and `wire()` unchanged; the `data-symbol-row` and `data-eye-symbol` hooks stay).
- [ ] **Step 2: Implement** the photo and `meta` in `card()`; the group's ids come from `t.symbols.groups()`.
- [ ] **Step 3: Verify** `npm run typecheck && npx vitest run`. Expected: PASS (existing tests untouched).
- [ ] **Step 4: Offline photos.** Open `vite.config.ts`; confirm the PWA precache pattern includes `webp` under `assets/symbols/photos/`. If not, add it to `workbox.globPatterns`. Expected: `npm run build` lists the photos in the precache manifest (`dist/sw.js` contains `photos/`).
- [ ] **Step 5: Commit** `feat(panel): handoff rows and photo for plants and objects`.

### Task 4: Surfaces and Lines rows

**Files:**
- Modify: `src/surfaces-ui.ts:29`, `src/lines-ui.ts:30-33`

**Interfaces:**
- Consumes: `layerRow` `handoff` option (Task 2); `plantList` from `src/plant-list.ts` (`.lines[]` has `{ item, feet, runs }`); `lengthText` (already in `lines-ui.ts`).
- Produces: surface rows pass `handoff: {}` (larger swatch, name only); line rows pass `handoff: { quantity: { value: lengthText(feet), label: `${runs} ${runs === 1 ? 'run' : 'runs'}` } }`, where `feet` and `runs` come from `plantList(t.symbols.placed, t.outlines, t.lines.placed, t.cal?.ftPerPt ?? null).lines.find(l => l.item.id === g.item)`.

- [ ] **Step 1: Implement** both row changes; leave cards, pickers and wiring untouched.
- [ ] **Step 2: Verify** `npm run typecheck && npx vitest run`. Expected: PASS.
- [ ] **Step 3: Commit** `feat(panel): handoff rows for surfaces and lines`.

### Task 5: Panel markup, view bar, removal of the Plant list

**Files:**
- Modify: `index.html`, `src/main.ts` (lines 8, 96, 173, and nothing else), `src/styles/components.css`
- Delete: `src/plant-list-ui.ts`

**Interfaces:**
- Produces: `index.html` sidebar holds only the Layers section, sections in the order Surfaces, Plants & objects (`#symbols`), Lines (`#lines`), Outlines (with the Plot plan layer inside, unchanged). The `side-section` blocks with Undo/Redo and zoom/Fit and the `#plant-list-section` are removed from the sidebar; the same buttons (same ids, same `title`s) sit in a new `<div class="view-bar" role="group" aria-label="View and history">` inside `.canvas`, after `.plan-head`.
- CSS: `.view-bar` is `position: absolute` at the canvas's top-right (`top: calc(var(--space-8) + env(safe-area-inset-top, 0px)); right: var(--space-8)`), `display: flex; gap: var(--space-4)`, `box-shadow: var(--shadow-sm)`, background `var(--color-surface)` with the `.segmented` border and radius; buttons keep the default control size. Add the handoff row styles: `button.layer-row.handoff` (min-height `calc(var(--width-plant-art) + var(--space-4))`), `.handoff .swatch` sized to `--width-plant-art`, `.layer-category` (the `.plant-category` rule: `--text-xs`, uppercase, muted), `.handoff-qty` (right-aligned column; `b` is `--text-lg`, `--weight-strong`, tabular numbers; `small` is `--text-xs` uppercase muted), `.layer-photo` (`width: 100%; border-radius: var(--radius-sm); object-fit: cover`), and a hairline `border-bottom` between handoff rows. Delete the now-unused `.plant-*` rules (lines 186-197) and the `.plant-list` summary rule.

- [ ] **Step 1: Edit** `index.html` as above (reorder, move controls, drop `#plant-list-section`).
- [ ] **Step 2: Edit** `src/main.ts`: remove the `renderPlantList` import and its two calls; nothing else changes (`$('undo')`, `$('fit')` etc. still resolve).
- [ ] **Step 3: Delete** `src/plant-list-ui.ts`; edit `components.css` as above.
- [ ] **Step 4: Verify** `npm run lint && npm run typecheck && npm test`. Expected: all PASS; `grep -rn "plant-list-ui\|renderPlantList\|#plant-list" src index.html` finds nothing.
- [ ] **Step 5: Commit** `feat(panel): merge plant list into Layers; move view controls onto the canvas`.

### Task 6: Browser checks

**Files:**
- Modify: every script that references the old panel — find with `grep -n "plant-list\|plant-count\|plant-photo\|plant-card\|plant-surface\|plant-measure" scripts/*.mjs` (known: `check-symbols.mjs`, `check-lines.mjs`; also check `check-surfaces.mjs`, `check-visibility.mjs`, `check-undo.mjs`, `check-step3.mjs`, `check-step2b.mjs` for `#undo` / zoom / `#fit` use, which keep working because the ids are unchanged)
- Create: `scripts/check-panel.mjs` (same harness as `check-symbols.mjs`: `openPlan`, memory store, Riesberg, viewport 1180×1000)

**Interfaces:**
- Replacement selectors: counts → `.layer-row.handoff .handoff-qty b`; the whole list text → the panel's `#symbols`/`#lines`/`#surfaces` `innerText`.

- [ ] **Step 1: Update** each script's `#plant-list` reads to the new selectors; keep each script's other assertions.
- [ ] **Step 2: Write** `scripts/check-panel.mjs` with checks (each `check(name, ok, got)`): sub-captions "Plants", "Objects", "Utility markers" appear for one placed item of each kind; the plant row's quantity equals the placed count and stays the same when that kind's eye hides it; tapping the row selects an instance and the card shows `.layer-photo` and "1 of 2"; an object's card has no `.layer-photo`; after deleting one of two instances the label is gone and the quantity reads 1; a long custom name leaves `.handoff-qty` inside the row's bounding box; with no scale a line row reads "no scale" and after typing a length it reads feet; `#plant-list` does not exist; `#undo`, `#redo`, `#zoom-in`, `#zoom-out`, `#fit` exist inside `.view-bar` and none inside `#sidebar`; the sidebar's section captions appear in the order Surfaces, Plants & objects, Lines, Outlines.
- [ ] **Step 3: Run** `npm run dev` (port 5180), then `node scripts/check-panel.mjs <riesberg.pdf>` and the updated scripts (`check-symbols`, `check-lines`, `check-surfaces`, `check-visibility`, `check-undo`, `check-collapse`). Expected: every line `ok`, no page errors. The Riesberg PDF is in the git-ignored `samples/`; ask the user for its path if absent.
- [ ] **Step 4: Screenshot** the panel at 1180 px and at tablet width 820 px beside the handoff sheet (Figma `117:12027`); note any visual gap for the user.
- [ ] **Step 5: Commit** `test(panel): browser checks for the handoff panel`.

### Task 7: Docs

**Files:**
- Modify: `docs/PRD.md` (§5 table row, §6.1 side panel bullet, §6.10 Plant list, §6.11 Layers → Lines placement)
- Create: `docs/conversations/2026-10-19-handoff-panel.md`

- [ ] **Step 1: Update** PRD §6.1: the side panel is Layers only; Undo/Redo and zoom/Fit sit in a floating bar at the canvas's top-right; sections run Surfaces, Plants & objects, Lines, Outlines. §6.10: the Plant list panel is merged into the rows (handoff-style cards with quantity; photo in the expanded card). §6.11: Lines sits below Plants & objects. Add a status row to §5 for this branch.
- [ ] **Step 2: Write** the decision summary in `docs/conversations/2026-10-19-handoff-panel.md`: whole panel merged; every row a handoff card; water skipped (follow-up: research all 51 plants with sources); view controls to the canvas.
- [ ] **Step 3: Final verification:** `npm run lint && npm run typecheck && npm test`. Expected: all PASS.
- [ ] **Step 4: Commit** `docs: PRD and decision summary for the handoff panel`.
