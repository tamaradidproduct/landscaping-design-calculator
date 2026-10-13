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

/** Center content smaller than the stage; otherwise keep the page covering the stage on that axis. */
export function clampView(v: View, stage: Size, content: Size): View {
  const axis = (pos: number, len: number, stageLen: number) =>
    len <= stageLen ? (stageLen - len) / 2 : Math.min(0, Math.max(stageLen - len, pos));
  return {
    scale: v.scale,
    x: axis(v.x, content.w * v.scale, stage.w),
    y: axis(v.y, content.h * v.scale, stage.h),
  };
}
