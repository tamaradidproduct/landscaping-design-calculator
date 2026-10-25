# Add tools and material grid — design

Date: 2026-10-24 · Branch: `feat/top-bar-and-tools` · Status: draft for review
Replaces the panel's global **+ Add** from `2026-10-20-panel-structure-design.md`. Decisions and mockups: `docs/conversations/2026-10-20-handoff-panel-findings.md`. Depends on `feat/plot-fill` landing first (plot fill and visible-area quantities; session "Land plot fill into the new panel").

## Goal
- Adding things is one tap and one search, from a row of tools at the top of the panel.
- Surfaces can be started by material first or by shape first.
- Choosing a material is visual: a search, tags and a grid of large thumbnails.

## Decisions
- A **tool row** of four buttons sits at the top of the Layers panel, under the "Layers" title: **Add**, **Surface**, **Edge**, **Plant** (long names: "Edges & walls", "Plants & objects" in tooltips and the search tags). It replaces the global + Add built in PR 51.
- **Add** opens a search across every category. **Surface**, **Edge** and **Plant** also open a search, with their own category **preselected as a tag**; typing always searches everything.
- **Surface** starts the drawing tool the moment it is tapped (shape first is the default); the search and grid open under the row at the same time so a material can be picked first.
- A tap on a material **applies immediately** and is undoable.
- A shape drawn without a material has a neutral hatched **unassigned** fill and counts nowhere until a material is assigned.
- **Outlines stay outlines.** A selected outline's card gets a **Duplicate as surface** icon button (the House has none): it copies the shape as a surface zone and opens the grid for it; the outline stays. The plot boundary's action is **Fill the plot** (plot fill).
- Tools are dimmed and show a hint until the scale is set (the panel-structure unlock); Outlines stays available.

## Tool row and search popover
- The popover opens **in the panel**, under the row, and pushes the sections down; closing it (Esc, the tool again, or choosing something that arms a tool) restores them. Only one tool is active at a time.
- Contents, top to bottom: the search field, a row of **tags**, then the results grid.
- **Tags:** All, Recent, then the families of the active category: for Surfaces the six material families (Turf & seed, Mulch & soil, Rock & gravel, Pavers & stone, Concrete, Decking); for Plants & objects the plant families, Objects and Utility markers; for Edges & walls the five line items. The Add tool shows All, Recent and the three categories. The preselected tag is the tool's category, or All for Add. A non-empty query ignores the tag and searches every category; results show a small category label.
- **Recent:** the last few items picked, stored on the device only (not in the plan).
- **Grid:** two columns; each cell a large thumbnail (material texture, or the plan-view art, or the line's swatch) with the name below; 44 px or larger touch targets; the selected item has the accent ring.

## What each choice does
- **Surface item:** arms the next shape with that material (material first). If a shape is already being drawn or has just closed without a material, it applies to that shape.
- **Plant or object item:** arms placing (one per tap until Done), as the picker does today.
- **Edge item:** starts drawing that line item.
- **Plot fill** (from `feat/plot-fill`): once the boundary is closed, "Fill the plot" is the first cell in the Surface grid; it opens the same grid for its material, and it follows the boundary as built.
- **Shape first:** after Close shape on a zone with no material, the grid opens in the new zone's card; dismissing it keeps the unassigned fill and an "Assign material" line.
- **Change a zone's material:** the card's Change material opens the same grid; a tap applies at once.

## Unassigned surfaces
- Drawn with a neutral hatched fill and the name "Surface N"; the card says "Not counted yet".
- Not counted in the Sheet or Preview, in the plant list quantities, or in later quantity totals.
- Saved with the plan; a null material must validate on load (storage change: `Outline.material` may be absent for a surface).

## Components and data flow
- A new `tool-row.ts` renders the row and the popover state (active tool, query, tag) and calls the tool: `startSurface(material?: MaterialId)`, `armSymbol(id)`, `startLine(item)`, as they exist today; a small pure `search-index.ts` builds one searchable list from `MATERIALS`, `SYMBOLS` and `LINE_ITEMS` with `{ id, name, category, family, thumb }` and a `search(query, tag?)` function.
- `surfaces-ui.ts`, `symbols-ui.ts`, `lines-ui.ts`: their own pickers are replaced by the shared popover; their rows, cards and wiring stay.
- `outline-ui.ts`: `duplicateAsSurface(id)` copies the outline's points and bulges into a new surface with no material and selects it; the boundary action calls the plot-fill entry.
- `plan-model.ts`: allow a surface without a material in validation and `normalize`; `materialOf` returns null; render and quantity code treat null as unassigned.
- No other storage changes; Recent uses `localStorage`.

## Testing
- Unit: `search` matches by name across categories and by tag; a query ignores the tag; the Recent list keeps the last N and dedups; validation accepts a surface without a material; `duplicateAsSurface` copies the shape and leaves the outline; quantities skip unassigned surfaces.
- Browser (Riesberg): tools are dimmed before the scale and active after; Surface starts drawing and opens the grid; pick a material then draw, and draw then pick (shape first) both end with the right zone; an unassigned zone shows the hatched fill and "Not counted yet"; the Add search finds a plant and a material from one query; Edge starts a fence; Duplicate as surface on a custom outline leaves the outline and adds a zone; Fill the plot appears only with a closed boundary; the panel's old + Add and pickers are gone.
- Visual: screenshots at 1180 px and 820 px.
- Checks: `npm run lint`, `npm run typecheck`, `npm test`, plus the Riesberg scripts (updated for the new entry).

## Out of scope
- The surface calculator and quantities UI, plant sizes and containers, rotate and resize handles, the measuring tool, export.

## Open items
- Whether the popover should float over the sections instead of pushing them.
- A clearer icon for Duplicate as surface (tooltip: "Duplicate as surface").
- Thumbnail art for line items, and plan-view art size in the grid.

## Workflow
- Commit on `feat/top-bar-and-tools`. No push, PR or auto-merge until the user says so.
