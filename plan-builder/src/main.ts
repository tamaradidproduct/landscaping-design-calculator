import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { PdfClient } from './pdf-client';
import { OutlineTool } from './outline-ui';
import type { OutlineKind } from './outline';
import { fitPage, panBy, zoomAt, type Point, type Size, type View } from './view';

registerSW({ immediate: true });

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage'), pageEl = $('page'), base = $<HTMLCanvasElement>('base'), sharp = $<HTMLCanvasElement>('sharp');
const fileInput = $<HTMLInputElement>('file');
const pdf = new PdfClient();
pdf.warmup();

let page = false;                        // a plot plan is open
let pageSize: Size = { w: 1, h: 1 };   // PDF points
let fitScale = 1;                        // CSS px per PDF point at zoom 1
let view: View = { scale: 1, x: 0, y: 0 };
let stageSize: Size = { w: 0, h: 0 };
let sharpTimer = 0;
let viewVersion = 0;
let baseVersion = 0;

const content = (): Size => ({ w: pageSize.w * fitScale, h: pageSize.h * fitScale });

// ---------- Outline tool (Step 2a) ----------
const tool = new OutlineTool({
  toPage: s => ({ x: (s.x - view.x) / view.scale / fitScale, y: (s.y - view.y) / view.scale / fitScale }),
  toScreen: p => ({ x: p.x * fitScale * view.scale + view.x, y: p.y * fitScale * view.scale + view.y }),
  pxPerPt: () => fitScale * view.scale,
  drawMagnified(ctx, s, zoom, size) {
    const span = size / zoom; // screen px shown in the magnifier
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor; ctx.fillRect(0, 0, size, size);
    if (!sharp.hidden) {
      const r = sharp.width / stageSize.w;
      ctx.drawImage(sharp, (s.x - span / 2) * r, (s.y - span / 2) * r, span * r, span * r, 0, 0, size, size);
    } else {
      const k = base.width / pageSize.w / (fitScale * view.scale); // base px per screen px
      const cx = (s.x - view.x) * k, cy = (s.y - view.y) * k;
      ctx.drawImage(base, cx - span * k / 2, cy - span * k / 2, span * k, span * k, 0, 0, size, size);
    }
  },
  toast: msg => toast(msg),
  historyChanged(canUndo, canRedo) {
    ($('undo') as HTMLButtonElement).disabled = !canUndo;
    ($('redo') as HTMLButtonElement).disabled = !canRedo;
  },
  sampleLuminance(c, n) {
    // Read what's on screen (sharp layer when ready, else the base layer) at 1 sample per screen px.
    const out = new Float32Array(n * n).fill(255), x0 = Math.round(c.x - n / 2), y0 = Math.round(c.y - n / 2);
    if (!sharp.hidden) {
      const r = sharp.width / stageSize.w, sx = Math.round(x0 * r), sy = Math.round(y0 * r), sw = Math.round(n * r);
      const data = sharp.getContext('2d', { willReadFrequently: true })!.getImageData(sx, sy, sw, sw).data;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        // darkest device pixel within this screen px, so 1-device-px lines still register
        let m = 255;
        for (let dy = 0; dy < r; dy++) for (let dx = 0; dx < r; dx++) {
          const i = ((Math.floor(y * r) + dy) * sw + Math.floor(x * r) + dx) * 4;
          if (data[i + 3] === 0) continue; // off the page
          m = Math.min(m, 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]);
        }
        out[y * n + x] = m;
      }
      return out;
    }
    const k = base.width / pageSize.w / (fitScale * view.scale); // base px per screen px
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = n;
    const ctx = tmp.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(base, (x0 - view.x) * k, (y0 - view.y) * k, n * k, n * k, 0, 0, n, n);
    const data = ctx.getImageData(0, 0, n, n).data;
    for (let i = 0; i < n * n; i++) if (data[i * 4 + 3]) out[i] = 0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2];
    return out;
  },
}, stage, $('panel'));

// Dev only: lets scripts capture what snapping sees, to turn real plans into regression tests.
if (import.meta.env.DEV) (window as unknown as { __sample: unknown }).__sample = (x: number, y: number, n: number) => Array.from(tool['host'].sampleLuminance({ x, y }, n) ?? []);

window.addEventListener('keydown', e => { if (e.key === 'Shift') tool.setShift(true); });
window.addEventListener('keyup', e => { if (e.key === 'Shift') tool.setShift(false); });

$('undo').onclick = () => tool.undo();
$('redo').onclick = () => tool.redo();

$('snap').onclick = () => {
  tool.snapOn = !tool.snapOn;
  $('snap').setAttribute('aria-pressed', String(tool.snapOn));
  $('snap').textContent = tool.snapOn ? 'Snap on' : 'Snap off';
  tool.update();
};

$('outline').onclick = () => { $('outline-menu').hidden = !$('outline-menu').hidden; };
document.querySelectorAll<HTMLButtonElement>('[data-outline]').forEach(b => {
  b.onclick = () => { $('outline-menu').hidden = true; tool.start(b.dataset.outline as OutlineKind); };
});
const dpr = () => Math.min(window.devicePixelRatio || 1, 3);

// ---------- Opening a file ----------
$('open-empty').onclick = () => fileInput.click();
$('open-again').onclick = () => fileInput.click();
$('fit').onclick = () => { fitToStage(); };
fileInput.onchange = () => { const f = fileInput.files?.[0]; fileInput.value = ''; if (f) void openFile(f); };

async function openFile(file: File) {
  const t0 = performance.now();
  $('empty').hidden = true; $('loading').hidden = false;
  try {
    const mark = (label: string) => console.debug(`[open] ${label}: ${Math.round(performance.now() - t0)} ms`);
    const bytes = await file.arrayBuffer();
    mark('file read');
    const opened = await pdf.open(bytes);
    mark('document loaded');
    pageSize = opened.pageSize;
    page = true;
    measureStage();
    fitToStage(false);
    await renderBase();
    mark('page drawn');
    $('loading').hidden = true; pageEl.hidden = false; $('bar').hidden = false;
    $('name').textContent = file.name;
    renderSharpSoon(0);
    const pages = opened.pageCount > 1 ? ` Showing page 1 of ${opened.pageCount}.` : '';
    toast(`Opened in ${((performance.now() - t0) / 1000).toFixed(1)} s.${pages}`);
  } catch (err) {
    console.error(err);
    page = false; $('loading').hidden = true; pageEl.hidden = true; sharp.hidden = true;
    $('empty').hidden = false; $('bar').hidden = true;
    toast('That file could not be opened as a PDF. Pick the plot plan PDF from the closing documents.');
  }
}

// ---------- Rendering ----------
// Base layer: the whole page at 2x screen resolution, moved with CSS transforms during gestures
// so pinch and pan stay smooth.
async function renderBase() {
  const version = ++baseVersion;
  const c = content();
  const scale = Math.min(fitScale * dpr() * 2, 4096 / Math.max(pageSize.w, pageSize.h));
  const w = Math.floor(pageSize.w * scale), h = Math.floor(pageSize.h * scale);
  const img = await pdf.render(w, h, scale, 0, 0);
  if (version !== baseVersion) return;
  pageEl.style.width = `${c.w}px`; pageEl.style.height = `${c.h}px`;
  base.width = w; base.height = h;
  base.getContext('2d')!.putImageData(img, 0, 0);
}

// Sharp layer: only what is on screen, at full device resolution for the current zoom.
// Drawn after the fingers lift; hidden while the view is moving.
function renderSharpSoon(delay = 120) {
  clearTimeout(sharpTimer);
  sharpTimer = window.setTimeout(() => void renderSharp(), delay);
}
async function renderSharp() {
  if (!page) return;
  const version = viewVersion, r = dpr();
  const w = Math.round(stageSize.w * r), h = Math.round(stageSize.h * r);
  const img = await pdf.render(w, h, fitScale * view.scale * r, view.x * r, view.y * r).catch(() => null);
  if (!img || version !== viewVersion) return; // a newer gesture moved the view
  sharp.width = w; sharp.height = h;
  sharp.getContext('2d')!.putImageData(img, 0, 0);
  sharp.hidden = false;
}

function applyView(next: View, settle = true) {
  view = next; // free panning: the plan can be moved anywhere, even off screen
  viewVersion++;
  sharp.hidden = true;
  pageEl.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  tool.render();
  if (settle) renderSharpSoon();
}

function measureStage() {
  const r = stage.getBoundingClientRect();
  stageSize = { w: r.width, h: r.height };
}
function fitToStage(settle = true) {
  const f = fitPage(stageSize, pageSize);
  fitScale = f.fitScale;
  applyView(f.view, settle);
}

new ResizeObserver(() => {
  const prev = stageSize; measureStage();
  if (!page || (prev.w === stageSize.w && prev.h === stageSize.h)) return;
  fitToStage(false); void renderBase().then(() => renderSharpSoon(0));
}).observe(stage);

// ---------- Gestures: one finger pans, two fingers pinch, double-tap zooms ----------
const pointers = new Map<number, Point>();
let pinch: { dist: number; mid: Point; view: View } | null = null;
let lastTap = { t: 0, p: { x: 0, y: 0 } };
let downAt: Point | null = null, moved = false;
let toolDrag = false; // the current single-finger action belongs to the outline tool
let toolPointer = -1;

const local = (e: PointerEvent): Point => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function startPinch() {
  const [a, b] = [...pointers.values()];
  pinch = { dist: dist(a, b) || 1, mid: mid(a, b), view };
}

stage.addEventListener('pointerdown', e => {
  if (!page) return;
  if ((e.target as Element).closest('.popover')) return; // let the edge popover's own controls work
  stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, local(e));
  if (pointers.size === 2 && toolDrag) { tool.setBypassFinger(true); return; } // second finger while placing = place freely
  if (pointers.size === 2) { startPinch(); moved = true; }
  if (pointers.size === 1) { downAt = local(e); moved = false; toolPointer = e.pointerId; toolDrag = tool.pointerDown(local(e), e.pointerType); }
});
stage.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) { if (page && e.pointerType === 'mouse') tool.hover(local(e), e.shiftKey); return; }
  const prev = pointers.get(e.pointerId)!, p = local(e);
  pointers.set(e.pointerId, p);
  if (toolDrag) { if (e.pointerId === toolPointer) tool.pointerMove(p, e.altKey, e.shiftKey); return; }
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const m = mid(a, b);
    const zoomed = zoomAt(pinch.view, dist(a, b) / pinch.dist, pinch.mid);
    applyView(panBy(zoomed, m.x - pinch.mid.x, m.y - pinch.mid.y), false);
    return;
  }
  if (downAt && dist(downAt, p) > 6) moved = true;
  if (moved) applyView(panBy(view, p.x - prev.x, p.y - prev.y), false);
});
function endPointer(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return;
  const p = local(e);
  pointers.delete(e.pointerId);
  if (toolDrag) {
    if (e.pointerId !== toolPointer) { tool.setBypassFinger(false); return; }
    toolDrag = false; tool.setBypassFinger(false); tool.pointerUp(); return;
  }
  if (pointers.size === 1 && pinch) { pinch = null; return; } // one finger still down: keep it as a pan
  if (pointers.size > 0) return;
  pinch = null;
  if (!moved) tool.tapEmpty();
  if (!moved) {
    const now = performance.now();
    if (now - lastTap.t < 320 && dist(p, lastTap.p) < 30) {
      lastTap.t = 0;
      if (view.scale > 1.05) fitToStage(); else applyView(zoomAt(view, 3, p));
      return;
    }
    lastTap = { t: now, p };
  }
  renderSharpSoon();
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);
stage.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') tool.hover(null); });
// Trackpad: two-finger drag pans; pinch (reported as ctrl+wheel) zooms. Mouse wheel: ctrl+wheel zooms.
stage.addEventListener('wheel', e => {
  if (!page) return;
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  const lines = e.deltaMode === 1 ? 16 : 1; // some mice report lines, not pixels
  if (e.ctrlKey) applyView(zoomAt(view, Math.exp(-e.deltaY * lines * 0.01), { x: e.clientX - r.left, y: e.clientY - r.top }));
  else applyView(panBy(view, -e.deltaX * lines, -e.deltaY * lines));
}, { passive: false });

// Safari on Mac reports trackpad pinch as gesture events instead of ctrl+wheel.
type GestureEvent = UIEvent & { scale: number; clientX: number; clientY: number };
let gestureStart: { scale: number; view: View } | null = null;
document.addEventListener('gesturestart', e => {
  e.preventDefault();
  if (page && pointers.size === 0) gestureStart = { scale: (e as GestureEvent).scale, view };
});
document.addEventListener('gesturechange', e => {
  e.preventDefault();
  if (!gestureStart) return;
  const g = e as GestureEvent, r = stage.getBoundingClientRect();
  applyView(zoomAt(gestureStart.view, g.scale / gestureStart.scale, { x: g.clientX - r.left, y: g.clientY - r.top }), false);
});
document.addEventListener('gestureend', e => { e.preventDefault(); if (gestureStart) { gestureStart = null; renderSharpSoon(); } });

// ---------- Toast ----------
let toastTimer = 0;
function toast(msg: string) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { t.hidden = true; }, 3500);
}
