# Panel structure (decision summary)

Date: 2026-10-21 · Branch: `feat/handoff-panel`

## What was decided and built
- The Layers panel guides a new plan: only **Outlines** until the plot boundary is closed, then until the scale is set; after that a global **+ Add** and the sections that have items appear. Empty sections are hidden, and plans that already have items stay unlocked.
- Section order: **Plants & objects → Edges & walls (renamed from Lines) → Surfaces → Outlines**. Draw order on the plan is unchanged.
- The Plant list under Layers is replaced by a read-only **Sheet view** behind an Edit | Sheet toggle, fed by the same plant list. It is the base for a later export.
- Undo/Redo move to the canvas top-right and zoom/Fit to the bottom-right; ⌘Z and ⇧⌘Z still work.
- Check scripts were updated for the new panel and for the numeric keypad (#28) that made the edge-length field read-only.

## Decided but not built (separate specs)
- Slimmer cards: edge chip with an info and a menu, outline and plant cards, a floating nudge pad, rotate and resize handles on the canvas (rotation snaps to 15°; plants do not rotate).
- Plant sizes: nursery size by default with a mature toggle; container picker per plant, canvas resize for free sizes, apply to all.
- Surface calculator: order quantities only, net area, researched per-material defaults, shown in the Sheet view.
- Research docs: `docs/plant-nursery-sizes.md`; material defaults still to research.

## Open
- Findings and ideas, with the open questions, are in `docs/conversations/2026-10-20-handoff-panel-findings.md`.
