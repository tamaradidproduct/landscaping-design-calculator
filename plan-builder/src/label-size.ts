// The size of the outline labels (the House, Driveway… names) on the plan: they scale with the plan as it zooms, within limits so a
// label stays readable zoomed far out and doesn't swamp the screen zoomed far in (the numbers are the LABEL tokens). Pure.
import { LABEL } from './overlay-tokens';

/** Label text size in screen px for a plan drawn at `pxPerPt` screen px per page point. */
export function labelFontPx(pxPerPt: number): number {
  if (Number.isNaN(pxPerPt)) return LABEL.pt;
  return Math.round(Math.min(LABEL.max, Math.max(LABEL.min, LABEL.pt * pxPerPt)) * 10) / 10;
}

/** The halo around a label (a stroke in the surface colour), a fixed share of its text size. */
export const labelHaloPx = (fontPx: number): number => fontPx * LABEL.halo;
