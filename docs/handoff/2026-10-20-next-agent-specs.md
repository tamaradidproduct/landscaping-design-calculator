# Specs for the next agent (Plan Builder)

Context: `2026-10-20-thread-summary.md` (read first). Branch to start from: **`integration/preview`** in the worktree `/Users/tamara/coding_projects/lp-gate` (or a fresh branch cut from it). Follow the user's process: brainstorm only where a decision is open, written spec → approval → written plan → approval and execution choice (they pick **Native**) → implement with TDD → one whole-branch reviewer → fix Critical/Important → report rulings and deferred minors. **Do not push or open PRs until the user says so.** Reply to the user in bullets only.

Priorities: A (ship) and B (plant sizes) are what the user is waiting on. C–H are smaller and can be batched.

---

## A. Ship what exists

**Goal:** get `integration/preview` reviewed and merged to `main` without losing anything.

- **Ask first** whether to open **one PR from `integration/preview`** (recommended: the four feature branches overlap in `outline-ui.ts`, `main.ts` and `PRD.md`) or separate PRs; then push (`git push -u origin integration/preview`) and open the PR(s) against `main` with a body listing the features (plot fill + visible-area quantities, layering, move lines + label scaling, panel gating, consolidation, tool-default fix), the verification numbers, and the deferred minors from the summary §5.
- After opening a PR: call the PR tools (`get_status`, `bind_pr` if needed) and offer Auto-fix; the user has declined it every time so far.
- CI is `.github/workflows` (lint, typecheck, test, staging deploy on merge; **production deploy needs manual approval** of the `production` environment: tell the user it is waiting).
- **Acceptance:** CI green on the PR; the user has the PR link; nothing pushed before they said yes.

## B. Plant sizes, nursery pot sizes, resize/rotate by handles, multi-select

Authoritative spec (approved in the brainstorm, awaiting written-spec approval): **`docs/superpowers/specs/2026-10-20-plant-size-and-handles-design.md`**. Read it fully. It decides: handles on a selection box (corner resize about the centre, rotate handle above, Shift snaps 15°) for all symbols; pot-size presets then Mature; multi-select resizes together (no group rotate); the card's −/+/typed rotate control is removed; the Plant list counts by size.

**Work to do:** get the spec approved (the user has not yet said "approved"; ask), write `docs/superpowers/plans/2026-10-20-plant-size-and-handles.md`, get the plan approved, then build. Suggested task split:

1. **Model + math (pure):** `PlacedSymbol.scale?` (0.05–3, additive, validated in `plan-model.ts`, saved/loaded/cleared by `editorFields`/`planStateOf`/`toDoc` like `rot`); `symbolSizePt/Px` and `SymbolLayer.ordered()` (stacking uses the scaled spread) and `hitTest` take `scale`; `src/pot-sizes.ts` (`POT_PRESETS`, `potSizesFor`, `scaleForPreset`, `sizeLabel`); handle geometry helpers (`selectionBox`, `handlePositions`, `scaleFromDrag`, `angleFromDrag`, group factor) in a pure `src/symbol-handles.ts`. Unit tests for all of it (see the spec's Tests).
2. **Renderer:** `symbols-render.ts` draws at `scale`; add the selection box, four corner handles and the rotate stem/handle to `symbolsSvgParts().top` (handles must paint above every group, as the halo does).
3. **Tool:** change `selectedSymbol: string | null` to a selection set (keep a single-selection accessor so existing paths stay identical); add drags `symbol-resize` and `symbol-rotate` (and group resize); handle presses win over symbols, lines and zones; each drag is one undo step; Shift-tap and a **Select several** toggle and **Select all** on a kind's row; Esc/empty tap clears.
4. **UI:** symbol card: pot-size chips + Mature + typed spread (ft); multi-selection card ("N selected", shared chips only when all are plants of one type, Delete selected); remove the rotate control (`rot-down`, `rot-up`, `#symbol-rotation`); marker hint "Turn the arrow with the handle above it."; Plant list rows "Name · size × qty".
5. **Check + docs:** `scripts/check-symbol-handles.mjs` (**must exit non-zero on failure**; model on `check-tool-defaults.mjs`); update `check-symbols.mjs` where it used the card's rotate control; PRD §6.10/§6.11; `docs/pot-sizes.md` (the assumed spreads, marked approximate, for the user's review); decision summary.

**Constraints:** keep 48 px touch targets (handle hit targets ≥ 28 px visual spacing, 44 px effective); handle colours/sizes go in `overlay-tokens.ts` / `tokens.json` (no raw numbers); do not regress tap priority, line moving, or the Layers panel gating; run the **full** browser battery before reporting.

## C. Decide: does the drawing tool remember the user's choice?

- Today (PRD §6.8): outlines start **Freehand**, surfaces **Rectangle**; a switch made **while drawing** is remembered per kind on the device. The user reported "we lost the correct defaults"; the cause was a bug (X changed the saved choice with nothing drawn; fixed), but they may prefer **no persistence at all**.
- **Ask one question:** (1) keep per-device memory (current), (2) always start in the default (drop `localStorage` for the shape; the bar/X only affect the current drawing). If (2): delete `loadShapes`/`shapeKey` persistence in `shape-pref.ts` and `main.ts`, update PRD §6.1/§6.8, `shape-pref.test.ts`, `check-shape-default.mjs`, `check-tool-defaults.mjs`.

## D. Make browser checks fail the build

- **Problem:** only `check-tool-defaults`, `check-plans`, `check-step1` exit non-zero; the rest print a table, so regressions go unnoticed ("you keep slipping").
- **Spec:** give every `scripts/check-*.mjs` an exit code (collect `results`, `process.exit(1)` if any row is not ok, as in `check-tool-defaults.mjs`); add `scripts/run-checks.mjs` that starts `vite` on a free port, runs the checks **one at a time** (never in parallel: they share a dev server and the Riesberg PDF), prints a summary and exits non-zero; add `npm run check:browser`. Do not seed `localStorage` in checks except where a check is about stored state (11 scripts currently seed `plan-builder.shape.outline = rect`; remove that so every check runs against real defaults).
- **Acceptance:** `npm run check:browser` passes on a clean checkout; a deliberately broken assertion makes it fail.

## E. Sync the design-system artifact

- Update the **Plan Builder** design-system artifact (https://claude.ai/artifact/JKnSFiSuXHsQ977zniZkYo; `plan-builder/design-system/README.md` has the steps) with token changes made since PR 19: removed `color-material-*` (11), added `opacity-layer-off`, `opacity-symbol-ghost`, `width-plant-art`, `opacity-line-halo`, `opacity-line-draft`, plus any from section B. Read the artifact with the Artifact tool first (`action: read`), publish the update to the **same URL**.

## F. Touch targets and the Layers panel polish

- PRD §6.6 requires controls ≥ 44 px. Raise `--control-sm` (40 px) to 44 px in `tokens.json` and verify card close button, square chip, rename field, range slider and material rows still lay out; re-run `check-zone-edit`, `check-surfaces`, `check-layering`.
- The user said the Layers panel looked "all over the place". Review `index.html`, `layers-sections.ts` and the CSS for: three icon buttons per header crowding the title ("Plants & objects" wraps), the empty gap above the Plant list, spacing between the sections. **Show the user a screenshot of the proposed layout and ask** before changing it.

## G. Outline strokes under surface fills (decision)

- With Outlines last in the panel (the user's choice) their strokes paint **under** surface fills, so the plot boundary line looks half as thick where a surface touches it. **Ask** whether to (1) leave it, (2) always paint outline *strokes* (not fills) above surfaces regardless of section order, or (3) move Outlines up manually when wanted. Implement the chosen option in `OutlineTool.render` (the per-group `parts`) with a Playwright assertion.

## H. Deferred minors (summary §5)

Take the ones the user cares about, one small PR-sized batch: line render cost on long bent runs (profile first), sharp-turn notches, the "no scale" row showing page-point length, curved-boundary area using `areaPt2` when nothing cuts the fill, `check-layering` no-saved-order case, extend `plan-store.contract.ts`, tap priority following section order (needs a decision). Each fix needs a test that fails first.

## I. Guard against regressions (process spec)

- Before reporting any task done: (1) run lint, typecheck, unit tests; (2) run the full browser battery from D, one check at a time, and read every FAIL; (3) re-read the PRD §6 lines for the area you touched and fix any that became stale **in the same commit**; (4) test in a **fresh browser profile** (no seeded `localStorage`); (5) `git status` for stray files (`*.bak`, screenshots, `node_modules` symlinks) before committing; (6) never edit files while a background battery is running.
- Add a **requirements traceability table** to `docs/` mapping each PRD §6 bullet to its unit test or check script (the audit found ~11 implemented-but-unverified requirements: Plot plan eye/opacity reset, replace-PDF keeps outlines, not-saved state, plot area/scale hint copy, surfaces header count with a fill, no-scale hints, offline). Add checks for the unverified ones.

## Open questions for the user (ask, do not assume)

1. Approve the plant-sizes spec as written (pot-size spreads are my assumptions; confirm or send corrections).
2. One PR or separate PRs for the unpushed work.
3. Section C (remember the drawing tool or not) and G (outline strokes under fills).
4. Whether to update the design-system artifact now or batch it after B.
