// Steps 2–3: outline the plot boundary, set the scale from one printed edge length, and mark any number
// of named existing features (house, driveway…). Snapping, guides, curves and undo/redo apply to all of them.
import {
  areaPt2, bulgeToward, constrain45, dist, edgeMid, edgePoints, formatFeet, formatScale, guides, nearestEdge,
  edgeTapOrder, moveInSection, nearestOnRing, snapSources, outlinePath, parseFeet, parseRadius, rectCorners, sectionPosition,
  type Outline, type OutlineKind, type OutlineShape,
} from './outline';
import { History } from './history';
import { committedOutlines } from './editor-state';
import type { PlanState } from './plan-model';
import { calibrate, IDENTITY, lineFeet, sameCorrection, type Calibration, type Correction, type Reference } from './scale';
import { GESTURE, HIT, MAGNIFIER, MARK, POPOVER, SQUARE_CHIP, TIP } from './overlay-tokens';
import { alignAll, alignCorner, cornerAngle, type Tidied } from './square';
import { boxSize, resizeBox, stretchEdge } from './stretch';
import { cornerArc, cornerBisector, distToCorner, distToSide, pushSide, radiusFromHandle, resizeCursor, roundHandleDistance, stepRadius, translate } from './shape-edit';
import { materialFill } from './patterns';
import { material, type MaterialId } from './materials';
import { containers, insideShape, shapeLabelPoint, shapePath, visibleShapes, type Shape } from './overlap';
import { button, cardHead, chipField, error, esc, field, figure, formStack, hint, inlineHint, input, row, token } from './ui';
import { findImageSnap, findSnapOnRay, SNAP_WINDOW } from './snap';
import type { Point } from './view';

export interface ToolHost {
  toPage(s: Point): Point;
  toScreen(p: Point): Point;
  /** Screen px per PDF point at the current zoom. */
  pxPerPt(): number;
  /** Draw the plan under screen point `s` into ctx (for the magnifier), magnified by `zoom`. */
  drawMagnified(ctx: CanvasRenderingContext2D, s: Point, zoom: number, size: number): void;
  toast(msg: string): void;
  /** Called whenever what can be undone/redone changes. */
  historyChanged(canUndo: boolean, canRedo: boolean): void;
  /** Called after every change to the outlines, what is being drawn, or the selection. */
  changed(): void;
  /** The plan's stretch correction changed: redraw the page (and everything on it) in the new true shape. */
  correctionChanged(c: Correction): void;
  /** Luminance (0–255) of the plan as shown, n×n samples at 1 per screen px, centred on screen point c. */
  sampleLuminance(c: Point, n: number): Float32Array | null;
}

/** A layer's colour (`--c`): the boundary and features by kind, a surface by its material. */
const colorOf = (o: Outline) => o.kind === 'surface' ? `var(--color-material-${o.material})` : o.kind === 'boundary' ? 'var(--color-boundary)' : 'var(--color-feature)';
/** A surface's material fill (colour + pattern), as an inline style addition. */
const fillOf = (o: Outline) => o.kind === 'surface' && o.material ? `;fill:${materialFill(o.material)}` : '';
const BOUNDARY = 'boundary'; // the plot boundary's id; features get f1, f2…

type Drag =
  | { type: 'place'; finger: Point; start: Point; touch: boolean; offsetY: number; rectStart?: boolean }
  | { type: 'corner'; id: string; i: number; grab: Point; moved: boolean }
  | { type: 'bend'; id: string; i: number; grab: Point; moved: boolean }
  // Surfaces only: move the whole zone, push one side, or round a corner (screen points from the press).
  | { type: 'move'; id: string; start: Point; before: Point[]; moved: boolean }
  | { type: 'side'; id: string; i: number; start: Point; before: Point[]; moved: boolean; fixed: 0 | 1 }
  | { type: 'round'; id: string; i: number; start: Point; r0: number; moved: boolean };

export class OutlineTool {
  outlines: Record<string, Outline> = {};
  drawing: string | null = null;
  /** Printed lengths typed for outline edges; the scale (and any stretch correction) is fitted to them. */
  refs: Reference[] = [];
  /** The fit of refs, recomputed on every update; null until a length is typed. */
  cal: Calibration | null = null;
  private shownCorrection: Correction = IDENTITY;
  /** What each layer shows once higher layers and the plot boundary have cut it (refreshed on every render). */
  private visible = new Map<string, Shape>();
  private visibleKey = '';
  private drag: Drag | null = null;
  private dragAt: Point | null = null;        // screen position of the point being placed or moved
  private hoverAt: Point | null = null;       // mouse position, for the rubber-band line
  private hoverEdge: { id: string; i: number } | null = null;
  /** The selected surface's corner the pointer is near (its round handle shows), or null. */
  private hoverCorner: number | null = null;
  /** The open edge; for a surface, `fixed` is the corner that stays put when a length is typed (0 = corner i). */
  private selectedEdge: { id: string; i: number; fixed: 0 | 1 } | null = null;
  private lastTap: { t: number; finger: Point } | null = null;
  /** Snapping, separately for tracing outlines (on by default) and designing surfaces (off by default). */
  private snap = { outlines: true, surfaces: false };
  /** Whether snapping is on for what is being drawn or edited now (a surface, or an outline). */
  get snapOn() { return this.snap[this.editingKind === 'surface' ? 'surfaces' : 'outlines']; }
  set snapOn(on: boolean) { this.snap[this.editingKind === 'surface' ? 'surfaces' : 'outlines'] = on; }
  private get editingKind() { const id = this.drawing ?? this.selected; return id ? this.outlines[id]?.kind ?? null : null; }
  /** How new outlines are drawn (the bottom bar's Freehand | Rectangle). */
  shape: OutlineShape = 'freehand';
  private rawAt: Point | null = null;          // where the point would be without snapping
  private snapped: 'corner' | 'line' | 'own' | null = null;
  private stick: { page: Point; kind: 'corner' | 'line' | 'own' } | null = null; // current snap target (sticky)
  private shiftKey = false;
  private angle: number | null = null;        // Shift-constrained direction, degrees
  private hoverPlaced: Point | null = null;   // where a click would place the next corner (mouse)
  selectedCorner: { id: string; i: number } | null = null;
  /** The outline being edited (boundary or feature): only it shows corners and bend handles, and only its can be dragged. */
  selected: string | null = null;
  private replaced: Outline | null = null;     // the outline being redrawn, put back on Cancel
  private history = new History<Snapshot>();
  private dragBefore: Snapshot | null = null;
  private lastNudge: { t: number; id: string; i: number } | null = null;
  private revision = 0;

  private svg: SVGSVGElement;
  private magnifier: HTMLCanvasElement;
  private popover: HTMLElement;
  private tip: HTMLElement;
  private squareChip: HTMLElement;

  private stageEl: HTMLElement;
  constructor(private host: ToolHost, stage: HTMLElement) {
    this.stageEl = stage;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('overlay');
    this.magnifier = Object.assign(document.createElement('canvas'), { className: 'magnifier', hidden: true });
    this.popover = Object.assign(document.createElement('div'), { className: 'card popover', hidden: true });
    this.tip = Object.assign(document.createElement('div'), { className: 'bubble tip', hidden: true });
    this.squareChip = Object.assign(document.createElement('div'), { className: 'card square-chip', hidden: true });
    this.squareChip.innerHTML = figure('') + button('Square', { data: { act: 'square' } })
      + chipField('corner-radius', 'Round', { inputmode: 'decimal', placeholder: '0′', title: '↑ ↓ to adjust (Shift: 2′)' });
    this.squareChip.querySelector<HTMLButtonElement>('[data-act=square]')!.onclick = () => this.squareSelectedCorner();
    const radius = this.squareChip.querySelector<HTMLInputElement>('#corner-radius')!;
    radius.onchange = () => {
      const c = this.selectedCorner, o = c && this.outlines[c.id], ft = parseRadius(radius.value);
      if (!c || !o || !this.cal) return;
      if (ft === null) {
        const r = o.radii?.[c.i] ?? 0;
        radius.value = r > 0 ? String(Math.round(r * this.cal.ftPerPt * 10) / 10) : '';
        return;
      }
      this.setCornerRadius(c.id, c.i, ft);
    };
    radius.onkeydown = e => {
      if (e.key === 'Enter') { radius.blur(); return; }
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      // Arrow keys step the radius live (0.5′, Shift 2′); a run of steps undoes as one.
      e.preventDefault();
      const c = this.selectedCorner, o = c && this.outlines[c.id]; if (!c || !o || !this.cal) return;
      const now = parseRadius(radius.value) ?? (o.radii?.[c.i] ?? 0) * this.cal.ftPerPt;
      const ft = stepRadius(now, e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
      radius.value = ft ? String(ft) : '';
      this.setCornerRadius(c.id, c.i, ft, true);
    };
    stage.append(this.svg, this.magnifier, this.tip, this.popover, this.squareChip);
    window.addEventListener('keydown', e => this.onKey(e));
  }

  // ---------- Undo / redo ----------
  private snapshot(): Snapshot {
    return {
      outlines: structuredClone(this.outlines), drawing: this.drawing, refs: structuredClone(this.refs), selectedCorner: this.selectedCorner,
      selected: this.selected, replaced: structuredClone(this.replaced),
    };
  }
  /** Call right before every change the user may want to undo. */
  private record() { this.history.record(this.snapshot()); this.lastNudge = null; this.revision++; }
  private restore(s: Snapshot) {
    this.outlines = s.outlines; this.drawing = s.drawing; this.refs = s.refs; this.selectedCorner = s.selectedCorner;
    this.selected = s.selected; this.replaced = s.replaced;
    this.drag = null; this.dragAt = null; this.snapped = null; this.stick = null; this.angle = null; this.hoverPlaced = null;
    this.selectedEdge = null; this.lastTap = null; this.lastNudge = null;
    this.magnifier.hidden = true;
    this.revision++;
    this.update();
    if (this.hoverAt) this.hover(this.hoverAt);
  }
  /** Replace everything with a saved plan: no selection, no undo history; snap and shape preferences stay. */
  load(state: PlanState) {
    this.outlines = structuredClone(state.outlines); this.refs = structuredClone(state.refs);
    this.drawing = null; this.replaced = null; this.selected = null; this.selectedCorner = null;
    this.drag = null; this.dragAt = null; this.snapped = null; this.stick = null; this.angle = null; this.hoverPlaced = null;
    this.selectedEdge = null; this.lastTap = null; this.lastNudge = null;
    this.magnifier.hidden = true;
    this.history.clear();
    this.revision++;
    this.update();
  }
  /** What to save: outlines and references, minus any outline still being drawn. */
  state(): PlanState { return { outlines: committedOutlines(this.outlines, this.drawing, this.replaced), refs: structuredClone(this.refs) }; }
  get saveRevision() { return this.revision; }
  undo() { if (this.drag) return; const s = this.history.undo(this.snapshot()); if (s) this.restore(s); }
  redo() { if (this.drag) return; const s = this.history.redo(this.snapshot()); if (s) this.restore(s); }

  // ---------- Commands ----------
  /** Outline the plot boundary (replacing the current one, if any). */
  startBoundary() { this.begin(BOUNDARY, 'boundary', 'Plot boundary'); }
  /** Outline a new existing feature with the name the contractor picked or typed. */
  startFeature(name: string) {
    let n = Object.keys(this.outlines).length + 1;
    while (this.outlines[`f${n}`]) n++;
    this.begin(`f${n}`, 'feature', name.trim() || 'Feature');
  }
  /** True once the plot boundary is closed: surfaces need the lot to clip to. */
  get boundaryClosed() { return !!this.outlines[BOUNDARY]?.closed && this.drawing !== BOUNDARY; }
  /** Draw a new surface (zone) of a material; its name starts as the material's. */
  startSurface(m: MaterialId) {
    if (!this.boundaryClosed) return;
    let n = 1;
    while (this.outlines[`s${n}`]) n++;
    this.begin(`s${n}`, 'surface', material(m).name, m);
  }
  /** Change a surface's material; a zone still named after its old material takes the new name. */
  setMaterial(id: string, m: MaterialId) {
    const o = this.outlines[id]; if (o?.kind !== 'surface' || o.material === m) return;
    this.record();
    if (!o.material || o.name === material(o.material).name) o.name = material(m).name;
    o.material = m;
    this.update();
  }
  /** Draw an existing outline again from scratch, keeping its name; Cancel puts the old one back. */
  redraw(id: string) { const o = this.outlines[id]; if (o) this.begin(id, o.kind, o.name, o.material); }
  private begin(id: string, kind: OutlineKind, name: string, m?: MaterialId) {
    if (this.drawing) this.cancel();
    this.record();
    this.replaced = this.outlines[id] ?? null;
    this.outlines[id] = { id, kind, name, pts: [], closed: false, ...(m ? { material: m } : {}) };
    this.drawing = id;
    this.selectedEdge = null; this.lastTap = null; this.selectedCorner = null; this.selected = null;
    this.update();
  }
  cancel() {
    if (!this.drawing) return;
    this.record();
    if (this.replaced) this.outlines[this.drawing] = this.replaced; else delete this.outlines[this.drawing];
    this.replaced = null; this.drawing = null; this.update();
  }
  /** Rename a feature or surface (the plot boundary keeps its name). */
  renameLayer(id: string, name: string) {
    const o = this.outlines[id], n = name.trim(); if (!o || !n || n === o.name) return;
    this.record(); o.name = n; this.update();
  }
  /** Delete a feature or surface (never the plot boundary). */
  deleteLayer(id: string) {
    const o = this.outlines[id]; if (!o || o.kind === 'boundary') return;
    this.record();
    delete this.outlines[id];
    this.refs = this.refs.filter(r => r.id !== id);
    if (this.selected === id) this.selected = null;
    if (this.selectedCorner?.id === id) this.selectedCorner = null;
    if (this.selectedEdge?.id === id) this.selectedEdge = null;
    this.host.toast(`${o.name} deleted.`);
    this.update();
  }
  close(record = true) {
    const o = this.current(); if (!o || o.pts.length < 3) return;
    if (record) this.record();
    // A redrawn outline's edges are new: lengths typed for the old ones no longer apply.
    const isNew = !this.replaced;
    if (this.replaced) this.refs = this.refs.filter(r => r.id !== o.id);
    o.closed = true; this.drawing = null; this.replaced = null; this.selected = o.id; // stays selected for adjusting
    o.bulges = o.pts.map((_, i) => o.bulges?.[i] ?? 0);
    // New layers go to the bottom (so higher ones cut them), except one drawn wholly inside another: it goes
    // just above the topmost one containing it, so it isn't hidden the moment it's finished.
    const inside = isNew && o.kind !== 'boundary' ? containers(o, Object.values(this.outlines)) : [];
    if (inside.length) this.placeAbove(o.id, inside[0]);
    this.host.toast(o.kind === 'surface'
      ? (this.cal ? `${o.name} added. Tap an edge to type the length you want.` : `${o.name} added. Set the scale on an outline edge to size it by typing lengths.`)
      : this.cal
      ? `${o.name} outlined. Tap an edge to see its length.`
      : `${o.name} outlined. Now tap an edge and type its printed length to set the scale.`);
    this.update();
  }
  private current(): Outline | undefined { return this.drawing ? this.outlines[this.drawing] : undefined; }
  /** True when single-finger input belongs to the tool rather than panning. */
  get busy() { return this.drawing !== null || this.drag !== null; }

  // ---------- Pointer input (screen coordinates) ----------
  pointerDown(p: Point, pointerType: string): boolean {
    this.hideTip();
    this.bypassHold = false; clearTimeout(this.holdTimer); this.downFinger = p;
    if (!this.drawing) this.stick = null; // keep only the target the placing preview is showing
    if (pointerType !== 'mouse') {
      // Press and hold still before moving: place this point freely (no snapping).
      this.holdTimer = window.setTimeout(() => {
        if (this.drag?.type !== 'place' && this.drag?.type !== 'corner') return;
        this.bypassHold = true;
        if (this.rawAt) this.applyDrag();
      }, GESTURE.holdMs);
    }
    // The selected surface corner's round handle sits inside the corner, so it goes before the corner itself.
    const round = this.roundHandleAt(p);
    if (round) {
      // Start from the radius as drawn (a typed one may be clamped to fit the sides).
      const o = this.outlines[round.id]!, at = this.host.toPage(round.at), c = o.pts[round.i];
      const r0 = o.radii?.[round.i] ? radiusFromHandle(Math.hypot(at.x - c.x, at.y - c.y), cornerBisector(o.pts, round.i).half) : 0;
      this.drag = { type: 'round', id: round.id, i: round.i, start: p, r0, moved: false };
      this.dragBefore = this.snapshot();
      return true;
    }
    const hit = this.cornerAt(p);
    if (hit) {
      const s = this.host.toScreen(this.outlines[hit.id]!.pts[hit.i]);
      this.drag = { type: 'corner', id: hit.id, i: hit.i, grab: { x: s.x - p.x, y: s.y - p.y }, moved: false };
      this.selectedCorner = { id: hit.id, i: hit.i };
      if (!this.drawing) this.selected = hit.id;
      this.dragBefore = this.snapshot();
      this.rawAt = s; this.dragAt = s; this.snapped = null; this.showMagnifier(); this.render();
      return true;
    }
    const bend = this.drawing ? null : this.bendHandleAt(p);
    if (bend) {
      const m = this.host.toScreen(edgeMid(this.outlines[bend.id]!.pts, bend.i, this.outlines[bend.id]!.bulges));
      this.drag = { type: 'bend', id: bend.id, i: bend.i, grab: { x: m.x - p.x, y: m.y - p.y }, moved: false };
      this.dragBefore = this.snapshot();
      this.rawAt = m; this.dragAt = m; this.snapped = null; this.selectedEdge = null; this.update();
      return true;
    }
    if (this.drawing) {
      // A tap places right under the finger; only when the finger starts dragging does the point
      // rise above it (gradually, so it doesn't jump), keeping it visible while adjusting.
      const touch = pointerType !== 'mouse', o = this.current()!;
      // Rectangle: the press places the first corner; the drag (or a second tap) gives the opposite one.
      const rectStart = this.shape === 'rect' && !o.pts.length;
      if (rectStart) { this.record(); o.pts.push(this.host.toPage(this.placeAt({ x: p.x, y: p.y }, null))); this.selectedCorner = null; }
      this.drag = { type: 'place', finger: p, start: p, touch, offsetY: 0, rectStart };
      this.rawAt = { x: p.x, y: p.y };
      this.dragAt = this.placeAt(this.rawAt, this.anchorFor(null));
      if (touch) this.showMagnifier();
      this.render();
      return true;
    }
    // A selected surface: press on a side to push it, or inside to move the whole zone (a tap still selects).
    const zone = this.selectedZone;
    if (zone) {
      const i = this.zoneSideAt(zone, p);
      const before = zone.pts.map(q => ({ ...q }));
      if (i !== null) {
        const a = this.host.toScreen(zone.pts[i]), b = this.host.toScreen(zone.pts[(i + 1) % zone.pts.length]);
        this.drag = { type: 'side', id: zone.id, i, start: p, before, moved: false, fixed: dist(p, a) <= dist(p, b) ? 0 : 1 };
        this.dragBefore = this.snapshot(); return true;
      }
      if (insideShape(this.visible.get(zone.id) ?? [], this.host.toPage(p))) {
        this.drag = { type: 'move', id: zone.id, start: p, before, moved: false };
        this.dragBefore = this.snapshot(); return true;
      }
    }
    const edge = this.edgeAt(p);
    if (edge) {
      // The corner nearer the tap stays put if a length is typed for a surface edge.
      const o = this.outlines[edge.id]!, a = this.host.toScreen(o.pts[edge.i]), b = this.host.toScreen(o.pts[(edge.i + 1) % o.pts.length]);
      this.selectedEdge = { ...edge, fixed: dist(p, a) <= dist(p, b) ? 0 : 1 }; this.selected = edge.id; this.update(); return true;
    }
    return false;
  }

  pointerMove(p: Point) {
    const d = this.drag; if (!d) return;
    if (d.type === 'move' || d.type === 'side' || d.type === 'round') {
      if (!d.moved && dist(p, d.start) < GESTURE.holdSlop) return; // still a tap
      d.moved = true; this.editZone(d, p); return;
    }
    if (this.downFinger && dist(p, this.downFinger) > GESTURE.holdSlop && !this.bypassHold) clearTimeout(this.holdTimer);
    if (d.type === 'place') {
      d.finger = p;
      if (d.touch) d.offsetY = Math.max(d.offsetY, Math.min(GESTURE.touchOffset, (dist(p, d.start) - GESTURE.holdSlop) * 1.5));
      this.rawAt = { x: p.x, y: p.y - d.offsetY };
    }
    else { this.rawAt = { x: p.x + d.grab.x, y: p.y + d.grab.y }; d.moved = true; }
    this.applyDrag();
  }

  private bypassKey = false;    // Option/Alt held: place freely
  private bypassHold = false;   // touch: pressed and held still before moving → place freely
  private holdTimer = 0;
  private downFinger: Point | null = null;

  /** Move a surface, push one of its sides, or round a corner, from the press at d.start to p (screen). */
  private editZone(d: Extract<Drag, { type: 'move' | 'side' | 'round' }>, p: Point) {
    const o = this.outlines[d.id]; if (!o) return;
    const a = this.host.toPage(d.start), b = this.host.toPage(p), delta = { x: b.x - a.x, y: b.y - a.y };
    if (d.type === 'move') { o.pts = translate(d.before, delta.x, delta.y); this.hideTip(); }
    else if (d.type === 'side') {
      o.pts = pushSide(d.before, d.i, delta);
      const ft = this.edgeFeet(o.id, d.i); this.showTipText(ft ? `Side ${formatFeet(ft)}` : 'Move side', p);
    } else {
      const { dir, half } = cornerBisector(o.pts, d.i), along = delta.x * dir.x + delta.y * dir.y;
      const r = radiusFromHandle(roundHandleDistance(d.r0, half) + along, half);
      o.radii = o.pts.map((_, k) => k === d.i ? r : o.radii?.[k] ?? 0);
      this.showTipText(r > 0 ? `Radius ${this.cal ? formatFeet(r * this.cal.ftPerPt) : ''}`.trim() : 'Sharp corner', p);
    }
    this.render();
  }
  private applyDrag() {
    const d = this.drag; if (!d || !this.rawAt || d.type === 'move' || d.type === 'side' || d.type === 'round') return;
    this.dragAt = d.type === 'bend' ? this.resolve(this.rawAt, undefined, true) : this.placeAt(this.rawAt, this.anchorFor(d.type === 'corner' ? d : null), d.type === 'corner' ? d : undefined);
    if (d.type === 'corner') this.outlines[d.id]!.pts[d.i] = this.host.toPage(this.dragAt);
    if (d.type === 'bend') {
      // Bend edge i so its arc passes through the handle. Within 2 px of straight, keep it straight.
      const o = this.outlines[d.id]!, a = o.pts[d.i], b = o.pts[(d.i + 1) % o.pts.length];
      const hgt = bulgeToward(a, b, this.host.toPage(this.dragAt));
      o.bulges![d.i] = Math.abs(hgt) * this.host.pxPerPt() < 2 ? 0 : hgt;
    }
    this.showMagnifier();
    this.render();
  }

  /**
   * Where a corner placed or dragged to screen position `raw` lands. Shift locks the edge from
   * `anchor` to 45° steps; otherwise snapping applies.
   */
  private placeAt(raw: Point, anchor: Point | null, exclude?: { id: string; i: number }): Point {
    if (this.shiftKey && anchor) {
      const c = constrain45(anchor, raw);
      this.snapped = null; this.stick = null; this.angle = c.angle;
      return this.snapOnRay(anchor, c.point, exclude);
    }
    this.angle = null;
    // Angles and alignment are never pulled into place without Shift (they felt sticky); the 90°,
    // straight and aligned hints still show. Snapping is to the outlines' own corners and the drawing.
    return this.resolve(raw, exclude);
  }
  /** Shift + snapping: stay on the 45° ray from `anchor`, but stop at corners on it or where it crosses a drawn line. */
  private snapOnRay(anchor: Point, c: Point, exclude?: { id: string; i: number }): Point {
    if (!this.snapOn || this.bypass) return c;
    const len = dist(anchor, c); if (len < 1) return c;
    const ux = (c.x - anchor.x) / len, uy = (c.y - anchor.y) / len;
    let best: Point | null = null, bd: number = GESTURE.ownSnap;
    for (const o of this.snapTargets(exclude)) o?.pts.forEach((pt, i) => {
      if (exclude && exclude.id === o.id && exclude.i === i) return;
      const s = this.host.toScreen(pt), t = (s.x - anchor.x) * ux + (s.y - anchor.y) * uy;
      const q = { x: anchor.x + t * ux, y: anchor.y + t * uy };
      if (t > 0 && dist(q, s) <= 6 && dist(q, c) < bd) { bd = dist(q, c); best = q; }
    });
    if (best) { this.snapped = 'own'; return best; }
    const n = SNAP_WINDOW, g = this.host.sampleLuminance(c, n); if (!g) return c;
    const o = { x: c.x - n / 2, y: c.y - n / 2 };
    const hit = findSnapOnRay(g, { x: n / 2, y: n / 2 }, { x: anchor.x - o.x, y: anchor.y - o.y, ux, uy }, n);
    if (!hit) return c;
    this.snapped = hit.kind;
    return { x: o.x + hit.x, y: o.y + hit.y };
  }

  /** The corner an edge is drawn from: the last corner while drawing, the previous corner while dragging one. */
  private anchorFor(c: { id: string; i: number } | null): Point | null {
    const o = c ? this.outlines[c.id] : this.current(); if (!o || !o.pts.length) return null;
    if (!c) return this.host.toScreen(o.pts[o.pts.length - 1]);
    if (c.i === 0 && !o.closed) return null;
    return this.host.toScreen(o.pts[(c.i - 1 + o.pts.length) % o.pts.length]);
  }

  /** Where a point placed at screen position `raw` lands: own corners first, then the drawing, else free. */
  private resolve(raw: Point, exclude?: { id: string; i: number }, lineOnly = false): Point {
    this.snapped = null;
    if (!this.snapOn || this.bypass) { this.stick = null; return raw; }
    const found = this.findSnap(raw, exclude, lineOnly), foundKind = this.snapped;
    if (lineOnly) return found ?? raw;
    // Sticky: keep the current target until the pointer clearly moves away from it — unless a
    // target closer to the pointer shows up.
    if (this.stick) {
      const s = this.host.toScreen(this.stick.page), ds = dist(s, raw);
      const better = found && dist(found, raw) < ds - 3;
      if (ds < GESTURE.release && !better) { this.snapped = this.stick.kind; return s; }
      this.stick = null;
    }
    this.snapped = foundKind;
    if (found) this.stick = { page: this.host.toPage(found), kind: foundKind! };
    return found ?? raw;
  }
  /** Outlines a placed point may snap to: tracing the boundary or a feature ignores designed surfaces. */
  private snapTargets(exclude?: { id: string; i: number }) {
    const editing = exclude?.id ?? this.drawing;
    return snapSources(Object.values(this.outlines), editing ? this.outlines[editing]?.kind ?? null : null);
  }
  private findSnap(raw: Point, exclude: { id: string; i: number } | undefined, lineOnly: boolean): Point | null {
    if (lineOnly) {
      // Bending: follow the drawn curve, so snap onto lines only (never to corners).
      const n = SNAP_WINDOW, g = this.host.sampleLuminance(raw, n), hit = g && findImageSnap(g, { x: n / 2, y: n / 2 });
      if (hit?.kind !== 'line') return null;
      this.snapped = 'line';
      return { x: raw.x - n / 2 + hit.x, y: raw.y - n / 2 + hit.y };
    }
    let best: Point | null = null, bd: number = GESTURE.ownSnap;
    for (const o of this.snapTargets(exclude)) {
      o?.pts.forEach((pt, i) => {
        if (exclude && exclude.id === o.id && exclude.i === i) return;
        const s = this.host.toScreen(pt), d = dist(s, raw);
        if (d < bd) { bd = d; best = s; }
      });
    }
    if (best) { this.snapped = 'own'; return best; }
    // Then onto another finished outline's edge (a bed sharing the lawn's edge); corners win over edges.
    const editing = exclude?.id ?? this.drawing;
    for (const o of this.snapTargets(exclude)) {
      if (!o?.closed || o.id === editing) continue;
      const near = nearestOnRing(outlinePath(o.pts, o.bulges, true).map(q => this.host.toScreen(q)), raw);
      if (near.d < bd) { bd = near.d; best = near.point; }
    }
    if (best) { this.snapped = 'own'; return best; }
    const n = SNAP_WINDOW, g = this.host.sampleLuminance(raw, n);
    const hit = g && findImageSnap(g, { x: n / 2, y: n / 2 });
    if (!hit) return null;
    this.snapped = hit.kind;
    return { x: raw.x - n / 2 + hit.x, y: raw.y - n / 2 + hit.y };
  }

  nudge(dx: number, dy: number) {
    const z = this.selectedZone;
    if (z && !this.selectedCorner) {
      // No corner selected on a surface: the arrows move the whole zone (consecutive nudges undo as one step).
      const now = performance.now(), ln = this.lastNudge;
      if (!(ln && ln.id === z.id && ln.i === -1 && now - ln.t < 1500)) this.record();
      else this.revision++;
      this.lastNudge = { t: now, id: z.id, i: -1 };
      const a = this.host.toPage({ x: 0, y: 0 }), b = this.host.toPage({ x: dx, y: dy });
      z.pts = translate(z.pts, b.x - a.x, b.y - a.y); this.update(); return;
    }
    const c = this.selectedCorner, o = c && this.outlines[c.id]; if (!c || !o?.pts[c.i]) return;
    // Consecutive nudges of the same corner undo as one step.
    const now = performance.now(), ln = this.lastNudge;
    if (!(ln && ln.id === c.id && ln.i === c.i && now - ln.t < 1500)) this.record();
    else this.revision++;
    this.lastNudge = { t: now, id: c.id, i: c.i };
    const s = this.host.toScreen(o.pts[c.i]); // one screen px, whatever the plan's stretch
    o.pts[c.i] = this.host.toPage({ x: s.x + dx, y: s.y + dy });
    this.update();
  }

  pointerUp() {
    clearTimeout(this.holdTimer); this.downFinger = null; this.bypassHold = false;
    const d = this.drag; this.drag = null; this.stick = null; this.angle = null;
    this.magnifier.hidden = true;
    if (!d) return;
    if (d.type === 'move' || d.type === 'side' || d.type === 'round') {
      this.hideTip();
      if (d.moved && this.dragBefore) { this.history.record(this.dragBefore); this.revision++; }
      this.dragBefore = null;
      if (!d.moved && d.type === 'side') this.selectedEdge = { id: d.id, i: d.i, fixed: d.fixed }; // a tap opens the side
      if (!d.moved && d.type === 'move') { this.tap(d.start); return; }
      this.update(); return;
    }
    if (d.type === 'bend') {
      if (d.moved && this.dragBefore) { this.history.record(this.dragBefore); this.revision++; }
      else this.selectedEdge = { id: d.id, i: d.i, fixed: 0 }; // a tap on the handle opens the edge
      this.dragBefore = null; this.dragAt = null; this.snapped = null; this.update(); return;
    }
    if (d.type === 'corner') {
      // A tap (no drag) on a corner while drawing: the first corner closes the shape.
      // A tap (no drag) while drawing: the first corner closes the shape; a quick second tap on the
      // corner just placed is a double-tap, which also closes it.
      const o = this.current(), now = performance.now();
      const tapped = !d.moved && o && d.id === o.id;
      if (tapped && o.pts.length >= 3 && (d.i === 0 || (d.i === o.pts.length - 1 && this.lastTap && now - this.lastTap.t < GESTURE.doubleTapMs))) {
        this.lastTap = null; this.dragAt = null; this.close(); return;
      }
      if (d.moved && this.dragBefore) { this.history.record(this.dragBefore); this.revision++; }
      this.dragBefore = null;
      this.dragAt = null; this.snapped = null; this.update(); return;
    }
    const o = this.current(); if (!o || !this.dragAt) return;
    if (this.shape === 'rect') {
      // A tap on the first corner leaves it waiting for the opposite one; a drag (or the second tap) finishes.
      if (d.rectStart && dist(d.finger, d.start) < GESTURE.holdSlop) { this.dragAt = null; this.snapped = null; this.update(); return; }
      this.finishRect(this.dragAt); return;
    }
    const now = performance.now();
    const isDouble = this.lastTap && now - this.lastTap.t < GESTURE.doubleTapMs && dist(this.lastTap.finger, d.finger) < 30;
    if (isDouble && o.pts.length >= 3) { this.lastTap = null; this.dragAt = null; this.close(); return; }
    this.record();
    o.pts.push(this.host.toPage(this.dragAt));
    this.selectedCorner = { id: o.id, i: o.pts.length - 1 };
    this.lastTap = { t: now, finger: d.finger };
    this.dragAt = null; this.snapped = null;
    this.update();
  }

  /** Rectangle from the first corner to the opposite one at screen point `at`, square to the plan; closes it. */
  private finishRect(at: Point) {
    const o = this.current()!, a = this.host.toScreen(o.pts[0]);
    this.dragAt = null; this.snapped = null;
    if (Math.abs(at.x - a.x) < GESTURE.rectMin || Math.abs(at.y - a.y) < GESTURE.rectMin) {
      this.host.toast('Drag to the opposite corner to draw a rectangle.'); this.update(); return;
    }
    this.record();
    o.pts = rectCorners(a, at).map(q => this.host.toPage(q));
    this.close(false);
  }

  /** A second finger arrived: abandon the single-finger action. */
  /** A second finger arrived: the gesture is navigation, so drop the single-finger action entirely. */
  cancelPointer() {
    clearTimeout(this.holdTimer); this.downFinger = null; this.bypassHold = false;
    // A rectangle's first corner, placed by the finger that turned out to be the start of a pinch: take it back.
    if (this.drag?.type === 'place' && this.drag.rectStart) { this.current()?.pts.pop(); this.revision++; }
    if (this.drag && this.drag.type !== 'place' && this.drag.moved && this.dragBefore) {
      // Put a corner or bend back where it was before the accidental drag.
      const before = this.dragBefore;
      this.outlines = before.outlines; this.refs = before.refs;
      this.revision++;
    }
    this.dragBefore = null; this.stick = null; this.snapped = null; this.angle = null;
    this.drag = null; this.magnifier.hidden = true; this.dragAt = null;
    this.update();
  }

  /**
   * A tap or click no corner, edge or handle took: select the existing feature under it (the smallest,
   * where features overlap), or drop the selection when it's outside every feature. (The boundary covers
   * the whole lot, so it's selected from its edges or its Layers row instead.)
   */
  tap(p: Point) {
    if (this.drawing) return;
    const hit = this.featureAt(p);
    if (hit === this.selected && !this.selectedEdge && !this.selectedCorner) return;
    this.selectedEdge = null; this.selectedCorner = null; this.selected = hit;
    this.update();
  }
  /** Select an outline from the Layers panel (null: drop the selection). */
  selectOutline(id: string | null) {
    if (this.drawing || (id && !this.outlines[id]?.closed)) return;
    if (id !== this.selected) this.aspectLock = false;
    this.selectedEdge = null; this.selectedCorner = null; this.selected = id; this.update();
  }
  /** Switch between drawing corner by corner and dragging a rectangle; an outline already started starts over (undoable). */
  setShape(shape: OutlineShape) {
    if (shape === this.shape) return;
    const o = this.current();
    if (o?.pts.length) { this.record(); o.pts = []; this.selectedCorner = null; this.lastTap = null; }
    this.shape = shape; this.dragAt = null; this.hoverPlaced = null;
    this.update();
    if (this.hoverAt) this.hover(this.hoverAt); // the pointer's mark follows the new tool straight away (X)
  }
  /**
   * Move a layer up or down within its Layers section (dir −1 = up). Higher layers cut lower ones; outlines always
   * cut surfaces; the plot boundary stays first and never moves.
   */
  moveLayer(id: string, dir: -1 | 1) {
    const ids = moveInSection(Object.keys(this.outlines), this.outlines, id, dir); if (!ids) return;
    this.record();
    this.outlines = Object.fromEntries(ids.map(k => [k, this.outlines[k]!]));
    this.update();
  }
  /** Put layer `id` directly above layer `above` (no undo step of its own: part of whatever made it). */
  private placeAbove(id: string, above: string) {
    const ids = Object.keys(this.outlines).filter(k => k !== id);
    ids.splice(ids.indexOf(above), 0, id);
    this.outlines = Object.fromEntries(ids.map(k => [k, this.outlines[k]!]));
  }
  /** Where a layer sits within its section (for disabling Move up / Move down at the ends). */
  layerPosition(id: string) { return sectionPosition(Object.keys(this.outlines), this.outlines, id); }
  /** True while a finished outline has a corner, edge or feature selected. */
  get selecting() { return this.selected !== null || this.selectedCorner !== null || this.selectedEdge !== null; }
  /** Escape: drop every selection. */
  deselect() {
    if (!this.selectedEdge && !this.selectedCorner && !this.selected) return;
    this.selectedEdge = null; this.selectedCorner = null; this.selected = null; this.update();
  }
  /** The layer whose visible part is under p (visible parts never overlap; one wholly covered can't be tapped). */
  private featureAt(p: Point): string | null {
    const pp = this.host.toPage(p);
    for (const [id, shape] of this.visible) if (insideShape(shape, pp)) return id;
    return null;
  }

  /** Place freely (no snapping): derived on every use, so it never outlives the key or hold behind it. */
  private get bypass() { return this.bypassKey || this.bypassHold; }

  hover(p: Point | null) {
    this.hoverAt = p;
    // Preview where a click would land, so snapping (and Shift) is visible before clicking.
    this.hoverPlaced = p && this.drawing ? this.placeAt(p, this.anchorFor(null)) : null;
    if (!this.hoverPlaced) { this.snapped = null; this.angle = null; if (!this.drag) this.stick = null; }
    const edge = p && !this.drawing ? this.edgeAt(p) : null;
    const changed = edge?.id !== this.hoverEdge?.id || edge?.i !== this.hoverEdge?.i;
    this.hoverEdge = edge;
    // Near a corner of the selected surface, show that corner's round handle.
    const z = p && !this.drag ? this.selectedZone : null;
    let near: number | null = null, nd: number = HIT.roundReveal;
    if (z && p) {
      const pp = this.host.toPage(p), k = this.host.pxPerPt();
      z.pts.forEach((_, i) => { const d = distToCorner(z.pts, i, z.radii, pp) * k; if (d < nd) { nd = d; near = i; } });
    }
    const cornerChanged = near !== this.hoverCorner;
    this.hoverCorner = near;
    if (cornerChanged && !changed && !this.drawing) this.render();
    // On the selected surface, say what a drag would do (and show it in the pointer).
    const action = p && !this.drag ? this.zoneActionAt(p) : null;
    this.stageEl.style.cursor = action ? action.cursor : '';
    if (action && p) this.showTipText(action.label, p);
    else if (edge && p) this.showTip(edge, p); else this.hideTip();
    if (changed || this.drawing) this.render();
  }

  /** What dragging from p would do on the selected surface: a label for the tip and a pointer. */
  private zoneActionAt(p: Point): { label: string; cursor: string } | null {
    const o = this.selectedZone; if (!o) return null;
    if (this.roundHandleAt(p)) return { label: 'Drag to round the corner', cursor: 'grab' };
    if (this.cornerAt(p)?.id === o.id) return { label: 'Drag to move the corner', cursor: 'grab' };
    if (this.bendHandleAt(p)?.id === o.id) return { label: 'Drag to curve the side', cursor: 'grab' };
    const i = this.zoneSideAt(o, p);
    if (i !== null) {
      // A two-way arrow across the side, like design tools show on a movable edge.
      const a = this.host.toScreen(o.pts[i]), b = this.host.toScreen(o.pts[(i + 1) % o.pts.length]), ft = this.edgeFeet(o.id, i);
      return { label: `Drag to move the side${ft ? ` · ${formatFeet(ft)}` : ''}`, cursor: resizeCursor({ x: -(b.y - a.y), y: b.x - a.x }) };
    }
    if (insideShape(this.visible.get(o.id) ?? [], this.host.toPage(p))) return { label: 'Drag to move', cursor: 'move' };
    return null;
  }
  /** The side of a surface whose drawn straight part is under p (screen); curved sides use their whole arc. */
  private zoneSideAt(o: Outline, p: Point): number | null {
    const pp = this.host.toPage(p), tol = HIT.zoneSide / this.host.pxPerPt();
    let best: number | null = null, bd = tol;
    o.pts.forEach((_, i) => {
      const d = o.bulges?.[i] ? (nearestEdge(o.pts, pp, tol, o.bulges) === i ? tol / 2 : Infinity) : distToSide(o.pts, i, o.radii, pp);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  /** The selected, finished surface (it can be moved, pushed and rounded), if any. */
  private get selectedZone(): Outline | null {
    const o = this.selected && !this.drawing ? this.outlines[this.selected] : undefined;
    return o?.kind === 'surface' && o.closed ? o : null;
  }
  /** Where the selected surface corner's round handle sits (screen), on its bisector at the arc's middle. */
  private roundHandlePos(): { id: string; i: number; at: Point } | null {
    const o = this.selectedZone, sel = this.selectedCorner;
    // The corner the pointer is near shows its handle; otherwise the selected corner does.
    const c = this.hoverCorner !== null && o ? { id: o.id, i: this.hoverCorner } : sel;
    if (!o || c?.id !== o.id || !o.pts[c.i] || o.bulges?.[c.i] || o.bulges?.[(c.i - 1 + o.pts.length) % o.pts.length]) return null;
    // On the arc's middle once rounded (on the drawn line, even when the radius is clamped to the sides); a sharp
    // corner's handle sits just inside it.
    const arc = cornerArc(o.pts, c.i, o.radii?.[c.i] ?? 0);
    if (arc) return { id: o.id, i: c.i, at: this.host.toScreen(arc[arc.length >> 1]) };
    const { dir } = cornerBisector(o.pts, c.i), d = MARK.roundHandleMin;
    const s = this.host.toScreen(o.pts[c.i]), t = this.host.toScreen({ x: o.pts[c.i].x + dir.x, y: o.pts[c.i].y + dir.y });
    const u = { x: t.x - s.x, y: t.y - s.y }, l = Math.hypot(u.x, u.y) || 1;
    return { id: o.id, i: c.i, at: { x: s.x + u.x / l * d, y: s.y + u.y / l * d } };
  }
  private roundHandleAt(p: Point) {
    const h = this.drawing ? null : this.roundHandlePos();
    return h && dist(h.at, p) < HIT.roundHandle ? h : null;
  }
  private bendHandleAt(p: Point): { id: string; i: number } | null {
    let best: { id: string; i: number } | null = null, bd: number = HIT.bend;
    for (const o of Object.values(this.outlines)) {
      if (!o?.closed || o.id !== this.selected) continue; // only the selected outline can be bent
      o.pts.forEach((_, i) => { const d = dist(this.host.toScreen(edgeMid(o.pts, i, o.bulges)), p); if (d < bd) { bd = d; best = { id: o.id, i }; } });
    }
    return best;
  }
  private cornerAt(p: Point): { id: string; i: number } | null {
    let best: { id: string; i: number } | null = null, bd: number = HIT.corner;
    for (const o of Object.values(this.outlines)) {
      // While drawing, other outlines' corners are snap targets (a shared corner places a new point
      // there), not handles to drag.
      if (this.drawing && o.id !== this.drawing) continue;
      // Otherwise only the selected outline's corners can be dragged: select first, then edit.
      if (!this.drawing && o.id !== this.selected) continue;
      // A selected surface's corners take a tighter area, so its sides and round handles stay easy to reach.
      const hit = o === this.selectedZone ? HIT.zoneCorner : HIT.corner;
      o.pts.forEach((pt, i) => { const d = dist(this.host.toScreen(pt), p); if (d < Math.min(bd, hit)) { bd = d; best = { id: o.id, i }; } });
    }
    return best;
  }
  private edgeAt(p: Point): { id: string; i: number } | null {
    const tol = HIT.edge / this.host.pxPerPt(), pp = this.host.toPage(p);
    for (const o of edgeTapOrder(Object.values(this.outlines), this.selected)) {
      if (!o?.closed) continue;
      const i = nearestEdge(o.pts, pp, tol, o.bulges);
      if (i !== null) return { id: o.id, i };
    }
    return null;
  }

  // ---------- Scale ----------
  /** The contractor typed edge i's printed length: keep it as a reference and refit the scale. */
  setEdgeLength(id: string, i: number, feet: number) {
    if (this.outlines[id]?.kind === 'surface') return; // surfaces are designed, not traced: they never set the scale
    this.record();
    this.refs = [...this.refs.filter(r => r.id !== id || r.i !== i), { id, i, feet }];
    this.selectedEdge = null;
    this.update();
    const c = this.cal!;
    this.host.toast(c.stretched ? `Plan stretch corrected. ${formatCalibration(c)}.`
      : c.needsOtherDirection ? 'These lengths all run the same way. Type one on an edge running the other way to correct a stretched plan.'
      : this.refs.length > 1 ? `Scale refitted: ${formatScale(c.ftPerPt)}.` : `Scale set: ${formatScale(c.ftPerPt)}.`);
  }
  /** A surface edge's typed length: stretch the zone along that edge from its fixed end. */
  resizeEdge(id: string, i: number, feet: number) {
    const o = this.outlines[id], c = this.cal, e = this.selectedEdge;
    if (o?.kind !== 'surface' || !o.closed || !c) return;
    this.record();
    const t = stretchEdge(o.pts, o.bulges, i, e?.id === id && e.i === i ? e.fixed : 0, feet / c.ftPerPt, c.correction);
    o.pts = t.pts; if (t.bulges) o.bulges = t.bulges;
    this.selectedEdge = null;
    this.update();
    this.host.toast(`${o.name}: edge now ${formatFeet(this.edgeFeet(id, i) ?? feet)}.`);
  }
  /** Width × Depth lock: typing one size scales the other in proportion. A session preference, off for each new selection. */
  aspectLock = false;
  /** A surface's bounding box in feet (true shape), or null before a scale exists. */
  zoneBox(id: string): { w: number; h: number } | null {
    const o = this.outlines[id], c = this.cal; if (o?.kind !== 'surface' || !o.closed || !c) return null;
    const b = boxSize(o.pts, o.bulges, c.correction);
    return { w: b.w * c.ftPerPt, h: b.h * c.ftPerPt };
  }
  /** A surface's typed Width or Depth: scale it about the center of its bounding box (both sizes when locked). */
  resizeZone(id: string, axis: 'w' | 'h', feet: number) {
    const o = this.outlines[id], c = this.cal;
    if (o?.kind !== 'surface' || !o.closed || !c || !(feet > 0)) return;
    const before = this.zoneBox(id); if (!before || Math.abs(before[axis] - feet) < 1e-6) return;
    this.record();
    const t = resizeBox(o.pts, o.bulges, axis, feet / c.ftPerPt, this.aspectLock, c.correction);
    o.pts = t.pts; if (t.bulges) o.bulges = t.bulges;
    this.update();
    const now = this.zoneBox(id)!;
    this.host.toast(`${o.name}: ${formatFeet(now.w)} × ${formatFeet(now.h)}.`);
  }
  /** Swap which end of the open surface edge stays put. */
  swapFixedEnd() {
    const e = this.selectedEdge; if (!e) return;
    this.selectedEdge = { ...e, fixed: e.fixed ? 0 : 1 }; this.update();
  }
  removeReference(k: number) {
    if (!this.refs[k]) return;
    this.record(); this.refs = this.refs.filter((_, j) => j !== k); this.update();
  }
  /** Square: line the selected corner (only it) up with its neighbours (see square.ts). */
  squareSelectedCorner() {
    const c = this.selectedCorner, o = c && this.outlines[c.id];
    if (!c || !o?.closed || this.drawing) return;
    this.applyTidy(o, alignCorner(o.pts, o.bulges, c.i, this.shownCorrection));
  }
  /** True when a corner is selected and still exists (the nudge arrows apply to it). */
  get cornerSelected() { const c = this.selectedCorner; return !!(c && this.outlines[c.id]?.pts[c.i]); }
  /** Round surface corner i to a radius in feet (0 = sharp). */
  setCornerRadius(id: string, i: number, feet: number, steps = false) {
    const o = this.outlines[id], c = this.cal; if (o?.kind !== 'surface' || !c || !o.pts[i]) return;
    // Arrow-key steps on the same corner within 1.5 s undo as one step (like nudges).
    const t = performance.now(), ln = this.lastNudge, key = -2 - i;
    if (!(steps && ln && ln.id === id && ln.i === key && t - ln.t < 1500)) this.record();
    if (steps) this.lastNudge = { t, id, i: key };
    if (steps && ln && ln.id === id && ln.i === key && t - ln.t < 1500) this.revision++;
    o.radii = o.pts.map((_, k) => k === i ? feet / c.ftPerPt : o.radii?.[k] ?? 0);
    this.update();
  }
  /** Round every corner of a surface to one radius in feet (0 = all sharp). */
  roundAll(id: string, feet: number) {
    const o = this.outlines[id], c = this.cal; if (o?.kind !== 'surface' || !c) return;
    this.record();
    o.radii = o.pts.map(() => feet / c.ftPerPt);
    this.update();
  }
  /** Square all corners: line every corner of an outline up with the others at once. */
  squareAll(id: string) {
    const o = this.outlines[id]; if (!o?.closed || this.drawing) return;
    this.applyTidy(o, alignAll(o.pts, o.bulges, this.shownCorrection));
  }
  /** True when tidying would move some corner by more than a hair (0.05 screen px). */
  private moves(o: Outline, t: Tidied) { return t.pts.some((p, k) => dist(p, o.pts[k]) * this.host.pxPerPt() > 0.05); }
  private applyTidy(o: Outline, t: Tidied) {
    if (!this.moves(o, t)) return;
    this.record();
    o.pts = t.pts; if (t.bulges) o.bulges = t.bulges;
    this.update();
  }
  /** "87.4° · Square" beside a selected corner of a finished outline that isn't square yet. */
  private renderSquareChip() {
    const chip = this.squareChip, c = this.selectedCorner, o = c && this.outlines[c.id];
    // Shown while Square would still move the corner (lined up already, or no edge near across/down: hidden).
    const squarable = !!(c && o?.closed && !this.drawing && !this.drag && this.moves(o, alignCorner(o.pts, o.bulges, c.i, this.shownCorrection)));
    // A selected surface corner always shows the chip: its radius can be typed (once there's a scale).
    const roundable = !!(c && o === this.selectedZone && !this.drag && this.cal && this.roundHandlePos());
    if (!squarable && !roundable) { chip.hidden = true; return; }
    chip.querySelector<HTMLElement>('[data-act=square]')!.hidden = !squarable;
    const field = chip.querySelector<HTMLElement>('.chip-field')!, radius = field.querySelector('input')!;
    field.hidden = !roundable;
    if (roundable && document.activeElement !== radius) {
      const r = o!.radii?.[c!.i] ?? 0;
      radius.value = r > 0 ? String(Math.round(r * this.cal!.ftPerPt * 10) / 10) : '';
    }
    const angle = cornerAngle(o!.pts, o!.bulges, c!.i, this.shownCorrection);
    chip.querySelector('.text-figure')!.textContent = `${angle.toFixed(1)}°`;
    chip.hidden = false;
    const s = this.host.toScreen(o!.pts[c!.i]), stage = this.svg.getBoundingClientRect(), m = SQUARE_CHIP.margin;
    chip.style.left = `${Math.max(m, Math.min(stage.width - chip.offsetWidth - m, s.x + SQUARE_CHIP.dx))}px`;
    chip.style.top = `${Math.max(m, Math.min(stage.height - chip.offsetHeight - m, s.y + SQUARE_CHIP.dy))}px`;
  }
  /** Edge i as page points (arcs sampled), end included. */
  edgeLine(id: string, i: number) {
    const o = this.outlines[id]!, b = o.pts[(i + 1) % o.pts.length];
    return [...edgePoints(o.pts[i], b, o.bulges?.[i] ?? 0), b];
  }
  edgeFeet(id: string, i: number) {
    return this.cal && this.outlines[id]?.pts[i] ? lineFeet(this.edgeLine(id, i), this.cal) : null;
  }
  /** Area of a closed outline in square feet (null before the scale is set). */
  areaSqft(o: Outline) {
    const c = this.cal; if (!c) return null;
    const m = c.correction;
    return areaPt2(o.pts, o.bulges) * Math.abs(m.a * m.d - m.b * m.c) * c.ftPerPt * c.ftPerPt;
  }
  /** Refit the scale to the typed lengths; tell the host when the plan's stretch correction changes. */
  private recalibrate() {
    const valid = this.refs.filter(r => this.outlines[r.id]?.closed && r.i < this.outlines[r.id]!.pts.length);
    this.cal = calibrate(valid.map(r => ({ line: this.edgeLine(r.id, r.i), feet: r.feet })));
    const c = this.cal?.correction ?? IDENTITY;
    if (!sameCorrection(c, this.shownCorrection)) { this.shownCorrection = c; this.host.correctionChanged(c); }
  }

  // ---------- Rendering ----------
  /** Redraw overlay, popover and panel. */
  update() { this.recalibrate(); this.render(); this.renderPopover(); this.host.historyChanged(this.history.canUndo, this.history.canRedo); this.host.changed(); }

  render() {
    const h = this.host;
    // Cutting only depends on the shapes and their order, not the view: redo it only when those change.
    const key = JSON.stringify(Object.values(this.outlines).map(o => [o.id, o.closed, o.pts, o.bulges, o.radii]));
    if (key !== this.visibleKey) { this.visibleKey = key; this.visible = visibleShapes(Object.values(this.outlines)); }
    let svg = '';
    // Paint surfaces first so outlines' strokes sit on top, and the layer being drawn or edited last of all.
    const active = this.drawing ?? this.selected, all = Object.values(this.outlines);
    const paint = [...all.filter(o => o.kind === 'surface'), ...all.filter(o => o.kind !== 'surface')];
    paint.sort((a, b) => Number(a.id === active) - Number(b.id === active));
    for (const o of paint) {
      if (!o || !o.pts.length) continue;
      const pts = o.pts.map(p => h.toScreen(p));
      const drawingThis = this.drawing === o.id, cursor = drawingThis ? this.dragAt ?? (this.drag ? null : this.hoverPlaced) : null;
      // Rectangle in progress: preview the whole rectangle from the first corner to the pointer.
      const rectPreview = drawingThis && this.shape === 'rect' && pts.length === 1 && cursor ? rectCorners(pts[0], cursor) : null;
      if (cursor && !rectPreview) pts.push(cursor);
      const line = o.closed ? outlinePath(o.pts, o.bulges, true, o.radii).map(p => h.toScreen(p)) : rectPreview ?? pts;
      const d = line.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + (o.closed || rectPreview ? ' Z' : '');
      const sel = this.selected === o.id, shown = this.visible.get(o.id);
      if (shown) {
        // A finished layer shows only its visible part; selected, its whole drawn outline shows too (dashed) so
        // it's clear what is being edited.
        if (shown.length) svg += `<path d="${shapePath(shown, h.toScreen)}" data-id="${esc(o.id)}" class="shape ${o.kind} closed${sel ? ' selected' : ''}" style="--c:${colorOf(o)}${fillOf(o)}"/>`;
        if (sel) svg += `<path d="${d}" class="shape ${o.kind} drawn" style="--c:${colorOf(o)}"/>`;
      } else svg += `<path d="${d}" class="shape ${o.kind}${o.closed ? ' closed' : ''}${sel || (drawingThis && o.kind === 'surface') ? ' selected' : ''}" style="--c:${colorOf(o)}${o.closed ? fillOf(o) : ''}"/>`;
      for (const e of [this.hoverEdge, this.selectedEdge]) {
        if (e?.id !== o.id || !o.closed) continue;
        const b = o.pts[(e.i + 1) % o.pts.length], seg = [...edgePoints(o.pts[e.i], b, o.bulges?.[e.i] ?? 0), b].map(p => h.toScreen(p));
        svg += `<path d="${seg.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}" class="edge-hi" style="--c:${colorOf(o)}"/>`;
      }
      // Only the outline being drawn or edited shows its handles; the rest are just shape and name.
      const handles = drawingThis || (!this.drawing && this.selected === o.id);
      if (o.closed && handles) o.pts.forEach((_, i) => {
        // Edge middle handles: drag to bend the edge into an arc.
        const m = h.toScreen(edgeMid(o.pts, i, o.bulges)), bent = !!o.bulges?.[i];
        svg += `<rect x="${m.x - MARK.bendHandle / 2}" y="${m.y - MARK.bendHandle / 2}" width="${MARK.bendHandle}" height="${MARK.bendHandle}" rx="${MARK.bendHandleRadius}" class="bend-handle${bent ? ' bent' : ''}" style="--c:${colorOf(o)}"/>`;
      });
      if (handles) o.pts.forEach((p, i) => {
        const s = h.toScreen(p);
        const closeTarget = drawingThis && i === 0 && o.pts.length >= 3;
        if (closeTarget) svg += `<circle cx="${s.x}" cy="${s.y}" r="${MARK.closeRing}" class="close-target" style="--c:${colorOf(o)}"/>`;
        svg += `<circle cx="${s.x}" cy="${s.y}" r="${closeTarget ? MARK.cornerClose : MARK.corner}" class="corner" style="--c:${colorOf(o)}"/>`;
      });
    }
    const fe = this.selectedEdge, feo = fe && this.outlines[fe.id];
    if (fe && feo?.kind === 'surface' && feo.closed) {
      // The end that stays put when a length is typed.
      const s = h.toScreen(feo.pts[(fe.i + fe.fixed) % feo.pts.length]);
      svg += `<circle cx="${s.x}" cy="${s.y}" r="${MARK.closeRing}" class="fixed-end" style="--c:${colorOf(feo)}"/>`;
    }
    const rh = this.drag?.type === 'move' || this.drag?.type === 'side' ? null : this.roundHandlePos();
    if (rh) svg += `<circle cx="${rh.at.x.toFixed(1)}" cy="${rh.at.y.toFixed(1)}" r="${MARK.roundHandle}" class="round-handle" style="--c:${colorOf(this.outlines[rh.id]!)}"/>`;
    for (const o of Object.values(this.outlines)) {
      // Feature names go on top of every shape so overlapping features stay readable, inside each one's visible
      // part. Surfaces carry no label: their fill says what they are, and the row names them.
      if (o.kind === 'surface') continue;
      const shown = this.visible.get(o.id), at = shown && shapeLabelPoint(shown);
      if (!at) continue;
      const c = h.toScreen(at);
      svg += `<text x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" class="label feature${this.selected === o.id ? ' selected' : ''}">${esc(o.name)}</text>`;
    }
    if (this.dragAt) svg += this.renderGuides(this.dragAt);
    else if (this.drawing && this.hoverPlaced) svg += this.renderGuides(this.hoverPlaced);
    const sel = this.selectedCorner && !this.dragAt ? this.outlines[this.selectedCorner.id]?.pts[this.selectedCorner.i] : null;
    if (sel) { const s = h.toScreen(sel); svg += `<circle cx="${s.x}" cy="${s.y}" r="${MARK.ring}" class="selected-corner"/>`; }
    const at = this.dragAt ?? (this.drawing && !this.drag ? this.hoverPlaced : null);
    if (at) {
      const { x, y } = at;
      if (this.angle !== null) svg += `<text x="${x + MARK.labelDx}" y="${y + MARK.labelDy}" class="label snap">${this.angle}°</text>`;
      if (this.dragAt && this.bypassHold) svg += `<text x="${x + MARK.labelDx}" y="${y + MARK.labelDy}" class="label snap">Free</text>`;
      if (this.snapped) {
        svg += `<circle cx="${x}" cy="${y}" r="${MARK.snapHalo}" class="snap-halo"/>`;
        const label = { corner: 'Corner', line: 'On line', own: 'Corner' }[this.snapped];
        svg += this.snapped === 'line'
          ? `<path d="M${x} ${y - MARK.snapLine}L${x + MARK.snapLine} ${y}L${x} ${y + MARK.snapLine}L${x - MARK.snapLine} ${y}Z" class="snap-mark"/>`
          : `<rect x="${x - MARK.snapCorner}" y="${y - MARK.snapCorner}" width="${2 * MARK.snapCorner}" height="${2 * MARK.snapCorner}" class="snap-mark"/>`;
        svg += `<text x="${x + MARK.labelDx}" y="${y + MARK.labelDy}" class="label snap">${label}</text>`;
      }
      // Rectangle: dashed guides across the whole plan through the pointer (the rectangle runs square to the plan,
      // so they show where its edges will go) and a ⌐ instead of Freehand's dot.
      if (this.drawing && this.shape === 'rect') svg += `<path d="M-${MARK.guideSpan} ${y}H${MARK.guideSpan}M${x} -${MARK.guideSpan}V${MARK.guideSpan}" class="rect-guide"/>`;
      if (this.dragAt) svg += `<circle cx="${x}" cy="${y}" r="${MARK.ring}" class="placing"/>${crosshair(x, y)}`;
      else if (this.drawing && this.shape === 'rect') { const k = MARK.cornerBracket; svg += `<path d="M${x} ${y + k}V${y}H${x + k}" class="corner-bracket"/>`; }
      else svg += `<circle cx="${x}" cy="${y}" r="${MARK.hoverDot}" class="hover-dot"/>`;
    }
    this.svg.innerHTML = svg;
    this.positionPopover();
    this.renderSquareChip();
    if (this.dragAt && !this.magnifier.hidden) this.drawMagnifier();
  }

  /** Hints for the point being placed or moved: right angle, straight on, and alignment with other corners. */
  private renderGuides(at: Point): string {
    const h = this.host, d = this.drag;
    let out = '', prev: Point | null = null, prevprev: Point | null = null, next: Point | null = null, nextnext: Point | null = null;
    let skip: { id: string; i: number } | null = null;
    if ((!d || d.type === 'place') && this.drawing) {
      const pts = this.outlines[this.drawing]!.pts.map(p => h.toScreen(p));
      prev = pts.at(-1) ?? null; prevprev = pts.at(-2) ?? null;
    } else if (d?.type === 'corner') {
      const o = this.outlines[d.id]!, n = o.pts.length, at2 = (k: number) => (o.closed || (k >= 0 && k < n)) ? h.toScreen(o.pts[(k + n) % n]) : null;
      prev = at2(d.i - 1); prevprev = at2(d.i - 2); next = at2(d.i + 1); nextnext = at2(d.i + 2);
      skip = d;
    }
    const others: Point[] = [];
    for (const o of Object.values(this.outlines)) o?.pts.forEach((p, i) => {
      if (skip && skip.id === o.id && skip.i === i) return;
      const s = h.toScreen(p);
      if ((prev && dist(s, prev) < 0.5) || (next && dist(s, next) < 0.5)) return; // the edge itself already shows that line
      others.push(s);
    });
    const marks = (pp: Point | null, p: Point | null) => {
      if (!pp || !p) return;
      const g = guides(pp, p, at, [], 0);
      if (g.rightAngle) {
        const u1 = unit(pp, p), u2 = unit(p, at), s = MARK.guideArm;
        const a = { x: p.x - u1.x * s, y: p.y - u1.y * s }, c = { x: p.x + u2.x * s, y: p.y + u2.y * s };
        out += `<path d="M${a.x} ${a.y}L${a.x + u2.x * s} ${a.y + u2.y * s}L${c.x} ${c.y}" class="guide-angle"/><text x="${p.x + MARK.guideLabelDx}" y="${p.y + MARK.guideLabelDy}" class="label guide">90°</text>`;
      } else if (g.straight) out += `<text x="${p.x + MARK.guideLabelDx}" y="${p.y + MARK.guideLabelDy}" class="label guide">Straight</text>`;
    };
    marks(prevprev, prev); marks(nextnext, next);
    const g = guides(null, null, at, others, 2.5);
    if (g.alignX) out += `<line x1="${g.alignX.x}" y1="${g.alignX.y}" x2="${g.alignX.x}" y2="${at.y}" class="guide-line"/>`;
    if (g.alignY) out += `<line x1="${g.alignY.x}" y1="${g.alignY.y}" x2="${at.x}" y2="${g.alignY.y}" class="guide-line"/>`;
    return out;
  }

  private showMagnifier() { this.magnifier.hidden = false; }
  private drawMagnifier() {
    const size = MAGNIFIER.size, r = Math.min(window.devicePixelRatio || 1, 3), m = this.magnifier, at = this.dragAt!;
    if (m.width !== size * r) { m.width = m.height = size * r; m.style.width = m.style.height = `${size}px`; }
    const ctx = m.getContext('2d')!;
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.clearRect(0, 0, size, size);
    this.host.drawMagnified(ctx, at, MAGNIFIER.zoom, size);
    ctx.strokeStyle = token('--color-snap'); ctx.lineWidth = MAGNIFIER.crosshairWidth;
    const c = size / 2, k = MAGNIFIER.crosshair;
    ctx.beginPath(); ctx.moveTo(c - k, c); ctx.lineTo(c + k, c); ctx.moveTo(c, c - k); ctx.lineTo(c, c + k); ctx.stroke();
    // Sit above the point; flip below when there's no room.
    const above = at.y - size - MAGNIFIER.gap > 0;
    m.style.left = `${at.x - size / 2}px`;
    m.style.top = `${above ? at.y - size - MAGNIFIER.gap : at.y + MAGNIFIER.gap}px`;
  }

  private showTipText(text: string, p: Point) {
    this.tip.textContent = text;
    this.tip.style.left = `${p.x + TIP.offset}px`; this.tip.style.top = `${p.y + TIP.offset}px`;
    this.tip.hidden = false;
  }
  private showTip(e: { id: string; i: number }, p: Point) {
    const ft = this.edgeFeet(e.id, e.i);
    this.tip.textContent = ft ? formatFeet(ft) : this.outlines[e.id]?.kind === 'surface' ? 'No scale yet' : 'Tap to set this edge’s length';
    this.tip.style.left = `${p.x + TIP.offset}px`; this.tip.style.top = `${p.y + TIP.offset}px`;
    this.tip.hidden = false;
  }
  private hideTip() { this.tip.hidden = true; }

  private renderPopover() {
    const e = this.selectedEdge;
    if (!e || !this.outlines[e.id]?.closed) { this.popover.hidden = true; return; }
    if (this.outlines[e.id]!.kind === 'surface') { this.renderSurfacePopover(e); return; }
    const ft = this.edgeFeet(e.id, e.i);
    const o = this.outlines[e.id]!, curved = !!o.bulges?.[e.i], ref = this.refs.find(r => r.id === e.id && r.i === e.i);
    this.popover.innerHTML = `
      ${cardHead(`${esc(o.name)} edge`)}
      ${figure(ft ? `Measures <b>${formatFeet(ft)}</b>${curved ? ' along the curve' : ''}` : 'No scale yet')}
      ${curved ? button('Make straight', { data: { act: 'straighten' } }) : hint('Drag the square in the middle of the edge to curve it.')}
      ${formStack(`
        ${field('edge-len', 'Printed length on the plan', row(input('edge-len', { inputmode: 'decimal', placeholder: `e.g. 116.45 or 116' 5"`, value: ref ? String(ref.feet) : undefined }), button(ref ? 'Update' : this.cal ? 'Add length' : 'Set scale', { variant: 'primary', type: 'submit' })))}
        ${ref ? button('Remove this length', { variant: 'danger', data: { act: 'unref' } })
          : this.cal ? hint('Lengths on edges running across and down also correct a stretched plan.') : ''}
        ${error(`Type a length in feet, like 116.45 or 116' 5".`)}`)}`;
    this.popover.hidden = false;
    this.popover.querySelector<HTMLButtonElement>('[data-act=close]')!.onclick = () => { this.selectedEdge = null; this.update(); };
    const straighten = this.popover.querySelector<HTMLButtonElement>('[data-act=straighten]');
    if (straighten) straighten.onclick = () => { this.record(); this.outlines[e.id]!.bulges![e.i] = 0; this.update(); };
    const unref = this.popover.querySelector<HTMLButtonElement>('[data-act=unref]');
    if (unref) unref.onclick = () => { this.selectedEdge = null; this.removeReference(this.refs.indexOf(ref!)); };
    const form = this.popover.querySelector('form')!;
    form.onsubmit = ev => {
      ev.preventDefault();
      const feet = parseFeet(this.popover.querySelector<HTMLInputElement>('#edge-len')!.value);
      if (!feet) { this.popover.querySelector<HTMLElement>('.text-error')!.hidden = false; return; }
      this.setEdgeLength(e.id, e.i, feet);
    };
    this.positionPopover();
  }
  /** A surface edge: its length can be typed to resize the zone (never the scale). */
  private renderSurfacePopover(e: { id: string; i: number; fixed: 0 | 1 }) {
    const o = this.outlines[e.id]!, ft = this.edgeFeet(e.id, e.i), curved = !!o.bulges?.[e.i];
    this.popover.innerHTML = `
      ${cardHead(`${esc(o.name)} edge`)}
      ${figure(ft ? `Measures <b>${formatFeet(ft)}</b>${curved ? ' along the curve' : ''}` : 'No scale yet')}
      ${curved ? button('Make straight', { data: { act: 'straighten' } }) : ''}
      ${ft === null ? hint('Set the scale on an outline edge first.') : formStack(`
        ${field('edge-len', 'Length', row(input('edge-len', { inputmode: 'decimal', placeholder: `e.g. 16 or 16' 6"` }), button('Resize', { variant: 'primary', type: 'submit' })))}
        ${row(inlineHint('Stays put: the marked end'), button('Swap', { mods: ['small'], data: { act: 'swap' } }))}
        ${error(`Type a length in feet, like 16 or 16' 6".`)}`)}`;
    this.popover.hidden = false;
    this.popover.querySelector<HTMLButtonElement>('[data-act=close]')!.onclick = () => { this.selectedEdge = null; this.update(); };
    const straighten = this.popover.querySelector<HTMLButtonElement>('[data-act=straighten]');
    if (straighten) straighten.onclick = () => { this.record(); o.bulges![e.i] = 0; this.update(); };
    const swap = this.popover.querySelector<HTMLButtonElement>('[data-act=swap]');
    if (swap) swap.onclick = () => this.swapFixedEnd();
    const form = this.popover.querySelector('form');
    if (form) form.onsubmit = ev => {
      ev.preventDefault();
      const feet = parseFeet(this.popover.querySelector<HTMLInputElement>('#edge-len')!.value);
      if (!feet) { this.popover.querySelector<HTMLElement>('.text-error')!.hidden = false; return; }
      this.resizeEdge(e.id, e.i, feet);
    };
    this.positionPopover();
  }
  private positionPopover() {
    const e = this.selectedEdge; if (!e || this.popover.hidden) return;
    const o = this.outlines[e.id]; if (!o) return;
    const a = this.host.toScreen(o.pts[e.i]), b = this.host.toScreen(o.pts[(e.i + 1) % o.pts.length]);
    const stage = this.svg.getBoundingClientRect(), w = this.popover.offsetWidth || POPOVER.fallbackWidth, hgt = this.popover.offsetHeight || POPOVER.fallbackHeight, mg = POPOVER.margin;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    this.popover.style.left = `${Math.max(mg, Math.min(stage.width - w - mg, mx - w / 2))}px`;
    this.popover.style.top = `${Math.max(mg, Math.min(stage.height - hgt - mg, my + POPOVER.below))}px`;
  }




  /**
   * The modifier keys as the latest input event reports them (Shift = 45° steps, Option/Alt = place
   * freely). Fed from every pointer and key event, and cleared when the window loses focus, so a
   * missed keyup (e.g. ⇧⌘4 screenshot) can't leave a modifier stuck on.
   */
  setModifiers(shift: boolean, alt: boolean) {
    if (shift === this.shiftKey && alt === this.bypassKey) return;
    this.shiftKey = shift; this.bypassKey = alt;
    if (this.drag) this.applyDrag(); else if (this.hoverAt) this.hover(this.hoverAt);
  }

  private onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === 'INPUT') return; // let text fields keep their own undo
    const mod = e.metaKey || e.ctrlKey, key = e.key.toLowerCase();
    if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
    if (mod && key === 'y') { e.preventDefault(); this.redo(); return; }
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key] && (this.selectedCorner || this.selectedZone)) { e.preventDefault(); const k = e.shiftKey ? 10 : 1; this.nudge(arrows[e.key][0] * k, arrows[e.key][1] * k); return; }
    if (this.drawing) {
      if (e.key === 'Enter') { e.preventDefault(); this.close(); }
      else if (e.key === 'Escape') this.cancel();
      else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); this.undo(); }
    } else if (e.key === 'Escape') this.deselect();
  }
}

/** "Across 1 in = 30.0 ft · Down 1 in = 29.6 ft" (or one scale when not stretched). */
function formatCalibration(c: Calibration): string {
  if (!c.stretched) return formatScale(c.ftPerPt);
  return `Across 1 in = ${(c.ftPerPt * c.correction.a * 72).toFixed(1)} ft · Down 1 in = ${(c.ftPerPt * c.correction.d * 72).toFixed(1)} ft`;
}

function crosshair(x: number, y: number): string {
  const o = MARK.crosshairOuter, g = MARK.crosshairGap;
  return `<path d="M${x - o} ${y}H${x - g}M${x + g} ${y}H${x + o}M${x} ${y - o}V${y - g}M${x} ${y + g}V${y + o}" class="crosshair"/>`;
}
function unit(a: Point, b: Point): Point { const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; }

interface Snapshot {
  outlines: Record<string, Outline>;
  drawing: string | null;
  refs: Reference[];
  selectedCorner: { id: string; i: number } | null;
  selected: string | null;
  replaced: Outline | null;
}
