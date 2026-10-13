// Steps 2–3: outline the plot boundary, set the scale from one printed edge length, and mark any number
// of named existing features (house, driveway…). Snapping, guides, curves and undo/redo apply to all of them.
import {
  areaPt2, bulgeToward, constrain45, dist, snapToGuides, edgeLengthPt, edgeMid, edgePoints, formatArea, formatFeet, formatScale, guides, nearestEdge,
  insidePolygon, labelPoint, outlinePath, parseFeet, percentOff,
  type Outline, type OutlineKind,
} from './outline';
import { History } from './history';
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
  /** Luminance (0–255) of the plan as shown, n×n samples at 1 per screen px, centred on screen point c. */
  sampleLuminance(c: Point, n: number): Float32Array | null;
}

const CORNER_HIT = 24;      // screen px
const EDGE_HIT = 16;        // screen px
const TOUCH_OFFSET = 56;    // when dragging to place on touch, the point rises this far above the finger
const DOUBLE_TAP_MS = 350;
const HOLD_MS = 450;        // touch: press and hold this long without moving to place freely
const HOLD_SLOP = 6;        // screen px of finger jitter still counted as holding still
const BEND_HIT = 20;        // screen px around an edge's middle handle
const GUIDE_SNAP = 6;       // screen px: pull into line with other corners / square to the previous edge
const OWN_SNAP = 22;        // screen px: snap to the outlines' own corners first
const RELEASE = 34;         // screen px: once snapped, the point stays put until the pointer moves this far away
const COLORS: Record<OutlineKind, string> = { boundary: 'var(--outline-boundary)', feature: 'var(--outline-feature)' };
const BOUNDARY = 'boundary'; // the plot boundary's id; features get f1, f2…

type Drag =
  | { type: 'place'; finger: Point; start: Point; touch: boolean; offsetY: number }
  | { type: 'corner'; id: string; i: number; grab: Point; moved: boolean }
  | { type: 'bend'; id: string; i: number; grab: Point; moved: boolean };

export class OutlineTool {
  outlines: Record<string, Outline> = {};
  drawing: string | null = null;
  ftPerPt: number | null = null;
  printedLotSqft: number | null = null;
  private drag: Drag | null = null;
  private dragAt: Point | null = null;        // screen position of the point being placed or moved
  private hoverAt: Point | null = null;       // mouse position, for the rubber-band line
  private hoverEdge: { id: string; i: number } | null = null;
  private selectedEdge: { id: string; i: number } | null = null;
  private lastTap: { t: number; finger: Point } | null = null;
  snapOn = true;
  private rawAt: Point | null = null;          // where the point would be without snapping
  private snapped: 'corner' | 'line' | 'own' | 'guide' | null = null;
  private guideLabel = '';
  private stick: { page: Point; kind: 'corner' | 'line' | 'own' } | null = null; // current snap target (sticky)
  private shiftKey = false;
  private angle: number | null = null;        // Shift-constrained direction, degrees
  private hoverPlaced: Point | null = null;   // where a click would place the next corner (mouse)
  selectedCorner: { id: string; i: number } | null = null;
  selectedFeature: string | null = null;
  private replaced: Outline | null = null;     // the outline being redrawn, put back on Cancel
  private history = new History<Snapshot>();
  private dragBefore: Snapshot | null = null;
  private lastNudge: { t: number; id: string; i: number } | null = null;

  private svg: SVGSVGElement;
  private magnifier: HTMLCanvasElement;
  private popover: HTMLElement;
  private tip: HTMLElement;
  private panel: HTMLElement;

  constructor(private host: ToolHost, stage: HTMLElement, panel: HTMLElement) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('overlay');
    this.magnifier = Object.assign(document.createElement('canvas'), { className: 'magnifier', hidden: true });
    this.popover = Object.assign(document.createElement('div'), { className: 'popover', hidden: true });
    this.tip = Object.assign(document.createElement('div'), { className: 'edge-tip', hidden: true });
    stage.append(this.svg, this.magnifier, this.tip, this.popover);
    this.panel = panel;
    window.addEventListener('keydown', e => this.onKey(e));
  }

  // ---------- Undo / redo ----------
  private snapshot(): Snapshot {
    return {
      outlines: structuredClone(this.outlines), drawing: this.drawing, ftPerPt: this.ftPerPt, selectedCorner: this.selectedCorner,
      selectedFeature: this.selectedFeature, replaced: structuredClone(this.replaced),
    };
  }
  /** Call right before every change the user may want to undo. */
  private record() { this.history.record(this.snapshot()); this.lastNudge = null; }
  private restore(s: Snapshot) {
    this.outlines = s.outlines; this.drawing = s.drawing; this.ftPerPt = s.ftPerPt; this.selectedCorner = s.selectedCorner;
    this.selectedFeature = s.selectedFeature; this.replaced = s.replaced;
    this.drag = null; this.dragAt = null; this.snapped = null; this.stick = null; this.angle = null; this.hoverPlaced = null;
    this.selectedEdge = null; this.lastTap = null; this.lastNudge = null;
    this.magnifier.hidden = true;
    this.update();
    if (this.hoverAt) this.hover(this.hoverAt);
  }
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
  /** Draw an existing outline again from scratch, keeping its name; Cancel puts the old one back. */
  redraw(id: string) { const o = this.outlines[id]; if (o) this.begin(id, o.kind, o.name); }
  private begin(id: string, kind: OutlineKind, name: string) {
    if (this.drawing) this.cancel();
    this.record();
    this.replaced = this.outlines[id] ?? null;
    this.outlines[id] = { id, kind, name, pts: [], closed: false };
    this.drawing = id;
    this.selectedEdge = null; this.lastTap = null; this.selectedCorner = null; this.selectedFeature = null;
    this.update();
  }
  cancel() {
    if (!this.drawing) return;
    this.record();
    if (this.replaced) this.outlines[this.drawing] = this.replaced; else delete this.outlines[this.drawing];
    this.replaced = null; this.drawing = null; this.update();
  }
  renameFeature(id: string, name: string) {
    const o = this.outlines[id], n = name.trim(); if (!o || !n || n === o.name) return;
    this.record(); o.name = n; this.update();
  }
  deleteFeature(id: string) {
    const o = this.outlines[id]; if (!o || o.kind !== 'feature') return;
    this.record();
    delete this.outlines[id];
    if (this.selectedFeature === id) this.selectedFeature = null;
    if (this.selectedCorner?.id === id) this.selectedCorner = null;
    if (this.selectedEdge?.id === id) this.selectedEdge = null;
    this.host.toast(`${o.name} deleted.`);
    this.update();
  }
  close() {
    const o = this.current(); if (!o || o.pts.length < 3) return;
    this.record();
    o.closed = true; this.drawing = null; this.replaced = null;
    o.bulges = o.pts.map((_, i) => o.bulges?.[i] ?? 0);
    this.host.toast(this.ftPerPt
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
        if (!this.drag || this.drag.type === 'bend') return;
        this.bypassHold = true;
        if (this.rawAt) this.applyDrag();
      }, HOLD_MS);
    }
    const hit = this.cornerAt(p);
    if (hit) {
      const s = this.host.toScreen(this.outlines[hit.id]!.pts[hit.i]);
      this.drag = { type: 'corner', id: hit.id, i: hit.i, grab: { x: s.x - p.x, y: s.y - p.y }, moved: false };
      this.selectedCorner = { id: hit.id, i: hit.i };
      if (!this.drawing) this.selectedFeature = this.outlines[hit.id]!.kind === 'feature' ? hit.id : null;
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
      const touch = pointerType !== 'mouse';
      this.drag = { type: 'place', finger: p, start: p, touch, offsetY: 0 };
      this.rawAt = { x: p.x, y: p.y };
      this.dragAt = this.placeAt(this.rawAt, this.anchorFor(null));
      if (touch) this.showMagnifier();
      this.render();
      return true;
    }
    const edge = this.edgeAt(p);
    if (edge) { this.selectedEdge = edge; this.selectedFeature = null; this.update(); return true; }
    return false;
  }

  pointerMove(p: Point) {
    const d = this.drag; if (!d) return;
    if (this.downFinger && dist(p, this.downFinger) > HOLD_SLOP && !this.bypassHold) clearTimeout(this.holdTimer);
    if (d.type === 'place') {
      d.finger = p;
      if (d.touch) d.offsetY = Math.max(d.offsetY, Math.min(TOUCH_OFFSET, (dist(p, d.start) - HOLD_SLOP) * 1.5));
      this.rawAt = { x: p.x, y: p.y - d.offsetY };
    }
    else { this.rawAt = { x: p.x + d.grab.x, y: p.y + d.grab.y }; d.moved = true; }
    this.applyDrag();
  }

  private bypassKey = false;    // Option/Alt held: place freely
  private bypassHold = false;   // touch: pressed and held still before moving → place freely
  private holdTimer = 0;
  private downFinger: Point | null = null;

  private applyDrag() {
    const d = this.drag; if (!d || !this.rawAt) return;
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
    // Priority: the outline's own corners, then guides (alignment, square, straight), then the drawing.
    if (this.snapOn && !this.bypass) {
      const ctx = this.guideContext(exclude);
      if (!this.ownCornerNear(raw, exclude)) {
        const g = snapToGuides(raw, ctx.prevprev, ctx.prev, ctx.others, GUIDE_SNAP);
        if (g) { this.snapped = 'guide'; this.guideLabel = g.label; this.stick = null; return g.point; }
      }
    }
    return this.resolve(raw, exclude);
  }
  private ownCornerNear(raw: Point, exclude?: { id: string; i: number }): boolean {
    return Object.values(this.outlines).some(o => o?.pts.some((pt, i) => !(exclude && exclude.id === o.id && exclude.i === i) && dist(this.host.toScreen(pt), raw) < OWN_SNAP));
  }
  /** Neighbouring corners (screen px) for guides: the edge being drawn or dragged, and every other corner. */
  private guideContext(exclude?: { id: string; i: number }): { prevprev: Point | null; prev: Point | null; others: Point[] } {
    const h = this.host, others: Point[] = [];
    for (const o of Object.values(this.outlines)) o?.pts.forEach((p, i) => { if (!(exclude && exclude.id === o.id && exclude.i === i)) others.push(h.toScreen(p)); });
    let prev: Point | null = null, prevprev: Point | null = null;
    if (exclude) {
      const o = this.outlines[exclude.id]!, n = o.pts.length, at = (k: number) => (o.closed || (k >= 0 && k < n)) ? h.toScreen(o.pts[(k + n) % n]) : null;
      prev = at(exclude.i - 1); prevprev = at(exclude.i - 2);
    } else {
      const o = this.current();
      if (o?.pts.length) { prev = h.toScreen(o.pts[o.pts.length - 1]); prevprev = o.pts.length > 1 ? h.toScreen(o.pts[o.pts.length - 2]) : null; }
    }
    return { prevprev, prev, others };
  }
  /** Shift + snapping: stay on the 45° ray from `anchor`, but stop at corners on it or where it crosses a drawn line. */
  private snapOnRay(anchor: Point, c: Point, exclude?: { id: string; i: number }): Point {
    if (!this.snapOn || this.bypass) return c;
    const len = dist(anchor, c); if (len < 1) return c;
    const ux = (c.x - anchor.x) / len, uy = (c.y - anchor.y) / len;
    let best: Point | null = null, bd = OWN_SNAP;
    for (const o of Object.values(this.outlines)) o?.pts.forEach((pt, i) => {
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
      if (ds < RELEASE && !better) { this.snapped = this.stick.kind; return s; }
      this.stick = null;
    }
    this.snapped = foundKind;
    if (found) this.stick = { page: this.host.toPage(found), kind: foundKind! };
    return found ?? raw;
  }
  private findSnap(raw: Point, exclude: { id: string; i: number } | undefined, lineOnly: boolean): Point | null {
    if (lineOnly) {
      // Bending: follow the drawn curve, so snap onto lines only (never to corners).
      const n = SNAP_WINDOW, g = this.host.sampleLuminance(raw, n), hit = g && findImageSnap(g, { x: n / 2, y: n / 2 });
      if (hit?.kind !== 'line') return null;
      this.snapped = 'line';
      return { x: raw.x - n / 2 + hit.x, y: raw.y - n / 2 + hit.y };
    }
    let best: Point | null = null, bd = OWN_SNAP;
    for (const o of Object.values(this.outlines)) {
      o?.pts.forEach((pt, i) => {
        if (exclude && exclude.id === o.id && exclude.i === i) return;
        const s = this.host.toScreen(pt), d = dist(s, raw);
        if (d < bd) { bd = d; best = s; }
      });
    }
    if (best) { this.snapped = 'own'; return best; }
    const n = SNAP_WINDOW, g = this.host.sampleLuminance(raw, n);
    const hit = g && findImageSnap(g, { x: n / 2, y: n / 2 });
    if (!hit) return null;
    this.snapped = hit.kind;
    return { x: raw.x - n / 2 + hit.x, y: raw.y - n / 2 + hit.y };
  }

  nudge(dx: number, dy: number) {
    const c = this.selectedCorner, o = c && this.outlines[c.id]; if (!c || !o?.pts[c.i]) return;
    // Consecutive nudges of the same corner undo as one step.
    const now = performance.now(), ln = this.lastNudge;
    if (!(ln && ln.id === c.id && ln.i === c.i && now - ln.t < 1500)) this.record();
    this.lastNudge = { t: now, id: c.id, i: c.i };
    const k = 1 / this.host.pxPerPt(), p = o.pts[c.i];
    o.pts[c.i] = { x: p.x + dx * k, y: p.y + dy * k };
    this.update();
  }

  pointerUp() {
    clearTimeout(this.holdTimer); this.downFinger = null; this.bypassHold = false;
    const d = this.drag; this.drag = null; this.stick = null; this.angle = null;
    this.magnifier.hidden = true;
    if (!d) return;
    if (d.type === 'bend') {
      if (d.moved && this.dragBefore) this.history.record(this.dragBefore);
      else this.selectedEdge = { id: d.id, i: d.i }; // a tap on the handle opens the edge
      this.dragBefore = null; this.dragAt = null; this.snapped = null; this.update(); return;
    }
    if (d.type === 'corner') {
      // A tap (no drag) on a corner while drawing: the first corner closes the shape.
      // A tap (no drag) while drawing: the first corner closes the shape; a quick second tap on the
      // corner just placed is a double-tap, which also closes it.
      const o = this.current(), now = performance.now();
      const tapped = !d.moved && o && d.id === o.id;
      if (tapped && o.pts.length >= 3 && (d.i === 0 || (d.i === o.pts.length - 1 && this.lastTap && now - this.lastTap.t < DOUBLE_TAP_MS))) {
        this.lastTap = null; this.dragAt = null; this.close(); return;
      }
      if (d.moved && this.dragBefore) this.history.record(this.dragBefore);
      this.dragBefore = null;
      this.dragAt = null; this.snapped = null; this.update(); return;
    }
    const o = this.current(); if (!o || !this.dragAt) return;
    const now = performance.now();
    const isDouble = this.lastTap && now - this.lastTap.t < DOUBLE_TAP_MS && dist(this.lastTap.finger, d.finger) < 30;
    if (isDouble && o.pts.length >= 3) { this.lastTap = null; this.dragAt = null; this.close(); return; }
    this.record();
    o.pts.push(this.host.toPage(this.dragAt));
    this.selectedCorner = { id: o.id, i: o.pts.length - 1 };
    this.lastTap = { t: now, finger: d.finger };
    this.dragAt = null; this.snapped = null;
    this.update();
  }

  /** A second finger arrived: abandon the single-finger action. */
  /** A second finger arrived: the gesture is navigation, so drop the single-finger action entirely. */
  cancelPointer() {
    clearTimeout(this.holdTimer); this.downFinger = null; this.bypassHold = false;
    if ((this.drag?.type === 'corner' || this.drag?.type === 'bend') && this.drag.moved && this.dragBefore) {
      // Put a corner or bend back where it was before the accidental drag.
      const before = this.dragBefore;
      this.outlines = before.outlines; this.ftPerPt = before.ftPerPt;
    }
    this.dragBefore = null; this.stick = null; this.snapped = null; this.angle = null;
    this.drag = null; this.magnifier.hidden = true; this.dragAt = null;
    this.update();
  }

  /**
   * A tap or click no corner, edge or handle took: select the existing feature under it (the smallest,
   * where features overlap), or drop the selection when it's outside every feature.
   */
  tap(p: Point) {
    if (this.drawing) return;
    const hit = this.featureAt(p);
    if (hit === this.selectedFeature && !this.selectedEdge && !this.selectedCorner) return;
    this.selectedEdge = null; this.selectedCorner = null; this.selectedFeature = hit;
    this.update();
  }
  /** Escape: drop every selection. */
  deselect() {
    if (!this.selectedEdge && !this.selectedCorner && !this.selectedFeature) return;
    this.selectedEdge = null; this.selectedCorner = null; this.selectedFeature = null; this.update();
  }
  private featureAt(p: Point): string | null {
    const pp = this.host.toPage(p);
    let best: string | null = null, ba = Infinity;
    for (const o of Object.values(this.outlines)) {
      if (o.kind !== 'feature' || !o.closed) continue;
      const a = Math.abs(areaPt2(o.pts, o.bulges));
      if (a < ba && insidePolygon(outlinePath(o.pts, o.bulges, true), pp)) { ba = a; best = o.id; }
    }
    return best;
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
    if (edge && p) this.showTip(edge, p); else this.hideTip();
    if (changed || this.drawing) this.render();
  }

  private bendHandleAt(p: Point): { id: string; i: number } | null {
    let best: { id: string; i: number } | null = null, bd = BEND_HIT;
    for (const o of Object.values(this.outlines)) {
      if (!o?.closed) continue;
      o.pts.forEach((_, i) => { const d = dist(this.host.toScreen(edgeMid(o.pts, i, o.bulges)), p); if (d < bd) { bd = d; best = { id: o.id, i }; } });
    }
    return best;
  }
  private cornerAt(p: Point): { id: string; i: number } | null {
    let best: { id: string; i: number } | null = null, bd = CORNER_HIT;
    for (const o of Object.values(this.outlines)) {
      // While drawing, other outlines' corners are snap targets (a shared corner places a new point
      // there), not handles to drag.
      if (this.drawing && o.id !== this.drawing) continue;
      o.pts.forEach((pt, i) => { const d = dist(this.host.toScreen(pt), p); if (d < bd) { bd = d; best = { id: o.id, i }; } });
    }
    return best;
  }
  private edgeAt(p: Point): { id: string; i: number } | null {
    const tol = EDGE_HIT / this.host.pxPerPt(), pp = this.host.toPage(p);
    for (const o of Object.values(this.outlines)) {
      if (!o?.closed) continue;
      const i = nearestEdge(o.pts, pp, tol, o.bulges);
      if (i !== null) return { id: o.id, i };
    }
    return null;
  }

  // ---------- Scale ----------
  setScaleFromEdge(id: string, i: number, feet: number) {
    this.record();
    this.ftPerPt = feet / edgeLengthPt(this.outlines[id]!.pts, i, this.outlines[id]!.bulges);
    this.host.toast(`Scale set: ${formatScale(this.ftPerPt)}.`);
    this.selectedEdge = null;
    this.update();
  }
  private edgeFeet(id: string, i: number) {
    return this.ftPerPt ? edgeLengthPt(this.outlines[id]!.pts, i, this.outlines[id]!.bulges) * this.ftPerPt : null;
  }

  // ---------- Rendering ----------
  /** Redraw overlay, popover and panel. */
  update() { this.render(); this.renderPopover(); this.renderPanel(); this.host.historyChanged(this.history.canUndo, this.history.canRedo); }

  render() {
    const h = this.host;
    let svg = '';
    for (const o of Object.values(this.outlines)) {
      if (!o || !o.pts.length) continue;
      const pts = o.pts.map(p => h.toScreen(p));
      const drawingThis = this.drawing === o.id;
      if (drawingThis && this.dragAt) pts.push(this.dragAt);
      else if (drawingThis && this.hoverPlaced && !this.drag) pts.push(this.hoverPlaced);
      const line = o.closed ? outlinePath(o.pts, o.bulges, true).map(p => h.toScreen(p)) : pts;
      const d = line.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + (o.closed ? ' Z' : '');
      const sel = this.selectedFeature === o.id;
      svg += `<path d="${d}" class="shape ${o.kind}${o.closed ? ' closed' : ''}${sel ? ' selected' : ''}" style="--c:${COLORS[o.kind]}"/>`;
      for (const e of [this.hoverEdge, this.selectedEdge]) {
        if (e?.id !== o.id || !o.closed) continue;
        const b = o.pts[(e.i + 1) % o.pts.length], seg = [...edgePoints(o.pts[e.i], b, o.bulges?.[e.i] ?? 0), b].map(p => h.toScreen(p));
        svg += `<path d="${seg.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}" class="edge-hi" style="--c:${COLORS[o.kind]}"/>`;
      }
      if (o.closed && !this.drawing) o.pts.forEach((_, i) => {
        // Edge middle handles: drag to bend the edge into an arc.
        const m = h.toScreen(edgeMid(o.pts, i, o.bulges)), bent = !!o.bulges?.[i];
        svg += `<rect x="${m.x - 5}" y="${m.y - 5}" width="10" height="10" rx="2" class="bend-handle${bent ? ' bent' : ''}" style="--c:${COLORS[o.kind]}"/>`;
      });
      o.pts.forEach((p, i) => {
        const s = h.toScreen(p);
        const closeTarget = drawingThis && i === 0 && o.pts.length >= 3;
        if (closeTarget) svg += `<circle cx="${s.x}" cy="${s.y}" r="16" class="close-target" style="--c:${COLORS[o.kind]}"/>`;
        svg += `<circle cx="${s.x}" cy="${s.y}" r="${closeTarget ? 7 : 6}" class="corner" style="--c:${COLORS[o.kind]}"/>`;
      });
    }
    for (const o of Object.values(this.outlines)) {
      // Names go on top of every shape so overlapping features stay readable.
      if (o.kind !== 'feature' || !o.closed) continue;
      const c = h.toScreen(labelPoint(outlinePath(o.pts, o.bulges, true)));
      svg += `<text x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}" class="feature-label${this.selectedFeature === o.id ? ' selected' : ''}">${esc(o.name)}</text>`;
    }
    if (this.dragAt) svg += this.renderGuides(this.dragAt);
    else if (this.drawing && this.hoverPlaced) svg += this.renderGuides(this.hoverPlaced);
    const sel = this.selectedCorner && !this.dragAt ? this.outlines[this.selectedCorner.id]?.pts[this.selectedCorner.i] : null;
    if (sel) { const s = h.toScreen(sel); svg += `<circle cx="${s.x}" cy="${s.y}" r="11" class="selected-corner"/>`; }
    const at = this.dragAt ?? (this.drawing && !this.drag ? this.hoverPlaced : null);
    if (at) {
      const { x, y } = at;
      if (this.angle !== null) svg += `<text x="${x + 16}" y="${y - 14}" class="snap-label">${this.angle}°</text>`;
      if (this.dragAt && this.bypassHold) svg += `<text x="${x + 16}" y="${y - 14}" class="snap-label">Free</text>`;
      if (this.snapped) {
        svg += `<circle cx="${x}" cy="${y}" r="16" class="snap-halo"/>`;
        const label = { corner: 'Corner', line: 'On line', own: 'Corner', guide: this.guideLabel }[this.snapped];
        svg += this.snapped === 'line' || this.snapped === 'guide'
          ? `<path d="M${x} ${y - 9}L${x + 9} ${y}L${x} ${y + 9}L${x - 9} ${y}Z" class="snap-mark"/>`
          : `<rect x="${x - 8}" y="${y - 8}" width="16" height="16" class="snap-mark"/>`;
        svg += `<text x="${x + 16}" y="${y - 14}" class="snap-label">${label}</text>`;
      }
      if (this.dragAt) svg += `<circle cx="${x}" cy="${y}" r="11" class="placing"/><path d="M${x - 18} ${y}H${x - 5}M${x + 5} ${y}H${x + 18}M${x} ${y - 18}V${y - 5}M${x} ${y + 5}V${y + 18}" class="crosshair"/>`;
      else svg += `<circle cx="${x}" cy="${y}" r="4" class="hover-dot"/>`;
    }
    this.svg.innerHTML = svg;
    this.positionPopover();
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
        const u1 = unit(pp, p), u2 = unit(p, at), s = 12;
        const a = { x: p.x - u1.x * s, y: p.y - u1.y * s }, c = { x: p.x + u2.x * s, y: p.y + u2.y * s };
        out += `<path d="M${a.x} ${a.y}L${a.x + u2.x * s} ${a.y + u2.y * s}L${c.x} ${c.y}" class="guide-angle"/><text x="${p.x + 10}" y="${p.y + 24}" class="guide-label">90°</text>`;
      } else if (g.straight) out += `<text x="${p.x + 10}" y="${p.y + 24}" class="guide-label">Straight</text>`;
    };
    marks(prevprev, prev); marks(nextnext, next);
    const g = guides(null, null, at, others, 2.5);
    if (g.alignX) out += `<line x1="${g.alignX.x}" y1="${g.alignX.y}" x2="${g.alignX.x}" y2="${at.y}" class="guide-line"/>`;
    if (g.alignY) out += `<line x1="${g.alignY.x}" y1="${g.alignY.y}" x2="${at.x}" y2="${g.alignY.y}" class="guide-line"/>`;
    return out;
  }

  private showMagnifier() { this.magnifier.hidden = false; }
  private drawMagnifier() {
    const size = 132, r = Math.min(window.devicePixelRatio || 1, 3), m = this.magnifier, at = this.dragAt!;
    if (m.width !== size * r) { m.width = m.height = size * r; m.style.width = m.style.height = `${size}px`; }
    const ctx = m.getContext('2d')!;
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.clearRect(0, 0, size, size);
    this.host.drawMagnified(ctx, at, 3, size);
    ctx.strokeStyle = '#d0349a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(size / 2 - 14, size / 2); ctx.lineTo(size / 2 + 14, size / 2); ctx.moveTo(size / 2, size / 2 - 14); ctx.lineTo(size / 2, size / 2 + 14); ctx.stroke();
    // Sit above the point; flip below when there's no room.
    const above = at.y - size - 40 > 0;
    m.style.left = `${at.x - size / 2}px`;
    m.style.top = `${above ? at.y - size - 40 : at.y + 40}px`;
  }

  private showTip(e: { id: string; i: number }, p: Point) {
    const ft = this.edgeFeet(e.id, e.i);
    this.tip.textContent = ft ? formatFeet(ft) : 'Tap to set this edge’s length';
    this.tip.style.left = `${p.x + 14}px`; this.tip.style.top = `${p.y + 14}px`;
    this.tip.hidden = false;
  }
  private hideTip() { this.tip.hidden = true; }

  private renderPopover() {
    const e = this.selectedEdge;
    if (!e || !this.outlines[e.id]?.closed) { this.popover.hidden = true; return; }
    const ft = this.edgeFeet(e.id, e.i);
    this.popover.innerHTML = `
      <div class="pop-head"><strong>${esc(this.outlines[e.id]!.name)} edge</strong><button type="button" class="icon" data-act="close" aria-label="Close">×</button></div>
      <div class="pop-measure">${ft ? `Measures <b>${formatFeet(ft)}</b>${this.outlines[e.id]!.bulges?.[e.i] ? ' along the curve' : ''}` : 'No scale yet'}</div>
      ${this.outlines[e.id]!.bulges?.[e.i] ? '<button type="button" data-act="straighten">Make straight</button>' : '<p class="pop-hint">Drag the square in the middle of the edge to curve it.</p>'}
      <form class="pop-form">
        <label for="edge-len">Printed length on the plan</label>
        <div class="row"><input id="edge-len" inputmode="decimal" autocomplete="off" placeholder="e.g. 116.45 or 116' 5&quot;" />
        <button type="submit" class="primary">${this.ftPerPt ? 'Reset scale' : 'Set scale'}</button></div>
        <p class="pop-error" hidden>Type a length in feet, like 116.45 or 116' 5".</p>
      </form>`;
    this.popover.hidden = false;
    this.popover.querySelector<HTMLButtonElement>('[data-act=close]')!.onclick = () => { this.selectedEdge = null; this.update(); };
    const straighten = this.popover.querySelector<HTMLButtonElement>('[data-act=straighten]');
    if (straighten) straighten.onclick = () => { this.record(); this.outlines[e.id]!.bulges![e.i] = 0; this.update(); };
    const form = this.popover.querySelector('form')!;
    form.onsubmit = ev => {
      ev.preventDefault();
      const feet = parseFeet(this.popover.querySelector<HTMLInputElement>('#edge-len')!.value);
      if (!feet) { this.popover.querySelector<HTMLElement>('.pop-error')!.hidden = false; return; }
      this.setScaleFromEdge(e.id, e.i, feet);
    };
    this.positionPopover();
  }
  private positionPopover() {
    const e = this.selectedEdge; if (!e || this.popover.hidden) return;
    const o = this.outlines[e.id]; if (!o) return;
    const a = this.host.toScreen(o.pts[e.i]), b = this.host.toScreen(o.pts[(e.i + 1) % o.pts.length]);
    const stage = this.svg.getBoundingClientRect(), w = this.popover.offsetWidth || 300, hgt = this.popover.offsetHeight || 170;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    this.popover.style.left = `${Math.max(8, Math.min(stage.width - w - 8, mx - w / 2))}px`;
    this.popover.style.top = `${Math.max(8, Math.min(stage.height - hgt - 8, my + 24))}px`;
  }

  private renderPanel() {
    const p = this.panel, o = this.current();
    if (o) {
      p.innerHTML = `
        <p class="panel-text">Tap each corner of the <b>${esc(o.kind === 'boundary' ? 'plot boundary' : o.name)}</b>. ${o.pts.length >= 3 ? 'Double-tap, tap the first corner, or press Close shape to finish.' : `${o.pts.length} of at least 3 corners placed.`}</p>
        <p class="panel-hint">${this.snapOn ? 'Points snap to lines and corners on the plan. To place one freely, hold Option (Alt) — on touch, press and hold before moving. Two fingers move and zoom.' : 'Snapping is off.'}</p>
        ${this.nudgePad()}
        <div class="row">
        <button type="button" data-act="close" class="primary" ${o.pts.length >= 3 ? '' : 'disabled'}>Close shape</button>
        <button type="button" data-act="cancel">Cancel</button></div>`;
      p.hidden = false;
    } else {
      const closed = Object.values(this.outlines).filter(x => x.closed);
      if (!closed.length) { p.hidden = true; return; }
      const f = this.selectedFeature ? this.outlines[this.selectedFeature] : null;
      if (f) { this.renderFeaturePanel(f); return; }
      const b = this.outlines.boundary?.closed ? this.outlines.boundary : null;
      const area = b && this.ftPerPt ? areaPt2(b.pts, b.bulges) * this.ftPerPt * this.ftPerPt : null;
      const off = area && this.printedLotSqft ? percentOff(area, this.printedLotSqft) : null;
      p.innerHTML = `
        <p class="panel-text">${this.ftPerPt ? `Scale: <b>${formatScale(this.ftPerPt)}</b>. Tap or hover an edge to see its length.` : 'Tap an edge and type its printed length to set the scale.'}</p>
        ${area ? `<div class="area-row"><span>Plot area <b>${formatArea(area)}</b></span>
          <label for="lot-size">Printed lot size</label><input id="lot-size" inputmode="numeric" placeholder="13,504" value="${this.printedLotSqft ?? ''}" />
          ${off !== null ? `<span class="${Math.abs(off) <= 1 ? 'ok' : 'warn'}">${Math.abs(off) < 0.05 ? 'matches' : `${Math.abs(off).toFixed(1)}% ${off > 0 ? 'over' : 'under'}`}</span>` : ''}</div>` : ''}
        ${this.nudgePad()}
        ${closed.some(c => c.kind === 'feature') ? '<p class="panel-hint">Tap inside an existing feature to rename, delete or redraw it.</p>' : ''}
        ${b ? '<div class="row"><button type="button" data-redo="boundary">Redo plot boundary</button></div>' : ''}`;
      p.hidden = false;
      const lot = p.querySelector<HTMLInputElement>('#lot-size');
      if (lot) lot.onchange = () => { const v = Number(lot.value.replace(/[^\d.]/g, '')); this.printedLotSqft = v > 0 ? v : null; this.renderPanel(); };
    }
    p.querySelectorAll<HTMLButtonElement>('[data-act]').forEach(btn => {
      btn.onclick = () => ({ close: () => this.close(), cancel: () => this.cancel() } as Record<string, () => void>)[btn.dataset.act!]();
    });
    p.querySelectorAll<HTMLButtonElement>('[data-nudge]').forEach(btn => {
      btn.onclick = () => { const [dx, dy] = btn.dataset.nudge!.split(',').map(Number); this.nudge(dx, dy); };
    });
    p.querySelectorAll<HTMLButtonElement>('[data-redo]').forEach(btn => { btn.onclick = () => this.redraw(btn.dataset.redo!); });
  }

  /** Panel for a selected existing feature: rename, redraw, delete. */
  private renderFeaturePanel(f: Outline) {
    const p = this.panel;
    p.innerHTML = `
      <form class="rename-row">
        <label for="feature-name-edit">Existing feature</label>
        <input id="feature-name-edit" autocomplete="off" value="${esc(f.name)}" />
        <button type="submit">Rename</button>
      </form>
      ${this.nudgePad()}
      <div class="row">
        <button type="button" data-act="redraw">Redo outline</button>
        <button type="button" data-act="delete" class="danger">Delete</button>
        <button type="button" data-act="done">Done</button>
      </div>`;
    p.hidden = false;
    const input = p.querySelector<HTMLInputElement>('#feature-name-edit')!;
    p.querySelector('form')!.onsubmit = ev => { ev.preventDefault(); this.renameFeature(f.id, input.value); input.blur(); };
    const act: Record<string, () => void> = {
      redraw: () => this.redraw(f.id), delete: () => this.deleteFeature(f.id), done: () => this.deselect(),
    };
    p.querySelectorAll<HTMLButtonElement>('[data-act]').forEach(btn => { btn.onclick = act[btn.dataset.act!]; });
    p.querySelectorAll<HTMLButtonElement>('[data-nudge]').forEach(btn => {
      btn.onclick = () => { const [dx, dy] = btn.dataset.nudge!.split(',').map(Number); this.nudge(dx, dy); };
    });
  }

  private nudgePad(): string {
    if (!this.selectedCorner || !this.outlines[this.selectedCorner.id]?.pts[this.selectedCorner.i]) return '';
    return `<div class="nudge"><span class="panel-hint">Nudge the selected corner</span>
      <button type="button" data-nudge="-1,0" aria-label="Nudge left">←</button><button type="button" data-nudge="0,-1" aria-label="Nudge up">↑</button>
      <button type="button" data-nudge="0,1" aria-label="Nudge down">↓</button><button type="button" data-nudge="1,0" aria-label="Nudge right">→</button></div>`;
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
    if (arrows[e.key] && this.selectedCorner) { e.preventDefault(); const k = e.shiftKey ? 10 : 1; this.nudge(arrows[e.key][0] * k, arrows[e.key][1] * k); return; }
    if (this.drawing) {
      if (e.key === 'Enter') { e.preventDefault(); this.close(); }
      else if (e.key === 'Escape') this.cancel();
      else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); this.undo(); }
    } else if (e.key === 'Escape') this.deselect();
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
function unit(a: Point, b: Point): Point { const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; }

interface Snapshot {
  outlines: Record<string, Outline>;
  drawing: string | null;
  ftPerPt: number | null;
  selectedCorner: { id: string; i: number } | null;
  selectedFeature: string | null;
  replaced: Outline | null;
}
