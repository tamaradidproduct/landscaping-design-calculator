// Geometry tokens for marks drawn on the plan overlay and the magnifier, in screen px.
// Colours, strokes and type for the same marks live in styles/tokens.css (--color-*, --stroke-*).
export const MARK = {
  corner: 6,            // corner dot radius
  cornerClose: 7,       // first corner while it can close the shape
  closeRing: 16,        // dashed ring around the first corner
  ring: 11,             // selected-corner ring / placing ring
  bendHandle: 10,       // square handle in the middle of an edge
  bendHandleRadius: 2,
  snapHalo: 16,
  snapCorner: 8,        // half-size of the square corner-snap mark
  snapLine: 9,          // half-size of the diamond on-line mark
  hoverDot: 4,
  crosshairOuter: 18,
  crosshairGap: 5,
  labelDx: 16,          // snap label offset from the point
  labelDy: -14,
  guideArm: 12,         // right-angle hint arm length
  guideLabelDx: 10,
  guideLabelDy: 24,
  cornerBracket: 8,     // rectangle tool: arm length of the ⌐ mark at the pointer
  guideSpan: 100000,    // rectangle tool: the guides run this far each way (the plan clips them)
  roundHandle: 6,       // surfaces: radius of the round-corner handle on the selected corner's bisector
  roundHandleMin: 22,   // …and its least distance from the corner (screen px), so it doesn't hide under the corner dot
} as const;

export const MAGNIFIER = { size: 132, zoom: 3, gap: 40, crosshair: 14, crosshairWidth: 1.5 } as const;
export const POPOVER = { margin: 8, below: 24, fallbackWidth: 300, fallbackHeight: 170 } as const;
export const TIP = { offset: 14 } as const; // edge-length tip, down-right of the pointer
export const SQUARE_CHIP = { dx: 20, dy: -60, margin: 8 } as const; // "87° · Square" chip, up-right of the selected corner

/** Hit areas around things that can be pressed or hovered on the plan, in screen px. */
export const HIT = {
  corner: 24,           // a corner dot
  edge: 16,             // an edge (tap to see or type its length)
  bend: 20,             // an edge's middle square
  zoneCorner: 14,       // a selected surface's corner dot (tighter, so its sides and round handle stay reachable)
  zoneSide: 10,         // the drawn straight part of a selected surface's side (push it)
  roundHandle: 13,      // the round handle (small, so the sides next to it stay easy to grab)
  roundReveal: 24,      // from the drawn line at a selected surface's corner (its arc, once rounded): shows the round handle
} as const;

/** Gesture thresholds: distances in screen px, times in ms. */
export const GESTURE = {
  touchOffset: 56,      // placing on touch: the point rises this far above the finger once it drags
  doubleTapMs: 350,
  holdMs: 450,          // touch: press and hold this long without moving to place freely
  holdSlop: 6,          // finger jitter still counted as holding still (or as a tap)
  rectMin: 8,           // a rectangle narrower or shorter than this wasn't meant
  ownSnap: 22,          // snap to the outlines' own corners and edges first
  release: 34,          // once snapped, the point stays put until the pointer moves this far away
} as const;
