// Pure pan/zoom math for the plan viewer.
// A View places the page (laid out at "fit" size) inside the stage:
// screen = view.x/y + content * view.scale, where content is in CSS px at fit size.

export interface View { scale: number; x: number; y: number; }
export interface Size { w: number; h: number; }
export interface Point { x: number; y: number; }

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 24;

/** Scale (CSS px per PDF point) that fits the whole page with a margin, plus the centered view. */
export function fitPage(stage: Size, page: Size, margin = 16): { fitScale: number; view: View } {
  const fitScale = Math.min((stage.w - margin * 2) / page.w, (stage.h - margin * 2) / page.h);
  return {
    fitScale,
    view: { scale: 1, x: (stage.w - page.w * fitScale) / 2, y: (stage.h - page.h * fitScale) / 2 },
  };
}

/** Zoom by `factor` keeping the content under `p` (stage coordinates) in place. */
export function zoomAt(v: View, factor: number, p: Point): View {
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.scale * factor));
  const k = scale / v.scale;
  return { scale, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k };
}

export function panBy(v: View, dx: number, dy: number): View {
  return { scale: v.scale, x: v.x + dx, y: v.y + dy };
}

/**
 * Centres `rect` (any units) in `stage` with `margin` px around it. `scale` is stage px per rect unit,
 * so screen = x/y + point * scale. Null for a rectangle with no size: the caller keeps the current view.
 */
export function fitRect(rect: { x: number; y: number; w: number; h: number }, stage: Size, margin: number): View | null {
  if (!(rect.w > 0) || !(rect.h > 0)) return null;
  const scale = Math.min((stage.w - margin * 2) / rect.w, (stage.h - margin * 2) / rect.h);
  if (!(scale > 0)) return null;
  return { scale, x: (stage.w - rect.w * scale) / 2 - rect.x * scale, y: (stage.h - rect.h * scale) / 2 - rect.y * scale };
}
