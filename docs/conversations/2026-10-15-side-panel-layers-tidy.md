# Plan Builder: side panel, layers, stretched plans and tidying (2026-10-14 → 2026-10-15)

Distilled summary of the working session behind this PR. Current requirements: `docs/PRD.md` §6.1–6.3, 6.7.

## Layout
- The floating top toolbar is gone. A **side panel** is docked on the right (280 px, always shown once a plan is open; collapsible was considered and deferred): **Undo / Redo** · **zoom − / + / Fit page** · **Layers**.
- **Layers → Outlines** replaces the Outline menu: one row per outline (tap to select), then suggestions while missing — **Plot boundary**, **House**, **Custom outline…** with quick picks (Driveway, Patio, Porch, Walk, Deck, Garage, Shed, Pool) or a typed name. Sections by trade come later.
- **Plot plan layer** pinned to the bottom of Layers: show/hide (hidden = no snapping to its lines), the file name with a pencil to open another file ("Open another" removed), and an opacity slider.
- **Snap toggle** sits in the floating bar at the bottom of the plan and only shows while drawing or editing an outline.
- The plot area shows quietly under the Plot boundary row.
- **No panel over the plan.** The bottom panel was too large; its contents moved into the Layers list: the row of the outline being drawn or selected **expands into a card** (step text, nudge arrows, Close shape / Cancel while drawing; rename in place, Square all corners, Redo outline, Delete, Layer order when selected). Close shape lives only in the card (double-tap or tapping the first corner also close).

## Selection
- Unselected outlines show only their shape and name; the selected one keeps the existing selected look plus its corners and bend squares. **Select first, then edit:** only the selected outline can be dragged. The boundary is selected from its edges or its Layers row.

## Drawing tools
- **Freehand | Rectangle** in a floating bar at the bottom of the plan while an outline is being drawn (with the Snap toggle); **X** switches; remembered on the device.
- **Rectangle** = drag from corner to opposite corner (or two taps), **square to the plan**; angled shapes use Freehand (three-tap angled rectangles were considered and dropped).
- The pointer tells the tools apart: Freehand a dot; Rectangle a ⌐ plus dashed guides across the plan. A small tool glyph next to the pointer was tried first and was too subtle; a tool-name label was judged unnecessary.

## Overlapping layers
- Overlaps are allowed and **cut by layer order**: a layer higher in Layers cuts the ones below; each keeps its drawn shape, but only its visible part is shown, tapped and (later) measured. Chosen over cutting shapes once, so editing the house later still reshapes the porch.
- New layers go to the bottom, except one drawn **wholly inside** another, which goes just above it. **Layer order ↑ ↓** in the card changes it.
- The **plot boundary clips everything inside it** (features now, hardscape and softscape later) and is never cut.
- Later: layers that sit over others without cutting them (a raised deck or balcony over hardscape/softscape).

## Scale and stretched plans
- Plans can be stretched differently across and down (scans, prints). Every typed edge length is kept as a reference; with references running both ways the app fits separate across/down scales and **stretches the picture and outlines back to true shape** (chosen over correcting only the numbers, because plant symbols at true size would otherwise be ovals).
- The correction is stored as a general 2×2 transform so **skew** can be handled later from more references.
- The scale itself isn't shown on screen (only in the message after typing a length); a typed length is updated or removed from its edge's popover.
- **Printed lot size** comparison removed: not needed.

## Tidying shapes
- First attempt (move the corner onto a right angle between its neighbours) left walls slightly tilted on a real plan. Replaced by **alignment**: Square lines a corner up with its neighbours (height from the neighbour along an across edge, left–right position from the one along a down edge). **Square all corners** does it for the whole outline. The chip keeps the angle readout and the "Square" label.
- Across/down follow the outline's own direction (the direction most of its edge length agrees with), so rotated houses work and a long slanted lot line can't tilt it. Only edges within 8° of across/down are lined up; slanted edges and curves are left alone.
- Kept for the plot boundary too, knowing it flattens real slants under 8° (Riesberg's top line is 1.3° off flat).

## Validation (Riesberg)
- Top + left lengths typed: plan stays unstretched (×1.0001); right edge 155.53′ vs printed 155.55′. A left length typed 10% long stretches the plan ×1.100 down; removing it undoes that.
- Square: an off corner goes from 92.4° to 90.000° with only it moving; the side line meeting the curved street already reads 90° (lot lines are radial).
- Overlap: house 100×60 = 6000 pt²; a porch rectangle drawn after it shows 2000 pt² (its 20×20 under the house cut away); moving the porch up flips it (house 5600, porch 2400); the boundary trims the porch to 1200.
