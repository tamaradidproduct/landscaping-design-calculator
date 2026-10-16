# Plan Builder: plan header on the canvas, archiving plans (2026-10-16)

Distilled summary of the working session behind this PR. Current requirements: `docs/PRD.md` §6.9.

## Editor header
- The plan's name now shows at the **top left of the plan**, grouped with the back button: **← · name · ⋯**. The "Plans" label on the back button was dropped (an arrow alone, labelled "Back to Plans" for screen readers); thin dividers sit either side of the name.
- The whole header is capped at **300 px** (new token `width-plan-head`, also added to the design-system artifact); a long name is truncated with "…" (full name on hover).
- **⋯ menu:** Rename (field in place), Archive (Unarchive on an archived plan), Delete (inline confirm, as on the Plans list). A dropdown on the name itself and click-to-rename were considered; a separate ⋯ button was chosen so the name stays plain text.
- Archive and Delete take you back to Plans with a message saying what happened.
- The plot plan row's pencil was replaced with a **replace** icon, since that row replaces the PDF rather than renaming anything.

## Archiving
- New: plans can be **archived**. They leave the main list and appear in a collapsed **"Archived (n)"** section under it, where they can be unarchived, renamed, opened or deleted. Archive is available both on Plans list rows and in the editor's ⋯ menu.
- Archiving doesn't change "Edited …" (it isn't an edit), and editing an archived plan doesn't unarchive it.
- Stored as an optional `archived` flag on the plan doc; no format version bump, and existing plans read as not archived.

## Small fixes
- The New plan form's address field now spans the card.

## Later
- Google Maps address suggestions in the address field (Airtable Finding #7).
