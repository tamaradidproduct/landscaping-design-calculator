// The size of the outline labels (the House, Driveway… names) on the plan: they scale with the plan as it zooms, within limits so a
// label stays readable zoomed far out and doesn't swamp the screen zoomed far in. Pure.

/** 14 page points of text, never under 10 px or over 40 px on screen. */
export const LABEL_FONT_PX = { pt: 14, min: 10, max: 40 } as const;

/** Label text size in screen px for a plan drawn at `pxPerPt` screen px per page point. */
export function labelFontPx(pxPerPt: number): number {
  if (Number.isNaN(pxPerPt)) return LABEL_FONT_PX.pt;
  return Math.round(Math.min(LABEL_FONT_PX.max, Math.max(LABEL_FONT_PX.min, LABEL_FONT_PX.pt * pxPerPt)) * 10) / 10;
}

/** The halo around a label (a stroke in the surface colour), a fixed share of its text size. */
export const labelHaloPx = (fontPx: number): number => fontPx * 0.28;
