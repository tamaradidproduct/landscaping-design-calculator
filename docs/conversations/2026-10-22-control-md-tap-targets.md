# Plan Builder: split --control-sm so tappable rows meet the 44px floor (2026-10-22)

Issue: #43 ("Decide whether --control-sm (40px) should stay below the PRD's 44px control floor").

## Options considered
1. Bump `--control-sm` itself to 44px — moves all 9 call sites at once, including text inputs and the texture-scale slider that aren't really tap targets.
2. **[Chosen — owner replied "Suggested approach approved"]** Move only the two genuinely tappable rows (`.layer-head`, `.material-list > button.layer-row`) onto the existing `--control-md` (48px, already PRD-compliant); leave `--control-sm` (40px) for the remaining non-tap-target uses (`button.icon.small`, `.square-chip button`, `.side-head .segmented > button`, `input.layer-rename`, `input[type="range"]`, `button.group-head`, `.chip-field input`).
3. Leave as-is — reject on the grounds that 40px rows are an intentional secondary-chrome convention.

## Decisions
- `.layer-head` (the expanded layer-card header; PRD §6.1 — tapping it also closes the card) and `.material-list > button.layer-row` (the material-picker rows) now use `--control-md` (48px) instead of `--control-sm` (40px).
- No other call site changed. `button.group-head` (the collapsible Layers section header) was listed in the issue's inventory but not named in the approved suggested approach, so it was left on `--control-sm` — out of scope for this decision; worth a follow-up issue if it also needs to move.
- `--control-sm`/`--control-md` are both existing design-system tokens (`src/styles/tokens.css`) — no token values changed, so `tokens.json`/the design-system artifact and `npm run tokens` are untouched; this is purely a per-selector choice of which existing token to use.

## Build notes
- `plan-builder/src/styles/components.css`: two one-line edits (`.layer-head`, `.material-list > button.layer-row`), `--control-sm` → `--control-md`.
- `npm run lint`, `npm run typecheck`, `npm test` (484 passed, 1 skipped) and `npm run build` all pass.

## Later
- Revisit `button.group-head` and `.side-head .segmented > button` if a future finding flags them as sub-44px tap targets too.
