# Plant sizes (install and mature) — decisions

Date: 2026-10-26 · Spec: `docs/superpowers/specs/2026-10-26-plant-sizes-design.md` · Plan: `docs/superpowers/plans/2026-10-26-plant-sizes.md` · Research: `docs/plant-nursery-sizes.md`, `docs/symbol-sizes.md`

## Decided
- **Plan-wide, view-only toggle.** One setting on the plan, `plantSizeView: 'install' | 'mature'`. Flipping it changes how plants are drawn and which size the sheet shows; it never changes a stored plant.
- **Toggle in the top bar,** next to Edit | Preview: "Install | Mature", "Now | Grown" at 900 px and below. Hidden until the plan has a plant; one undo step per flip; 44 px controls.
- **A placed plant stores a container or a custom size, nothing about mature:** `container` (a library label such as `5 gal`) or `customInstall` (feet). Neither means the default container.
- **The canvas handle sets a custom install size, in the Install view only,** clamped to the mature spread. Hidden in Mature; mature size always comes from the library.
- **Defaults are the most common planting container:** trees their mid size (15 gal or 6 ft B&B), shrubs 5 gal, perennials, grasses and ground covers 1 gal. Corn and Vegetable plants have one size and no picker.
- **Apply to all** copies the container or custom size to every placed plant of the species in the plan, as one undo step. New plants keep the default.
- **Existing plans** with plants and no stored view ask once on first open ("Show plants at install size?", Install size / Keep mature). Either answer is stored; dismissing keeps Mature. New plans start in Install with no prompt.
- **Sheet layout: choice C.** Each plant row shows only the active view's size, with a footnote naming the view. Mixed containers of one species make separate rows; quantities are unaffected. This replaces the earlier "both sizes on the sheet" idea for the sheet.
- **The PDF export's size rule is left to the export spec** (it defaults to following the sheet).

## Rulings while building
- **"Has plants" means a placed plant** (a library plant on the plan), not an armed placement or an object; it decides whether the toggle shows, the default view, and whether the first-open prompt applies.
- **The Custom chip makes the plant custom at its current size** (the diameter it shows now), so pressing it never changes the drawing; the handle then adjusts it.
- **The toggle works in Preview** too (Preview blocks drawing and undo, not the view switch), and the sheet follows it.

## Built as
- `plant-size.ts` (pure resolver), install-size data in `scripts/plant-install-sizes.mjs`, the card in `symbols-ui.ts`, the handle in `symbols-render.ts` / `outline-ui.ts`, the toggle in `top-bar.ts` / `main.ts`, the prompt in `plant-size-prompt.ts` (opened from `app-shell.ts`), the sheet rows in `sheet-ui.ts`.
- Browser check: `scripts/check-plant-sizes.mjs` (Riesberg, memory store).

## Left over
- Whether "Now | Grown" is the right short label.
- Thumbnail or label treatment for "Custom" on the Layers rows.
- The size handle sits about 16 px outside the dashed halo on a small plant and reads as a separate ring; consider a connector line.
