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
} as const;

export const MAGNIFIER = { size: 132, zoom: 3, gap: 40, crosshair: 14, crosshairWidth: 1.5 } as const;
export const POPOVER = { margin: 8, below: 24, fallbackWidth: 300, fallbackHeight: 170 } as const;
export const TIP = { offset: 14 } as const; // edge-length tip, down-right of the pointer
