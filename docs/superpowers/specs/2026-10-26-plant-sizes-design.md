# Plant sizes (install and mature) — design

Date: 2026-10-26 · Branch: `docs/plant-sizes-spec` · Status: draft for review
Spec 5 of the editor redesign. Research: `docs/plant-nursery-sizes.md`, `docs/symbol-sizes.md`. Context: `docs/handoff-2026-10-25-panel-redesign.md`.

## Goal
- A plan shows plants at the size the customer gets on install day, and can show what they grow into.
- A contractor can choose a container per plant, or set a custom install size, without touching the researched mature size.

## Decisions
- **View toggle is plan-wide and view-only.** One setting on the plan, `plantSizeView: 'install' | 'mature'`. Flipping it changes how plants are drawn and which size the sheet shows; it never changes a stored plant.
- **Toggle location:** the top bar, next to Edit | Preview, as a segmented "Install | Mature". At 900 px and below the labels shorten to "Now | Grown". Hidden until the plan has a plant. One undo step per flip. Controls are 44 px (spec: top bar, #84).
- **Placed plant stores a container or a custom size, nothing about mature.** `container` (a library label such as `5 gal`) or `customInstall` (feet of canopy diameter). Neither set means the plant's default container.
- **Canvas handle sets a custom install size, in the Install view only.** The picker then reads "Custom". In the Mature view the handle is hidden; mature size always comes from the library. A custom size is clamped to the plant's mature spread.
- **Defaults are the most common planting container:** trees their mid size (15 gal or 6 ft B&B), shrubs 5 gal, perennials, grasses and ground covers 1 gal. Corn and Vegetable plants have one size only (mature) and no container picker.
- **Apply to all** (in the plant card, after choosing a container or custom size) copies `container` or `customInstall` to every placed plant of the same species in this plan. One undo step. New plants keep the default.
- **Existing plans:** a plan with plants and no `plantSizeView` shows a one-time prompt on first open, "Show plants at install size?" with **Install size** and **Keep mature**. Either choice is stored on the plan, so it never asks again. Dismissing keeps Mature and stores it. New plans start in Install with no prompt.
- **Sheet and Preview** show only the active view's size per plant row, with a footnote naming the view ("Sizes shown at install. Switch to Mature to see grown sizes."). Quantities are unaffected by size. This supersedes the earlier "both sizes on the sheet" decision for the sheet; the export spec decides the PDF and defaults to following the sheet.

## Data
- `plan-builder/scripts/plant-install-sizes.mjs` (already drafted, untracked): per plant an ordered `install` list of `{ container, d }` (feet), plus `approximate` for the doc's ⚠️ rows. Trees list two entries, other plants one, Corn and Vegetable plants none.
- **Changes to the draft:**
  - Add a **5 gal** entry for shrubs (about 15 plants, such as lilacs, dogwood, hydrangea, lavender, boxwood), derived by the doc's shrub rule (5 gal ≈ 2–3 ft, scaled down for compact plants), capped at the mature spread, marked `approximate`.
  - Add a `default` index per plant (trees: the mid entry; shrubs: the 5 gal entry; others: the first).
- **Rule kept:** an install diameter never exceeds the plant's mature spread in `symbol-sizes.mjs`; a test enforces it.
- Widths are derived, not listed by nurseries (±25%); the picker shows the container label, not a claim of precision.

## Model and storage
- `plan-model.ts`: plan gains `plantSizeView?: 'install' | 'mature'`; a placed plant gains `container?: string` and `customInstall?: number`.
- Resolver `plantDiameter(symbol, placed, view)` (pure, in a small `plant-size.ts`):
  - view `mature` → the mature spread;
  - view `install` → `customInstall` (clamped), else the container's `d` (an unknown or removed label falls back to the default container), else the default;
  - a plant with no containers → the mature spread in both views.
- Validation and `normalize` on load: drop a `customInstall` that is not a positive number, clamp it to the mature spread, drop an unknown `container`. Plans saved before this change load unchanged.
- Firestore: the new fields are optional and saved with the plan and its placed plants, like the existing fields.

## Behavior
- **Drawing:** the canvas and the plants' hit areas use `plantDiameter`. Plants stay circles and do not rotate.
- **Plant card:** a size line ("Install 4.5 ft across · mature 10 ft"), container chips (44 px targets) plus **Custom**, a hint about the canvas handle, **Apply to all <name> (N)** and Delete. In the Mature view the chips are disabled with the hint "Switch to Install to change the container".
- **Handle:** one drag is one undo step; the card shows "Custom" and the diameter.
- **Prompt:** a modal on first open; tablet-friendly 44 px buttons; Esc and the backdrop keep Mature.
- **Sheet and Preview:** a row per species and size as the active view shows it; mixed containers of one species make separate rows.

## Components and data flow
- `plant-size.ts` (new, pure): `plantDiameter`, `defaultContainer`, `containersFor`, `clampCustom`.
- `symbols.ts`: expose the container list per symbol.
- `symbols-ui.ts`: plant card, container chips, Apply to all.
- `outline-ui.ts`: draws plants with the resolver; the size handle (Install view only).
- `top-bar.ts` (with `components.css` for the 900 px labels): the Install | Mature toggle.
- `sheet-ui.ts`: the per-row size and the footnote.
- `app-shell.ts` / `plans-ui.ts`: the first-open prompt.

## Testing
- Unit: `plantDiameter` for both views, the default per family, an unknown container, a custom size clamped to mature, a plant with no containers; the 5 gal rows never exceed mature; validation and normalize on load; Apply to all copies to the same species only and is one undo step; the toggle changes no stored plant.
- Browser (Riesberg): toggle flips drawn sizes; picker changes a plant; handle sets Custom and is hidden in Mature; Apply to all; the first-open prompt on an old plan and no prompt on a new one; the sheet footnote and rows; the 900 px top bar with short labels.
- Visual: screenshots at 1180 px and 820 px.
- Checks: `npm run lint`, `npm run typecheck`, `npm test` plus the Riesberg scripts that touch plants and the top bar.

## Out of scope
- The surface calculator, the export PDF, rotation handles, editing the mature size, and a per-plant mature override.

## Open items
- Whether "Now | Grown" is the right short label.
- Thumbnail or label treatment for "Custom" on the Layers rows.
- The PDF export's size rule, decided in the export spec.

## Workflow
- Commit on `docs/plant-sizes-spec`. No push, PR or auto-merge until the user says so.
