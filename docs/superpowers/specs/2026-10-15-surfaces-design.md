# Surfaces (material zones) — design

- **Date:** 2026-10-15
- **Branch:** `feat/material-zones` (based on `feat/side-panel-layers`, PR #8; rebase onto `main` once #8 merges)
- **Stage:** 1 of 3 (see §8)

## 1. Goal
- The contractor adds the **new work** to the lot: hardscape (patio, pavers, gravel…) and softscape (sod, mulch, rock…) as **zones**, each filled with a material.
- Stage 1 is **visual only**: zones with a fill and a name; no quantities or totals yet.
- Unlike outlines (which trace what is already on the plan), zones are **designed**: the contractor types the size they want.

## 2. Decisions
| Topic | Decision |
|---|---|
| First slice | Visual only (quantities later) |
| Materials | Built-in starter list, flat colour + simple pattern; kept as data so Servin textures can replace the look later |
| Layers | One **Surfaces** section (hardscape + softscape together), shown **above Outlines** in the panel; Objects & plants later, between Surfaces and Outlines |
| Clipping | Plot boundary clips zones; **Outlines (existing features) cut zones**; within Surfaces, a higher zone cuts lower ones |
| Starting a zone | Material first: "Add surface…" → pick a material → draw (Freehand or Rectangle) |
| Look | **Solid** when unselected; **see-through** only while selected or being drawn |
| Edge lengths | Reversed vs outlines: on a zone, a typed length **resizes the zone**; it never touches the scale |
| Resize modes | All three needed, in stages: stretch (stage 1), Width × Depth for rectangles (stage 2), move one corner (stage 3) |
| Architecture | A surface is a new **kind of outline** (approach 1); a general layer model waits for objects and plants |

## 3. Data and materials
- `OutlineKind` = `'boundary' | 'feature' | 'surface'`.
- `Outline` gains optional `material?: MaterialId` (set only for surfaces). A surface's `name` defaults to its material's name; several zones may share a name.
- New `src/materials.ts` (pure data + lookups):

| Id | Name | Trade | Pattern |
|---|---|---|---|
| `sod` | Sod | softscape | plain |
| `turf` | Artificial turf | softscape | fine lines |
| `mulch` | Mulch | softscape | speckle |
| `river-rock` | River rock | softscape | pebbles |
| `decorative-rock` | Decorative rock | softscape | pebbles |
| `gravel` | Gravel | hardscape | fine dots |
| `pavers` | Pavers | hardscape | brick grid |
| `flagstone` | Flagstone | hardscape | irregular cells |
| `concrete-brushed` | Brushed concrete | hardscape | fine lines |
| `concrete-stamped` | Stamped concrete | hardscape | square grid |
| `decking` | Decking | hardscape | boards |

- Each material: `{ id, name, trade: 'hardscape' | 'softscape', color: <token name>, pattern: PatternId }`. Trade is used only to group the picker (and the bid sheet later), not for layer sections.
- **Tokens:** one `color-material-<id>` per material in `design-system/tokens.json`, plus `opacity-surface-editing` (≈ 0.5); `npm run tokens` regenerates `tokens.css`; the design-system artifact is updated to match. Edge colour is derived in CSS (`color-mix` of the material colour with ink), so no extra tokens per material.
- **Patterns:** SVG `<pattern>`s in the overlay's `<defs>`, one per pattern id, drawn in screen space (they don't grow with zoom), coloured from the material token. The same pattern renders in panel swatches.

## 4. Layer order and cutting
- Storage stays one insertion-ordered `outlines` map.
- Cutting order passed to `visibleShapes`: **boundary** (clips everything, never cut) → **all features** (in their order) → **all surfaces** (in their order). So a feature always cuts every zone, whatever was drawn first.
- `moveLayer` (↑ ↓) swaps only with the neighbour **in the same section**; `layerPosition` reports first/last within the section.
- "Drawn wholly inside another → goes just above it" applies **within the section** (a mulch bed inside the lawn goes above the lawn; a zone inside the house does not move above the house).
- Tapping the plan picks the topmost **visible part**: features first, then the highest zone, then the boundary's edges. A zone wholly covered can be selected from its row.

## 5. Layers panel
- Side panel order: Undo/Redo → View → Layers: **Surfaces** → **Outlines** → plot plan layer (pinned to the bottom).
- **Surfaces section** (new `src/surfaces-ui.ts`, mirroring `layers-ui.ts`):
  - Heading "Surfaces"; one row per zone in layer order (top cuts bottom). Row = swatch (material colour + pattern) + zone name.
  - **Gated on the plot boundary:** until it is closed, the section shows only the hint "Outline the plot boundary first".
  - Empty (boundary closed, no zones): hint "Add the new surfaces: lawn, beds, patio…".
  - **"Add surface…"** row at the end opens the **material picker** inline: two groups, **Hardscape** and **Softscape**, each chips with swatch + name; tapping a chip starts drawing; Cancel closes the picker.
- **Card while drawing:** as for features — step text (Freehand / Rectangle), nudge arrows, Close shape (Freehand only), Cancel. The bottom bar (Freehand | Rectangle, Snap) and **X** work as now.
- **Card when selected:**
  - **Material**: the same chip picker with the current material marked. Changing it keeps the shape; the zone is renamed to the new material only if it still had the default name.
  - **Rename** in place (e.g. "Front lawn").
  - Square all corners · Redo outline · Delete · Layer order ↑ ↓ (within Surfaces).
- **Components:** existing `layerRow`, `layerCard`, `chips`, `layerActions`, `layerOrder`; new swatch variant that can show a pattern (`ui.ts`).

## 6. Drawing and look on the plan
- Same tool as outlines: Freehand / Rectangle, snapping, guides, curves, Square, undo/redo.
- **Snap targets** include the boundary, features' corners and edges, and other zones' corners and edges (a bed can share an edge with the lawn exactly).
- **Solid** (unselected): visible part filled with material colour + pattern, thin edge in a darker shade, name in small text at its label point.
- **See-through** (selected or being drawn): fill at `opacity-surface-editing`, corners and bend handles as outlines have now, whole drawn outline dashed (as for selected layers).
- Features keep their grey fill and label and draw above all zones.
- Plot plan opacity / hide are unchanged; solid zones simply cover the plan.

## 7. Resizing a zone by edge length (stage 1: stretch)
- Tapping a zone's edge opens the edge popover with **"Length"** (not "Printed length on the plan") and the edge's current length.
- No scale yet → the popover says "Set the scale on an outline edge first" and has no field. (In practice the boundary is closed first, but it may not have a typed length.)
- **Stretch:** typed length `L` for edge A→B, with **fixed end F** (the corner nearer the tap; marked on the plan; a swap button switches ends):
  - Work in **true space** (apply the plan correction, stretch, invert back), so a stretched plan still gives true sizes.
  - `u` = unit direction of the edge's chord; `k` = factor making the edge's length equal `L`. Every corner `P` moves to `P + (k − 1)·((P − F)·u)·u` — a one-directional stretch from F along the edge.
  - A rectangle stays a rectangle (12′ × 20′ typed to 16′ → 16′ × 20′); freehand shapes stretch proportionally in that direction.
  - **Curved edges:** the typed length is the arc length; `k` is solved numerically (bisection) so the arc length matches. Every bent edge keeps passing through its stretched midpoint (bulges recomputed from the moved midpoint).
  - One undo step. The scale and references never change from a zone.
- Outlines keep today's behaviour (typed length sets/refines the scale).

## 8. Stages
- **Stage 1 (this spec):** §3–§7.
- **Stage 2:** **Width × Depth** fields for Rectangle zones — while drawing (filled live) and in the card (editable; resizes from the first corner).
- **Stage 3:** **Move one corner** as a second choice in the edge popover ("Stretch zone" | "Move corner"): only the far corner slides along the edge's line.
- **Later:** paint-bucket fill between existing lines; Servin textures; quantities (sq ft per material); default lot material; decks/balconies over surfaces without cutting them.

## 9. Testing
- **Unit**
  - `materials.test.ts`: ids unique; trade valid; every `color` names a defined token; every pattern id exists.
  - `overlap.test.ts`: features cut surfaces whatever the insertion order; boundary clips zones; a higher zone cuts a lower one; containment placement stays within the section.
  - `outline-ui` ordering helpers (or extracted pure functions): ↑ ↓ never crosses sections.
  - `stretch.test.ts`: typed length gives the exact edge length; fixed end doesn't move; a rectangle stays square; stretch under a non-identity correction gives true lengths; a curved edge reaches the typed arc length.
- **Riesberg Playwright** — new `scripts/check-surfaces.mjs`: Surfaces gated until the boundary closes; Sod over the lot minus the house; Pavers rectangle typed from 12′ to 16′ (stays square, other side unchanged); material change renames a default-named zone only; ↑ ↓ within Surfaces; solid vs see-through look; edge popover on a zone never changes the scale.
- All existing checks re-run (step1–3, undo, guides, modifiers, touch-nav, snap-feel, stretch, square, rect, overlap); `npm run lint`, `npm run typecheck`, `npm test`.

## 10. Docs
- `docs/PRD.md`: workflow step 3, build-steps table (Step 4 = Surfaces, stage 1), new §6.8 Surfaces.
- `docs/conversations/2026-10-15-surfaces.md`: distilled decisions.
- Design-system artifact: new colour and opacity tokens.
