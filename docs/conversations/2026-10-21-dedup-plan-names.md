# Plan Builder: dedup logic and sequence numbers for duplicate plan names (2026-10-21)

Issue #21: "would be nice to be able to know if I'm adding a plan that may already exist. Let's add a warning that 'a plan with this name already exists' and add a sequence number to the plan name." A suggested approach was posted on the issue and approved with "go ahead."

## Decisions
- **Both a warning and auto-numbering**, as the issue body asked for explicitly: a plan created or renamed to a name that already exists gets an inline notice *and* a sequence number appended automatically — the contractor never has to retype it.
- **Match scope:** exact match after trim + case-insensitive normalize, against the contractor's own **active (non-archived)** plans only. Archived plans are out of the way (PRD §6.9's archive semantics) and shouldn't block a name.
- **Where it surfaces:** both the New-plan form (`create()`) and the Plans-list inline Rename (`saveRename()`) in `plans-ui.ts` — the two places that set a plan's address/name. The editor's own header rename (`plan-head-ui.ts` / `app-shell.ts`) was left out of scope; it wasn't named in the approved approach and can follow later if it turns out to matter.
- **Sequencing:** "Smith residence" + "Smith residence" → "Smith residence (2)"; a third one skips past any numbers already in use ("Smith residence (3)", even if "(2)" belongs to a different, unrelated plan whose base name doesn't match). The base is found by stripping a trailing `" (n)"` before comparing, so matching an already-numbered name (e.g. retyping "Smith residence (2)" by hand) still bumps correctly.

## Build rulings
- `dedupeName(name, existing)` is a pure function in `address-extract.ts` (the naming-logic file) — takes a candidate name and the plan names to check against, returns the (possibly renumbered) name and whether it was a duplicate. Fully unit-testable without the DOM.
- `activePlanNames(plans, excludeId?)` in `plans-ui.ts` filters the `PlanMeta[]` list the Plans screen already keeps in memory down to the active-plan names to dedupe against; `excludeId` keeps a rename from colliding with itself.
- The warning reuses the existing inline `error()` line already used for file-type problems in the New-plan form (and the rename row's own error line) — same visual slot, same `--color-warn` token, no new UI component. Message: `A plan named "X" already exists. Numbered this one so you can tell them apart.`
- No PlanStore changes: the store stays a dumb address string in/out; dedup is purely a UI-layer decision, consistent with the suggested approach's framing ("the PlanStore list the UI already has in memory").
- This repo has no jsdom/DOM test environment yet, so `PlansScreen` itself isn't unit-tested; the new logic was factored into plain functions (`dedupeName`, `activePlanNames`) so the create/rename/archived-exclusion scenarios are covered directly in `address-extract.test.ts` and the new `plans-ui.test.ts`, without adding a DOM dependency.

## Later
- The editor header's own Rename (outside the Plans list) doesn't dedupe yet.
- No live preview while typing — the check runs on submit (Create / Save), not on every keystroke.
