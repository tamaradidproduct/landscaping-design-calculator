# Plan Builder: direction reset and steps 1–2c (2026-10-12 → 2026-10-13)

Distilled summary of the working sessions behind PR #1. Full decision log: `docs/PRD.md`, Appendix B.

## Direction
- The Figma-based quantity takeoff was dropped: it needed a designer in the loop. Code archived as tag `archive/figma-takeoff-hardening`.
- New direction: contractors build a scaled landscape plan themselves, on site, on a tablet, starting from the homeowner's plot plan PDF. Outputs later: a plan sheet and a priced proposal as a PDF.
- Work proceeds one small, agreed step at a time after a broad "zone drawing" prototype was judged unusable (archived as `archive/zone-drawing-lab`).

## Decisions by step
- **Step 1 — open the plot plan:** PDF picked on the device and never uploaded; fills the screen; smooth pinch/pan; sharp when zoomed; offline. PDF.js was too slow on real plans whose text is drawn as shapes (~12 s), so rendering uses PDFium (WebAssembly) in a worker.
- **Step 2 — outline first, then set the scale:** outlining the plot boundary (or a structure) and typing one printed edge length beats tapping a scale bar; the other edges and the printed lot area cross-check it. Pure drawing, not dependent on PDF vector data, so it works for scans too.
- **Snapping:** on by default, to lines and corners in the plan's pixels; guides (square, straight, aligned) take priority over the image; Shift = 45° steps while still snapping; easy to bypass (Snap toggle, Option/Alt, touch press-and-hold). Points must always stay freely movable.
- **Curves:** drag an edge's middle to bend it into an arc.
- **Touch:** one finger draws, two fingers always move; taps place exactly under the finger.
- **Undo/redo** for every step, including each dot of an unfinished outline.

## Validation (Riesberg plot plan, 1" = 30')
- Left edge 138.30′ vs printed 138.31′; street curve 62.03′ vs 62.02′; lot area +0.7% vs printed 13,504 sq ft.
- The plan's two printed scales disagree (1"=30' and 1"=20'); only 1"=30' is right — reading the printed scale is unreliable.

## Step 3 — existing features (built 2026-10-13)
- The separate "House" outline is gone; the house is one of any number of named **existing features**, drawn with the same tool and shown as grey fill + name. The plot boundary stays special.
- Naming happens before drawing (quick picks or typed). Tap inside a feature to rename, redraw or delete it; overlaps allowed, the smallest feature under the tap wins.
- Found while checking on Riesberg: tapping a corner shared with another outline dragged that outline. While drawing, other outlines' corners are now snap targets only.

## Next
- Step 4+: material zones, plant symbols, edging/walls — to be defined.
