import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { PdfClient } from './pdf-client';
import { clampView, fitPage, panBy, zoomAt, type Point, type Size, type View } from './view';

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
  view = clampView(next, stageSize, content());
  viewVersion++;
  sharp.hidden = true;
  pageEl.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
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

const local = (e: PointerEvent): Point => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function startPinch() {
  const [a, b] = [...pointers.values()];
  pinch = { dist: dist(a, b) || 1, mid: mid(a, b), view };
}

stage.addEventListener('pointerdown', e => {
  if (!page) return;
  stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, local(e));
  if (pointers.size === 2) { startPinch(); moved = true; }
  if (pointers.size === 1) { downAt = local(e); moved = false; }
});
stage.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId)!, p = local(e);
  pointers.set(e.pointerId, p);
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
  if (pointers.size === 1 && pinch) { pinch = null; return; } // one finger still down: keep it as a pan
  if (pointers.size > 0) return;
  pinch = null;
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
stage.addEventListener('wheel', e => {
  if (!page) return;
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  applyView(zoomAt(view, Math.exp(-e.deltaY * 0.0018), { x: e.clientX - r.left, y: e.clientY - r.top }));
}, { passive: false });
// Safari fires its own pinch gesture events; keep them from zooming the whole page.
document.addEventListener('gesturestart', e => e.preventDefault());

// ---------- Toast ----------
let toastTimer = 0;
function toast(msg: string) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { t.hidden = true; }, 3500);
}
