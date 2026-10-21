# PRD — Landscaping Plan Builder for Contractors (working name)

> Status: **v0.6 — 2026-10-12.** Sections 1–8 are the current requirements. Appendix A keeps the archived Figma-takeoff spec (code archived as git tag `archive/figma-takeoff-hardening`); Appendix B is the full decision log.
> Legend: ✅ decided · 🔨 built · ❓ open · 📝 later

## 1. Problem & vision
- Contractors **can't produce a landscape plan** — they lack design tools and skills — so they lose jobs, quote loosely and hand crews vague instructions.
- Vision: on site, on a **tablet**, a contractor turns the homeowner's **plot plan PDF** into a scaled, professional plan by drawing over it with a built-in symbol library; quantities and a priced proposal fall out of the drawing.
- Must not depend on Figma or a designer in the loop (reason for the reset). Not related to the Front Range Yards HOA-plan service.

## 2. Users & context
- **Primary:** landscaping contractors / installers. ❓ Homeowners (DIY) as a later audience.
- **Context:** on site with the homeowner, ~30–60 min, tablet (iPad or Android, any browser), often **offline**.
- Plot plans arrive **mostly as vector PDFs** (builder/surveyor exports); scans/photos also exist.
- ❓ No pilot contractor yet.

## 3. Jobs to be done
- **Win the job** — show the homeowner a professional plan and proposal.
- **Quote accurately** — quantities for their own bid.
- **Instruct crews** — install guide for the field.
- HOA submission: nice to have, not a driver.

## 4. Workflow
1. **Open the plot plan** — contractor picks the PDF on site. 🔨 Step 1
2. **Outline, then set the scale** — trace the plot boundary or a structure, type one printed edge length; other edges and the lot area confirm it. 🔨 Steps 2a–2c
3. **Draw the design** — fill zones with materials (🔨 Step 4: Surfaces, stage 1 — see §6.8; 🔨 Plot fill: the whole lot in one material that follows the boundary, with zones drawn on it cutting it out — see §6.8), drop plants/objects from the library, mark existing features, edging/walls as lines, plant-spacing fill, dimension labels. ❓ to be defined step by step
4. **Price** from the contractor's own price list. ⏸ deferred
5. **Present** — plan sheet first, then the price. **Send a PDF.**
- After the first proposal (versions, tiers, crew sheets): 📝 later.

## 5. Build steps
| Step | What | Status | Branch |
|---|---|---|---|
| 1 | Open a plot plan PDF: fills the screen, pinch/zoom/pan, sharp when zoomed, offline | 🔨 done | `feat/plan-builder` |
| 2a | Outline boundary or house; set scale from one edge; edge lengths on hover/tap; area vs printed lot size | 🔨 done | `feat/plan-builder` |
| 2b | Snapping to the plan's lines/corners; 90°/straight/alignment hints (never locked); snap toggle + Option/second-finger bypass; nudge | 🔨 done | `feat/plan-builder` |
| — | Undo/redo (⌘Z / ⇧⌘Z, toolbar buttons), including dots of an unfinished outline | 🔨 done | `feat/plan-builder` |
| 2c | Curved edges: drag an edge's middle handle to bend it into an arc; "Make straight"; lengths and area follow the curve | 🔨 done, in review | `feat/plan-builder-2c-curves` |
| 3 | Mark existing features (any number, custom names, grey fill + label); house becomes one of them | 🔨 done, in review | `feat/step3-existing-features` |
| 4 | Surfaces, stage 1: material zones (hardscape + softscape), solid fills, resize by typed edge length | 🔨 done, in review | `feat/material-zones` |
| 4b | Surfaces stage 2 (Width × Depth in the zone card, optional aspect lock), stage 3 (move one corner) | 🔨 stage 2 done; stage 3 📝 next | `feat/surfaces-width-depth` |
| 5 | Plants & objects (symbols at true mature size) and the Plant list | ✅ done (merged) | `feat/symbols` |
| 5b | Lines (fence, walls, edging, dry river), stepping stones, utility markers (the rest of the library's surfaces) | ✅ done (merged) | `feat/linear-point-surfaces` |
| 5c | Plot fill (the lot in one material, following the boundary) and visible-area surface quantities | 🔨 done, in review | `feat/plot-fill` |
| 5d | Layering: reorderable Layers sections (Plants & objects on top by default), automatic plant stacking, move lines by dragging, outline labels that scale with the plan, a Layers panel that waits for the plot boundary | 🔨 done, in review | `feat/layering`, `feat/move-lines`, `fix/gate-sections` |
| 6 | Saved plans + invite-only Google sign-in: many plans per contractor, Firebase sync, works offline | 🔨 in progress | `feat/plans-auth` |

## 6. Current requirements, by area
### 6.1 Viewing the plan ✅🔨
- Pick the PDF from the tablet's file picker; it stays on the device. Page 1 only (multi-page: 📝 later).
- Opens in about a second once the app has warmed up. Rendering uses **PDFium** (WebAssembly): PDF.js took ~12 s on a real plan whose text is drawn as shapes.
- Pinch/scroll-pinch zooms; one finger or two-finger trackpad drag pans; **panning is free** (not limited to the page). Double-tap zooms in / back to fit.
- Works **offline** after the first load.
- 🔨 **Plot plan layer** as its own block below the Layers sections (it stays when a section collapses or moves): **eye** shows/hides the plan (hidden = no snapping to its lines), the **file name** with a pencil opens a different plot plan, and an **opacity** slider (10–100%). Resets to shown, 100% on opening a file. ("Open another" removed.)
- 🔨 **Side panel** on the right (always docked, 280 px), top to bottom: **Undo / Redo** · **zoom − / + / Fit page** · **Layers**. Layers has four sections (see §6.12); the **Outlines** section has one row per outline (tap a feature's row to select it), then suggestions while missing — **Plot boundary**, **House**, **Custom outline…** (quick picks: Driveway, Patio, Porch, Walk, Deck, Garage, Shed, Pool, or type a name). Sections by trade come later.
- 🔨 **Collapsible Layers sections:** Plants & objects, Lines, Surfaces and Outlines each have a header with a chevron; collapsed, it shows the count (Outlines = the plot boundary + features, not the plot plan; Surfaces = zones). Open/closed is remembered on the device. Selecting a layer on the plan or starting to draw one opens its section; it can be collapsed again while still selected.
- 🔨 **Snap toggle** sits in the floating bar at the bottom of the plan (beside Freehand | Rectangle), shown only while drawing an outline or with a finished outline's corner, edge or feature selected.
- 🔨 **Rectangle tool.** While an outline is being drawn, a floating bar at the bottom of the plan offers **Freehand | Rectangle** (with the Snap toggle beside it); **X** switches; the choice is remembered on the device. The pointer shows which tool is on: Freehand = a dot; Rectangle = a ⌐ corner mark and dashed guide lines across the plan through the pointer (also while dragging, so they show where the edges will run); the cursor is a crosshair while drawing. **Rectangle:** drag from one corner to the opposite one (or tap one corner, then the other); the result is square to the plan and closes itself as a normal 4-corner outline (editable, bendable, Square works). Each end snaps like any corner; Shift makes it a square. Switching tools after starting starts the outline over (⌘Z brings the corners back). Angled shapes: use Freehand.
- 🔨 **Overlapping layers cut each other by layer order.** A layer higher in Layers cuts the ones below it: each layer keeps the shape as drawn, but is shown, tapped and (later) measured by its **visible part** only. New layers go to the bottom, so a porch rectangle drawn after the house loses the part under the house — except one drawn **wholly inside** another, which goes just above it so it isn't hidden. **Layer order ↑ ↓** in the card changes it. A selected layer also shows its whole drawn outline dashed. A layer wholly under another can't be tapped on the plan; select it from its row. Most overlaps are meant this way; 📝 later: layers that sit over others without cutting them (a raised deck or balcony over hardscape/softscape).
- 🔨 **The plot boundary clips everything inside it** — existing features now, hardscape and softscape later: nothing shows or counts outside the lot. The boundary itself is never cut.
- 🔨 **No panel over the plan.** The row of the outline being drawn or selected **expands into a card** in Layers: drawing — "Tap each corner of the **House** · 2 placed" (then "3 corners. Tap the first corner or double-tap to finish."), nudge arrows, **Close shape** / **Cancel**; selected — the name as a field to **rename in place** (features), the plot area (boundary), nudge arrows while a corner is selected, **Square corners**, **Redo**, **Delete** (features). × / tapping the card's head / tapping empty plan / Escape closes it. Close shape lives only in the card (double-tap or tapping the first corner also close). Until a scale exists, a one-line hint under the outlines says to tap an edge and type its printed length. The long snapping hint was dropped (the snap labels on the plan explain themselves).

### 6.2 Outlining ✅🔨
- **Pure drawing** — works the same for vector PDFs and scans; never relies on the PDF's vector data.
- Outline kinds now: plot boundary, house. 📝 More kinds later: other existing structures and surfaces (driveway, patio, deck…).
- Placing: tap corners. On touch, a **tap places exactly under the finger**; when the finger **drags** to adjust, the point rises gradually to ~56 px **above the finger** so it stays visible, with a **magnifier**.
- Closing: **Close shape** button, **double-tap/double-click**, or tap the first corner.
- Clicking/tapping **outside a shape clears its selection** (selected corner, edge popover).
- **Select, then edit:** only the **selected** outline shows its corners and bend squares, and only its corners/edges can be dragged (freely, even after snapping wrong); **nudge** with arrow buttons/keys. Unselected outlines show just their shape and name. Select from the Layers row, by tapping inside a feature, or by tapping an edge (the boundary covers the whole lot, so it's selected from its edges or row). A just-closed outline stays selected. **Redo** for the plot boundary is in its card.
- 🔨 **Tidy: Square.** With a corner of a finished outline selected, a chip beside it shows its angle and **Square** (shown only while Square would move it). Square **lines the corner up with its neighbours**: along an edge running across it takes that neighbour's height, along one running down its left–right position — so the corner comes out square and in line with the walls. Only that corner moves. **Square corners** (in the selected outline's card) lines every corner up at once (corners joined by an across edge share a height, by a down edge a left–right position).
  - "Across/down" follow the **outline's own direction** (the direction most of its edge length agrees with), so a house drawn at an angle lines up with its own walls; worked out in true shape after any stretch correction.
  - Only edges within **8°** of across/down are lined up: slanted edges (45° bays, Riesberg's side lot line at 16°) and **bent edges** are left alone; bent edges keep their bulge per chord. One undo step.
  - ⚠️ Square all on a lot also flattens real slight slants within 8° (Riesberg's top line is 1.3° off flat) — per-corner Square is the safer tool on lot boundaries.
- **Touch navigation while outlining:** one finger places and drags points; **two fingers always pan and zoom** (a second finger cancels whatever the first started, so nothing gets placed or moved by accident).
- **Snapping** on by default to drawn lines and corners (heavy outlines preferred, lettering ignored) and to the outline's own corners; **turn off** with the toolbar toggle, **hold Option/Alt** (keyboard), or on touch **press and hold still (~½ s) before moving** to place that point freely ("Free" label).
- **Guides are hints only** (90°, straight, aligned with another corner): shown, never pulled into place. Straight lines and 45° steps come only from holding **Shift**, which still snaps along the ray. Snapping without Shift = the outlines' own corners, then lines/corners in the drawing.
- **Snap gravity:** corners pull from ~26 px (outline corners from ~22 px); once snapped, the point **stays put** until the pointer moves ~34 px away or a closer target appears; with a mouse, the **snap preview shows before clicking** (halo + label).
- **Shift** (while placing or dragging a corner) locks the edge from the previous corner to **45° steps** (0°, 45°, 90°… on screen) and shows the angle. **Snapping still works with Shift**: the point stays on the 45° line but stops at a drawn corner on it or where it crosses a drawn line.
- Snapping recognises **dashed lines** (property lines are often dashed) and lines with labels written alongside them.
- **Curves:** drag the square at an edge's middle to bend it into an arc (snaps onto the drawn curve); "Make straight" in the edge's popover.
- **Undo/redo** for every step, including each dot of an unfinished outline.

### 6.3 Scale & checks ✅🔨
- Tap an edge, type its printed length (`116.45`, `116' 5"`) → scale (shown as "1 in on paper = 30.0 ft"). Every typed length is kept as a **reference**; the scale is fitted to all of them. The scale isn't shown on screen (only in the toast after typing); an edge with a typed length shows it in its popover with **Update** and **Remove this length** (undoable).
- 🔨 **Stretched plans:** with references on edges running different ways (across vs down), the app fits **separate across and down scales** and stretches the plan picture and outlines back to their **true shape** ("Across 1 in = 30.0 ft · Down 1 in = 33.0 ft"). References all running the same way keep one best-fit scale and ask for one the other way. The correction is a general 2×2 transform (only stretch for now); 📝 skew later fits more of it from 3+ references. Redrawing an outline drops the lengths typed for its old edges.
- Edge lengths appear only on **hover or tap**; curved edges measure along the curve.
- Plot area is shown quietly under **Plot boundary** in the Layers panel. (Typing the printed lot size to compare was removed: not needed.)
- Accuracy target: **within 1%** of printed dimensions.
- 📝 Later calibration methods: trace-the-lot with typed lengths for every edge; reading the printed scale (unreliable: Riesberg prints both 1"=30' and 1"=20'; only 1"=30' is right) — would need OCR, as plan text is often drawn as shapes.

### 6.4 Library ✅
- Built-in shared library (the Landscaping symbols set). Plant symbols at **true mature size**. Picker: search + categories. ✅ Mature spread researched per plant with a source (docs/symbol-sizes.md).

### 6.5 Outputs ✅ (not built)
- Plan sheet in the style of the Servin example + priced proposal, as a **PDF**.

### 6.6 Platform ✅
- Web app for any tablet browser; offline-capable. Controls ≥ 44 px. iPad testing deferred for now.
- Client plot plans are never committed: `samples/` and derived test fixtures are git-ignored.

### 6.7 Existing features (Step 3) ✅🔨
- After outlining and scaling, the contractor marks **existing features** — anything already on the lot that isn't new work.
- **Any number** of features; each gets a **name the contractor types** (e.g. "Driveway", "AC pad", "Window well"). The **house is just one of them** (no separate house tool); the plot boundary stays special.
- Drawn with the same outline tool (snapping, guides, curves, undo/redo).
- Shown as **grey fill + its name**, like the house on the Servin plan sheet.
- Result of Step 3 is **visual only** — no quantities or totals yet.
- 🔨 Started from the **Layers → Outlines** suggestions (Plot boundary · House · Custom outline…). A feature is named first: a suggestion, a quick pick, or any typed name.
- 🔨 **Tap inside** a feature to select it → **Rename**, **Redo** (Cancel puts the old one back), **Delete**. Overlapping features: the tap picks the smallest one under the finger (a porch inside the house).
- 🔨 Features may overlap each other and the boundary; nothing is clipped. Any feature edge can still set the scale.
- 🔨 While drawing, other outlines' corners are snap targets, not handles — tapping a shared corner (driveway meeting the garage) places a new point there instead of dragging the house's corner.
- 🔨 Undo/redo covers naming, renaming, deleting and redrawing.
- 📝 Small features: at low zoom the edge-bend handles can cover the middle, so a tap bends/opens an edge instead of selecting — zoom in, or revisit hit priority later.

### 6.8 Surfaces (Step 4) ✅🔨
- The contractor adds the **new work** as zones filled with a material. Stage 1 is **visual only**; **visible-area quantities** (sq ft per material) now show in the Plant list (see Surface quantities below).
- **Materials:** the **29 area textures of the Landscaping symbols library** (Figma `0B2UpvIGBFOE1ZEDx8rXPR`), grouped in the picker by family — Turf & seed, Mulch & soil, Rock & gravel, Pavers & stone, Concrete, Decking. Each is a photo-texture tile that **repeats at a real-world size (10 ft by default; each zone can scale it) and scales with zoom and the plan's scale**; a plan with no scale yet uses a default tile (24 page points) that still follows zoom and the zone's texture scale. Plans saved with the earlier 11 flat-colour materials open with the nearest texture. Linear, point and utility surfaces (fences, walls, edging, stepping stones, dry river, gas/electric/drainage markers) come with the symbols step.
- **Texture scale:** each zone's card has a **Texture scale** control (− / percent / +, ×1.25 per press, 25%–400%; tap the percent to reset). Saved with the zone; one undo step per press.
- **Show / hide:** an eye on every layer row and on every section header. A hidden layer isn't drawn, selected, tapped or snapped to; it still cuts (hiding the House leaves its hole in the lawn). A header's eye hides all its layers without changing their own eyes. Saved **with the plan** (not an undo step); drawing into a hidden layer shows it.
- **Layers:** a **Surfaces** section (hardscape and softscape together); the sections' order is §6.12 (Plants & objects, Lines, Surfaces, Outlines by default).
- **Clipping:** the plot boundary clips zones; **existing features (Outlines) always cut zones**, whatever was drawn first; within Surfaces a higher zone cuts lower ones; Layer order ↑ ↓ stays within the section; a zone drawn wholly inside another zone goes just above it.
- **Starting a zone:** only once the plot boundary is closed. **Add surface…** → pick a material → draw with Freehand or Rectangle (same tool, snapping, curves, Square, undo). Zones also snap to other outlines' **edges**, so a bed can share the lawn's edge.
- **Card:** rename in place (default name = material), **change material** (renames only a zone still named after its material), Square all corners, Redo outline, Delete, Layer order.
- **Look:** **solid** fill when unselected; **see-through** only while being drawn (a selected zone stays solid). **No name label on the plan** (the fill says what it is; the row names it). The plot boundary is drawn as its line only — no tint — so the plan shows through untouched.
- **Edge lengths are reversed for zones:** typing a length on a zone edge **resizes the zone** — it stretches along that edge from the end that stays put (the corner nearer the tap, marked on the plan; Swap switches). A rectangle stays square; on a curved edge the length is along the curve; sizes are true sizes on a stretched plan. Zones never change the scale; before a scale exists the popover says to set it on an outline edge first.
- 🔨 **Editing a selected zone:** drag **inside** to move it (arrow keys too, when no corner is selected); drag a **side** to push it in or out (its neighbours follow, so a rectangle stays a rectangle); the middle square still **curves** the side. **Round corners:** select a corner and type a radius in its chip, or drag the round handle on the corner; **Round all corners** in the card. A side shows a two-way arrow pointer across it (like design tools); hovering near a corner's drawn line (its arc, once rounded) shows its round handle, which then sits on the arc; a side reacts only along its drawn straight part, and the corner dots take a tighter area; with the corner's radius field focused, ↑ ↓ step it by 0.5′ (Shift 2′), and a run of steps undoes as one; the **Round all corners** field in the card steps the same way (↑ ↓ / Shift, one undo step per run, focus stays in the field). **Rounded corners survive bending a neighbouring side:** the rounding stays tangent to the curved side and trims the arc (a smooth junction needs none). With **Shift** held while dragging a corner's round handle, every corner takes that radius. On a sharp corner the round handle floats well clear of the corner dot (34 px) with a finger-sized target. The card shows the material as one line with **Change**, which opens the picker in place. Hovering says what a drag would do ("Drag to move", "Drag to move the side · 12.00′", "Drag to curve the side", "Drag to round the corner"). The zone's name in its card shows as an underlined field with a pencil, so it's clearly renameable.
- 🔨 **Draw shape default by kind:** outlines (plot boundary, existing features) start in **Freehand**; surfaces start in **Rectangle**. Switching (bar or X) **while drawing** is remembered **per kind** on the device, so a zone last drawn Freehand starts Freehand next time and the outlines' choice is unaffected. X does nothing when nothing is being drawn, and undo or redo back into a drawing in progress resumes that kind's tool.
- 🔨 **Snap is off by default for surfaces** (designed, not traced) and on for outlines; the Snap toggle switches the one for what's being drawn or edited.
- 🔨 **Width × Depth (stage 2):** a selected zone's card has a **Size** row — **Width** and **Depth** of the zone's bounding box (axis-aligned to the page, true feet), for any zone, not only rectangles; an irregular shape reports its overall extent. Typing one resizes the zone **from the center of that box**, along that axis only; an unreadable entry snaps back. A **lock** between the fields (off by default) scales both axes in proportion. The lock is a session preference, not saved, and turns off when another zone is selected. Curved sides count with their bulge. One undo step per entry. Needs a scale (hidden until one exists). Zones only: outlines' typed lengths set the scale. Not shown while drawing.
- 🔨 **Plot fill:** **Surfaces → Fill the plot…** (once the boundary is closed) covers the whole plot with one surface; pick its material from the same list. It **follows the plot boundary** (reshape, bend or redraw the boundary and the fill re-fits) and is always the lowest surface, so anything drawn on it cuts it out. One per plan; Delete brings the offer back. Its card has material (Change), Texture scale and Delete only: no Width × Depth, rounding, nudge, Redraw or order arrows, and its corners and sides cannot be dragged. Saved as an outline flagged `base`.
- 🔨 **Surface quantities:** the Plant list's **Surfaces** rows show each material's **visible area** in square feet, summed over its zones: clipped to the plot boundary, with the house, existing features and any surface above it cut out. Plants, objects, lines and markers do not cut. Needs the plan scale (no scale: the material only). Hidden zones still cut and still count.
- 📝 Next: **move one corner** as a second resize choice (stage 3). Later: paint-bucket fill between existing lines, quantities with prices, a default material chosen at plan creation, decks/balconies over surfaces.

### 6.10 Plants & objects ✅🔨
- The library's **51 plants and 14 objects** (families: evergreen, deciduous and accent trees, accent, privacy and large shrubs, perennials, ground covers, ornamental grasses, other). Each has its plan-view art, a photo (plants), a category and a researched size: a plant is a circle of its **typical mature spread**, an object its footprint (long side researched, the other from the art's proportions). Every size has a source and a range in `docs/symbol-sizes.md`; ⚠️ marks approximate ones.
- **Layers → Plants & objects** (the top section by default; see §6.12). **Add plant or object…** opens a list picker with search, then families. Picking one arms placing: **each tap drops one** at its true size until **Done** or Esc; dragging still pans.
- A placed symbol: tap to select, drag to move, arrow keys nudge, **Rotate** (− / typed angle / +, 15° steps), **Delete**; every change undoes (a drag or a run of nudges is one step). Where symbols overlap, they stack automatically (see §6.12), not by placing order.
- **Rows** group by kind ("Blue Diamond Spruce × 3") with an eye per kind and one on the section header (saved with the plan, like the other eyes; hidden symbols still count in the list).
- Saved with the plan as `symbols` (library id, position, rotation). With no plan scale yet, a symbol is 2.4 page points per foot and still follows zoom.
- **Plant list** panel under Layers, live: surfaces used (swatch, name), plants (symbol, name, category, quantity, photo), objects (symbol, name, quantity). The water-consumption table is 📝 later.
- 📝 Later: plant growth over time, quantities with prices, per-symbol size overrides, the water table.

### 6.11 Lines, stepping stones and utility markers ✅🔨
- The rest of the library's surfaces: **5 linear items** (wood privacy fence, decorative veneer wall, Allen block retaining wall, white stone edging, dry river), **4 stepping stones** and **3 utility markers** (gas, electric, drainage). One ruling for every size read off Figma: **36 Figma px = 1 ft** (a 72 px stepping stone is 2 ft).
- **Layers → Lines** (see §6.12 for the section order). **Add line…** opens a picker with search. Picking one starts drawing: **tap a point for each corner of the run, then Done** (Enter, or double-tap the last point); Esc cancels, Backspace removes the last point; Shift holds 45°. Dragging still pans. A tap within 4 px of the last point is ignored; fewer than two distinct points saves nothing.
- A drawn line: tap to select, **press and drag its body to move the whole run** (like a zone or an object; one undo step; arrow keys nudge it, Shift ×10; a drag that starts off the line still pans); drag a **point** to move it, a **square** to bend that segment into an arc; tap a point then **Delete point** (never below two); **Width** (− / typed feet or inches / +, 0.25 ft steps, 0.25–12 ft); **Delete line**. Every change undoes. Default widths are the Figma stroke: 0.33 ft (fence, walls, edging), 0.55 ft (dry river).
- A run is drawn as its item's Figma texture at **true width**, turned to follow the run (grain follows bends; the width follows zoom and calibration), with round caps except the dry river; a run is never thinner than 2 px. Lines draw above surfaces and below plants and objects in the default section order (stacking follows §6.12).
- **Rows** group by item ("Wood privacy fence × 3") with an eye per item and one on the section header (saved with the plan; hidden lines still count).
- **Stepping stones** are objects (2 × 2 ft; the Colorado buff stone 3.56 × 2 ft), placed one per tap like any symbol, with rotate.
- **Utility markers** place one per tap; **rotation is the direction** (the art points along the run, 0° = up). True size (0.4 × 1 ft for gas and electric, 3.8 × 3 ft for drainage) but never shorter than **20 px** on screen.
- Saved with the plan as `lines` (item, points, bends, width in feet); stones and markers are `symbols`. With no plan scale a width or length uses 2.4 page points per foot and the list says "no scale".
- **Plant list** gains **Lines** (item, total feet, runs), stepping stones under **Objects**, and **Utility markers** (quantity).
- 📝 Later: stones repeating along a path, fence posts and gates, widths per segment, utility depth and length, snapping lines to outlines.

### 6.12 Layering ✅🔨
- **Section order:** the four Layers sections (Plants & objects, Lines, Surfaces, Outlines) can be moved up and down with ↑ ↓ buttons on each header (disabled at the ends). The panel's top-to-bottom order is the plan's stacking, top to bottom. Default: **Plants & objects, Lines, Surfaces, Outlines** (Outlines last in the panel), so plants and objects draw over everything; outline strokes then sit under surface fills, and moving Outlines up puts them over. Saved with the plan (`sectionOrder`), not an undo step. The Plot plan block stays below the sections. What cuts what (features cut surfaces) and the surface areas do not change; **tapping** keeps its priority (plants and objects, then lines, then zones and outlines).
- **Plants stack automatically** by type, then size, not by placing order. Bottom to top: utility markers, objects (stepping stones too), perennials / ground covers / ornamental grasses / other, shrubs, trees. Within a tier a larger mature spread sits below a smaller one; equal sizes keep placing order. A tap where a tree and a perennial overlap picks the tree. No manual Bring to front / Send to back.
- **The panel waits for the plot boundary:** until the boundary is closed only **Outlines** shows (with the Plot plan block); Surfaces, Lines, Plants & objects and the Plant list appear once it is, and always when the plan already has some. The ↑ ↓ buttons move a section past the sections that are showing.
- **Outline labels** (House, Driveway…) are 10 page points of text and **scale with the plan** as it zooms, kept between 8 and 30 px.
- A surface's card says what it needs when the plan has no scale yet (typed Width × Depth and rounding need it); dragging and pushing sides work without one.
- 📝 Later: tapping that follows the section order, reordering rows inside Lines and Plants & objects.

### 6.9 Plans & sign-in ✅🔨
- A contractor keeps **many plans, one per job/address**, and opens any of them on any of their devices.
- **Sign-in:** Google only; required to use the app. **Invite-only:** an `invites/<email>` doc added by hand in the Firebase console; security rules refuse everything else. An un-invited account sees "not invited" and can read or write nothing. No in-app admin, no invite email.
- **Privacy:** each user sees only their own plans; no sharing.
- **Offline:** full offline (open, edit, create) after one online sign-in on that device; syncs when back online. Plans not yet uploaded show "Not synced yet".
- **Storage:** Firebase (Auth, Firestore `nam5`, Cloud Storage `us-central1`, Blaze plan). One doc per plan (outlines, surfaces, typed lengths); the plot plan PDF in Cloud Storage and cached on the device.
- **Saving:** autosave about 1 s after each change; no Save button. Last write wins per plan.
- **Plans screen:** newest-edited first; New plan (pick the PDF, then confirm: the address is optional and the plan is named from the address found in the PDF's text, else the file name, else "Untitled plan"; typed text always wins), rename address (name required), **archive** (archived plans leave the list for a collapsed "Archived (n)" section below it, with Unarchive; archiving doesn't count as an edit), delete (inline confirm).
- 🔨 **Editor header:** top left of the plan, ← (back to Plans) · the plan's name · ⋯ menu with **Rename**, **Archive** and **Delete** (inline confirm). Capped at 300 px; a long name is cut with "…". Archive and Delete return to Plans with a message. The plot plan row's icon is a "replace" icon (it replaces the PDF; it doesn't rename).
- **Replace plot plan:** allowed from the plot plan row (e.g. a revised survey); **outlines, surfaces and typed lengths are kept** as they are, for the contractor to re-check. Undo doesn't cover it.
- Not saved: undo history, selection, zoom/pan, plot plan visibility.
- ✅ Local testing without Google: dev builds only, `?store=memory`.
- ⏸ Later: Google Maps address search in the address field (Finding #7); Firestore rules emulator tests; automated offline check (needs a built preview); contractor profile; sharing/teams; in-app invite admin; version history; importing old local-only work.
- Spec: `docs/superpowers/specs/2026-10-15-plans-auth-design.md`.

## 7. Validation so far (Riesberg plot plan, 1" = 30')
- Scale from the 116.45′ top edge → left edge **138.30′** vs printed 138.31′ (−0.01%).
- Street curve bent onto the drawing → **62.03′** vs printed L = 62.02′.
- Lot area with the curve → **13,597 sq ft** vs printed 13,504 (+0.7%).
- Snapping: taps ~9 px off the three test corners landed 0.4–1.8 px from the drawn corner; ~79% of 24 real-pixel samples land within 2.5 px (misses in dense hatching).
- Step 3: house (10 corners), driveway and porch marked; porch inside the house selects on tap; rename, delete, undo/redo and redraw-then-cancel all behave (`scripts/check-step3.mjs`).
- Surfaces (`scripts/check-surfaces.mjs`): a 12′ pavers edge typed to 16′ → 16.00′ with the fixed corner unmoved and the far side unchanged; ⌘Z back to 12′; a house drawn after the sod cuts a hole in it; a material change is one undo step; the boundary's 100′ reference edge still reads 100.00′ after resizing zones.
- Not yet tested with real touch on a tablet.

## 8. Open questions
- ❓ Homeowners (DIY) as a later audience?
- ✅ Saving jobs: Google sign-in, invite-only, Firebase sync, works offline (§6.9)
- ❓ Multi-page plot plans; edit-name button meaning.
- ❓ Pilot contractor recruitment; business model; success measure.
- ✅ Mature-spread data for plant symbols: researched online, each with its source and range, flagged when approximate (docs/symbol-sizes.md).

---

# Appendix A — Archived: Figma-takeoff spec (superseded 2026-10-12)
> Kept for context only. Code: git tag `archive/figma-takeoff-hardening`.

## A.4 Current capabilities (as built) 🔍
### A.4.1 Connect design
- Paste Figma Personal Access Token + frame URL (must include `node-id`).
- Frame rendered as PNG at 1x; layer tree parsed via Figma REST API.
- Layers starting with `.` skipped; hidden layers excluded; locked layers hidden by default (toggle).

### A.4.2 Measure
- Per layer: **Area** (count opaque pixels of exported layer PNG) or **Length** (vector path length; fallback = half boundary pixels).
- Custom polygon drawing on canvas → area or length.
- Global scale input `pixels per foot` (default **12**).
- Component/instance layers auto-counted as **Object Inventory** (by layer name).

### A.4.3 Classify
- Hardcoded list of 11 generic materials (Decorative rock, Seating wall, Stamped/Brushed concrete, Artificial turf, Sod, Mulch, Pavers, Wood/Composite decking, Gravel).
- Auto-suggest material from Figma fill/stroke **style name**; manual override via side sheet.

### A.4.4 Summarize & export
- Totals per material: sq ft, linear ft, counts.
- Google sign-in → append `[material, value, unit]` rows to a user-supplied Sheet; Sheet ID saved per user in Firestore. ✅ **Sheets export to be removed; sign-in kept for sync.**
- Copy-as-CSV exists but has no button; "Export Report" button is a placeholder.

### A.4.5 Not persisted
- Measurements, material assignments, scale — lost on reload.

## A.5 Domain conventions
- ✅ Scale convention: **1 px = 1 inch** (= 12 px/ft; matches app default). Plot plans are calibrated to this before drafting (see `landscaping-plan-scale-calibration` skill).
- 🔍 Symbol library ("Landscaping symbols", Servin; Figma `0B2UpvIGBFOE1ZEDx8rXPR`): 51 plants, 14 objects and the surfaces (29 area textures, plus linear, point and utility ones). Each item has a **measurement class: count | area | linear**.
- 🔍 Library names ≠ card titles, and some have typos (`Blue arrrow juniper`, `Perrenials`) — matching must use main-component names.
- ✅ **Library is source of truth** for materials and measurement type; replaces the 11 hardcoded materials. Measurement class (count/area/linear) decides how each item is measured — no manual Area/Length choice for library items.

## A.6 Goals & success metrics
- ✅ Accuracy target: **±5%** vs. true quantity (overage covers the rest).
- ✅ Success = **manual validation** by the stakeholder against known plans (Pennycress first).

## A.7 Scope
### A.7.1 In scope (now)
- ✅ Raw quantities only (sq ft, linear ft, counts).
### A.7.2 Explicitly out of scope (now)
- ✅ Waste/overage factors, unit conversions (cu yd, pallets, tons), pricing, labor estimates.
### A.7.3 Next milestone — ✅ "Harden the Figma prototype"
- Library-driven classification (count / area / linear from symbol library).
- Accuracy fixes to hit ±5%.
- PDF bid sheet output.
- Remove Google Sheets export; keep Google sign-in + Firestore for profile/project sync.
- ✅ Persistence: **local save** signed-out; **Firestore sync** when signed in with Google.

## A.7a Output: PDF bid sheet ✅
- ✅ **App builds both pages** (not exported from Figma).
- ✅ Structure: **page 1 = plan sheet, page 2 = bid table** (line item, qty, unit, blank unit price, blank total).
- ✅ Header branding is **per contractor** (Servin Landscaping is an example customer).
- ✅ Water consumption **out of scope** this milestone.
- Reference example: Figma `dInKvof2isrTso3C8gb4T5`, node `117:12027` ("040726-8651 Pennycress dr 3", 3300×5100).
- Must contain:
  - **Project header** — company logo/name/phone/email, "Landscaping plan for: <address>", design version + date.
  - **Plan image** — the drawing with dimensions; measured regions keyed.
  - **Line items + quantities** — surfaces (sq ft / linear ft), plants (count per species), objects (count).
  - **Blank price columns** — unit price / line total for contractor to fill in.
- 🔍 Example sheet structure: Header band (400px) → drawing (1775w) + Annotations column (1141w): Surfaces swatches, Plants cards (symbol, name, category, qty, water table, photo), Water consumption summary, Objects, Footer (scale bar 1"=12', version info).
- 🔍 Gap in example: surfaces show swatches **without quantities** (only sod has 772 sq ft) — the bid sheet must add them.

## A.7b Input: Figma source frame ✅
- Designer provides a link to a **drawing-only source frame** (long-term: equivalent drawn in-app).
- Reference example: Figma `dInKvof2isrTso3C8gb4T5`, node `117:11887` (858×2148 px; house 60 ft = 722 px ✓ 1 px = 1 in).
- ✅ Surfaces drawn as **vector shapes with image (texture) fills**.
- 🔍 Observed structure:
  - `Plan/Hardscape` — surface vectors: `Plot`, `Rock` (covers entire plot), `Grass`, `Mulch right` (boolean op), `Paver patio`; 16× `Paver` instances (stepping stones); `Firepit` instance.
  - `Plan/Hardscape/Structures` — existing: `House`, `Deck`, `Porch`, `Driveway`, `Walkway`, `Stairs`, 2× `Window well`.
  - `Plan/Outlines` — duplicate outlines + `Corner` markers (drafting aids).
  - `Plan/Measurements and annotations` — 23× `Measurement` instances + text labels (drafting aids).
  - `Plan/Plants` — plant instances (Eastern redbud, Blue diamond spruce, Crabapple, Common lilac, Fern ×8, Hydrangea ×5, Blue columbine ×11, "Coneflowers 03…28" ×26).
- 🔍 **Implications for the takeoff engine:**
  - Surfaces **overlap** (Rock spans the whole plot under everything) → per-layer area is wrong; need **visible area** after subtracting layers above it and structures.
  - Layer names are **unreliable**: "Coneflowers 03–28" appear on the sheet as "White Nugget (Ice plant) ×26"; "Fern" → "Fernbush". Plants must be identified by **main component**, not layer name.
  - Surface names ("Rock", "Grass", "Mulch right") ≠ library names → need mapping from **image fill / layer name** to library surface.
  - Drafting aids (Outlines, Measurements, Corners, text) must be ignored.
  - Example plan sheet reports sod = 772 sq ft and plant counts → candidate ground truth.

## A.8 Requirements
### A.8.1 Functional
| ID | Requirement | Pri |
|---|---|---|
| F1 | Load a Figma source frame from a URL (+ PAT); ignore drafting aids (outlines, measurements, corners, text) | P0 |
| F2 | Identify every library item by **main component**, not layer name | P0 |
| F3 | Classify each item via library measurement class: count / area / linear | P0 |
| F4 | Surfaces: compute **visible area** (shape minus everything above it, minus structures) | P0 |
| F5 | Map surface image fills → library surface automatically; designer confirms/overrides when no match | P0 |
| F6 | Structures (House, Driveway, Deck, Porch, Walkway…) default to **existing** (subtracted, not billed); designer can flag any as **new work** to include | P0 |
| F7 | Plants counted per species (library name), regardless of instance names | P0 |
| F8 | Objects counted per library item | P0 |
| F9 | Generate PDF: page 1 plan sheet (header, drawing, annotation column, scale bar, version/date); page 2 bid table (item, qty, unit, blank unit price, blank total) | P0 |
| F10 | Contractor branding on header (logo, name, phone, email) + client address | P0 |
| F15 | Linear footage: **edging** — designer explicitly marks edging; marking UX to be worked out in a prototype (not in this milestone's plan) | P2 |
| F16 | Linear footage: library **walls / fences** (retaining wall, veneer wall, privacy fence) | P0 |
| F20 | Linear quantity mode per item: centerline (thin walls/fences) vs full perimeter (e.g. mulch berms); auto-default by shape thickness, designer can override | P0 |
| F17 | Count-type paving items (e.g. stepping-stone pavers) reported as **count + sq ft** | P1 |
| F18 | Contractor profile (logo, name, phone, email) entered in app and saved locally, reused across projects | P0 |
| F11 | Local save/load of a takeoff project | P1 |
| F12 | Scale fixed at 1 px = 1 in; editable override with validation (>0), quantities recompute | P1 |
| F13 | Manual polygon plotting for items not in Figma (existing feature) | P2 |
| F14 | Remove Google Sheets export and the `spreadsheets` OAuth scope | P0 |
| F19 | Google sign-in syncs contractor profile + saved projects to Firestore; signed-out users keep local save | P0 |
### A.8.2 Accuracy
- ✅ ±5% on area and length.
- ✅ Acceptance test: Pennycress source (`117:11887`) must reproduce the example sheet — sod ≈ 772 sq ft; Blue Diamond Spruce 1, Eastern Redbud 1, Crabapple 1, Lilac 1, Hydrangea 5, Fernbush 8, Columbine 11, White Nugget 26; Sitting wall 1.
- 🔍 Current gaps vs. target: curve lengths approximated as chords; raster boundary length overestimates diagonals; scale changes don't recompute.
### A.8.3 Non-functional
- ✅ Desktop + tablet browsers; **full workflow on tablet** (touch-friendly canvas, controls ≥44px).
- Google sign-in (Firebase Auth) for cloud sync; app fully usable signed-out with local save.
- Figma token from build-time env var; no token entry UI.

## A.9 Known gaps / tech debt
- Code review 2026-10-12: scale=0 crash; scale change doesn't recompute; duplicate rows on re-export; PAT in localStorage; broad Sheets scope; Firestore test read always denied; placeholder UI (fake feed / memory / status bar); Length button no-op with 2 points; no double-click finish.

## A.10 Open questions
- ✅ Edging marking: to be explored in a prototype.
- ❓ Edging material — one default or per marked edge?
- ✅ Figma token: build-time variable for now (`VITE_FIGMA_PAT`); no token UI. Will go away with the in-app editor.


---

# Appendix B — Decision log
### Round 1 (2026-10-12)
- ✅ Primary user: contractors / installers.
- ✅ Output serves: estimate/quote, ordering, install planning, design iteration.
- ✅ Stage: prototype, not used on real work.
- ✅ Scale: fixed convention.

### Round 2 (2026-10-12)
- ✅ Figma = prototype design source, can continue for now; long-term = in-app drawing on scaled plot plan with symbol library, by contractor or homeowner.
- ✅ Scale = 1 px = 1 in.
- ✅ Raw quantities only for now.
- ✅ Accuracy ±5%.

### Round 3 (2026-10-12)
- ✅ Not related to Front Range Yards.
- ✅ Symbol library drives materials + measurement class.
- ✅ Figma phase: designer runs takeoff on contractor's behalf.
- ✅ Output: **PDF bid sheet**.

### Round 4 (2026-10-12)
- ✅ Drop Google Sheets export.
- ✅ Bid sheet: line items + quantities, blank price columns, plan image, project header; example in Figma `117:12027`.
- ✅ Plants included, counted by species.
- ✅ Next milestone: harden Figma prototype.

### Round 5 (2026-10-12)
- ✅ PDF: plan sheet page + bid table page.
- ✅ Servin = example contractor customer → per-contractor branding.
- ✅ Water consumption out for now.
- ✅ Local save.

### Round 6 (2026-10-12)
- ✅ App builds page 1 (plan sheet) and page 2 (bid table).
- ✅ Surfaces = vector + image fill.
- ✅ Input = drawing-only source frame (example `117:11887`); app builds summary of materials, plants, objects with counts / sq ft / linear ft.
- ✅ Platform: desktop + tablet.

### Round 7 (2026-10-12)
- ✅ Visible-area rule for overlapping surfaces.
- ✅ Structures: per-layer flag existing vs new work.
- ✅ Surface mapping: auto-match image fill, manual fallback.
- ✅ Pennycress plan sheet numbers = acceptance ground truth.

### Round 8 (2026-10-12)
- ✅ Linear: edging between surfaces + walls/fences (utility lines out).
- ✅ Stepping-stone pavers: count + sq ft.
- ✅ Contractor branding: entered in app, saved locally.
- ✅ Success: manual validation for now.

### Round 9 (2026-10-12)
- ✅ Edging is designer-marked, not auto-derived.
- ✅ Tablet: full workflow.

### Round 10 (2026-10-12)
- ✅ Keep Google sign-in → sync contractor profile + projects via Firestore.
- ✅ Edging marking → explore in a prototype (deferred).
- ✅ Figma token → env variable, no UI.

### Round 11 (2026-10-12)
- ✅ Mulch berms (and similar) need **full perimeter**, not half → per-item linear mode.
- ✅ Execution: subagent-driven.

### Round 12 — direction reset (2026-10-12)
- ✅ Scratch the Figma-takeoff build; branch parked, not deleted.
- ✅ Reason: too Figma-dependent.
- ✅ First user: contractors / installers. Pain: getting a plan at all (no design tools/skills).
- ✅ Plan used to: win the job, quote accurately, instruct crews.
- ✅ Input: homeowner's plot plan PDF. Device: on site, tablet.

### Round 13 (2026-10-12)
- ✅ Scaling: explore trace → auto-detect → known-dimension fallback.
- ✅ Outputs: Servin-style plan sheet + priced proposal.
- ✅ Drawing: simple zones + symbols.
- ✅ HOA: nice to have.

### Round 14 (2026-10-12)
- ✅ Prices from contractor's own price list.
- ✅ Built-in shared symbol library.
- ✅ No pilot contractor yet.
- ✅ Homeowner gets a PDF.

### Round 15 — workflow (2026-10-12)
- ✅ Job created by contractor on site.
- ✅ Full plan done on site in ~30–60 min.
- ✅ Homeowner shown the plan at the end.
- ✅ Post-proposal steps out of scope for now.

### Round 16 — workflow details (2026-10-12)
- ✅ Trace over the PDF (tap corners, type lengths).
- ✅ Draw: existing features, edging/walls, plant spacing fill, dimensions.
- ✅ Often offline on site.
- ✅ Present plan sheet first.

### Round 17 (2026-10-12)
- ✅ Pricing details (price-list setup, proposal contents, price view) deferred — focus on the **editor**.
- Plant spacing fill behavior: no preference yet.

### Round 18 — editor (2026-10-12)
- ✅ Zone input method → prototype (combination likely).
- ✅ Curves essential.
- ✅ Default-fill zone model.
- ✅ Undo/redo, reshape, snap, copy/repeat all v1.

### Round 19 — editor details (2026-10-12)
- ✅ Library: search + categories.
- ✅ Symbols at true mature size.
- ✅ Quantities on selection.
- ✅ Any tablet browser.

### Round 20 — zone prototype feedback (2026-10-12)
- ❌ Zone Drawing Lab prototype judged **unusable**: couldn't draw at all; too many modes at once; plan too small to see; wrong starting point (should start from the plot plan / lot setup).
- ✅ Process change: go **slowly, one step at a time**, agreeing on each step before building it. Next step: the first screen of the workflow (job + plot plan → scaled base).

### Step 1 — Open the plot plan (agreed 2026-10-12)
- **Scope:** contractor picks the plot plan PDF from the tablet; it fills the screen; pinch to zoom and pan. Nothing else (no job info, no page picker, no drawing).
- **Done when:**
  - PDF opens in under a few seconds.
  - Fills the screen and stays sharp when zoomed (printed dimensions readable).
  - Pinch-zoom and pan feel smooth, like a photo viewer.
  - Works offline once the app is loaded.
- **Test file:** a real plot plan PDF supplied by the stakeholder (path TBD).

### Step 1 — build notes (2026-10-12)
- Built in `plan-builder/` (branch `feat/step1-open-plot-plan`).
- PDF.js was too slow on real plot plans: the Riesberg plan draws its text as ~12k vector shapes → ~12 s to first paint. Switched to **PDFium (WebAssembly)** in a background worker: ~0.7 s to open once the engine has warmed up (~3 s after app launch), ~1.5–2 s if opened immediately.
- Measured in headless Chrome on a Mac (820×1180, 2x); **not yet measured on a real iPad**.
- ⚠️ Later steps: this plan's scale label (`1" = 30'`) disagrees with its title block (`1"=20'`), and its text is drawn as shapes (no extractable text) → auto-detecting scale would need OCR.

### Round 21 (2026-10-12)
- ✅ Two-finger trackpad drag = pan; pinch = zoom (shipped `bc4cca8`).
- 📝 Backlog (low priority): replace "Open another" with an **edit button next to the file name**. ❓ Edit = rename, or replace the file?
- ✅ iPad testing deferred for now.
- ✅ Next step: **Step 2 — scale calibration flow** (to be defined before building).

### Step 2 — Scale calibration (agreed 2026-10-12)
- **Method:** known dimension only — tap both ends of one printed dimension, type its length.
- 📝 Later: try "trace the lot" and "printed scale bar/label" methods.
- **Confidence:** check a second printed dimension — the app shows what it measures vs. what's printed.
- **Done when:** endpoints can be placed precisely (zoom in, land exactly on the tick) · a second Riesberg dimension measures within 1% · calibration can be redone anytime.

### Step 2 — exploration: snapping & outline-first (2026-10-12)
- 💡 Stakeholder idea: **outline first, then set scale** — trace the plot boundary or a structure, then use those outlines to set the scale.
- 💡 Stakeholder idea: **snap tapped points** to the drawing — vector points for true-vector PDFs; corners/lines for image plans.
- 🔬 Feasibility on Riesberg (vector PDF), via PDFium:
  - All 11,861 page objects are paths; 98k straight segments + curves extracted in **~0.15 s** with exact coordinates → vector snapping is feasible.
  - ~95% of segments are under 5 pt (text drawn as shapes) → snapping must ignore tiny glyph strokes and favor long lines.
  - Property lines are **broken into several pieces** (e.g. the 155.55' line is 3–4 segments; the 116.45' line is one 207.8 pt segment) → snap to merged lines and their **intersections (corners)**, not just segment ends.
  - The boundary includes **curves** (top-right corner arc; front edge along Riesberg Lane, L=62.02', R=222.50') → tracing needs arc support.
  - ~~Actual drawing scale ≈ 1" = 40'~~ **Corrected:** that 207.8 pt line was the retaining wall, not the property line. The top property line is 279.5 pt → **1" = 30.0'**, matching the drawing's scale label (the title block's 1"=20' is wrong).
  - Cross-check available: printed **lot size 13,504 sq ft** can validate a traced boundary's area.
- Image (raster) plans: feasible without heavy libraries — find dark-line pixels near the tap, fit up to two lines, snap to their intersection (corner) or onto the line. Not yet tested (no raster sample).

### Round 22 (2026-10-12)
- ✅ Step 2 becomes **outline first, then set scale**.
- ✅ Contractor picks what to outline (plot boundary or house footprint).
- ✅ Prototype **vector-PDF snapping first**; image-plan snapping later.
- ✅ Plot plans arrive **mostly as vector PDFs**.

### Round 23 — Step 2 feedback (2026-10-12)
- ✅ Points must always be **freely repositionable**, even after snapping to the wrong place.
- ✅ Closing a shape: an explicit **Confirm/Close button**, plus **double-click/double-tap** to close (in addition to tapping the first point).
- ✅ Edge length labels appear only on **hover or tap** over an edge, not all at once.
- ✅ Snapping can be disruptive → need a way to **unsnap** (temporarily or entirely).
- 🔄 Direction shift under discussion: **pure drawing** (no reliance on the PDF's vector data) as the primary, foolproof workflow that works the same for vector PDFs and raster images. Vector snapping becomes optional at most.

### Round 24 — pure drawing decisions (2026-10-12)
- ✅ **Pure drawing** is the primary workflow (same for vector PDFs and images).
- ✅ Precision aids: magnifier while dragging · offset cursor (point above the finger) · right-angle & straight guides · nudge arrows.
- ✅ **Snapping to the underlying image** (lines/corners as rendered pixels) — works the same for vector PDFs and raster plans, no reliance on PDF vector data.
- ✅ Snapping **on by default**; turn it off with a **toolbar toggle** and/or **hold to bypass** while dragging (both).
- ✅ Curves: **bend an edge** — draw straight, drag the edge's middle to curve it (arc through 3 points).

### Round 25 (2026-10-12)
- 📝 Outlines will need more kinds than plot boundary and house — other **existing structures and surfaces** (driveway, patio, deck, etc.). 2a builds boundary + house only.
- ✅ Guides (2b): **never lock** — only *show* when an angle is right (90°) or a point is aligned.
- ✅ Go ahead with **Step 2a**.

### Step 2a — built (2026-10-12)
- Outline the plot boundary or house: tap corners (point sits above the finger on touch, with a magnifier); close with **Close shape**, **double-tap/double-click**, or a tap on the first corner; drag any corner freely; Undo corner / Cancel / Redo.
- Tap an edge → popover: measured length + "Printed length" → **Set scale**. Hover an edge (mouse) → its length.
- Plot area shown once scaled; type the printed lot size to see the % difference.
- Panning is now free (no limit at the plan's edges).
- Riesberg check (scale from the 116.45′ top edge): left edge **138.30′ vs printed 138.31′ (−0.01%)**; scale reads 1 in = 30.0 ft. Area 13,738 vs printed 13,504 sq ft (+1.7%) because the curved street edge is still drawn straight — expected until 2c.

### Step 2b — built (2026-10-12)
- **Snapping to the plan's pixels** (works for vector PDFs and scans alike): finds long drawn lines near the point and snaps to where two meet (corner) or onto the nearest line. Prefers heavy lines (outlines) over thin dimension/hatch lines; ignores lettering. Own corners snap first.
- Shows what it snapped to ("Corner" / "On line") at the point.
- **Off switch:** toolbar **Snap on/off**; **hold Option/Alt or a second finger** while placing/dragging to place freely. (A second finger during a placement now means "place freely", not pinch — lift and pinch to zoom.)
- **Hints, never locked:** "90°" mark when an edge is square to the previous one, "Straight" when it continues it, dashed line when the point lines up with another corner. Shown while dragging, and on mouse hover while drawing.
- **Nudge:** arrow buttons in the panel and arrow keys (Shift = 10 px) move the selected corner.
- Riesberg check (tap ~9 px off): all three test corners snapped onto the drawn corner (0.4–1.8 px). On 24 captured real windows across two zoom levels, ~79% land within 2.5 px of the corner; misses are in dense spots (bottom-left corner with hatch dots and double lines) — nudge or bypass there.

### Round 26 (2026-10-12)
- ✅ Parked Figma-takeoff code **archived** as git tag `archive/figma-takeoff-hardening` (branch removed); its requirements stay in this PRD for context.
- ✅ Each build step now gets its own branch off `feat/plan-builder`.
- ✅ **Undo/redo** (branch `feat/plan-builder-undo`): ⌘Z / Ctrl+Z undoes, ⇧⌘Z / Ctrl+Shift+Z (or Ctrl+Y) redoes; toolbar Undo/Redo buttons for touch. Works mid-outline (each placed dot is a step), and on close, corner drags, nudges (consecutive nudges of one corner = one step), starting/cancelling an outline and setting the scale. Text fields keep their own undo.

### Step 2c — built (2026-10-12)
- Drag the square at the middle of any edge of a closed outline to bend it into a circular arc through that point; the handle snaps onto drawn lines (never corners) so it follows the plan's curve. Tapping the handle opens the edge; "Make straight" undoes a bend. Corner drags keep the bend. Undo/redo cover bends.
- Riesberg: street curve 62.03′ vs printed 62.02′; lot area 13,597 vs printed 13,504 sq ft (+0.7%, within the 1% target; was +1.7% with the edge straight).

### Round 27 — Step 3 defined (2026-10-13)
- ✅ Step 3 = **mark existing features**. Result: visual plan only (no quantities yet).
- ✅ Feature names are typed by the contractor (custom); any number of features.
- ✅ Look: grey fill + label.
- ✅ House merges into existing features (a feature named "House").

### Round 28 — snap feel & Shift (2026-10-13)
- ✅ Snapping must feel stronger ("more gravity"): wider pull, sticky targets, snap preview on hover.
- ✅ Hold **Shift** while outlining to draw at 45° increments.
- Riesberg: approaching the top-left corner, the preview locks onto it from 12 px and holds; click lands 0.5 px from the drawn corner. Shift at ~10° → 0°; at ~43° → exact 45° diagonal.

### Round 29 — Shift keeps snapping (2026-10-13)
- ❌ Shift turned snapping off. ✅ Now Shift + snapping combine: the point stays on the 45° line and stops at drawn corners on it or where it crosses a drawn line.
- Found while fixing: Riesberg's left property line is dashed (~6 px gaps) with a rotated bearing label alongside; snapping now handles both. Riesberg: Shift-drawing left onto that line stops exactly on it (0.0 px). Real-pixel sample: 18/24 within 2.5 px of the corner (was 19/24).

### Round 30 — selection & guide priority (2026-10-13)
- ✅ Clicking outside a shape deselects it.
- 🔄 Guides change from "show only, never lock" to **snap targets with priority over the image** (still bypassable with Option/Alt, a second finger, or Snap off). Priority: own corners → guides → drawing underneath.
- Check: a 3rd corner ~2° off square lands exactly square; a 4th near both the 1st corner's column and the 3rd's row lands on both; Riesberg corner snapping, area and curve results unchanged.

### Round 31 — iPad navigation (2026-10-13)
- ❌ On iPad the app couldn't tell moving around from placing a corner (the "second finger = place freely" trick blocked two-finger panning).
- ✅ One finger draws, two fingers move (Procreate-style). ✅ Free placement on touch = press and hold before moving. Second-finger bypass removed.
- Checked with simulated multi-touch: tap places; two-finger drag pans and pinch zooms (1.00 → 2.28) without placing anything; press-and-hold places a point with no snapping. Still needs a real-iPad try.

### Round 32 — touch placement offset (2026-10-13)
- ❌ On iPad, taps placed the point ~64 px above the finger (the always-on offset cursor) — felt like a misplaced cursor.
- ✅ A tap now places right where the finger touches; the offset only appears (gradually) while dragging to fine-tune.

### Round 33 — Step 3 built: existing features (2026-10-13)
- ✅ House folded into "Existing feature…"; name first (quick picks or typed); grey fill + name label; tap inside to rename / redo outline / delete; overlaps allowed.
- ❌→✅ Found on Riesberg: drawing the driveway from the garage's corners grabbed and moved the house's corners. Other outlines' corners now only snap while drawing.

### Round 34 — no angle pull without Shift (2026-10-13)
- ❌ Lines kept locking to straight/90° without Shift — guide snapping (and a Shift state that could stick after a missed keyup) felt like stuck 45° steps.
- 🔄 Reverses Round 30: guides go back to **hints only**. Angle/straight constraints only while Shift is held. Shift/Option state now comes from every input event and clears when the window loses focus.
