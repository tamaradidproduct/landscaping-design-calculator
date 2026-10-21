# Plan Builder: drag-and-drop plot plan upload (2026-10-21)

Issue: [#23](https://github.com/tamaradidproduct/landscaping-design-calculator/issues/23) — "Allow drag and drop to upload plot plan."

## Thread
- The request: allow dragging a file onto the New plan card, and dropping a file anywhere on the Plans page should open New plan with it attached.
- Suggested approach posted on the issue: feed drops through the existing `pick(file)` flow in `plans-ui.ts` (the same path the shared `#file` input already uses via `armFilePicker()`), reusing `checkPdf()`'s validation and error message rather than duplicating it; add a lightweight dashed-outline drop affordance consistent with the app's existing minimal styling. Repo owner replied "go ahead."

## Decisions
- **One behavior, not two.** Dropping onto the open New-plan card and dropping elsewhere on the Plans page both end up at the same `pick(file)` call — the only difference is that a drop outside an already-open card first sets `newOpen = true` (and arms the shared file input, same as clicking "New plan") before handing it the file. There's no separate "card drop zone" vs. "page drop zone" code path.
- **No new validation.** A non-PDF drop hits `checkPdf()` inside `pick()` and shows the same "That file isn't a PDF" message the file picker already shows.
- **Visual affordance is page-wide, not per-element.** A single `drag-over` class toggled on the Plans screen root (added on `dragenter`/`dragover` while a drag carries files, cleared on `dragleave`/`drop`/`hide`) draws a dashed accent-color outline inset from the screen edge. This covers both drop targets described above with one rule in `plans.css`, matching the app's existing dashed-border language (e.g. the "Custom outline…" suggestion row).
- **Desktop-only convenience, not a touch feature.** The product is tablet-first, but a drag from a connected keyboard/trackpad or a Files-app drag is still a real desktop use case worth the small amount of code; no attempt was made to support touch-only drag sources.
- **Reliable file detection.** `dataTransfer.files` is only populated once `drop` fires (it's empty during `dragenter`/`dragover` for security reasons), so the affordance uses `dataTransfer.types.includes('Files')` to detect a file drag early, and only reads `dataTransfer.files[0]` in the `drop` handler.

## Build notes
- Changed only `plan-builder/src/plans-ui.ts` (drag handlers wired in `PlansScreen`'s constructor, alongside its existing click/keydown/input listeners) and `plan-builder/src/styles/plans.css` (the `.drag-over` outline).
- No test harness for DOM/drag events exists in this codebase yet (no `plans-ui.test.ts` before this change, no jsdom dependency), so rather than stand up new test infrastructure for one feature, the one pure piece of new logic — reading the first file off a drop (`droppedFile()`) — was pulled out and smoke-tested directly in `plan-builder/src/plans-ui.test.ts` with a minimal fake `DataTransfer`. The DOM wiring itself (listeners, class toggling, opening the card) is exercised manually/in the running app, not under test.

## Later
- If a DOM test harness (jsdom/happy-dom) is ever added for `plans-ui.ts` more broadly, the drag-open-card and drag-onto-open-card behaviors would be worth covering directly.
