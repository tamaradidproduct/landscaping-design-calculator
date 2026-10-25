// The side panel's drag handle (its left edge): drag (mouse, pen or touch) to widen it, double-tap to reset, or focus it and
// use ← / → (16 px; Home = default, End = widest). The width is a per-viewer preference kept in localStorage, not part of the plan. It is applied as an
// override of the --width-sidebar token on the app element, so the panel and the handle both follow it; the stage's
// ResizeObserver then refits the plan and the floating controls re-clamp (main.ts).

export const SIDEBAR = { maxPx: 480, maxShare: 0.4, step: 16, doubleTapMs: 350, tapSlopPx: 4, storageKey: 'plan-builder.sidebar-width' } as const;

/** The widest the panel may be in a window `viewport` px wide: 480 px or 40% of the window, never below the default. */
export const maxSidebarWidth = (viewport: number, min: number) => Math.max(min, Math.min(SIDEBAR.maxPx, Math.round(viewport * SIDEBAR.maxShare)));
/** `w` held between the default width and the widest, in whole pixels (the default when `w` is not a number). */
export function clampSidebarWidth(w: number, viewport: number, min: number): number {
  if (Number.isNaN(w)) return min;
  return Math.round(Math.min(maxSidebarWidth(viewport, min), Math.max(min, w)));
}
/** A width read back from storage, or null when there is none (or it is not a positive number). */
export function parseStoredWidth(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Wires `handle` (role="separator") to resize the panel by overriding --width-sidebar on `root`. */
export function wireSidebarResize(root: HTMLElement, handle: HTMLElement) {
  const min = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--width-sidebar')) || 280;
  let width = min;
  const read = () => { try { return parseStoredWidth(localStorage.getItem(SIDEBAR.storageKey)); } catch { return null; } };
  const store = () => { try { if (width === min) localStorage.removeItem(SIDEBAR.storageKey); else localStorage.setItem(SIDEBAR.storageKey, String(width)); } catch { /* storage blocked */ } };
  const apply = (w: number) => {
    width = clampSidebarWidth(w, window.innerWidth, min);
    if (width === min) root.style.removeProperty('--width-sidebar'); else root.style.setProperty('--width-sidebar', `${width}px`);
    handle.setAttribute('aria-valuenow', String(width));
    handle.setAttribute('aria-valuemin', String(min));
    handle.setAttribute('aria-valuemax', String(maxSidebarWidth(window.innerWidth, min)));
  };
  const wanted = read();
  apply(wanted ?? min);
  // A narrower window can lower the widest allowed; the preference itself is kept for a wider window later.
  window.addEventListener('resize', () => apply(read() ?? width));

  let lastTap = 0;
  handle.onpointerdown = down => {
    if (down.pointerType === 'mouse' && down.button !== 0) return;
    down.preventDefault();
    const x0 = down.clientX, w0 = width;
    let moved = false, frame = 0, x = x0;
    handle.setPointerCapture(down.pointerId);
    handle.classList.add('dragging');
    const move = (e: PointerEvent) => {
      x = e.clientX;
      if (Math.abs(x - x0) > SIDEBAR.tapSlopPx) moved = true;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; apply(w0 + (x0 - x)); }); // the handle is on the left edge: left = wider
    };
    const end = (e: PointerEvent) => {
      handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', end); handle.removeEventListener('pointercancel', end);
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      handle.classList.remove('dragging');
      if (e.type === 'pointercancel') { apply(w0); return; }
      if (moved) { apply(w0 + (x0 - e.clientX)); store(); lastTap = 0; return; }
      // Two taps in a row reset to the default width.
      if (e.timeStamp - lastTap < SIDEBAR.doubleTapMs) { apply(min); store(); lastTap = 0; } else lastTap = e.timeStamp;
    };
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  };
  handle.onkeydown = e => {
    const d = e.key === 'ArrowLeft' ? SIDEBAR.step : e.key === 'ArrowRight' ? -SIDEBAR.step : 0;
    if (d) { e.preventDefault(); e.stopPropagation(); apply(width + d); store(); return; }
    if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); e.stopPropagation(); apply(e.key === 'Home' ? min : Infinity); store(); }
  };
}
