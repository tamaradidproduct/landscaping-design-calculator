# Plant nursery sizes (for review)

Researched 2026-10-21. For each of the 51 plants in [symbol-sizes.md](symbol-sizes.md): up to three plan-view sizes (single canopy diameter, ft; trees get three, everything else two, Corn and Vegetable plants one): the **smallest installed** (the smallest container commonly planted: 1 gal for perennials, grasses, ground covers and vegetables), an **in-between** size (the container a landscaper most often plants, or a mid container where the smallest is already typical), and the **mature** spread. Mature spreads are in `symbol-sizes.md`; this doc only adds install-time sizes. ⚠️ marks 15 approximate rows (assumed cultivar, size inferred from a similar plant, or no usable listing). Nothing here changes app code.

**Read this first:** nurseries list *height* by container and *mature* width, but almost never the width of the plant you buy. Heights below are anchored on real listings where found (named in the Source column); **widths are derived** by the conversion rules in Methodology, and are capped at the mature spread. Treat footprints as ±25%.

## Methodology

- **Container sizes (trade gallons).** `#N` is a nursery class, not liquid gallons. Pot dimensions used for sanity checks (Sooner Plant Farm): #1 ≈ 6–8 in, #2 ≈ 9 in, #3 ≈ 10 in, #5 ≈ 11 in, #7 ≈ 14 in, #10 ≈ 15 in, #15 ≈ 17 in, #25 ≈ 22 in wide ([source](https://soonerplantfarm.com/page/Pot-Size-Details)).
- **Trees.** Box size to caliper from ANSI Z60.1 (via UF/IFAS): 20 in box ≈ 1.25–2 in caliper, 24 in box ≈ 1.5–2.5 in, 60 in box ≈ 4–6 in ([source](https://hos.ifas.ufl.edu/woody/box-size.shtml)). TxDOT treats 15 gal / 1.5–3 in caliper as the standard landscape tree and 5 gal as mass-planting stock ([source](https://www.txdot.gov/manuals/des/lad/chapter-3--landscape-development/setion-4--plant-selection/plant-sizing.html)). Real heights by pot: 5 gal ≈ 4–6 ft, 15 gal ≈ 6–8 ft for redbud and similar (Sooner Plant Farm, [redbud](https://soonerplantfarm.com/plant/redbud-eastern), [bur oak](https://soonerplantfarm.com/plant/oak-bur)). Canopy at install ≈ 0.4–0.6 × height for deciduous and ornamental trees, so 5 gal ≈ 2–3 ft, 15 gal ≈ 3–5 ft, 2 in caliper (≈ 24 in box) ≈ 5–7 ft.
- **Evergreen trees and conifers.** Sold by height as well as pot. Pyramidal spruce and pine: width ≈ 0.5–0.65 × height (Blue Diamond 5 gal is 2–3 ft tall, 7 gal 3–4 ft; [Sooner](https://soonerplantfarm.com/plant/spruce-blue-diamond-blue)). Columnar junipers and arborvitae: width ≈ 0.25–0.35 × height (Skyrocket 5 gal is 3–5 ft tall; [Sooner](https://soonerplantfarm.com/plant/juniper-skyrocket)).
- **Shrubs.** Width ≈ 1 gal 0.75–1.25 ft, 2 gal 1.25–1.75, 3 gal 1.5–2.5, 5 gal 2–3, 10 gal 3.5–4.5, scaled down (never above mature spread) for compact plants.
- **Perennials, grasses, ground covers.** 4 in pot ≈ 0.3–0.5 ft, quart ≈ 0.5–0.75, 1 gal ≈ 0.75–1.25, 2 gal ≈ 1–1.75, 3–5 gal grasses ≈ 2–4 ft. Capped at mature spread (a 1 gal can't be wider than the plant's mature width). Retailers confirm 1 gal is the usual perennial and grass size ([CSU Extension](https://planttalk.colostate.edu/topics/annuals-perennials/1017-perennials-plant)).
- **Consistency rule.** Smallest < in between < mature for trees, smallest < mature for other plants (— means not used), and install footprints never exceed the mature spread in `symbol-sizes.md`. Other containers considered (e.g. 15 gal, 8 ft B&B) were dropped to keep three sizes.
- **Source preference.** (1) A nursery listing that names a container and a height or width; (2) university extension / botanic garden; (3) grower size guides and the conversion rules above. Nursery pages list mature size for ornamental trees far more often than install size, so the Source column links the page used for the plant's range and container availability.
- **Colorado Front Range.** Large evergreens are usually sold balled-and-burlapped by height (6 ft, 8 ft, 10 ft) rather than by pot; deciduous shade and ornamental trees are 15 gal or B&B by caliper (1.5–2 in). Xeric natives and Plant Select perennials and grasses are sold in 1 gal (sometimes 4 in or quart). I could not find current Front Range retailer spec pages (Fort Collins Nursery, Tagawa Gardens and others publish no size sheets online), so the in-between container rests on general practice, not a cited local page.

## Plants (51)

Sizes are canopy diameter in feet, shown as container: footprint, where each footprint is the midpoint of the researched range (or an interpolated 2 gal value where the researched in-between was below 1 gal). "Mature" is the spread from `symbol-sizes.md`.

| Plant | Family | Smallest installed (ft) | In between (ft, trees only) | Mature (ft) | Basis / range found | Source |
|---|---|---|---|---|---|---|
| Blue Diamond Spruce | Evergreen trees | 5 gal: 1.75 | 6 ft B&B: 4.5 | 10 | 5 gal is 2–3 ft tall, 7 gal 3–4 ft (Sooner); width ≈ 0.6 × height; mature 10 | [source](https://soonerplantfarm.com/plant/spruce-blue-diamond-blue) |
| Austrian Pine | Evergreen trees | 5 gal: 2 | 6 ft B&B: 4 | 30 | Nurseries list 5 gal and #15; width ≈ 0.5 × height; mature 30 | [source](https://shop.wattersgardencenter.com/products/watters/plants/trees/evergreen_trees/tr-eg-5-pine_aust) |
| Fat Albert Spruce | Evergreen trees | 5 gal: 2.25 | 6 ft B&B: 4.5 | 10 | 5 gal, 15 gal and 5–6 ft B&B listings exist; broader than Blue Diamond (0.65 × height); mature 10 | [source](https://shop.mahoneysgarden.com/product/blue-spruce-colorado-fat-albert-5-6ft-bb/) |
| Rocky Mountain Maple ⚠️ | Deciduous trees | 5 gal: 2.5 | 15 gal: 4 | 12 | Native multi-stem small tree; no nursery spec found, sized as a redbud-class tree; box size rare; mature 12 | [source](https://plants.ces.ncsu.edu/plants/acer-glabrum/common-name/rocky-mountain-maple/) |
| Japanese Maple | Deciduous trees | 3 gal: 1.25 | 15 gal: 4 | 20 | 15 gal listed 6–8 ft tall; dwarf cultivars much smaller; mature 20 | [source](https://terragreenhouses.com/product/japanese-maple-crimson-queen-5gal/) |
| Oak ⚠️ | Deciduous trees | 5 gal: 2 | 2 in caliper: 5.5 | 60 | Assumed bur oak; 15 gal is 6–8 ft tall (Sooner); slow, narrow when young; mature 60 | [source](https://soonerplantfarm.com/plant/oak-bur) |
| Snow Fountain Weeping Cherry | Accent trees | 5 gal: 2 | 15 gal: 3.5 | 8 | Grafted weeping standard, canopy builds slowly; mature 8 | [source](https://naturehills.com/collections/trees/products/white-snow-fountain-weeping-cherry) |
| Eastern Redbud | Accent trees | 5 gal: 2.5 | 15 gal: 4.5 | 30 | 5 gal 4–6 ft tall, 15 gal 6–8 ft (Sooner); mature 30 | [source](https://soonerplantfarm.com/plant/redbud-eastern) |
| Spring Snow Crabapple | Accent trees | 5 gal: 2.5 | 15 gal: 4.5 | 15 | Same tree-class rule; no container-specific listing found; mature 15 | [source](https://plants.westonnurseries.com/12130019/Plant/986/Spring_Snow_Flowering_Crab) |
| Lilac tree | Accent trees | 5 gal: 2.5 | 15 gal: 4.5 | 20 | Japanese tree lilac, tree-class rule; mature 20 | [source](https://nurseryguide.com/find_plants/syringa_reticulata) |
| Korean Lilac Tree ⚠️ | Accent trees | 5 gal: 1.75 | 15 gal: 3 | 6 | Assumed grafted tree-form Korean lilac (same assumption as the mature row); mature 6 | [source](https://trees.umn.edu/dwarf-korean-lilac-syringa-meyeri-palibin) |
| Ivory Silk Lilac Tree | Accent trees | 5 gal: 2.5 | 15 gal: 4 | 18 | Upright, narrow when young; tree-class rule; mature 18 | [source](https://seattle.gov/trees/trees-for-neighborhoods/past-plantings/ivory-silk-japanese-tree-lilac) |
| Lilacs | Accent shrubs | 1 gal: 1 | — | 10 | Lilacs ship up to 5 gal; shrub rule; mature 10 | [source](https://www.lexingtonky.gov/node/19360) |
| Dogwood ⚠️ | Accent shrubs | 1 gal: 1 | — | 10 | Assumed red twig dogwood; shrub rule; mature 10 | [source](https://www.csu.org/water-wise-plants/red-twig-dogwood) |
| Lavender | Accent shrubs | 1 gal: 1.25 | — | 2.5 | Compact shrub scaled to mature 2.5; 1 gal is the usual size | [source](https://edis.ifas.ufl.edu/publication/FP337/pdf) |
| Hydrangea | Accent shrubs | 1 gal: 1 | — | 5 | Bigleaf hydrangea; shrub rule, compact cultivars smaller; mature 5 | [source](https://www.boethingtreeland.com/plants/hydrangea-macrophylla-pink) |
| Skyrocket Juniper | Privacy shrubs | 5 gal: 1.25 | — | 2.5 | 2 gal 2–3 ft tall, 5 gal 3–5 ft tall (Sooner); columnar, mature 2.5 | [source](https://soonerplantfarm.com/plant/juniper-skyrocket) |
| Blue Arrow Juniper | Privacy shrubs | 5 gal: 1.25 | — | 2.5 | #5 listed; columnar like Skyrocket; mature 2.5 | [source](https://www.rogersgardens.com/collections/landscape-plants/products/01494953655) |
| Emerald Green Juniper ⚠️ | Privacy shrubs | 5 gal: 1.5 | — | 3.5 | No such juniper; sized as Emerald Green arborvitae (same proxy as the mature row); mature 3.5 | [source](https://shop.mahoneysgarden.com/?p=223231) |
| Golden Bamboo | Privacy shrubs | 1 gal: 0.88 | — | 6 | #5 listed (Roger’s Gardens); runner, so the install clump understates where it ends up; use a root barrier; mature 6 | [source](https://www.rogersgardens.com/products/01494911425) |
| Fernbush | Large shrubs | 1 gal: 1 | — | 5 | Shrub rule; Front Range natives often sold as 1 gal; mature 5 | [source](https://adams.extension.colostate.edu/horticulture/fernbush/) |
| Japanese Fern ⚠️ | Large shrubs | 1 gal: 1.25 | — | 1.75 | Assumed Japanese painted fern (perennial, not a shrub); perennial rule; mature 1.75 | [source](https://www.gertens.com/japanese-painted-fern.html) |
| Panchito Manzanita | Large shrubs | 1 gal: 1 | — | 4 | 1 gal and 5 gal listings exist (Watters, Cornell Farms); slow, mound; mature 4 | [source](https://cornellfarms.com/products/arctostaphylos-x-c-panchito-5-gal-manzanita) |
| Mugo Pine ⚠️ | Large shrubs | 1 gal: 0.88 | — | 6 | Assumed dwarf (Slowmound class); 1, 2, 3, 5 gal listed; slow; mature 6 | [source](https://shop.bathgardencenter.com/item/055210081035/Pine-Slowmound-Mugo-Pinus-mugo-Slowmound-3-gallon?cid=25) |
| Pinyon Pine | Large shrubs | 5 gal: 2 | — | 20 | Very slow, so wide for height only when large; conifer rule; mature 20 | [source](https://www.csu.org/water-wise-plants/pinyon-pine) |
| Rubber Rabbitbrush | Large shrubs | 1 gal: 1 | — | 4.5 | Native, fast; 1 gal is the usual size; mature 4.5 | [source](https://shop.sbbotanicgarden.org/products/ericameria-nauseosa-rabbitbush) |
| Boxwood ⚠️ | Large shrubs | 1 gal: 0.88 | — | 3 | Assumed Green Mountain; compact so scaled to mature 3 | [source](https://plants.ces.ncsu.edu/plants/buxus-green-mountain/common-name/green-mountain-boxwood/) |
| Globe pine ⚠️ | Large shrubs | 1 gal: 0.62 | — | 3 | Assumed dwarf globe mugo (‘Mops’); very slow; mature 3 | [source](https://bylands.com/product/pinus-mugo-mops/) |
| Creeping Phlox | Perennials | 1 gal: 1 | — | 1.75 | Perennial rule; mat that spreads; mature 1.75 | [source](https://www.provenwinners.com/plants/phlox/eye-candy-creeping-phlox-moss-pinks-phlox-subulata) |
| May Night Salvia | Perennials | 1 gal: 1 | — | 1.5 | Perennial rule; mature 1.5 | [source](https://dutchbulbs.com/product/Salvia-MayNight) |
| Basket of Gold | Perennials | 1 gal: 1 | — | 2 | Perennial rule; mature 2 | [source](https://plants.kennedyscountrygardens.com/12150017/Plant/2159/Gold_Dust_Basket_Of_Gold) |
| Black Eyed Susan | Perennials | 1 gal: 1 | — | 2 | Perennial rule; mature 2 | [source](https://www.gertens.com/goldsturm-black-eyed-susan.html) |
| Coneflower ⚠️ | Perennials | 1 gal: 1 | — | 1.5 | Perennial rule; only cultivar pages for mature size; mature 1.5 | [source](https://www.rhs.org.uk/plants/312612/echinacea-purpurea-catharina/details) |
| Purple Coneflower ⚠️ | Perennials | 1 gal: 1 | — | 1.5 | Same as Coneflower; mature 1.5 | [source](https://www.rhs.org.uk/plants/285237/echinacea-purpurea-purity/details) |
| White Nugget (Ice plant) | Perennials | 1 gal: 0.7 | — | 0.8 | Low mat, capped at mature 0.8; 4 in or quart usual | [source](https://www.gardenia.net/plant/delosperma-white-nugget) |
| Blue Mist Spirea | Perennials | 1 gal: 1 | — | 3 | Sub-shrub (caryopteris); perennial/shrub rule; mature 3 | [source](https://selectors.extension.illinois.edu/node/4147) |
| Gardilla Geranium ⚠️ | Perennials | 1 gal: 1 | — | 2 | No “Gardilla” listing, sized as a hardy geranium; mature 2 | [source](https://conservationgardenpark.jvwcd.gov/plants/1704/hardy-geranium) |
| Colorado Blue Columbine | Perennials | 1 gal: 0.75 | — | 1 | Perennial rule, capped at mature 1; clumping | [source](https://rainyside.com/plant_gallery/perennials/Aquilegia_coerulea.html) |
| Cockscomb | Perennials | 1 gal: 0.75 | — | 1 | Annual bedding plant, sold in packs and 4 in pots; capped at mature 1 | [source](https://plantdatabase.kpu.ca/Plant/cecr) |
| Sage ⚠️ | Perennials | 1 gal: 1.15 | — | 2.5 | Assumed garden sage; shrubby perennial; mature 2.5 | [source](https://ucanr.edu/node/103609) |
| Lily of the Valley | Perennials | 1 gal: 0.8 | — | 1.5 | Rhizome ground cover, sold as pips or small pots; mature 1.5 | [source](https://plants.ces.ncsu.edu/plants/all/convallaria-majalis/) |
| Snapdragons | Perennials | 1 gal: 0.75 | — | 1 | Sold as bedding packs and 4 in pots; mature 1 | [source](https://www.depts.ttu.edu/plantresources/Pages/directories/landscape-info-sheets/herbaceous-info/Antirrhinum_majus.php) |
| Wooly Thyme | Ground covers | 1 gal: 0.9 | — | 1.25 | Planted from 4 in pots or flats, spreads in 1–2 seasons; mature 1.25 | [source](https://www.csu.org/water-wise-plants/woolly-thyme) |
| Russian Sage | Ornamental grasses | 1 gal: 1 | — | 3 | Sub-shrub in the grasses family of the symbol library; perennial rule; mature 3 | [source](https://www.depts.ttu.edu/plantresources/Pages/directories/landscape-info-sheets/herbaceous-info/Perovskia_atriplicifolia.php) |
| Maiden Grass | Ornamental grasses | 1 gal: 1.25 | — | 5 | Grass rule; clumps grow fast to full size in 2 seasons; mature 5 | [source](https://devilmountainnursery.com/miscanthus-sinensis) |
| Japanese Forest Grass | Ornamental grasses | 1 gal: 1 | — | 1.5 | Grass rule; mature 1.5 | [source](https://almanacplanting.com/products/hakone-grass) |
| Feather Reed Grass | Ornamental grasses | 1 gal: 1 | — | 2 | ‘Karl Foerster’ sold in 1 and 3 gal (Bath Garden Center, Classy Groundcovers); capped at mature 2 | [source](https://shop.bathgardencenter.com/item/032200684018/Feather-Reed-Grass-Calamagrostis-Karl-Foerster-1-gallon?cid=34) |
| Blue Grama Grass | Ornamental grasses | 1 gal: 1 | — | 1.75 | Native bunchgrass, also sold as plugs; mature 1.75 | [source](https://nativegardeners.com/products/grama-blue) |
| Arizona Star | Other | 1 gal: 0.65 | — | 7 | Boething lists #5, #10, 24 in box; slow-growing rosette; not reliably winter-hardy on the Front Range; mature 7 | [source](https://www.boethingtreeland.com/plants/agave-weberi-arizona-star) |
| Corn ⚠️ | Other | — | — | 1 | Annual vegetable, sown or transplanted; footprint taken as spacing, same assumption as the mature row; mature 1 | [source](https://gardeningsolutions.ifas.ufl.edu/plants/edibles/vegetables/corn/) |
| Vegetable plants ⚠️ | Other | — | — | 2 | Generic: no single plant (tomato, pepper, etc.); family default; mature 2 | [source](https://gardeningsolutions.ifas.ufl.edu/plants/edibles/vegetables/) |

## Needs your judgement

- **Which container is 'in between' (trees only):** 15 gal vs 1.5 in B&B for ornamental trees, and 5 gal vs 6 ft B&B for spruces and pine; I used the most common choice.
- **Shrubs now have only a smallest size:** it is the smallest container (often 1 gal, about 1 ft) even though shrubs are usually planted at 5 gal (about 2–3 ft). Decide whether shrubs should use 5 gal as their install size.
- **Do install footprints cap at the mature spread?** Applied here (White Nugget stays at or under 0.8 ft). If the app lets the toggle show install above mature, small plants like Columbine and Cockscomb need review.
- **Families that don't match the plant:** Russian Sage is in “Ornamental grasses” and Japanese Fern in “Large shrubs” in the library; I sized them as what they are (sub-shrub, perennial).
- **Vegetable and Corn:** one size only (the mature spread), no container picker.
- **Arizona Star:** kept as a plan symbol (the app is not Colorado-only).
- **Golden Bamboo:** a running bamboo; the install footprint will be wrong within a season or two.
- **All ⚠️ rows:** they inherit the cultivar assumption from `symbol-sizes.md`; fixing that fixes both docs.

## What is least reliable

- **Widths at install, everywhere.** Nurseries almost never list them; they come from height-to-width ratios and are ±25%. Only heights for a handful of plants (Blue Diamond, Skyrocket, redbud, bur oak, Japanese maple) are directly listed.
- **In-between container choice.** No Colorado retailer size sheet was found; the container chosen reflects general practice.
- **Large evergreens and 2 in caliper trees.** Sold by height or caliper, not pot, and width varies a lot by grower and sheared vs. open form.
- **Rocky Mountain Maple, Korean Lilac Tree, Emerald Green, Corn and Vegetables.** Assumed type or no listing at all.
- **Fat Albert and Austrian Pine at 15 gal.** Retailer pages disagree (one lists a 15 gal Fat Albert with 4–6 ft width, another 10 ft); I used the conversion rule.
