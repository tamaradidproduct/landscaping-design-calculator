# Handoff panel and export: findings and ideas

Date: 2026-10-20 · Branch: `feat/handoff-panel` · Status: notes only, nothing decided

Reviewed: `docs/superpowers/plans/2026-10-19-handoff-panel.md` and `docs/superpowers/specs/2026-10-19-handoff-panel-design.md`.

## Direction
- Build the right panel to the handoff spec first, then build the export flow from it.
- The panel becomes the on-screen version of the customer sheet; export is the same data on paper.

## Findings on the plan
- **Finding:** two sources for quantity. The panel rows use `ids.length` from `symbols.groups()` (Task 1/3); `plantList()` in `plant-list.ts` already counts plants, objects, markers, lines and surfaces. Export should read `plantList()`, so panel and sheet could disagree. Idea: feed rows from `plantList()` too, or share one "sheet model".
- **Finding:** Task 1 test "keeps every id, so hidden instances still count" cannot fail. `splitByKind` takes no visibility input, so it proves nothing about the eye. The real check is the Task 6 browser check.
- **Finding:** surface rows show name only (sq ft out of scope), but `plantList().surfaces` has no area. A sheet or priced proposal needs sq ft per surface.
- **Finding:** Task 5 and 6 cite `main.ts` line numbers (8, 96, 173), which go stale as `main` moves.
- **Finding:** photos precache is an unverified assumption (Task 3, step 4). Export has to embed photos, so offline availability matters twice.
- **Finding:** a no-scale plan shows "no scale" on lines. Export needs the same rule: block it, warn, or print without lengths.
- **OK:** ids `undo`, `redo`, `zoom-in`, `zoom-out`, `fit` stay stable. No model or storage change. Hidden kinds still count.

## Gaps between the panel spec and a customer sheet
- Spec drops water consumption (follow-up: research all 51 plants with sources). The Figma sheet has a water table, so export will not match the sheet until that lands.
- Spec drops PDF export and a per-instance list.
- Lines and Outlines are not on the customer sheet, but lines drive pricing (PRD A.7a: priced bid sheet).

## Export questions to decide later
- Sheet contents: plan view, scale bar, title block, plant list with photos, surfaces, lines? (PRD: Servin example)
- Do hidden layers print? Today hidden kinds still count in quantity.
- Where does Export live: header ⋯ menu, the new floating view bar, or the panel?
- How is the plan image produced offline: PDFium page render plus overlay raster, or vector output?
- Price: same PDF or a second step ("plan sheet first, then the price", PRD)?
- Sharing: download, or share sheet on the tablet?

## Panel density and guided steps (from a screenshot of the current panel)
- **Finding:** all four sections are open at once, each with its own eye, hint text and Add… buttons. On an empty plan that is about 1,250 px of mostly empty scaffolding.
- **Finding:** the order Surfaces, Lines, Plants & objects, Outlines is backwards for the real workflow. Outlines come first (they set the scale), but they sit last.
- **Finding:** nothing says what to do first. "Outline the plot boundary first." is a hint under Surfaces, away from where the action is.
- **Finding:** later sections look as available as the first, though measurements and surfaces depend on the scale from the plot boundary.
- **Finding:** the handoff spec orders the panel for the customer sheet (Surfaces, Plants & objects, Lines, Outlines), not for the contractor's workflow. The two orders conflict.
- **Goal:** lower the density of the panel.
- **Goal:** still guide the contractor through the steps: outlines, then measurements (scale), then surfaces, objects and plants.

### Ideas (not decided)
- **Step-based panel:** show one active step with a short title and one action; completed steps collapse to a one-line summary (for example "Plot boundary · scale set").
- **Progressive unlock:** Surfaces, Lines, Plants & objects stay collapsed or dimmed until the boundary and scale exist, with one line saying why.
- **Empty sections collapse:** a section with nothing in it shows only its caption and "+ Add", with no hint text; hints appear only for the active step.
- **Single eye:** drop per-section eyes while empty; show them once a section has content.
- **Two modes:** a "Build" order for the contractor (outlines, scale, surfaces, plants) and a "Sheet" order for the handoff view and export (surfaces, plants & objects, lines, outlines). Possibly one panel with tabs or a toggle.
- **Open question:** does the handoff order apply only to the export and sheet view, while the live panel follows the workflow order?

## Plant and object sizes
- **Finding:** today a plant's size is one fixed number per library entry: its typical mature spread (`LibrarySymbol.size`, 51 plants, sources in `docs/symbol-sizes.md`). An object's is its researched long side.
- **Finding:** `PlacedSymbol` stores only `id`, `symbol`, `x`, `y`, `rot`. A placed instance has no size of its own, so every instance of a kind is the same size and nothing can be changed per instance.
- **Finding:** 14 sizes are marked approximate, and listed ranges are wide (Oak 45-80 ft, Spring Snow Crabapple 10-22 ft). One value per kind is a guess that cannot be corrected on site.

### Three size modes (ideas, not decided)
- **Nursery size** (for example 5-gal, 15-gal, 24" box, 2" caliper):
  - Matches how landscapers order and install, so it suits quantities and installation.
  - Needs per-plant research on which container sizes exist, and the plan-view footprint at install is much smaller than at maturity.
- **Mature size:**
  - Today's behavior. It shows the final spread and the spacing and overlap a customer should expect.
  - It overstates the footprint on day one, so a plan can look empty or overlap in ways that do not apply at install.
- **Manual:**
  - The contractor types a diameter, or drags a handle on the canvas, for one plant or a whole kind.
  - It fixes wrong research and cultivar differences, but it adds an override to store and show.

### Questions to settle
- Is size a per-kind default plus an optional per-instance override, or always per kind?
- Is the nursery vs mature choice one plan-wide toggle ("show at install / show at maturity"), or set per plant?
- Does the sheet or export list the nursery size (what to buy), the mature size (what to expect), or both?
- Does a manual size change the quantities or the sheet, or only the drawing?
- Does a size change touch storage? The panel plan avoids model changes, and a per-instance override needs a new field on `PlacedSymbol`.
- Is a source needed for nursery sizes, as for the mature spreads?

## Edge overlay card is too big and busy (`renderPopover` in `outline-ui.ts`)
- **Finding:** the plot-boundary edge card holds a title with a close button, a "Measures 115.00'" line, a curve hint, a labelled input with a primary button, and a full-width "Remove this length" button. That is five stacked blocks at the card width, over the plan.
- **Finding:** the card covers the plan area the contractor is looking at, including the edge it describes.
- **Finding:** the "Snap on" chip sits on top of the card and hides part of "Remove this length".
- **Finding:** the curve hint is permanent text, though it matters only once.
- **Finding:** "Remove this length" is full width and as prominent as the main action, though it is rare and destructive.
- **Finding:** the title ("Plot boundary edge") and the printed-length field restate each other.
- **Goal:** one glance shows the length and one tap changes it; everything else stays out of the way.

### Ideas (not decided)
- **Compact chip:** a small pill anchored at the edge's midpoint showing "115.00'". Tapping it turns the number into an inline field (type, Enter to save). No title, no hint.
- **Secondary actions in a menu:** "Remove length" and "Make straight" behind a ⋯ button on the chip, since both are rare.
- **Curve cue on the edge itself:** the square handle in the middle of the edge is the cue, with a one-time hint instead of permanent text.
- **Lighter card:** keep a card but cut it to one row: length (editable) plus Update, with the close ×, remove, and curve actions as small icon buttons.
- **Move Snap:** keep the chip clear of the card (a fixed spot in the view bar, or hidden while a card is open).
- **Same pattern for surface edges:** apply the chip to the surface popover (Length, Resize, Swap), with the stay-put end marked on the plan.

## Selected outline card in Layers is too tall (`layer-card.ts`, `ui.ts` nudge)
- **Finding:** a selected outline ("House") card stacks five rows: name with edit pencil and ×, a "Nudge corner" label, four 48 px arrow buttons, Square corners + Redo, and a full-width Delete. About 300 px tall for one selected shape.
- **Finding:** the arrows have a label row of their own and take a full row, though they are only useful while a corner is selected.
- **Finding:** Delete is full width and as prominent as the actions above it, though it is rare and destructive.
- **Finding:** Square corners and Redo sit above Delete as large buttons; "Redo" is ambiguous (redo the drawing, not redo an undo).

### Ideas (not decided)
- **One header row:** name (tap to rename, so the pencil can go), ⋯ menu, ×.
- **Actions into the ⋯ menu:** Square corners, Redo outline (renamed "Redraw"), and Delete, since all are occasional.
- **Nudge only when a corner is selected:** show the four arrows in one row, with no "Nudge corner" label, and hide them otherwise.
- **Keep Square corners visible as one small button** if it is used often, with the rest in ⋯.
- **Result:** a card of one header row, plus one arrow row only while a corner is selected (about 110 px instead of 300).

## Adding surfaces: two entry paths, and the material list
- **Finding:** today there is one path: Add surface… → pick a material in a long list → draw the zone (`startSurface` in `outline-ui.ts`, picker in `surfaces-ui.ts`). The material is chosen before the shape exists.
- **Finding:** contractors often think in shapes first ("this patio area"), and decide the material afterwards or compare several on the same shape.
- **Finding:** an existing surface can already change its material from its card (`setMaterial`, "change-material"), but a plain outline cannot become a surface.

### Both-ways entry (ideas, not decided)
- **Material first (current):** Add surface… → choose material → draw the shape.
- **Shape first:** Add surface… → "Draw shape" → draw it → choose a material (the zone shows a neutral fill until then, with the picker open in its card).
- **Shared picker:** one material picker used by both paths, so the list is built once. Material-first opens it before drawing; shape-first opens it after Close shape.
- **Entry point:** the Add surface… button offers "Pick a material" and "Draw shape first" as two choices, or the picker has a "Skip, choose later" action at the top.
- **Convert an outline:** an outline already drawn (House, custom outline) could get "Make a surface…" in its card.
- **Open questions:** what a surface with no material looks like and counts as; whether it exports; whether to block closing the card until a material is set.

### Redesigning the material list (ideas, not decided)
- **Finding:** the picker is one long scroll of rows grouped under family captions, each with a small swatch; it grows with the library and sits in the 280 px panel.
- **Finding:** swatches are small for a decision made on how a texture looks.
- **Finding:** rows show a name only; trade (hardscape vs softscape) and the repeat size are not shown.
- **Idea:** a swatch grid (2-3 columns, larger thumbnails with the name below) instead of rows.
- **Idea:** filter chips on top (All, Hardscape, Softscape, and families) instead of long captions; collapsed families.
- **Idea:** a search field and a "recent" row at the top for repeat use.
- **Idea:** open the picker as a sheet or popover over the canvas rather than inside the panel, to save panel height (see the panel-density notes).
- **Idea:** preview the texture on the shape as you tap, then confirm.

## "Round all corners" field shows no current value (`surfaces-ui.ts:112`)
- **Finding:** the field is always empty, with placeholder text "Round all corners, e.g. 2′ (↑ ↓ to adjust)", even when the zone's corners are already rounded. The contractor cannot see the current radius.
- **Finding:** `uniformRadius(id)` in `outline-ui.ts` already returns the shared radius in feet (rounded to 0.01), or 0 when corners are sharp or differ. The arrow-key handler already uses it, so the value exists; it is just never displayed.
- **Finding:** the placeholder is long and cut off in the narrow panel (shows "Round all corners").
- **Finding:** a single selected corner already shows its radius (the corner chip's "Round" field, `outline-ui.ts:150`), so the zone card is the inconsistent one.

### Ideas (not decided)
- **Prefill the field** with `uniformRadius(id)` (empty or "0′" when sharp), and refresh it when the radius changes by corner edits, undo, or Redo.
- **Mixed radii:** show "Mixed" as a placeholder when corners differ, and apply it to all on submit.
- **Visible label instead of placeholder:** a short label "Corner radius" above or beside the field, with the unit shown in the field ("2′"), so the hint "↑ ↓ to adjust" can move to a tooltip.
- **Stepper:** −/+ buttons around the value for tablet use (arrow keys do not exist there).

## Decision: panel section order (user, 2026-10-20)
- **Decision:** the order is **Plants & objects → Lines → Surfaces → Outlines**. This replaces the handoff spec's order (Surfaces, Plants & objects, Lines, Outlines) and the current one (Surfaces, Lines, Plants & objects, Outlines).
- **Consequence:** Outlines stay last, so the "outline first, then scale" guidance cannot come from section order. It has to come from guidance (see the panel-density notes: step hints, unlock, or a mode).
- **Consequence:** the handoff-panel plan's Task 1 (`GROUPS` order test) and its Task 5 markup and PRD §6.1 / §6.11 text need the new order.
- **Open:** "Lines" needs a better name (it holds fence, wall, edging, dry river). Candidates: Edges & borders, Linework, Features, Fences & edging.
- **Open:** a panel order is not the draw order on the plan (a higher zone cuts the ones below; outlines cut every zone). Keep draw order unchanged.

### Other findings in the same screenshot
- **Finding:** the old "Plant list" section (a disclosure triangle) still sits under Layers. The handoff plan removes it; it is the same data as the rows ("× 2", "× 4").
- **Finding:** the expanded plant card shows a bare "0" field with −/+ and no label or unit. It is presumably rotation; label it ("Rotate", degrees).
- **Finding:** names are cut off ("Rocky Mounta...", "Rocky Mountain M...") in both the row and the card; the card has space to wrap its title.
- **Finding:** in the Plants & objects rows the eye sits left of the row, but in the section headers it sits right, so the eye position differs between levels.

## Outline name labels on the plan are too prominent (e.g. "House")
- **Finding:** an outline's name on the canvas ("House") draws at `--text-sm`, strong weight, dark ink, with a heavy halo in the outline's fill colour (`.overlay .label.feature` in `styles/plan.css:27`). It reads as a heading and competes with the plan.
- **Finding:** the label is a fixed screen size, so it stays the same size when the plan is zoomed out and crowds small shapes.
- **Goal:** labels are quiet reference text: smaller, scaling with the plan, and de-emphasized.

### Ideas (not decided)
- **Scale with the plan:** font size in plan units (feet or page points) times the zoom, so it grows and shrinks with the drawing, with a minimum size to stay legible and a hide rule below it.
- **De-emphasize:** regular weight, smaller size, muted ink at reduced opacity, and a lighter or no halo.
- **Fit to the shape:** hide the label when it does not fit inside the shape at the current zoom.
- **Selected state:** show the label at full contrast only while its outline is selected.
- **Same rule for other labels:** zone sizes, edge lengths and surface names, so all plan text follows one quiet style.

## Plant list repeats the Layers sections (decision needed)
- **Finding:** the Plant list under Layers shows surfaces, plants (art, name, category, quantity, photo) and, below, objects, lines and markers. The same items, with the same counts, are already rows above ("× 2", "× 4", surface rows).
- **Finding:** it is the only place the photo and a large quantity show without selecting a row, so it carries information the rows do not.
- **Finding:** it is the closest thing today to the customer sheet, and the base for export.
- **Finding:** the handoff-panel plan already resolves this by consolidating (rows become handoff cards, the section is deleted), but that plan predates the new panel order and the density goals.

### Options (not decided)
- **Consolidate (current plan):** delete the section; Layers rows become handoff cards with art, name, category, and big quantity; photo in the expanded card. One list, no repetition. Cost: the rows get taller, which fights the density goal.
- **Separate view:** keep it as a read-only "Plant list" / "Sheet" view, reached by a tab or toggle on the panel (Edit | List), not stacked below Layers. Layers stays compact for editing; the view is the preview of the customer handoff and the export source. Cost: two surfaces to maintain and keep consistent.
- **Hybrid:** compact rows in Layers (name, eye, count) and the rich handoff cards only in the separate view; selecting a row in the view highlights it on the plan.
- **Open:** is the list editable (tap to select, change quantity) or read-only? Does it include totals (lines in ft, surfaces in sq ft) that the rows do not?

## Undo/Redo and zoom/Fit take two full rows at the top of the panel
- **Finding:** Undo, Redo, zoom −/+ and Fit page occupy two bordered rows (about 160 px) above Layers, at full button weight, though they are utility controls.
- **Already planned:** the handoff-panel plan (Task 5) moves them into a floating `view-bar` at the canvas's top-right, keeping ids `undo`, `redo`, `zoom-in`, `zoom-out`, `fit`. This matches the request.
- **Not yet in that plan:** making them quiet. The plan keeps "default control size" buttons.

### Ideas (not decided)
- **Icon-only buttons** (undo, redo, −, +, fit) with tooltips and aria-labels, in a single small pill, instead of labelled buttons.
- **Muted until used:** low-contrast icons, full contrast on hover or press; a disabled Redo stays faint.
- **Group by function:** history (undo, redo) apart from view (zoom, fit), with a hairline between them.
- **Placement:** top-right, clear of the plan header (top-left) and the Snap chip; zoom could also sit bottom-right as in map apps, with undo/redo top-right.
- **Touch size:** keep 44 px hit areas even with small icons.
- **Gestures:** pinch to zoom already exists, so − / + could be dropped or kept only on desktop.

## Surface calculator (to build)
- **Need:** a calculator that turns each surface into what to order and install, from the drawing. The PRD's vision is "quantities and a priced proposal fall out of the drawing"; pricing is deferred (step 4), and `plantList().surfaces` lists surfaces with no area.
- **What exists:** zone area (`areaPt2` and `formatArea` in `outline.ts`, curves included, true feet once there is a scale); the cuts rule (a higher zone cuts the ones below, outlines cut every zone); 29 materials in families (Turf & seed, Mulch & soil, Rock & gravel, Pavers & stone, Concrete, Decking) with a `trade` field.
- **Legacy scope (PRD A.7.2):** waste/overage factors, unit conversions (cu yd, pallets, tons), pricing and labor estimates were explicitly out of scope for the earlier tool (raw quantities only), so none of it exists to port.
- **Gap:** zones overlap, so each zone's net area (after cuts by higher zones and outlines) is what counts, and no function computes it yet.
- **Gap:** no per-material data for coverage (depth, coverage per unit, unit size, waste), so there is nothing to convert area into units.

### Inputs per surface (ideas, not decided)
- **Net area** (sq ft) after cuts, from the drawing.
- **Depth or thickness** (mulch, rock, soil: inches; pavers and sod: fixed).
- **Waste/overage** (percent, per material default with an override).
- **Unit and coverage** (cu yd, tons, sq ft pallets, rolls) per material, with a source each, like `docs/symbol-sizes.md`.
- **Optional:** base layers (gravel base, sand, fabric, edging) as bundled extras per material, and slope/compaction factors.

### Outputs (ideas, not decided)
- **Per surface:** area, depth, quantity in order units, with the formula shown ("820 sq ft × 3 in ÷ 324 = 7.6 cu yd + 10% = 8.4").
- **Per plan:** totals per material across zones, feeding the sheet, the bid table (qty, unit, blank price) and export.
- **Later:** unit price and labor from the contractor's own price list (PRD step 4).

### Questions to settle
- Where does the calculator live: inside the surface card (depth field and result), a separate Quantities view (see the plant list options), or both?
- Are depth, waste and unit set per zone, per material, or plan-wide?
- Does the result update live as the shape changes?
- How are cuts shown to the user, so a net area under a higher zone is not a surprise?
- Is the research (coverage, units, waste) done per material with sources, as for symbol sizes?

## Idea: measurement tool or mode
- **Need:** let the contractor see distances between things on the plan: surfaces, outlines, plants, objects, edges and walls (for example house wall to a tree, patio edge to the fence, spacing between plants, clearance to the boundary).
- **What exists:** edge lengths on outlines (tap an edge), the scale from typed lengths, snap labels while drawing. No way to measure between two arbitrary things.

### Ideas (not decided)
- **Ruler mode:** a tool in the view controls or Add menu. Tap two points; a line shows the distance in feet and inches, in the plan's scale. Needs a scale (hidden before one exists).
- **Snap to items:** endpoints snap to corners, edges, plant centers and plant edges, so a tap picks "tree edge" and "house corner".
- **Nearest distance between two items:** select one item, tap another; show the shortest gap between their edges (and center to center for plants).
- **Quick spacing readout:** with an item selected, show dimension lines to its nearest neighbors in each direction (like design apps), with no mode change.
- **Persistent vs temporary:** measurements vanish when the mode ends, or can be pinned as annotations on the sheet.
- **Units and format:** feet and inches (116′ 5″), matching typed lengths.

### Questions to settle
- Is it a separate mode (tool in the canvas controls) or an overlay on selection?
- Do measurements save with the plan, show on the sheet and export, or stay session-only?
- Plants are circles of mature spread: measure to the trunk (center) or the canopy edge, or both?
- Does it respect hidden layers?
- Where does it sit among the canvas controls (top-right history, bottom-right zoom)?

## Inventory: the selected-outline card today (`layers-ui.ts:65`, `layer-card.ts`, `ui.ts`)
- **Plot boundary, selected:** head (swatch, name "Plot boundary", area as sub-line, × to close); nudge arrows only while a corner is selected; Square corners; Redo (no Delete; no layer order).
- **Feature (House, custom), selected:** head (swatch, name as an editable field with pencil, ×); nudge arrows only while a corner is selected; Square corners, Redo, Delete; "Layer order ↑ ↓" row (hidden when it is the only feature).
- **Being drawn (boundary or feature):** head (swatch, name, "Drawing…"); a step hint ("Tap each corner of the House · 2 placed", then "3 corners. Tap the first corner or double-tap to finish."); nudge arrows only while a corner is selected; Close shape (primary, disabled under 3 corners) and Cancel. Rectangles: no Close shape.
- **Nudge row:** a "Nudge corner" label plus four 48 px arrows (← ↑ ↓ →).
- **Elsewhere, not in the card:** the corner chip on the canvas has Square (square one corner) and Round (radius) fields; the edge popover has length, curve, remove.
- **Closing the card:** × button, tapping the head, tapping empty plan, Escape.
- **Surface cards add:** material line with Change, texture scale, Size (width × depth, aspect lock), Round all corners field, Square corners/Redo/Delete, layer order.

### Decisions on the outline card (user, 2026-10-20)
- **Square corners** stays visible in the card.
- **"Redo"** is renamed "Redraw" (or similar), to avoid confusion with redo.
- **Delete** becomes an icon.
- **Layer order** stays important; consider a drag handle on the row instead of the ↑ ↓ buttons in the card.
- **Nudge arrows removed from the outline card (user decision):** corners move with the keyboard arrow keys, which already work (`outline-ui.ts:1442`). Open concern: the PRD's primary device is a tablet with no keyboard, and the arrows were added back in #41 ("Restore 48px nudge arrows in layer cards") for touch. Touch alternatives: drag the corner handle, a magnifier-assisted drag, or a small floating nudge pad on the canvas that appears only with a selected corner.
- **Decision:** touch nudging uses a floating nudge pad on the canvas, shown only while a corner is selected; the Layers card has no arrows. Open: its position (beside the corner or a fixed canvas corner) and its overlap with the corner chip (Square, Round fields).

### Decisions on the plant card (user, 2026-10-20)
- **Rotation** moves to a rotate handle on the selected symbol on the canvas; no rotate control in the card (the bare "0" stepper goes). Open: handle for plants (circles) or objects only; touch target size; keyboard rotate.
- **Planned from earlier notes:** library photo at the top of the card; Delete as an icon; the name wraps instead of truncating; "1 of N" label when a kind has several instances.
- **Revised (user):** no photo in the plant card (the photo stays for the Sheet view). Rotation is canvas-only, never in a card. Plants need no rotation at all (they are circles); rotation applies to surfaces. Open: does "surfaces" mean surface zones, or objects too (planters, stepping stones, which rotate today)?
- **Plant card now:** header (swatch, wrapped name, category, eye), size line ("12 ft wide"), "1 of N" with ‹ ›, trash icon.
- **Decision:** a canvas rotate handle for surface zones, objects (planters, firepit, stepping stones) and lines (rotate a drawn fence or edging as a whole). Plants and utility markers do not rotate. Open: rotation point (center of the bounding box), snapping to 15 or 45 degrees, rotating curved zones with bulges, and undo as one step per drag.
- **Rotation, settled (user):** utility markers rotate too (only plants do not). The handle snaps every 15 degrees. A curved zone rotates around the center of its bounding box. One drag is one undo step.
- **Plants need size control, not rotation (user):** the plant card gets a size control (ties to the plant and object sizes notes; a per-instance size needs a new field on `PlacedSymbol`, a storage change).
- **Plant size control, settled (user):** both a resize handle on the canvas (quick) and an editable diameter in the card (exact; typed feet, steppers of 0.5 ft, reset to the library default). A change applies to the selected plant only, with an "Apply to all N" action for every placed plant of that kind. Needs a per-instance size on `PlacedSymbol` (a storage change, so the plan-structure spec's "no model changes" does not cover it; belongs to the sizes spec). Open: handle for objects too; resize limits; whether the sheet lists the changed size; how the nursery vs mature modes (see the sizes notes) interact with per-instance sizes.
- **Default draw size (user):** plants draw at **nursery (install) size** by default, with a plan-wide toggle to show **mature** spread. This reverses today's behavior (mature only) and needs install-size data for all 51 plants, researched with sources like `docs/symbol-sizes.md`. Interacts with per-plant manual size and the Apply to all action.
- **Nursery size is a container size (user):** each plant has container options (for example 5-gal, 15-gal, 24" box, 2" caliper), each with a researched plan-view footprint, and a default. The card gets a container picker; the order list and sheet show the container. Research needed: container options and footprints for all 51 plants, with sources.
- **Open:** do objects and utility markers have container sizes (no); what a manual diameter does to the container field (clears it, or marks it "custom"); whether the sheet and export show container, mature spread, or both (likely both).
- **Install | Mature toggle (user):** a small two-state control on the canvas next to the zoom controls (bottom-right), plan-wide and saved with the plan (a new plan-level field). Open: whether the Sheet view or export prints one or both sizes, and the toggle's effect on overlap warnings.
- **Manual size, settled (user):** no diameter field in the card. Size changes only through the canvas control: drag the resize handle, or tap one of the predetermined container sizes in the card (the container picker). A drag sets a free size; the container field then reads "custom" (open: whether it shows the nearest container).
- **Sheet and export print both** the container (what to buy) and the mature spread (what to expect).
- **Next:** container research for all 51 plants runs as its own session; output `docs/plant-nursery-sizes.md`.

## Inventory: the selected-surface card today (`surfaces-ui.ts:105`)
- **Head:** material swatch, name (editable field with pencil), × to close.
- **Material line:** swatch, material name, Change button (opens the material picker in place).
- **Texture:** label, − / percent (tap to reset to 100%) / +.
- **Size** (needs a scale): Width and Depth fields of the bounding box, with an aspect-lock toggle between them.
- **Nudge pad:** four arrows with a "Nudge corner" label, while a corner is selected (leaving the card, see the outline-card decisions).
- **Round all corners:** a field with a long placeholder and Apply (needs a scale; shows no current value).
- **Actions:** Square corners, Redo, Delete.
- **Layer order:** "Layer order ↑ ↓" row (hidden if the only zone).
- **About 9 rows, roughly 500 px** with the picker closed, the tallest card in the app.

### Decisions on the surface card (user, 2026-10-20)
- **Collapsed disclosure:** Size, Round all corners and Texture sit under one "Adjust shape and texture" disclosure; the default card shows the material line, area and the action row (about 150 px).
- **Default content (user):** area only ("820 sq ft" under the name). The calculator (depth, waste, units, quantity) is not in the card; it lives in a separate Quantities view (where it appears is a calculator-spec decision; the Sheet view is a candidate). Open: gross area vs net after cuts in the card.

### Decisions on the surface calculator (user, 2026-10-20)
- **First version: order quantities, no prices.** Net area per surface converted to order units (cu yd, tons, sq ft, pallets) with depth and waste, plus totals per material. Prices (and labor) come later (PRD step 4).
- **Inputs (user):** each material has a researched default depth, waste and unit; editable per surface in the Quantities view, with a reset to default. Needs defaults for the 29 materials, with sources.
- **Area (user):** quantities use net area only (after cuts by higher zones and outlines); no gross number shown. Needs a net-area function (does not exist yet; `areaPt2` gives gross). Open: the surface card's "820 sq ft" should then also show net, to match the Quantities view.
- **Placement (user):** quantities live inside the Sheet view; each surface on the Sheet carries its quantity line. No separate Quantities view. Open: the Sheet is also customer-facing (and the export source), so working numbers (depth, waste) need a quiet display or an edit mode; where depth and waste are edited (inline in the Sheet, or a detail row on tap).
- **Editing, simplified (user):** no per-surface editing of depth or waste for now; only global defaults. This supersedes "editable per surface". The Sheet stays read-only. Open: where the global defaults are edited and whether they are per material or one global set.
- **Defaults (user):** fixed researched per-material depth, waste and unit with sources for now; no settings UI. Needs research for the 29 materials (depth or thickness, coverage per unit, order unit, waste percent, base layers if any), in the style of `docs/symbol-sizes.md`.

### Surface calculator, summary of decisions
- Order quantities only, no prices. Net area only. Per-material researched defaults, no editing. Quantities live inside the (read-only) Sheet view, per surface and totalled per material.
- Open: the net-area algorithm (cuts by higher zones and outlines), the unit conversion formulas, whether bases (gravel, sand, fabric) are bundled, rounding rules (whole pallets, 0.1 cu yd), and what a surface shows with no scale ("no scale", no quantity).

## Ideas: line drawing cursor and corner smoothing
- **Cursor while drawing lines:** the stage uses the browser's plain `crosshair` (`.stage.drawing` in `styles/plan.css:40`), thin and easy to lose over a busy plot plan.
  - Ideas: a larger high-contrast cursor (a dot or ring with a halo that works on light and dark plans); a rubber-band preview of the next segment with its length; the line item's own color and width in the preview; snap indicators for corners and edges.
  - Open: touch has no cursor, so the touch equivalent is a magnifier or a crosshair at the touch point (the app already has a magnifier for outlines).
- **Smoothing and rounding corners on lines:** lines have per-segment bends (`PlacedLine.bulges`) but no corner radii, while outlines already have per-corner `radii` and a Round all corners action.
  - Ideas: a corner round handle on a selected line point, like outlines; a "Smooth line" action that rounds every bend at once (Catmull-Rom or radius-based), with a strength control; round only inside corners, never the ends.
  - Needs: a `radii` field on `PlacedLine` (storage change), length recalculation along the smoothed path, and the same rounding for fence runs vs curved dry rivers.
  - Open: does a smoothed fence still count its runs and length (it must), and does a rounded corner change the fence's post or panel count later?

## Idea: edit the size and shape of an outline after it is committed
- **Today:** a selected outline can have its corners dragged or nudged, sides bent into curves, rounded, squared, or the whole outline redrawn from scratch ("Redo"). Surface zones also have Width and Depth (`resizeZone`, `zoneBox` in `outline-ui.ts`) and a move. Feature outlines (House) and the plot boundary have no size fields; a typed length on an edge calibrates the scale, it does not resize the shape.
- **Gap:** no way to add or remove a corner on a finished outline (no insert-point or delete-point), so a rectangle cannot become an L-shape without redrawing.
- **Gap:** no scale handle to resize a whole outline from the canvas.

### Ideas (not decided)
- **Add a corner:** tap or drag a midpoint dot on an edge to insert a corner (the existing bend square becomes a choice: curve or add a corner).
- **Remove a corner:** select a corner, press Delete or use a small "Remove corner" action; blocked below 3 corners.
- **Resize whole outline:** corner handles at the bounding box (scale from the opposite corner or the center), with Width and Depth fields as for zones, extended to features. The plot boundary stays special (changing it would change the lot and the scale).
- **Typed edge length that resizes (features):** distinguish "this edge's printed length" (calibration) from "make this edge N ft" (resize); today only the first exists for outlines.
- **Guards:** keep the same undo as one step per drag; surfaces cut by an outline update live.

### Open questions
- Is editing the plot boundary allowed after the scale is set, and what happens to the scale and placed items if it changes?
- Does resizing an outline move the items inside it (plants, surfaces), or leave them in place?
- Is the corner add/remove a handle on the canvas or an action in the card (the card is being slimmed; see its decisions)?

## Idea: Sheet view hides the uploaded plan
- **Idea:** switching to the Sheet view hides the uploaded plot plan (the PDF underneath) and fills the view with the drawn plan alone, so it previews what the customer gets.
- **Open:** the plan fills the view (fit to the drawing's bounds, not the page); do surfaces, outlines, plants and lines all draw, and with the outlines' name labels?
- **Open:** does the PDF come back when switching to Edit (yes), and is the zoom and pan state kept per view?
- **Open:** a scale bar, title block, north arrow and plant legend belong here later (the export sheet); only the drawing for now?
- **Link:** this is the same render the export will need (PDFium page vs overlay only); it is a candidate first step for the export spec.

## Idea: adjust line thickness
- **Today:** a selected line's card already has a Width control: − / a field in feet ("6 in works too") / +, stepped by `stepLineWidth` (`lines-ui.ts:54`). So width is adjustable, only inside the card.
- **Gap:** no canvas control for thickness, and the card is being slimmed (the rarely changed controls may move behind the disclosure).
- **Ideas:** a thickness handle on the line on the canvas (drag the line's edge, like the plant resize handle); keep the − / + stepper in the card as the exact control; preset widths per line item (fence 0.25 ft, wall 1 ft, edging 0.5 ft, dry river wider) as quick picks.
- **Open:** which of these the user meant: the existing control is hard to find, or a canvas control is wanted.

### Update from `origin/main` (checked 2026-10-21)
- **Corner insertion has shipped** on main (#26, "Insert a corner on an existing outline, zone or line edge"), so the "cannot add a corner" gap above is already closed; removing a corner is still open. Re-check the outline-edit idea against main before specifying it.
- **Also on main:** a custom numeric keypad for edge-length and zone-resize entry (#28), JPG/PNG plot plans (#20, relevant to the Sheet view hiding the uploaded plan), duplicate plan-name handling (#21), drag-and-drop upload (#23).
