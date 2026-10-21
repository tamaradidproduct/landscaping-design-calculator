# Double-tap no longer leaves a spurious corner (2026-10-21)

## Decisions
- **Root cause (#22):** in `src/outline-ui.ts` `pointerUp()`, the first tap of a double-tap pair is indistinguishable from an ordinary single tap when it lands away from any existing corner — it gets pushed onto the outline as a real point. The second tap, recognized afterward as the other half of a double-tap, closed the shape without ever removing that first tap's point, so the closed outline kept a spurious extra corner.
- **Fix, approved on the issue:** when a repeat tap closes the outline, drop the point the first tap placed (if it placed one at all) before closing, so closing a shape by double-tap/double-click never leaves a stray corner behind. This covers both ways a double-tap can land: a second tap that happens to hit the just-placed point (handled where a tap lands on an existing corner), and a second tap nearby but not exactly on it (handled where a tap lands on open space).
- **A second gap, also fixed:** double-tapping directly on an already-placed last corner (no new point ever added) previously never closed at all, because a plain tap on an existing corner didn't record itself as a "last tap" the way placing a new point did — so the second tap had nothing to recognize as a double-tap. A plain tap on the last corner now stamps the same way, so a quick repeat tap on it closes.
- **#24 ("boundary not closing on a double-click not aligned with the previously placed anchor"):** this is the same root cause as #22, not a separate defect. A double-click landing near, but not exactly on, an existing corner goes through the same "first tap pushes a point, second tap closes" path — the fix removes the spurious point there too, regardless of input device (mouse, pencil, touch) or which corner the click is near. No additional, device- or hit-radius-specific change was needed. `Refs #24` is included on the PR on that basis.

## Build rulings
- The decision logic (whether a repeat tap should close the outline, and whether to drop a point first) is a small pure function, `closesOnRepeatTap` in `src/outline.ts`, unit-tested directly — mirroring how the line-drawing tool's own double-tap-to-finish logic (`draftTap` in `src/line-draft.ts`) is already a pure, separately tested function. `pointerUp()` in `src/outline-ui.ts` calls it from both places a repeat tap is detected.
- `lastTap` now also records whether the tap it describes placed a new point (`added`), so the two scenarios above (drop a point vs. nothing to drop) are told apart correctly.
- No change to `GESTURE.doubleTapMs`/hit-radius tokens in `src/overlay-tokens.ts` — the existing timing and distance windows were not the bug.

## Later
- Nothing speculative added beyond the approved fix; no further outline-closing work is planned from this thread.
