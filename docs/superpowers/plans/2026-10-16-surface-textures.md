# Surface Textures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 11 flat-colour materials with the 29 Figma area textures, drawn at true real-world scale.

**Architecture:** Textures are bundled WebP tiles (built once from Figma by a script) referenced by `materials.ts`. `patterns.ts` emits one image `<pattern>` per material for the plan, sized `tileFt / ftPerPt * pxPerPt` and resized whenever the view or calibration changes, plus a fixed-size twin for swatches. Legacy ids are remapped when a plan loads.

**Tech Stack:** TypeScript, Vite (`import.meta.glob`), vitest, `sharp` (dev only, tile build), Playwright checks.

**Spec:** `docs/superpowers/specs/2026-10-16-surface-textures-design.md`

## Global Constraints

- App directory is `plan-builder/`; run all commands there.
- Check commands: `npm run lint`, `npm run typecheck`, `npm test`, plus the Riesberg Playwright check `scripts/check-surfaces.mjs`.
- Figma file `0B2UpvIGBFOE1ZEDx8rXPR`, Surfaces section `170:1977`; 29 materials, ids are kebab-case of the name (see spec table).
- `tileFt` default 2; tile files 256 px WebP in `src/assets/surfaces/<id>.webp`.
- `src/styles/tokens.css` is generated: edit `design-system/tokens.json`, run `npm run tokens`, never edit the CSS by hand.
- Keep tokens `color-material-shade` and `mix-material-edge`; remove the 11 `color-material-<old id>` tokens.
- Do not push, open a PR or enable auto-merge.
- Branch is `feat/surface-textures`; commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Plan with no calibration (`ftPerPt` unknown): patterns use a fixed fallback tile size, never NaN or zero. Tested in Task 3.
- Zoom extremes (`MIN_ZOOM` 1 to `MAX_ZOOM` 24): tile px is clamped to at least `MIN_TILE_PX` (4) so a tiny tile never moirés or stalls. Tested in Task 3.
- Saved plan with a legacy id loads remapped; an unknown id is rejected as an invalid plan, never rendered blank. Tested in Task 2.
- Changing a zone's material renames it only while it is still named after the old material, with the new names. Covered in Task 6.
- Offline: the built `dist/` precache manifest lists the `.webp` tiles. Checked in Task 5.

---

### Task 1: Texture source list and tile build

**Files:**
- Create: `plan-builder/scripts/surface-sources.mjs` (the 29 entries: `id`, `name`, `family`, `trade`, `node` = Figma id of the swatch image node)
- Create: `plan-builder/scripts/build-surface-tiles.mjs`
- Create: `plan-builder/src/assets/surfaces/<id>.webp` (29 files) and `plan-builder/src/assets/surfaces/edges.json` (`{ [id]: '#rrggbb' }`)
- Modify: `plan-builder/package.json` (devDependency `sharp`)

**Interfaces:**
- Produces: `SURFACE_SOURCES: { id: string; name: string; family: Family; trade: 'hardscape' | 'softscape'; node: string }[]` exported from `surface-sources.mjs`, order = spec table order. `Family` is `'Turf & seed' | 'Mulch & soil' | 'Rock & gravel' | 'Pavers & stone' | 'Concrete' | 'Decking'`. Trade: Turf & seed, Mulch & soil, and the rock-family loose materials are `softscape`; Pavers & stone, Concrete, Decking, and Red crushed concrete are `hardscape` (matches the old split: gravel was hardscape, river and decorative rock softscape, so Rock & gravel is `softscape` except Granite fines, Clear mountain granite, Mountain granite rock, which are `hardscape`).
- Produces: `edges.json` read by Task 2.

- [ ] **Step 1: Find swatch node ids.** For each of the 29 symbols in the spec table (symbol ids are in Figma section `170:1977`; use `get_metadata` on a symbol to find its image-filled swatch child), record the swatch node id in `surface-sources.mjs`.
- [ ] **Step 2: Download each swatch at 512 px** with the Figma `get_screenshot` tool (`maxDimension` 512) into a scratch folder outside the repo (curl the returned URL).
- [ ] **Step 3: Implement `build-surface-tiles.mjs <inputDir>`:** for each source, crop 4% inset on every side (removes drop shadow and dashed border seen on pavers and concrete swatches), resize to 256×256, write `src/assets/surfaces/<id>.webp` (quality 80), and compute `edge` as the average colour of the cropped tile; write `edges.json`.
- [ ] **Step 4: Run it and inspect.** Open every tile; if one shows a seam when 2×2 tiled, change that source to mirror-tile (2×2 mirrored, downscale to 256) via a `mirror: true` flag in `surface-sources.mjs`.
- [ ] **Step 5: Verify** `ls src/assets/surfaces/*.webp | wc -l` prints 29 and total size under 1.5 MB (`du -ch src/assets/surfaces`).
- [ ] **Step 6: Commit** `feat(surfaces): export the Figma surface textures as bundled tiles`.

### Task 2: Material model, legacy ids, plan load

**Files:**
- Modify: `plan-builder/src/materials.ts`, `plan-builder/src/plan-model.ts:43`
- Test: `plan-builder/src/materials.test.ts`, `plan-builder/src/plan-model.test.ts`

**Interfaces:**
- Consumes: `SURFACE_SOURCES` (Task 1) and `edges.json`.
- Produces: `type Family`, `type MaterialId` (union of the 29 ids), `interface Material { id; name; family; trade; tile: string; tileFt: number; edge: string }`, `MATERIALS: readonly Material[]`, `material(id): Material`, `materialsByFamily(): { family: Family; materials: Material[] }[]` (six groups in spec order), `LEGACY_MATERIAL_IDS: Record<string, MaterialId>`, `normalizeMaterialId(id: string): MaterialId | null` (legacy mapped, valid passed through, unknown null).

- [ ] **Step 1: Write failing tests** in `materials.test.ts` (replace the old ones): `MATERIALS.length` is 29 with unique ids and names; `materialsByFamily()` returns six non-empty groups in order Turf & seed, Mulch & soil, Rock & gravel, Pavers & stone, Concrete, Decking; every `tile` is a non-empty string and every `edge` matches `/^#[0-9a-f]{6}$/`; every `LEGACY_MATERIAL_IDS` value is a valid id and its keys are exactly the 11 old ids (sod → `premium-sod`, turf → `festival-turf`, mulch → `wood-mulch`, river-rock → `white-river-rock`, decorative-rock → `mesa-cobble-stone`, gravel → `clear-mountain-granite`, pavers → `pavers-classic`, flagstone → `red-flagstone`, concrete-brushed → `brushed-concrete`, concrete-stamped → `stamped-concrete`, decking → `deck-wood`); `normalizeMaterialId('sod')` is `premium-sod`, `normalizeMaterialId('sand')` is `sand`, `normalizeMaterialId('nope')` is `null`. In `plan-model.test.ts`: `fromDoc` of a doc whose surface has `material: 'sod'` returns `premium-sod`; `material: 'nope'` throws `PlanFormatError` with reason `invalid`. Keep the `opacity-surface-editing` test.
- [ ] **Step 2: Run** `npx vitest run src/materials.test.ts src/plan-model.test.ts`; expect FAIL.
- [ ] **Step 3: Implement** `materials.ts` building `MATERIALS` from the `SURFACE_SOURCES` data (import the `.mjs` list, or generate `src/materials-data.ts` from it if TypeScript cannot import `.mjs` cleanly) and resolving `tile` with `import.meta.glob('./assets/surfaces/*.webp', { eager: true, query: '?url', import: 'default' })`; `tileFt` is 2 for all. Implement `fromDoc` remap with `normalizeMaterialId`.
- [ ] **Step 4: Run** the two test files; expect PASS. Run `npm run typecheck`; fix type errors at old `MaterialId` uses (the picker is rebuilt in Task 6, so typecheck may fail until then: acceptable only if the failures are in `surfaces-ui.ts` and `ui.ts`; note them in the commit).
- [ ] **Step 5: Commit** `feat(surfaces): 29-material model with legacy id mapping`.

### Task 3: Image patterns at true scale

**Files:**
- Modify: `plan-builder/src/patterns.ts` (replace `TILES`, `patternDefs`)
- Test: `plan-builder/src/materials.test.ts` (pattern tests) or new `plan-builder/src/patterns.test.ts`

**Interfaces:**
- Consumes: `MATERIALS`, `Material.tile`, `Material.tileFt`.
- Produces: `MIN_TILE_PX = 4`, `FALLBACK_TILE_PX = 64`, `SWATCH_TILE_PX = 24`, `tileSizePx(tileFt: number, ftPerPt: number | null, pxPerPt: number): number` (`tileFt / ftPerPt * pxPerPt`, clamped to at least `MIN_TILE_PX`; `FALLBACK_TILE_PX` when `ftPerPt` is null, 0 or not finite), `patternDefs(): string` (one `material-<id>` plan pattern and one `swatch-<id>` fixed pattern per material, each an `<image href=tile>` in a `userSpaceOnUse` pattern), `materialFill(id): string` (`url(#material-<id>)`), `swatchFill(id): string` (`url(#swatch-<id>)`), `scalePatterns(root: ParentNode, ftPerPt: number | null, pxPerPt: number): void` (sets `width`, `height` of every `pattern[id^="material-"]` and its `<image>` to `tileSizePx` for that material's `tileFt`).

- [ ] **Step 1: Write failing tests:** `tileSizePx(2, 0.05, 10)` is 400; `tileSizePx(2, 0.05, 0.01)` is `MIN_TILE_PX`; `tileSizePx(2, null, 10)`, `tileSizePx(2, 0, 10)` and `tileSizePx(2, NaN, 10)` are `FALLBACK_TILE_PX`; `patternDefs()` contains `id="material-premium-sod"` and `id="swatch-premium-sod"` for every material and each contains the material's tile URL; `materialFill('sand')` is `url(#material-sand)`, `swatchFill('sand')` is `url(#swatch-sand)`; `scalePatterns` on a DOM built from `patternDefs()` (jsdom is not installed: build a minimal fake root with `querySelectorAll` returning plain objects with `setAttribute`) sets the plan pattern width to 400 for `(0.05, 10)` and leaves `swatch-` patterns at `SWATCH_TILE_PX`.
- [ ] **Step 2: Run** `npx vitest run src/patterns.test.ts`; expect FAIL.
- [ ] **Step 3: Implement** the functions above in `patterns.ts`; drop the old procedural `TILES` and `PatternId`.
- [ ] **Step 4: Run** the test; expect PASS.
- [ ] **Step 5: Commit** `feat(surfaces): image patterns sized to real-world scale`.

### Task 4: Wire scaling and edge colour into the plan

**Files:**
- Modify: `plan-builder/src/main.ts` (view and calibration change paths: `applyView`, wherever `Calibration` updates), `plan-builder/src/outline-ui.ts:43,45` (`colorOf`, `fillOf`)

**Interfaces:**
- Consumes: `scalePatterns`, `material(id).edge`, `host.pxPerPt()`, `Calibration.ftPerPt`.
- Produces: nothing new; `colorOf` returns `material(o.material).edge` for surfaces.

- [ ] **Step 1: In `colorOf`**, return the material's `edge` hex for a surface instead of `var(--color-material-<id>)`.
- [ ] **Step 2: In `main.ts`**, call `scalePatterns(document.querySelector('.defs')!, ftPerPt, pxPerPt)` at the end of `applyView` and after every calibration change, batched with `requestAnimationFrame` (one pending call at a time). `ftPerPt` is `null` when the plan has no calibration. `pxPerPt` is `fitScale * view.scale` (check the existing `pxPerPt` implementation and reuse it).
- [ ] **Step 3: Verify** `npm run dev`, open `http://localhost:5180/?store=memory`, open a sample plan, draw a zone, zoom with the +/− buttons: the texture grows and shrinks with the plan (screenshot at two zoom levels).
- [ ] **Step 4: Commit** `feat(surfaces): textures follow zoom and calibration`.

### Task 5: Picker, swatches, tokens, offline

**Files:**
- Modify: `plan-builder/src/surfaces-ui.ts:13`, `plan-builder/src/ui.ts:104-106`, `plan-builder/vite.config.ts` (`globPatterns` add `webp`), `plan-builder/design-system/tokens.json`, `plan-builder/src/styles/components.css` (chip rules only if needed)
- Test: `plan-builder/src/tokens.test.ts` (existing), `plan-builder/src/materials.test.ts`

**Interfaces:**
- Consumes: `materialsByFamily()`, `swatchFill`.
- Produces: picker rendering six family captions with texture chips; `ui.ts` swatch uses `swatchFill`.

- [ ] **Step 1: Failing test:** in `materials.test.ts`, no token named `color-material-<old id>` exists (only `color-material-shade`); `mix-material-edge` still exists.
- [ ] **Step 2: Run** `npx vitest run src/materials.test.ts src/tokens.test.ts`; expect FAIL.
- [ ] **Step 3: Remove** the 11 tokens from `tokens.json`, run `npm run tokens`.
- [ ] **Step 4: Rebuild the picker** to group by `materialsByFamily()` with `caption(family)`, replacing `TRADES`/`materialsByTrade`, and point the swatch at `swatchFill`.
- [ ] **Step 5: Add `webp`** to `globPatterns`; run `npm run build` and confirm `grep -c webp dist/sw.js` is at least 29.
- [ ] **Step 6: Run** `npm run lint && npm run typecheck && npm test`; expect all pass.
- [ ] **Step 7: Update the Plan Builder design-system artifact** (https://claude.ai/artifact/JKnSFiSuXHsQ977zniZkYo) to remove the same 11 tokens, per `design-system/README.md`.
- [ ] **Step 8: Commit** `feat(surfaces): grouped texture picker; drop old material tokens`.

### Task 6: Playwright check, docs, final verify

**Files:**
- Modify: `plan-builder/scripts/check-surfaces.mjs` (old material ids and names), `docs/PRD.md` (§6.8 materials and tiling), create `docs/conversations/2026-10-16-surface-textures.md`

- [ ] **Step 1: Update `check-surfaces.mjs`** to the new ids and names; keep the "material change renames only a zone still named after its material" assertions using the new names (for example Premium sod → Pavers (classic)).
- [ ] **Step 2: Run** `node scripts/check-surfaces.mjs <riesberg.pdf>` (with the dev server running); expect every result `ok`.
- [ ] **Step 3: Update PRD §6.8** (materials list now the 29 library textures, true-scale tiling, grouped picker; remove the 11-material sentence) and write the decision summary in the style of `docs/conversations/2026-10-15-surfaces.md`.
- [ ] **Step 4: Final run** `npm run lint && npm run typecheck && npm test`; expect all pass.
- [ ] **Step 5: Commit** `docs: surface textures (PRD §6.8, decision summary)` and the check-script update.
