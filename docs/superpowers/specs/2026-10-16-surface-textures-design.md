# Surface textures from the Landscaping symbols library

Date: 2026-10-16 · Status: draft for review

## Goal

Replace the 11 hardcoded flat-colour materials with the area-surface textures from the Figma "Landscaping symbols" library (`0B2UpvIGBFOE1ZEDx8rXPR`, Surfaces section `170:1977`), drawn at true real-world scale. The PRD already makes the library the source of truth for materials (§Library).

## Scope

In: the 29 area textures below, true-scale tiling, grouped picker, alias map for saved plans, design-system token cleanup.

Out (go in the symbols spec): linear surfaces (fence, veneer wall, retaining wall, white stone edging, dry river), point surfaces (stepping stones), utility markers (gas, electric, drainage), plants, objects, quantities.

## Materials (29)

| Family | Materials |
|---|---|
| Turf & seed | Premium sod, Putting green, Festival turf, Native seed, Hydroseed clover |
| Mulch & soil | Wood mulch, Rubber mulch, Sand, Garden soil |
| Rock & gravel | White river rock, White glacier river rock, Mesa cobble stone, Colorado buff rock, Blue glacier cobble, Clear mountain granite, Mountain granite rock, Black granite rock, Polished black rock, White quartz, Granite fines |
| Pavers & stone | White pavers, Dark gray pavers, Belgard pavers, Pavers (classic), Red flagstone, Red crushed concrete |
| Concrete | Brushed concrete, Stamped concrete |
| Decking | Deck wood |

Dropped as strays or duplicates: second "Putting green" (`173:4023`), "Breeze/granite fines" (`2271,590`, duplicate of Granite fines), off-grid "Pavers" (`174:1441`). Final names follow the Figma card titles.

## Data model (`materials.ts`)

```ts
interface Material {
  id: MaterialId;        // kebab-case of the name, e.g. 'premium-sod'
  name: string;
  family: Family;
  trade: Trade;          // kept for later quantities; not used by the picker
  tile: string;          // asset URL (Vite import)
  tileFt: number;        // real-world repeat; default 2
  edge: string;          // zone edge colour, average of the tile, computed at export
}
```

`MaterialId` becomes the union of the 29 ids. `LEGACY_MATERIAL_IDS` maps the old ids on load:

| Old | New |
|---|---|
| sod | premium-sod |
| turf | festival-turf |
| mulch | wood-mulch |
| river-rock | white-river-rock |
| decorative-rock | mesa-cobble-stone |
| gravel | clear-mountain-granite |
| pavers | pavers-classic |
| flagstone | red-flagstone |
| concrete-brushed | brushed-concrete |
| concrete-stamped | stamped-concrete |
| decking | deck-wood |

Plans are remapped when loaded (plan model / stores); nothing in storage is rewritten until the next save.

## Assets

- Export each swatch image from Figma (REST images endpoint or `get_design_context` asset URLs) at 2× of 184 px, then resize to 256 px and encode WebP (~30 KB each, ~1 MB total).
- Store in `plan-builder/src/assets/surfaces/<id>.webp`; Vite hashes and bundles them.
- Add `webp` to the PWA `globPatterns` so textures are precached for offline use.
- A script `plan-builder/scripts/export-surfaces.mjs` documents the export (node ids, names) and computes `edge`, so the list is reproducible. The generated list is committed as data.
- Visual check for seamless tiling; if a tile shows seams, mirror-tile it (2×2 mirrored, then downscale) at export.

## Rendering (`patterns.ts`)

- One `<pattern>` per material: `patternUnits="userSpaceOnUse"`, containing an `<image>` of the tile. Size = `tileFt × pxPerFt` in plan pixels, so it scales with the plan.
- The pattern size is updated whenever the view (zoom) or the plan scale changes, through the `view.ts` and `scale.ts` hooks the overlay already uses. Updates are batched per animation frame.
- The picker and Layers swatches use a fixed-size render of the same tile (screen px), independent of zoom.
- Zone edge stroke uses `material.edge` shaded as today (`mix-material-edge`, `color-material-shade` stay).

## Picker (`surfaces-ui.ts`)

Chips grouped by family (six groups, the table order above), each chip showing a texture thumbnail and the name. The hardscape/softscape grouping is removed from the UI.

## Design tokens

Remove the 11 `color-material-*` tokens from `design-system/tokens.json` and regenerate with `npm run tokens`. Keep `color-material-shade` and `mix-material-edge`. Update the Plan Builder design-system artifact to match, as the repo CLAUDE.md requires.

## Testing

- `materials.test.ts`: 29 unique ids and names, every material has an existing tile file, every family is non-empty, every legacy id maps to a valid new id.
- New unit test for the pattern-size function (`tileFt`, scale and zoom to px).
- Plan load test: a saved plan with old ids loads with remapped ids.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and the Riesberg Playwright checks (`scripts/check-surfaces.mjs` updated to the new ids).
- Manual: draw a zone, zoom in and out, confirm the texture scales with the plan; check performance on a tablet.

## Risks

- Swatches may not tile seamlessly (mitigation above).
- Updating many patterns on every zoom frame could be slow; only patterns used by visible zones need updating, and updates are frame-batched.
- Bundle size grows by about 1 MB (within the PWA cache limit).

## Docs

Update PRD §6.8 (materials, textures, true-scale tiling) and add a decision summary `docs/conversations/2026-10-16-surface-textures.md`.
