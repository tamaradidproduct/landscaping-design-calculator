import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { PdfClient } from './pdf-client';
import { ImageClient } from './image-client';
import type { PageEngine } from './page-engine';
import { sniffPlanFileType } from './plan-store';
import { OutlineTool } from './outline-ui';
import { OutlinesSection } from './layers-ui';
import { SurfacesSection } from './surfaces-ui';
import { SymbolsSection } from './symbols-ui';
import { canvasNudgePad } from './ui';
import { nudgePadVisible } from './card-helpers';
import { wireSidebarResize } from './sidebar-resize';
import { renderSheet } from './sheet-ui';
import { ToolRow } from './tool-row';
import { loadRecent, pushRecent, saveRecent } from './search-index';
import { panelState, visibleGroups } from './panel-state';
import { LinesSection } from './lines-ui';
import { GROUPS, groupCounts, groupToOpen, readOpen, type Group } from './sections';
import { patternDefs, scalePatterns, zonePatternDefs } from './patterns';
import { material, type MaterialId } from './materials';
import { isAssigned, type Outline, type OutlineShape } from './outline';
import { loadShapes, shapeGroup, shapeKey } from './shape-pref';
import { applyCorrection, IDENTITY, invertCorrection, type Correction } from './scale';
import { planBounds } from './plan-bounds';
import { fitPage, fitRect, MAX_ZOOM, MIN_ZOOM, panBy, zoomAt, type Point, type Size, type View } from './view';
import { docBytes, toDoc } from './plan-model';
import { topBarHtml, EXPORT_NOTE, type EditorView } from './top-bar';
import { startShell, type OpenResult, type Shell } from './app-shell';

registerSW({ immediate: true });

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage'), pageEl = $('page'), base = $<HTMLCanvasElement>('base'), sharp = $<HTMLCanvasElement>('sharp');
// Surface fill patterns: the picker and Layers swatches' fixed ones here, one per zone for the plan (zone-defs).
document.querySelector('.app')!.insertAdjacentHTML('beforeend', `<svg class="defs" aria-hidden="true" width="0" height="0"><defs>${patternDefs()}</defs><defs id="zone-defs"></defs></svg>`);
const pdf = new PdfClient();
pdf.warmup();
const img = new ImageClient(); // JPG/PNG plot plans: a parallel, PDFium-free render path (#20)
let engine: PageEngine = pdf;   // whichever of the two produced the plot plan now open

let page = false;                        // a plot plan is open
let pageSize: Size = { w: 1, h: 1 };   // PDF points
let fitScale = 1;                        // CSS px per PDF point at zoom 1
let view: View = { scale: 1, x: 0, y: 0 };
let stageSize: Size = { w: 0, h: 0 };
let sharpTimer = 0;
let viewVersion = 0;
let baseVersion = 0;

// ---------- Top bar: rendered once (PlanHead owns its left cluster); undo/redo and the view switch are patched in place ----------
const bar = { canUndo: false, canRedo: false, view: 'edit' as EditorView };
$('top-bar').innerHTML = topBarHtml({ name: '', ...bar });
function updateBar() {
  ($('undo') as HTMLButtonElement).disabled = !bar.canUndo;
  ($('redo') as HTMLButtonElement).disabled = !bar.canRedo;
  document.querySelectorAll<HTMLButtonElement>('#view-switch [data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === bar.view)));
  $('top-bar').classList.toggle('previewing', bar.view === 'preview');
}

let correction: Correction = IDENTITY;   // page points → true-shape points (a stretched plan, once corrected)
/** The page in true-shape points (only stretches for now, so the sheet's corner stays at the origin). */
const shown = (): Size => ({ w: pageSize.w * correction.a, h: pageSize.h * correction.d });
const content = (): Size => ({ w: shown().w * fitScale, h: shown().h * fitScale });

// ---------- Outline tool (Step 2a) ----------
let shell: Shell | null = null; // sign-in, Plans and autosave (app-shell.ts); told about every editor change
let surfaces: SurfacesSection | null = null; // the Layers panel's Surfaces section, created once the tool exists
let linesSection: LinesSection | null = null; // the Layers panel's Lines section
let symbolsSection: SymbolsSection | null = null; // the Layers panel's Plants & objects section
let outlines: OutlinesSection | null = null; // the Layers panel's Outlines section, created once the tool exists
const pxPerPtNow = () => fitScale * view.scale * Math.sqrt(correction.a * correction.d - correction.b * correction.c);
const zoneDefs = document.getElementById('zone-defs')!;
let zoneKey = '';
/** Each zone's texture repeats at its real-world size: add or drop zone patterns, then resize them to the current zoom and scale. */
// ftPerPt is per true-shape point, and toScreen applies the stretch correction first: fitScale × zoom is its screen scale.
const rescalePatterns = () => {
  const zones = Object.values(tool.outlines).filter((o): o is Outline & { material: string } => o.kind === 'surface' && isAssigned(o));
  const key = zones.map(o => `${o.id}:${o.material}`).join();
  if (key !== zoneKey) { zoneKey = key; zoneDefs.innerHTML = zonePatternDefs(zones.map(o => ({ id: o.id, material: o.material }))); }
  scalePatterns(zoneDefs, new Map(zones.map(o => [o.id, { tileFt: material(o.material).tileFt, texScale: o.texScale ?? 1 }])), tool.cal?.ftPerPt ?? null, fitScale * view.scale, { x: view.x, y: view.y });
};
const tool = new OutlineTool({
  toPage: s => applyCorrection(invertCorrection(correction), { x: (s.x - view.x) / view.scale / fitScale, y: (s.y - view.y) / view.scale / fitScale }),
  toScreen: p => { const q = applyCorrection(correction, p); return { x: q.x * fitScale * view.scale + view.x, y: q.y * fitScale * view.scale + view.y }; },
  pxPerPt: pxPerPtNow,
  drawMagnified(ctx, s, zoom, size) {
    const span = size / zoom; // screen px shown in the magnifier
    ctx.globalAlpha = 1; ctx.fillStyle = getComputedStyle(document.body).backgroundColor; ctx.fillRect(0, 0, size, size);
    if (!planVisible) return;
    ctx.globalAlpha = planOpacity;
    if (!sharp.hidden) {
      const r = sharp.width / stageSize.w;
      ctx.drawImage(sharp, (s.x - span / 2) * r, (s.y - span / 2) * r, span * r, span * r, 0, 0, size, size);
    } else {
      const k = base.width / shown().w / (fitScale * view.scale); // base px per screen px
      const cx = (s.x - view.x) * k, cy = (s.y - view.y) * k;
      ctx.drawImage(base, cx - span * k / 2, cy - span * k / 2, span * k, span * k, 0, 0, size, size);
    }
  },
  toast: msg => toast(msg),
  correctionChanged(c) {
    // The plan stretches to its true shape around the sheet's top-left corner; Fit page re-centres it.
    correction = c;
    if (!page) return;
    const size = content(); pageEl.style.width = `${size.w}px`; pageEl.style.height = `${size.h}px`;
    applyView(view, false); void renderBase().then(() => renderSharpSoon(0));
  },
  historyChanged(canUndo, canRedo) {
    bar.canUndo = canUndo; bar.canRedo = canRedo; updateBar();
  },
  changed() {
    rescalePatterns(); // a typed edge length can change the plan's scale
    shell?.changed();
    surfaces?.render();
    linesSection?.render();
    symbolsSection?.render();
    outlines?.render();
    if (sheetOpen) renderSheet($('layers-sheet'), tool);
    updateGroups();
    $('snap').hidden = !tool.drawing && !tool.selecting; // snapping matters only while drawing or editing an outline
    showSnap();
    refreshFloating();
    $('shape').hidden = !tool.drawing; // Freehand | Rectangle: only while an outline is being drawn
    stage.classList.toggle('drawing', !!tool.drawing);
    $('shape').querySelectorAll<HTMLButtonElement>('[data-shape]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.shape === tool.shape)));
  },
  sampleLuminance(c, n) {
    if (!planVisible) return null; // a hidden plan has no lines to snap to
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
    const k = base.width / shown().w / (fitScale * view.scale); // base px per screen px
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = n;
    const ctx = tmp.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(base, (x0 - view.x) * k, (y0 - view.y) * k, n * k, n * k, 0, 0, n, n);
    const data = ctx.getImageData(0, 0, n, n).data;
    for (let i = 0; i < n * n; i++) if (data[i * 4 + 3]) out[i] = 0.3 * data[i * 4] + 0.59 * data[i * 4 + 1] + 0.11 * data[i * 4 + 2];
    return out;
  },
}, stage);
// Collapsible Layers sections: the open/closed state is remembered on this device; a collapsed header shows its count.
const GROUPS_KEY = 'plan-builder.sections';
const groupsOpen = readOpen((() => { try { return localStorage.getItem(GROUPS_KEY); } catch { return null; } })());
let activeLayer: string | null = null; // the layer being drawn, else selected — its section opens when it changes
function setGroupOpen(g: Group, open: boolean) {
  groupsOpen[g] = open;
  try { localStorage.setItem(GROUPS_KEY, JSON.stringify(groupsOpen)); } catch { /* not remembered */ }
  updateGroups();
}
let activeLine: string | null = null; // the line being drawn (its item) or selected — the Lines section opens when it changes
let activePlacing: string | null = null; // the symbol armed for placing — Plants & objects opens when it changes (its Done is in there)
function updateGroups() {
  const next = tool.drawing ?? tool.selected, open = groupToOpen(activeLayer, next, tool.outlines);
  activeLayer = next;
  const line = tool.lineDraft ? tool.lineDraft.item : tool.selectedLine, lineChanged = line !== null && line !== activeLine;
  activeLine = line;
  if (lineChanged && !groupsOpen.lines) { setGroupOpen('lines', true); return; }
  const placingChanged = tool.placing !== null && tool.placing !== activePlacing;
  activePlacing = tool.placing;
  if (placingChanged && !groupsOpen.symbols) { setGroupOpen('symbols', true); return; }
  if (open && !groupsOpen[open]) { setGroupOpen(open, true); return; }
  const counts = groupCounts(Object.values(tool.outlines), Object.keys(tool.symbols.placed).length, Object.keys(tool.lines.placed).length);
  // Guided unlock: only Outlines until the boundary is closed and the scale set; empty sections stay hidden until their first item.
  const state = panelState({ boundaryClosed: tool.boundaryClosed, scaleSet: !!tool.cal, placed: counts.symbols + counts.lines + counts.surfaces });
  const shown = new Set(visibleGroups(state, counts));
  const busy: Record<Group, boolean> = { symbols: !!tool.placing, lines: !!tool.lineDraft, surfaces: !!tool.drawing && tool.outlines[tool.drawing]?.kind === 'surface', outlines: true };
  for (const g of GROUPS) $(`section-${g}`).hidden = !shown.has(g) && !busy[g];
  toolRow.setReady(state === 'ready');
  document.querySelectorAll<HTMLButtonElement>('.group-head').forEach(b => {
    const g = b.dataset.group as Group, isOpen = groupsOpen[g], count = b.querySelector<HTMLElement>('.group-count')!;
    b.setAttribute('aria-expanded', String(isOpen));
    $(`group-${g}`).hidden = !isOpen;
    count.hidden = isOpen; count.textContent = `· ${counts[g]}`;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-eye-group]').forEach(b => {
    const g = b.dataset.eyeGroup as Group, hidden = tool.hiddenSections.has(g), name = g === 'surfaces' ? 'surfaces' : g === 'symbols' ? 'plants and objects' : g === 'lines' ? 'edges and walls' : 'outlines';
    b.hidden = counts[g] === 0;
    b.setAttribute('aria-pressed', String(!hidden));
    b.setAttribute('aria-label', `${hidden ? 'Show' : 'Hide'} all ${name}`); b.title = b.getAttribute('aria-label')!;
  });
}
document.querySelectorAll<HTMLButtonElement>('[data-eye-group]').forEach(b => { b.onclick = () => tool.toggleSection(b.dataset.eyeGroup as Group); });
document.querySelectorAll<HTMLButtonElement>('.group-head').forEach(b => {
  b.onclick = () => setGroupOpen(b.dataset.group as Group, !groupsOpen[b.dataset.group as Group]);
});
// Close shape on a zone without a material opens the grid in its card, so the tool row's popover steps aside.
surfaces = new SurfacesSection($('surfaces'), tool, () => toolRow.close());
surfaces.render();
linesSection = new LinesSection($('lines'), tool);
linesSection.render();
symbolsSection = new SymbolsSection($('symbols'), tool);
symbolsSection.render();
outlines = new OutlinesSection($('outlines'), tool, id => surfaces?.openGridFor(id)); // Duplicate as surface opens the new zone's grid
outlines.render();
// Tool row + search popover. Surface starts drawing as soon as it is tapped; a pick is recorded as Recent and routed by its
// category: a material goes to the surface being drawn (else arms the next one), a plant or object arms placing, a line item
// starts that line. Each of these cancels a draft of another kind first.
const toolRow = new ToolRow($('add'), entry => {
  saveRecent(pushRecent(loadRecent(), entry.id));
  if (entry.category === 'surfaces') tool.pickMaterial(entry.id as MaterialId);
  else if (entry.category === 'symbols') tool.startPlacing(entry.id);
  else tool.startLine(entry.id);
}, t => { if (t === 'surfaces') tool.startSurfaceDrawing(); },
// Fill the plot leads the Surface grid while the plot can be filled; it opens the boundary card's grid (the draft is dropped).
{ available: () => tool.fillable && !!tool.cal, open: () => outlines?.openFill() });
// Edit | Preview (top bar): Preview is the read-only sheet view of the same data. It hides the plot plan for display only
// (previewing, never planVisible), fits the drawn plan, and switches the drawing tools off until Edit returns.
let sheetOpen = false;
let previewing = false;
let editView: View | null = null; // zoom and pan to restore on returning to Edit
const previewFitMargin = 32;
function fitDrawing() {
  const b = planBounds(tool.state());
  if (!b) { fitToStage(false); return; }
  const corners = [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x, y: b.y + b.h }, { x: b.x + b.w, y: b.y + b.h }].map(p => applyCorrection(correction, p));
  const xs = corners.map(p => p.x), ys = corners.map(p => p.y), x = Math.min(...xs), y = Math.min(...ys);
  const r = { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  const f = fitRect(r, { w: stageSize.w / fitScale, h: stageSize.h / fitScale }, previewFitMargin / fitScale);
  if (!f) { fitToStage(false); return; }
  const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, f.scale));
  applyView({ scale, x: stageSize.w / 2 - (r.x + r.w / 2) * fitScale * scale, y: stageSize.h / 2 - (r.y + r.h / 2) * fitScale * scale }, false);
}
function setView(v: EditorView) {
  const preview = v === 'preview';
  if (preview === previewing) return;
  previewing = preview; sheetOpen = preview; bar.view = v; updateBar();
  $('layers-edit').hidden = preview; $('layers-sheet').hidden = !preview;
  applyPlanLook(); tool.previewing = preview; tool.render();
  if (preview) { renderSheet($('layers-sheet'), tool); if (page) { editView = view; fitDrawing(); } }
  else { if (page && editView) { applyView(editView, false); renderSharpSoon(0); } editView = null; }
}
document.querySelectorAll<HTMLButtonElement>('#view-switch [data-view]').forEach(b => { b.onclick = () => setView(b.dataset.view === 'preview' ? 'preview' : 'edit'); });
// The tool's own keys (⌘Z, arrows, Escape, Enter…) are off in Preview, while top-bar and sidebar controls keep their keys.
window.addEventListener('keydown', e => {
  // ⌘Z / ⇧⌘Z never act in Preview, wherever focus is (even on the bar); other keys pass inside inputs, the bar and the panel.
  const history = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z';
  if (previewing && (history || !(e.target as HTMLElement).closest('input, textarea, #top-bar, #sidebar'))) e.stopImmediatePropagation();
}, true);
updateGroups();

// Dev only: size of the plan document as it would be saved (outlines + refs + small fixed metadata); scripts assert it stays small.
if (import.meta.env.DEV) (window as unknown as { __planBytes: unknown }).__planBytes = () =>
  docBytes(toDoc(tool.state(), { address: 'x', createdAt: 0, updatedAt: 0, pdf: { name: 'x.pdf', size: 0, rev: 1, uploaded: false } }));

// Dev only: lets scripts capture what snapping sees, to turn real plans into regression tests.
if (import.meta.env.DEV) (window as unknown as { __sample: unknown }).__sample = (x: number, y: number, n: number) => Array.from(tool['host'].sampleLuminance({ x, y }, n) ?? []);

// Shift / Option state comes from every input event (not just Shift's own keydown/keyup), so it can't stick.
window.addEventListener('keydown', e => tool.setModifiers(e.shiftKey, e.altKey));
window.addEventListener('keyup', e => tool.setModifiers(e.shiftKey, e.altKey));
window.addEventListener('blur', () => tool.setModifiers(false, false));

$('undo').onclick = () => { if (!previewing) tool.undo(); };
$('redo').onclick = () => { if (!previewing) tool.redo(); };
$('export').onclick = () => toast(EXPORT_NOTE);

// Freehand | Rectangle, remembered per kind on this device (a convenience: losing it just means the defaults,
// Freehand for outlines and Rectangle for surfaces). X switches.
tool.shapePrefs = loadShapes(k => localStorage.getItem(k));
const pickShape = (shape: OutlineShape) => {
  tool.setShape(shape);
  try { localStorage.setItem(shapeKey(shapeGroup(tool.editingKind)), shape); } catch { /* storage blocked */ }
};
$('shape').querySelectorAll<HTMLButtonElement>('[data-shape]').forEach(b => {
  b.onclick = () => pickShape(b.dataset.shape === 'rect' ? 'rect' : 'freehand');
});
window.addEventListener('keydown', e => {
  if (e.key.toLowerCase() !== 'x' || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).closest('input, textarea')) return;
  e.preventDefault(); pickShape(tool.shape === 'rect' ? 'freehand' : 'rect');
});

// Floating canvas aids: the touch-only nudge pad (bottom-left) and Square corners beside the selected outline or zone.
const canvasEl = $('canvas'), squareBtn = $<HTMLButtonElement>('square-corners');
canvasEl.insertAdjacentHTML('beforeend', canvasNudgePad());
const nudgePadEl = canvasEl.querySelector<HTMLElement>('.nudge-pad')!;
nudgePadEl.hidden = true;
nudgePadEl.querySelectorAll<HTMLButtonElement>('[data-nudge]').forEach(b => {
  b.onclick = () => { const [dx, dy] = b.dataset.nudge!.split(',').map(Number); tool.nudge(dx!, dy!); };
});
const coarse = window.matchMedia('(pointer: coarse)');
function refreshFloating() {
  nudgePadEl.hidden = !nudgePadVisible(tool.nudgeable, coarse.matches);
  const t = tool.squareTarget;
  squareBtn.hidden = !t;
  if (!t) { tool.avoidChip(null); return; }
  // Beside the shape's top-right, kept inside the stage and clear of Undo/Redo (top right) and the zoom, nudge and Snap rows (bottom).
  const w = squareBtn.offsetWidth, h = squareBtn.offsetHeight, gap = 8, top = 80, bottom = 72;
  squareBtn.style.left = `${Math.max(gap, Math.min(stageSize.w - w - gap, t.bbox.right + gap))}px`;
  squareBtn.style.top = `${Math.max(top, Math.min(stageSize.h - h - bottom, t.bbox.top - h - gap))}px`;
  // The edge chip keeps clear of this button.
  const left = squareBtn.offsetLeft, topPx = squareBtn.offsetTop;
  tool.avoidChip({ left, top: topPx, right: left + w, bottom: topPx + h });
}
coarse.addEventListener('change', refreshFloating);

// The side panel's left edge widens it; the stage's ResizeObserver (below) refits the plan, which re-clamps the floating controls.
wireSidebarResize(document.querySelector<HTMLElement>('.app')!, $('sidebar-resize'));
squareBtn.onclick = () => { const t = tool.squareTarget; if (t) tool.squareAll(t.id); };

// Snap is kept separately for tracing outlines (on by default) and designing surfaces (off by default).
const showSnap = () => {
  $('snap').setAttribute('aria-pressed', String(tool.snapOn));
  $('snap').textContent = tool.snapOn ? 'Snap on' : 'Snap off';
};
$('snap').onclick = () => { tool.snapOn = !tool.snapOn; showSnap(); tool.update(); };

const dpr = () => Math.min(window.devicePixelRatio || 1, 3);

// ---------- Plot plan layer: show/hide and opacity ----------
let planVisible = true, planOpacity = 1;
function applyPlanLook() {
  for (const el of [pageEl, sharp]) { el.style.visibility = planVisible && !previewing ? '' : 'hidden'; el.style.opacity = String(planOpacity); }
  const eye = $('plan-visible'), opacity = $<HTMLInputElement>('plan-opacity');
  eye.setAttribute('aria-pressed', String(planVisible));
  eye.setAttribute('aria-label', planVisible ? 'Hide the plot plan' : 'Show the plot plan'); eye.title = eye.getAttribute('aria-label')!;
  opacity.disabled = !planVisible;
  $('plan-opacity-value').textContent = `${Math.round(planOpacity * 100)}%`;
}
$('plan-visible').onclick = () => { planVisible = !planVisible; applyPlanLook(); };
$<HTMLInputElement>('plan-opacity').oninput = e => { planOpacity = Number((e.target as HTMLInputElement).value) / 100; applyPlanLook(); };

// ---------- Opening a plot plan ----------
$('fit').onclick = () => { fitToStage(); };
const ZOOM_STEP = 1.25; // − / + buttons, around the middle of the plan
const zoomBy = (k: number) => { if (page) applyView(zoomAt(view, k, { x: stageSize.w / 2, y: stageSize.h / 2 })); };
$('zoom-in').onclick = () => zoomBy(ZOOM_STEP);
$('zoom-out').onclick = () => zoomBy(1 / ZOOM_STEP);

let openVersion = 0; // bumped by every open and by leaving the editor: a stale open stops quietly
/**
 * Shows the PDF in the editor; `name` labels the plot plan layer (the plan's address). 'failed' leaves
 * whatever was open before (a failed Replace keeps the current plot plan) and says nothing: the caller does.
 */
async function openBytes(bytes: ArrayBuffer, name: string): Promise<OpenResult> {
  const t0 = performance.now(), v = ++openVersion;
  if (!page) $('loading').hidden = false;
  let swapped = false; // the page state now describes the new document
  try {
    const mark = (label: string) => console.debug(`[open] ${label}: ${Math.round(performance.now() - t0)} ms`);
    // Pick the engine by the bytes' own header, not the plan's saved name: works for a fresh pick
    // and for bytes read back later (store/cache keep no separate file-type field).
    const prev = engine, next = sniffPlanFileType(bytes) === 'application/pdf' ? pdf : img;
    const opened = await next.open(bytes);
    if (v !== openVersion) return 'stale';
    engine = next; // commit only once it has actually opened, same as the PDF path's own "load first"
    if (prev === img && next !== img) img.close(); // only now that img is no longer the open plot plan
    mark('document loaded');
    pageSize = opened.pageSize;
    page = true; swapped = true;
    measureStage();
    fitToStage(false);
    await renderBase();
    if (v !== openVersion) return 'stale';
    mark('page drawn');
    $('loading').hidden = true; pageEl.hidden = false;
    $('name').textContent = name;
    planVisible = true; planOpacity = 1; $<HTMLInputElement>('plan-opacity').value = '100'; applyPlanLook();
    renderSharpSoon(0);
    const pages = opened.pageCount > 1 ? ` Showing page 1 of ${opened.pageCount}.` : '';
    toast(`Opened in ${((performance.now() - t0) / 1000).toFixed(1)} s.${pages}`);
    return 'ok';
  } catch (err) {
    if (v !== openVersion) return 'stale';
    console.error(err);
    $('loading').hidden = true;
    if (swapped || !page) { page = false; pageEl.hidden = true; sharp.hidden = true; }
    return 'failed';
  }
}

// ---------- Rendering ----------
// Base layer: the whole page at 2x screen resolution, moved with CSS transforms during gestures
// so pinch and pan stay smooth.
async function renderBase() {
  const version = ++baseVersion;
  const c = content();
  const t = shown(), m = correction;
  const scale = Math.min(fitScale * dpr() * 2, 4096 / Math.max(t.w, t.h));
  const w = Math.floor(t.w * scale), h = Math.floor(t.h * scale);
  const pixels = await engine.render(w, h, [m.a * scale, m.c * scale, m.b * scale, m.d * scale, 0, 0]);
  if (version !== baseVersion) return;
  pageEl.style.width = `${c.w}px`; pageEl.style.height = `${c.h}px`;
  base.width = w; base.height = h;
  base.getContext('2d')!.putImageData(pixels, 0, 0);
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
  const k = fitScale * view.scale * r, m = correction;
  const pixels = await engine.render(w, h, [m.a * k, m.c * k, m.b * k, m.d * k, view.x * r, view.y * r]).catch(() => null);
  if (!pixels || version !== viewVersion) return; // a newer gesture moved the view
  sharp.width = w; sharp.height = h;
  sharp.getContext('2d')!.putImageData(pixels, 0, 0);
  sharp.hidden = false;
}

function applyView(next: View, settle = true) {
  view = next; // free panning: the plan can be moved anywhere, even off screen
  viewVersion++;
  sharp.hidden = true;
  pageEl.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  $<HTMLButtonElement>('zoom-out').disabled = view.scale <= MIN_ZOOM;
  $<HTMLButtonElement>('zoom-in').disabled = view.scale >= MAX_ZOOM;
  rescalePatterns();
  tool.render();
  refreshFloating();
  if (settle) renderSharpSoon();
}

function measureStage() {
  const r = stage.getBoundingClientRect();
  stageSize = { w: r.width, h: r.height };
}
function fitToStage(settle = true) {
  const f = fitPage(stageSize, shown());
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
  if ((e.target as Element).closest('.edge-chip, .square-chip')) return; // let the edge chip's and Square chip's own controls work
  stage.setPointerCapture(e.pointerId);
  tool.setModifiers(e.shiftKey, e.altKey);
  pointers.set(e.pointerId, local(e));
  // Two fingers always move the plan: a second finger cancels whatever the first one started.
  if (pointers.size === 2 && toolDrag) { tool.cancelPointer(); toolDrag = false; }
  if (pointers.size === 2) { startPinch(); moved = true; }
  if (pointers.size === 1) { downAt = local(e); moved = false; toolPointer = e.pointerId; toolDrag = !previewing && tool.pointerDown(local(e), e.pointerType); }
});
stage.addEventListener('pointermove', e => {
  if (e.pointerId === toolPointer || !pointers.size) tool.setModifiers(e.shiftKey, e.altKey);
  if (!pointers.has(e.pointerId)) { if (page && !previewing && e.pointerType === 'mouse') tool.hover(local(e)); return; }
  const prev = pointers.get(e.pointerId)!, p = local(e);
  pointers.set(e.pointerId, p);
  if (toolDrag) { if (e.pointerId === toolPointer) tool.pointerMove(p); return; }
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
    toolDrag = false; tool.pointerUp(); return;
  }
  if (pointers.size === 1 && pinch) { pinch = null; return; } // one finger still down: keep it as a pan
  if (pointers.size > 0) return;
  pinch = null;
  const drafting = !!tool.lineDraft; // a tap that ends the line leaves no draft behind, but still isn't a zoom
  if (!moved && !previewing) tool.tap(p);
  if (!moved) {
    const now = performance.now();
    if (now - lastTap.t < 320 && dist(p, lastTap.p) < 30 && !tool.placing && !drafting) { // placing or drawing a line: quick taps drop symbols and points (a double-tap ends the line), not a zoom
      lastTap.t = 0;
      if (view.scale > 1.05) fitToStage(); else applyView(zoomAt(view, 3, p));
      return;
    }
    lastTap = { t: now, p };
  }
  renderSharpSoon();
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', e => { moved = true; endPointer(e); }); // an OS-cancelled touch is not a tap
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

// iOS browsers ignore user-scalable=no: block page pinch-zoom and double-tap zoom outside the plan too.
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
  const now = Date.now();
  if (now - lastTouchEnd < 350 && !(e.target as Element).closest('input, button, label')) e.preventDefault();
  lastTouchEnd = now;
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

// ---------- Screens and saving ----------
shell = startShell({
  tool,
  openBytes,
  closePage() {
    openVersion++; page = false; pageEl.hidden = true; sharp.hidden = true; $('loading').hidden = true;
    setView('edit'); clearTimeout(toastTimer); $('toast').hidden = true; // an editor message doesn't follow you to Plans
  },
  toast,
  readPdfText: bytes => pdf.text(bytes),
});
