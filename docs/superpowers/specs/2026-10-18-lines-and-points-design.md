# Lines, stepping stones and utility markers

Date: 2026-10-18 · Status: draft for review · Builds on the symbols work (PRs 19, 33, 34, all merged). PRD step 5b.

## Goal

Add the rest of the Landscaping symbols library's surfaces (Figma `0B2UpvIGBFOE1ZEDx8rXPR`, Surfaces section `170:1977`): **linear items** you draw as a run with a width (wood privacy fence, decorative veneer wall, retaining wall, white stone edging, dry river), **four stepping stones**, and **three utility markers** (gas, electric, drainage) with a direction. All of them count in the Plant list (feet for lines, quantity for the rest).

## Decisions (from the brainstorm)

- **Lines are drawn by clicking points, then Done**; points can be dragged, segments bent into curves (the outline editor's flow). Each line has a width, editable in its card.
- **Stepping stones and utility markers place one per tap**, like symbols; rotate; direction is the rotation.
- **Sizes come from Figma**, one ruling for all: **36 Figma px = 1 ft** (a 72 px stepping stone is 2 ft, matching the usual flagstone).
- Counting joins the Plant list: length in feet per line item, quantity per stone and marker.
- Out of scope: stones repeating along a path, fence posts or gates, per-segment widths, utility depth or length, snapping lines to outlines.

## Library

### Line items (`src/line-items.ts`, art from `scripts/line-sources.mjs`)

Figma draws each as a 1-D vector with an image stroke and round caps (the "Wall feature" and "Dry river" template parts), so the stroke weight is the default width.

| Item | Figma stroke | Default width | Art |
|---|---|---|---|
| Wood privacy fence | 12 px | 0.33 ft | image stroke (wood strip) |
| Decorative veneer wall | 12 px | 0.33 ft | image stroke |
| Retaining wall (card title "Allen block retaining wall") | 12 px | 0.33 ft | image stroke |
| White stone edging | 12 px | 0.33 ft | image stroke |
| Dry river | 20 px | 0.55 ft | image stroke, no cap |

```ts
interface LineItem { id: string; name: string; family: string; art: string; thumb: string; defaultWidthFt: number; roundCaps: boolean }
```

- Width range in the card: 0.25–12 ft in steps of 0.25 ft, or a typed value; changing it never moves the run.
- Art is the image the stroke uses, exported at 4× from the plain node ids (not instance paths), as the textures were; a 64 px thumbnail for the picker.

### Points (`src/symbols.ts`, existing data files)

| Symbol | Figma size | Footprint |
|---|---|---|
| Porcelain pavers | 72 × 72 | 2 × 2 ft |
| Concrete pavers | 72 × 72 | 2 × 2 ft |
| Flagstone pavers | 72 × 73 | 2 × 2 ft |
| Colorado buff stone | 128 × 72 | 3.56 × 2 ft |

- Added as `kind: 'object'`, family "Stepping stones", so placing, rotate, undo, hide and counting already work. Card titles in Figma differ from component names (as in the symbols spec); `symbol-sources.mjs` maps each to one canonical id and name, and the naming test covers them.
- Art built with `build-symbols.mjs`, as for objects.

### Utility markers (`src/symbols.ts`, `kind: 'marker'`)

| Marker | Figma size | Footprint | Colour in Figma |
|---|---|---|---|
| Gas | 15 × 37 | 0.42 × 1.03 ft | amber with flame |
| Electric | 15 × 37 | 0.42 × 1.03 ft | purple with bolt |
| Drainage | 136 × 109 | 3.78 × 3.03 ft | arrow |

- True size like any symbol, with a **minimum on-screen size of 20 px** on the long side so the small ones stay visible and tappable at plan zoom.
- The art's top points along the run; **rotation is the direction**. The card's Rotate control and arrow keys work as for symbols; the tap target stays the symbol.
- Plan-view art from the Figma component's vectors (they are vector-only), rendered through the existing pipeline.

## Plan model

`PlanState` gains `lines?: Record<string, PlacedLine>` (additive, `v: 1` kept):

```ts
interface PlacedLine { id: string; item: string; points: Point[]; bulges?: number[]; widthFt: number } // page points
```

- `item` must be a known line item, `points` at least 2, all numbers finite, `widthFt` in 0.25–12, `bulges` (if present) one per segment; anything else is an invalid plan (as for symbols).
- Ids `l1`, `l2`, … Undoable in the editor snapshot, saved by the Firestore and memory stores (`editorFields`, cleared with `deleteField` when absent).
- Hidden state reuses `hiddenLayers` (a line id) and `hiddenSections` (new section id `lines`, between Surfaces and Plants & objects). Stones and markers are symbols, so their state is unchanged.
- `Group` gains `'lines'`; the markers join the symbol group counts under "Utility markers" (a new section in the symbols picker).

## Drawing and editing lines

- **Layers section "Lines"** with **Add…**: picker with search and rows (thumbnail, name), like the symbol picker.
- **Draw:** tap points; the run follows as a stroke at true width; **Done** (or double-tap the last point) ends; Esc cancels; fewer than two points does not save.
- **Edit:** tap a line to select; drag a point to move it, drag a segment's midpoint to bend it (the outline editor's handle, `shape-edit.ts`); delete a point with the card's **Delete point** or by dragging it onto a neighbour; **Delete line**; **Width** field with − / + stepper; undo covers all of it.
- **Hidden lines** can't be selected or tapped. Selected: a halo along the run.
- **Draw order:** surfaces, lines, symbols, outline strokes, handles on top, so a fence draws over turf and under plants.
- **Pointer priority:** an armed drawing or placing tool first; then handles; then the selected line's points; then a symbol; then a line; then zones.

## Rendering

- The run is sampled to short segments (curves with `edgePoints`); each segment is a rectangle of the line's width along its direction. Segments sit in one `<g>` per line with a single `clip` free join: round caps (where the item has them) are circles at the ends; interior joins overlap by half the width so bends stay filled.
- The image stroke is a `<pattern>` per line item, sized so the art's short side equals the Figma stroke weight, with `patternTransform` rotated per segment so grain follows the run. Width follows zoom like surface textures (page points × `ftPerPt`); unscaled plans use the same default feet per point as symbols (`UNSCALED_FT_PT`).
- Stones and markers go through the existing `symbolsSvg` renderer (markers with the minimum on-screen size rule).

## Counting (Plant list)

New panel sections, all live, hidden items still counting:

- **Lines:** item, **total length in feet**, runs ("62 ft · 3 runs"). A run's length is its sampled arc length × `ftPerPt`; with no plan scale the entry reads "no scale" and shows page-point length greyed.
- **Objects:** stepping stones appear here with quantity, as other objects.
- **Utility markers:** icon, name, quantity.
- Empty state unchanged ("Placed plants and objects appear here"); lines alone also make the list non-empty.

## Tests

- **Unit:** line library integrity and naming guard; `fromDoc` / `toDoc` for `lines` (round trip, unknown item, one point, bad width, bad bulges); length with and without scale; segment geometry (rectangle width, rotation, round caps, bent joins); marker minimum on-screen size; stone and marker footprints from Figma sizes; plant list rows for lines, stones and markers.
- **Playwright (Riesberg):** `scripts/check-lines.mjs` — draw a fence, bend a segment, change its width, move a point, delete, undo; place a stone and a gas marker, rotate; hide the Lines section; reopen; list shows feet and counts. Existing checks still pass.
- **Docs:** PRD §6.11 (lines, stones, markers) and step table, decision summary `docs/conversations/2026-10-18-lines-and-points.md`; design-system tokens for the line halo and marker colours via `npm run tokens`, then the artifact.

## Risks

- **Thin default widths.** Figma's 12 px stroke is 4 in at the 36 px/ft ruling, so a fence is a thin line at yard zoom. Width is editable; the ruling can change in one constant if you prefer wider defaults.
- **Image strokes at small widths.** Wood and stone textures can look noisy at 4 in; art is exported high-res and the pattern is minified by the browser, checked on a contact sheet.
- **Pointer overlap.** Lines run under symbols and zones; hit testing uses the stroke width with a minimum 12 px target, and the priority order above decides ties.
- **Precache growth.** Eight new images plus six symbol arts; target under 2 MB added.
