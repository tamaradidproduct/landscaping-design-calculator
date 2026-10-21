# Plan Builder: numeric keypad for length entry (2026-10-21)

Issue: #28 ("Limit the input to only numbers for inputting measurements on iPad").

## Options considered
1. Keep both decimal and feet-inches formats, accept the keyboard-switch cost on iPad — no code change.
2. **[Chosen — owner replied "Do the number 2"]** Add a lightweight custom keypad (digits + `'` `"` `.` keys only) for the two length fields, replacing the native keyboard.
3. Drop feet-inches typing, decimal feet only.

## Decisions
- **A custom on-screen keypad replaces the native keyboard** for the two places a contractor types a printed length: the edge-length popover (`#edge-len` in `renderPopover`, sets the scale / adds a reference length) and the zone-resize length field (`#edge-len` in `renderSurfacePopover`). Both still accept decimal feet or feet-inches (`116' 5"`) — the existing `parseFeet` parser is untouched.
- **The field is `readonly`**, so iOS/iPadOS never shows the native keyboard for it; the keypad is the only way to edit the value. This is a single entry mechanism for desktop and touch alike (no separate "physical keyboard" code path) — simpler than maintaining two, and the keypad's buttons are just as usable with a mouse.
- **Keypad layout:** 4×4 grid — `1 2 3 ′`, `4 5 6 ″`, `7 8 9 .`, `C 0 ⌫ Done`. `Done` submits the form (same as tapping Update/Resize/Set scale); the card's existing `×` close button is the dismiss action.
- **Every key is ≥44px** (PRD §6.6): `.keypad-key` uses `--control-md` (48px), inside a 4-column grid that stretches each button to fill its cell.

## Build notes
- `src/ui.ts`: added `applyKeypadKey(value, key)` (pure: digits/marks append, `back` drops the last character, `clear` empties, `done` is a no-op) and `numericKeypad()` (renders the grid, each key a `button` with `data-key`). `InputOptions` gained `readonly?: boolean`.
- `src/outline-ui.ts`: both popovers render `numericKeypad()` under the length field and call a new `wireLengthKeypad(form)`, which wires every `.keypad-key`'s click to `applyKeypadKey` on `#edge-len` (or submits the form for `done`). No change to `setEdgeLength`/`resizeEdge`/`parseFeet`.
- `src/styles/components.css`: new `.keypad` (grid) / `.keypad-key` (sizing) rules, reusing existing tokens (`--control-md`, `--space-3`) — no new design tokens, so the tokens.json artifact and `npm run tokens` are untouched.
- Tests: `src/ui.test.ts` covers `applyKeypadKey` building up both a decimal and a feet-inches value key by key (checking the feet-inches result against `parseFeet`), backspace, clear and `done`, plus that `numericKeypad()` renders every key once.

## Later
- None identified; the native-keyboard code path for these two fields is fully retired, not kept as a fallback.
