# Handoff: what was built in this thread (Plan Builder, 2026-10-16 → 2026-10-20)

Read this first, then `2026-10-20-next-agent-specs.md` for what to do next. Authority for product behaviour is `docs/PRD.md` §6; per-feature reasoning is in `docs/conversations/` and `docs/superpowers/specs|plans/`.

## 1. The project and how to work in it

- **App:** `plan-builder/` (Vite + TypeScript, vitest, Playwright checks, Firebase). Contractors trace a plot-plan PDF, add surfaces, plants, objects and lines, and get a Plant list. Repo root: `/Users/tamara/coding_projects/landscaping-design-calculator` (a second checkout, `../lp-gate`, is a git worktree used for this thread's unpushed work).
- **Run checks:** from `plan-builder/`: `npm run lint`, `npm run typecheck`, `npm test` (481 unit tests). Browser checks: `node scripts/check-<name>.mjs ../samples/riesberg-plot-plan.pdf 'http://localhost:<port>/?store=memory' [outDir]` against `npm run dev`. `?store=memory` bypasses Google sign-in (dev builds only). **Only `check-tool-defaults.mjs`, `check-plans.mjs` and `check-step1.mjs` exit non-zero on failure; the others only print a table, so read the output.**
- **Tokens:** edit `plan-builder/design-system/tokens.json`, run `npm run tokens`; never hand-edit `src/styles/tokens.css`. TypeScript geometry tokens live in `src/overlay-tokens.ts` (MARK, HIT, GESTURE, LABEL, DRAWN). The design-system artifact (https://claude.ai/artifact/JKnSFiSuXHsQ977zniZkYo) must follow token changes; **it has not been updated for several rounds** (see next-agent specs).
- **Standing rules from the user (CLAUDE.md files and conversation):**
  - Replies to the user are **bullets only** (every line a bullet, heading, table row or code fence; no standalone sentences).
  - **Never push, open a PR or enable auto-merge until the user says so.** (They said so for PRs 19, 33, 34 and 40; Auto-fix was offered each time and declined.)
  - Process the user chose each time: brainstorm → written spec (approve) → written plan (approve + choose execution; they always chose **Native**: implement every task yourself, then **one** whole-branch reviewer on the most capable model, fix Critical/Important in one pass with a test that failed first, defer Minors to the ledger and the final message) → ask before pushing.
  - Keep a task list and call the wrap-up tool at the end of each turn (Claude Code desktop app conventions); a ledger lives in `.superpowers/sdd/<plan>/progress.md` (git-ignored) and is deleted after the final review.
  - Rulings you make on the user's behalf must be listed in the final message with their cost.
- **Other session:** the main checkout is on branch `feat/handoff-panel` (another agent's right-panel redesign; spec/plan docs only at last look). Do not switch that checkout; work in `../lp-gate`.

## 2. What was built (all with specs, plans, tests, Playwright checks, PRD sections)

| Area | Result | Where |
|---|---|---|
| **Surface textures** (PR 19, merged) | 29 Figma textures at true scale (4× exports); legacy-id alias map | `scripts/surface-sources.mjs`, `build-surface-tiles.mjs`, `src/materials.ts`, `patterns.ts` |
| **Zone scale, visibility, rounding** (PR 33, merged) | per-zone texture scale; eyes per layer, section and category, saved with the plan; list material picker; rounding on any shape incl. bent sides; Shift rounds all; handles easier to reach | `src/outline.ts`, `fillet.ts`, `shape-edit.ts`, `sections.ts`, `surfaces-ui.ts` |
| **Plants & objects** (PR 34, merged) | 65 library symbols (51 plants, 14 objects) at researched true size (`docs/symbol-sizes.md`, 15 marked approximate), one per tap, move/rotate/delete, undo, hide, Plant list | `src/symbols*.ts`, `symbol-layer.ts`, `plant-list*.ts`, `scripts/build-symbols.mjs` |
| **Lines, stepping stones, utility markers** (PR 40, merged) | 5 line items (fence, veneer wall, Allen block retaining wall, white stone edging, dry river) drawn by tapping points, bendable, editable width (0.25–12 ft), textured; 4 stepping stones; 3 markers (rotation = direction, 20 px minimum on screen); counted in the Plant list | `src/line-*.ts`, `lines-*.ts`, `src/assets/lines`, `docs/conversations/2026-10-18-lines-and-points.md` |
| **Plans + invite-only sign-in** (merged earlier) | many plans per contractor, Firebase, offline, autosave | `src/firebase-plan-store.ts`, `plans-ui.ts` (PRD §6.9) |

### Built in this thread but NOT pushed (branch `integration/preview`, 32 commits on top of `origin/main` 5002100)

`integration/preview` merges four feature branches and adds a consolidation pass; **it is the branch to ship**.

| Feature | Branch (also merged into integration) | Summary |
|---|---|---|
| **Plot fill + surface quantities** | `feat/plot-fill` | Surfaces → *Fill the plot…* covers the lot with one surface that **follows the boundary** (flag `base` on an outline, key `fill`, always the lowest surface, shape locked); the Plant list shows each material's **visible area** in sq ft (clipped to the lot; house, features and higher surfaces cut out; plants/objects/lines don't). `src/plot-fill.ts`, `surface-area.ts`. |
| **Layering** | `feat/layering` | Layers sections reorderable with ↑ ↓ (saved as `sectionOrder`); default top→bottom **Plants & objects, Lines, Surfaces, Outlines**; the plan paints in that order; plants stack automatically (markers < objects < perennials/grasses < shrubs < trees; larger spread below smaller). `sections.ts` (`moveSection`, `moveAmong`, `paintOrder`), `symbols.ts` (`tierOf`), `symbol-layer.ts` (`ordered`). |
| **Move lines + label scaling** | `feat/move-lines` | Press and drag a line's body to move the whole run (arrow keys nudge); outline labels scale with the plan (now 8 page points, 7–24 px: `LABEL` token). |
| **Gating** | `fix/gate-sections` | Until the plot boundary is closed only **Outlines** shows (with the Plot plan block); Surfaces, Lines, Plants & objects and the Plant list appear once it is (`groupAvailable`). |
| **Consolidation** | on `integration/preview` | Loose numbers into token files; `figma-scale.ts`; one Layers sections component (`layers-sections.ts`); one search-picker component (`ui.ts`); shared eye-toggle/nudge code in the tool; `formatLengthFt`; `base` valid only under key `fill`; marker cards say Direction; draft line dashed; surface card hints that typed sizes need the scale. |
| **Tool-default fix** | on `integration/preview` | Root cause of "outlines start in Rectangle": **X changed and saved the tool even when nothing was being drawn**. Now X/the bar act only while drawing; undo/redo into a drawing in progress restores that kind's tool; selecting a plant opens its collapsed section; plot fill hides the Snap toggle; section move buttons are 48 px. Asserting `scripts/check-tool-defaults.mjs`. |

- **Preview server:** `cd ../lp-gate/plan-builder && npx vite --host=localhost --port=5191` → `http://localhost:5191/?store=memory` (the user's browser pane points here). The main checkout's dev server (port 5180) shows *another* branch and none of this work.
- **Latest numbers:** 481 unit tests pass, typecheck and lint clean; the 13 older browser checks plus `check-layering`, `check-plot-fill`, `check-move-lines`, `check-sections-gate`, `check-tool-defaults` passed on the last full run.

## 3. Decisions the user made (do not relitigate)

- Surfaces first, then symbols; textures at **true scale** and larger; per-zone scale control; eyes per layer **and** category, saved with the plan.
- One symbol per tap; plants and objects together; objects can rotate; sizes researched online with sources.
- Lines: tap points then Done, bendable, width per line; stones and markers one per tap; sizes **kept as in Figma** at 36 px = 1 ft.
- Plot fill **follows the boundary** (not a one-time copy); area counts **visible parts only**, cut by features and higher surfaces, **not** by plants/objects/lines ("just the surfaces").
- Layering: automatic by type then size (no manual override); sections reorderable; **Outlines stays last in the panel**; only Outlines shows until the boundary exists (including the Plant list).
- Outline labels scale with zoom and should be small (this was tuned three times: 14 → 10 → 8 page points).
- Plants: **resize and rotate by handles on a selection box**, **nursery pot sizes as presets**, **multi-select to resize together**, the card's rotate control goes away (spec written, not built).
- Tool defaults: outlines Freehand, surfaces Rectangle. The PRD says a switch made *while drawing* is remembered per kind on the device. The user's complaint suggests they may prefer "always start in the default"; see next-agent specs (decision pending).

## 4. Where this thread slipped, and how to avoid it

- **Regressions in older requirements** (the user said "You keep slipping"): the defaults bug above came from an unguarded X handler that predates this thread's branches but was exposed by seeded `localStorage` in checks; several checks seed `plan-builder.shape.outline = rect` (11 scripts). Run `check-tool-defaults.mjs` in a **fresh browser**, and compare new work against PRD §6 before claiming done (a read-only audit of ~75 requirements found 7 mismatches; all fixed or listed below).
- **Mid-run edits break background test batteries** (a markup change while checks ran produced false results). Never edit while the battery runs; never start two batteries at once (they share files and ports).
- **Merging several branches that each edit `outline-ui.ts`/`main.ts`/`PRD.md`** creates conflicts; they were resolved by hand in `integration/preview` (keep both sides; labels loop moved into per-group paint). Prefer one branch at a time from now on.
- **A refactor broke startup once** (the shared search picker assumed its results block existed); the full battery caught it. Run the battery after any shared-component change.
- **Stale docs:** the PRD lagged the code several times; update §6 in the same commit as behaviour.
- **Process shortcuts to avoid:** skipping RED (a few fixes had their failing check written after the change; the tool-default fix was proven by re-running the check against the pre-fix code); leaving stray files (`PRD.md.bak`, a screenshot, an empty placeholder were all committed by accident once).

## 5. Known deferred minors (from the three whole-branch reviews)

- Render cost: one `<pattern>` + `<polygon>` per sampled line segment, redrawn on every pan frame (profile a long bent fence on a tablet; merge collinear samples if slow); notches on line turns sharper than 90°.
- "No scale" list row for lines omits the page-point length the spec mentioned.
- Fill area on a curved boundary comes from the flattened polygon (~2 sq ft off on a 30 ft radius arc); list areas shift while the boundary is redrawn; the "drag on the fill" check is weak when the view pans.
- `check-layering` lacks a "plan with no saved order opens with the default" browser case (unit-covered).
- Tap priority ignores section order (spec decision): a plant under a tree canopy or an opaque surface is only reachable from the Layers rows.
- `plan-store.contract.ts` was not extended for `lines`/`sectionOrder` (the `editorFields` unit tests cover it).
- Older controls from before this thread are 40 px (PRD §6.6 says ≥ 44 px): card close button, square chip, rename field, range slider, material rows.
- Version skew: an older deployed client rejects `hiddenSections: ['lines']` / `sectionOrder` as invalid until reloaded.
- Production deploy of the last merge to main has been waiting for approval in GitHub (environment `production`).

## 6. Files an agent should open first

- `docs/PRD.md` (§5 step table, §6.1, §6.8 surfaces, §6.10 symbols, §6.11 lines, §6.12 layering), `docs/conversations/*`, `CLAUDE.md`.
- `plan-builder/src/outline-ui.ts` (OutlineTool: pointer routing, render per group, selection, drags, undo), `main.ts` (wiring, Layers panel), `plan-model.ts` (saved shape and validation), `sections.ts`, `symbol-layer.ts`, `line-layer.ts`, `plot-fill.ts`, `overlay-tokens.ts`.
