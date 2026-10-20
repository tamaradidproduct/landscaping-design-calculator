# Plant and object symbols

Date: 2026-10-17 · Status: draft for review · Builds on PR 33 (hidden layers, `hiddenLayers` / `hiddenSections`).

## Goal

Let the contractor drop plants and objects from the Landscaping symbols library (Figma `0B2UpvIGBFOE1ZEDx8rXPR`) onto the plan at true size, move, rotate and delete them, hide them, and see a live **plant list** (symbol, name, category, quantity, photo). PRD: "Plant symbols at true mature size", "Objects", and the quantity take-off.

## Decisions (from the brainstorm)

- **Plants and objects together.** 51 plants and 14 objects (the PRD's "~47 / 17" is stale; Figma's Objects section also holds three report variants that are not objects).
- **One symbol per tap**; placing stays armed until Done or Esc.
- **Sizes researched online**, source and range kept per item; you review the table before it ships.
- **Objects and plants can rotate.**
- **Plant list in the app now**, without the water-consumption table (it comes later).
- Out of scope: water table, plant growth over time, linear / point / utility surfaces (fences, walls, edging, stepping stones, dry river, gas / electric / drainage markers), PDF export, pricing.

## Library

Bundled data built by `plan-builder/scripts/build-symbols.mjs`, like the textures.

| Kind | Families |
|---|---|
| Plants (51) | Evergreen trees 3, Deciduous trees 3, Accent trees 6, Accent shrubs 4, Privacy shrubs 4, Large shrubs 8, Perennials 14, Ground covers 1, Ornamental grasses 5, Other 3 |
| Objects (14) | Firepit, Boulder, Planter box, Hot tub, Monkey bars, Playground, Water feature, Trampoline, Swing set, Bubbling boulder, Seating wall, Outdoor lighting, Outdoor grill, Spigot |

Per symbol (`src/symbols.ts`, data in `scripts/symbol-sources.mjs` plus `src/assets/symbols/symbols.json`):

```ts
interface Symbol {
  id: string;            // kebab-case canonical name, e.g. 'blue-spruce'
  name: string;          // the card title, e.g. 'Blue Diamond Spruce'
  kind: 'plant' | 'object';
  family: string;        // horticultural family for plants; 'Objects' otherwise
  category: string;      // the card's small label, e.g. 'Evergreen tree'
  art: string;           // plan-view image URL (transparent, shadow included)
  photo?: string;        // reference photo (plants)
  size: { w: number; d: number }; // feet: plants w = d = mature spread; objects their footprint
  sizeSource: { url: string; note: string; approximate?: boolean };
}
```

- **Assets** are exported from Figma at source resolution (plan art about 512 px, photo about 320 px, WebP) with the Figma MCP `download_assets`, picking the plan art by size and transparency per symbol. A 64 px thumbnail per symbol is used in the picker, so full art loads only when placed.
- **Naming guard.** Figma's component names, card names and card titles disagree (e.g. "Blue spruce" vs "Blue Diamond Spruce", "Boulder" vs "Colorado Buff"). `symbol-sources.mjs` maps each Figma symbol id to one canonical id, name and family; a test checks the three names line up and every symbol has art, a photo (plants), a category and a size.
- **Sizes.** Researched from extension services and botanical-garden pages (plant mature spread) and manufacturer dimensions (objects). The typical value is used, with the range and URL kept in `sizeSource`. A symbol with no source uses its family's typical size and is marked `approximate`. The table is reviewed before merging.

## Plan model

`PlanState` gains `symbols?: Record<string, PlacedSymbol>`:

```ts
interface PlacedSymbol { id: string; symbol: string; x: number; y: number; rot?: number } // page points, degrees
```

- Validated on load like outlines: known library id, finite numbers; an unknown `symbol` id is an invalid plan.
- Undoable (in the editor snapshot) except visibility, which reuses `hiddenLayers` (a placed symbol's id) and `hiddenSections` (new section id `symbols`, between Surfaces and Outlines).
- Ids `y1`, `y2`, … Group state is derived (same `symbol`), not stored.

## Placing and editing

- **Layers section "Plants & objects"** (between Surfaces and Outlines) with **Add…** opening a list picker: search box, then families as captions with thumbnail rows (the same list style as the material picker).
- **Place:** pick a symbol, a ghost follows the pointer at true size, each tap places one; Done or Esc ends. Plants are circles of the mature spread (`size.w` ÷ `ftPerPt` × px per point); objects use their footprint. With no plan scale yet, a default size in page points is used (like textures), and the symbol follows zoom.
- **Edit:** tap a symbol to select (a halo), drag to move, arrow keys nudge. The row's card shows name, **Rotate** (− / + 15° and a typed angle) and Delete. Hidden symbols can't be selected or tapped.
- **Layers rows** are grouped by symbol ("Blue spruce × 3") with an eye per group and one on the section header. Selecting a symbol on the plan opens its group.
- Symbols draw above surfaces and below outline strokes; no clipping. *(Superseded by `2026-10-19-layering-design.md`: sections are reorderable, Plants & objects is on top by default, and symbols stack by type and size.)*

## Plant list

A collapsible panel section under Layers, live from the placed symbols:

- **Surfaces used:** swatch and name.
- **Plants:** symbol art, name, category (small caps), **quantity**, photo. Sorted by family, then name.
- **Objects:** symbol art, name, quantity.
- Empty state: "Placed plants and objects appear here." Hidden symbols still count.

## Tests

- Unit: library integrity and naming guard; `fromDoc` / `toDoc` for `symbols` (round trip, unknown symbol id, bad numbers); placement geometry (true-size diameter from `ftPerPt`, unscaled fallback, rotation); counts per symbol; group rows.
- Playwright (Riesberg): `scripts/check-symbols.mjs` — pick, place two, move, rotate, delete, undo, hide a group and the section, reopen, plant list counts. Existing checks still pass.
- Docs: PRD (§6.x symbols, plant list; correct the counts), decision summary `docs/conversations/2026-10-17-symbols.md`; design-system tokens for any new colours (halo, ghost) via `npm run tokens`, and the design-system artifact.

## Risks

- Picking the right plan-art image per Figma symbol (a card holds about five images: art, shadow, photo). Mitigation: a contact-sheet check and per-symbol overrides in `symbol-sources.mjs`.
- Bundle size: about 65 symbols × (art + photo + thumb). Target under 8 MB added; thumbnails keep first load light.
- Research accuracy: ranges vary by cultivar; the review table and the `approximate` flag make that visible.
