// Steps 2a–2b: outline the plot boundary or the house, then set the scale from one printed edge length.
// 2b adds snapping to what's drawn on the plan, angle/alignment hints (shown, never locked) and nudging.
import {
  OUTLINE_LABEL, areaPt2, dist, edgeLengthPt, formatArea, formatFeet, formatScale, guides, nearestEdge, parseFeet, percentOff,
  type Outline, type OutlineKind,
} from './outline';
import { findImageSnap, SNAP_WINDOW } from './snap';
import type { Point } from './view';

export interface ToolHost {
  toPage(s: Point): Point;
  toScreen(p: Point): Point;
  /** Screen px per PDF point at the current zoom. */
  pxPerPt(): number;
  /** Draw the plan under screen point `s` into ctx (for the magnifier), magnified by `zoom`. */
  drawMagnified(ctx: CanvasRenderingContext2D, s: Point, zoom: number, size: number): void;
  toast(msg: string): void;
  /** Luminance (0–255) of the plan as shown, n×n samples at 1 per screen px, centred on screen point c. */
  sampleLuminance(c: Point, n: number): Float32Array | null;
}

const CORNER_HIT = 24;      // screen px
const EDGE_HIT = 16;        // screen px
const TOUCH_OFFSET = 64;    // the point being placed sits this far above the finger
const DOUBLE_TAP_MS = 350;
const OWN_SNAP = 14;        // screen px: snap to the outlines' own corners first
const COLORS: Record<OutlineKind, string> = { boundary: 'var(--outline-boundary)', house: 'var(--outline-house)' };

type Drag =
  | { type: 'place'; finger: Point; offsetY: number }
  | { type: 'corner'; kind: OutlineKind; i: number; grab: Point; moved: boolean };

export class OutlineTool {
  outlines: Partial<Record<OutlineKind, Outline>> = {};
  drawing: OutlineKind | null = null;
  ftPerPt: number | null = null;
  printedLotSqft: number | null = null;
  private drag: Drag | null = null;
  private dragAt: Point | null = null;        // screen position of the point being placed or moved
  private hoverAt: Point | null = null;       // mouse position, for the rubber-band line
  private hoverEdge: { kind: OutlineKind; i: number } | null = null;
  private selectedEdge: { kind: OutlineKind; i: number } | null = null;
  private lastTap: { t: number; finger: Point } | null = null;
  snapOn = true;
  private bypass = false;                      // held Option/Alt or a second finger: place freely
  private rawAt: Point | null = null;          // where the point would be without snapping
  private snapped: 'corner' | 'line' | 'own' | null = null;
  selectedCorner: { kind: OutlineKind; i: number } | null = null;

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

  // ---------- Commands ----------
  start(kind: OutlineKind) {
    this.drawing = kind;
    this.outlines[kind] = { kind, pts: [], closed: false };
    this.selectedEdge = null; this.lastTap = null; this.selectedCorner = null;
    this.update();
  }
  cancel() {
    if (!this.drawing) return;
    delete this.outlines[this.drawing];
    this.drawing = null; this.update();
  }
  undoPoint() {
    const o = this.current(); if (!o) return;
    o.pts.pop(); this.selectedCorner = o.pts.length ? { kind: o.kind, i: o.pts.length - 1 } : null; this.update();
  }
  close() {
    const o = this.current(); if (!o || o.pts.length < 3) return;
    o.closed = true; this.drawing = null;
    this.host.toast(this.ftPerPt
      ? `${OUTLINE_LABEL[o.kind]} outlined. Tap an edge to see its length.`
      : `${OUTLINE_LABEL[o.kind]} outlined. Now tap an edge and type its printed length to set the scale.`);
    this.update();
  }
  private current(): Outline | undefined { return this.drawing ? this.outlines[this.drawing] : undefined; }
  /** True when single-finger input belongs to the tool rather than panning. */
  get busy() { return this.drawing !== null || this.drag !== null; }

  // ---------- Pointer input (screen coordinates) ----------
  pointerDown(p: Point, pointerType: string): boolean {
    this.hideTip();
    const hit = this.cornerAt(p);
    if (hit) {
      const s = this.host.toScreen(this.outlines[hit.kind]!.pts[hit.i]);
      this.drag = { type: 'corner', kind: hit.kind, i: hit.i, grab: { x: s.x - p.x, y: s.y - p.y }, moved: false };
      this.selectedCorner = { kind: hit.kind, i: hit.i };
      this.rawAt = s; this.dragAt = s; this.snapped = null; this.showMagnifier(); this.render();
      return true;
    }
    if (this.drawing) {
      const offsetY = pointerType === 'touch' ? TOUCH_OFFSET : 0;
      this.drag = { type: 'place', finger: p, offsetY };
      this.rawAt = { x: p.x, y: p.y - offsetY };
      this.dragAt = this.resolve(this.rawAt);
      if (offsetY) this.showMagnifier();
      this.render();
      return true;
    }
    const edge = this.edgeAt(p);
    if (edge) { this.selectedEdge = edge; this.update(); return true; }
    return false;
  }

  pointerMove(p: Point, alt = false) {
    const d = this.drag; if (!d) return;
    this.bypassKey = alt;
    if (d.type === 'place') { d.finger = p; this.rawAt = { x: p.x, y: p.y - d.offsetY }; }
    else { this.rawAt = { x: p.x + d.grab.x, y: p.y + d.grab.y }; d.moved = true; }
    this.applyDrag();
  }

  /** Hold a second finger while dragging to place freely. */
  setBypassFinger(on: boolean) { this.bypassFinger = on; if (this.drag) this.applyDrag(); }
  private bypassKey = false;
  private bypassFinger = false;

  private applyDrag() {
    const d = this.drag; if (!d || !this.rawAt) return;
    this.bypass = this.bypassKey || this.bypassFinger;
    this.dragAt = this.resolve(this.rawAt, d.type === 'corner' ? d : undefined);
    if (d.type === 'corner') this.outlines[d.kind]!.pts[d.i] = this.host.toPage(this.dragAt);
    this.showMagnifier();
    this.render();
  }

  /** Where a point placed at screen position `raw` lands: own corners first, then the drawing, else free. */
  private resolve(raw: Point, exclude?: { kind: OutlineKind; i: number }): Point {
    this.snapped = null;
    if (!this.snapOn || this.bypass) return raw;
    let best: Point | null = null, bd = OWN_SNAP;
    for (const o of Object.values(this.outlines)) {
      o?.pts.forEach((pt, i) => {
        if (exclude && exclude.kind === o.kind && exclude.i === i) return;
        const s = this.host.toScreen(pt), d = dist(s, raw);
        if (d < bd) { bd = d; best = s; }
      });
    }
    if (best) { this.snapped = 'own'; return best; }
    const n = SNAP_WINDOW, g = this.host.sampleLuminance(raw, n);
    const hit = g && findImageSnap(g, { x: n / 2, y: n / 2 });
    if (!hit) return raw;
    this.snapped = hit.kind;
    return { x: raw.x - n / 2 + hit.x, y: raw.y - n / 2 + hit.y };
  }

  nudge(dx: number, dy: number) {
    const c = this.selectedCorner, o = c && this.outlines[c.kind]; if (!c || !o?.pts[c.i]) return;
    const k = 1 / this.host.pxPerPt(), p = o.pts[c.i];
    o.pts[c.i] = { x: p.x + dx * k, y: p.y + dy * k };
    this.update();
  }

  pointerUp() {
    const d = this.drag; this.drag = null;
    this.magnifier.hidden = true;
    if (!d) return;
    if (d.type === 'corner') {
      // A tap (no drag) on a corner while drawing: the first corner closes the shape.
      // A tap (no drag) while drawing: the first corner closes the shape; a quick second tap on the
      // corner just placed is a double-tap, which also closes it.
      const o = this.current(), now = performance.now();
      const tapped = !d.moved && o && d.kind === o.kind;
      if (tapped && o.pts.length >= 3 && (d.i === 0 || (d.i === o.pts.length - 1 && this.lastTap && now - this.lastTap.t < DOUBLE_TAP_MS))) {
        this.lastTap = null; this.dragAt = null; this.close(); return;
      }
      this.dragAt = null; this.snapped = null; this.update(); return;
    }
    const o = this.current(); if (!o || !this.dragAt) return;
    const now = performance.now();
    const isDouble = this.lastTap && now - this.lastTap.t < DOUBLE_TAP_MS && dist(this.lastTap.finger, d.finger) < 30;
    if (isDouble && o.pts.length >= 3) { this.lastTap = null; this.dragAt = null; this.close(); return; }
    o.pts.push(this.host.toPage(this.dragAt));
    this.selectedCorner = { kind: o.kind, i: o.pts.length - 1 };
    this.lastTap = { t: now, finger: d.finger };
    this.dragAt = null; this.snapped = null;
    this.update();
  }

  /** A second finger arrived: abandon the single-finger action. */
  cancelPointer() {
    this.drag = null; this.magnifier.hidden = true; this.dragAt = null; // a moved corner keeps where it got to
    this.render();
  }

  tapEmpty() { if (this.selectedEdge) { this.selectedEdge = null; this.update(); } }

  hover(p: Point | null) {
    this.hoverAt = p;
    const edge = p && !this.drawing ? this.edgeAt(p) : null;
    const changed = edge?.kind !== this.hoverEdge?.kind || edge?.i !== this.hoverEdge?.i;
    this.hoverEdge = edge;
    if (edge && p) this.showTip(edge, p); else this.hideTip();
    if (changed || this.drawing) this.render();
  }

  private cornerAt(p: Point): { kind: OutlineKind; i: number } | null {
    let best: { kind: OutlineKind; i: number } | null = null, bd = CORNER_HIT;
    for (const o of Object.values(this.outlines)) {
      if (!o) continue;
      o.pts.forEach((pt, i) => { const d = dist(this.host.toScreen(pt), p); if (d < bd) { bd = d; best = { kind: o.kind, i }; } });
    }
    return best;
  }
  private edgeAt(p: Point): { kind: OutlineKind; i: number } | null {
    const tol = EDGE_HIT / this.host.pxPerPt(), pp = this.host.toPage(p);
    for (const o of Object.values(this.outlines)) {
      if (!o?.closed) continue;
      const i = nearestEdge(o.pts, pp, tol);
      if (i !== null) return { kind: o.kind, i };
    }
    return null;
  }

  // ---------- Scale ----------
  setScaleFromEdge(kind: OutlineKind, i: number, feet: number) {
    this.ftPerPt = feet / edgeLengthPt(this.outlines[kind]!.pts, i);
    this.host.toast(`Scale set: ${formatScale(this.ftPerPt)}.`);
    this.selectedEdge = null;
    this.update();
  }
  private edgeFeet(kind: OutlineKind, i: number) {
    return this.ftPerPt ? edgeLengthPt(this.outlines[kind]!.pts, i) * this.ftPerPt : null;
  }

  // ---------- Rendering ----------
  /** Redraw overlay, popover and panel. */
  update() { this.render(); this.renderPopover(); this.renderPanel(); }

  render() {
    const h = this.host;
    let svg = '';
    for (const o of Object.values(this.outlines)) {
      if (!o || !o.pts.length) continue;
      const pts = o.pts.map(p => h.toScreen(p));
      const drawingThis = this.drawing === o.kind;
      if (drawingThis && this.dragAt) pts.push(this.dragAt);
      else if (drawingThis && this.hoverAt && !this.drag) pts.push(this.hoverAt);
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + (o.closed ? ' Z' : '');
      svg += `<path d="${d}" class="shape${o.closed ? ' closed' : ''}" style="--c:${COLORS[o.kind]}"/>`;
      for (const e of [this.hoverEdge, this.selectedEdge]) {
        if (e?.kind !== o.kind || !o.closed) continue;
        const a = h.toScreen(o.pts[e.i]), b = h.toScreen(o.pts[(e.i + 1) % o.pts.length]);
        svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="edge-hi" style="--c:${COLORS[o.kind]}"/>`;
      }
      o.pts.forEach((p, i) => {
        const s = h.toScreen(p);
        const closeTarget = drawingThis && i === 0 && o.pts.length >= 3;
        if (closeTarget) svg += `<circle cx="${s.x}" cy="${s.y}" r="16" class="close-target" style="--c:${COLORS[o.kind]}"/>`;
        svg += `<circle cx="${s.x}" cy="${s.y}" r="${closeTarget ? 7 : 6}" class="corner" style="--c:${COLORS[o.kind]}"/>`;
      });
    }
    if (this.dragAt) svg += this.renderGuides(this.dragAt);
    else if (this.drawing && this.hoverAt) svg += this.renderGuides(this.hoverAt);
    const sel = this.selectedCorner && !this.dragAt ? this.outlines[this.selectedCorner.kind]?.pts[this.selectedCorner.i] : null;
    if (sel) { const s = h.toScreen(sel); svg += `<circle cx="${s.x}" cy="${s.y}" r="11" class="selected-corner"/>`; }
    if (this.dragAt) {
      const { x, y } = this.dragAt;
      if (this.snapped) {
        const label = { corner: 'Corner', line: 'On line', own: 'Corner' }[this.snapped];
        svg += this.snapped === 'line'
          ? `<path d="M${x} ${y - 9}L${x + 9} ${y}L${x} ${y + 9}L${x - 9} ${y}Z" class="snap-mark"/>`
          : `<rect x="${x - 8}" y="${y - 8}" width="16" height="16" class="snap-mark"/>`;
        svg += `<text x="${x + 16}" y="${y - 14}" class="snap-label">${label}</text>`;
      }
      svg += `<circle cx="${x}" cy="${y}" r="11" class="placing"/><path d="M${x - 18} ${y}H${x - 5}M${x + 5} ${y}H${x + 18}M${x} ${y - 18}V${y - 5}M${x} ${y + 5}V${y + 18}" class="crosshair"/>`;
    }
    this.svg.innerHTML = svg;
    this.positionPopover();
    if (this.dragAt && !this.magnifier.hidden) this.drawMagnifier();
  }

  /** Hints for the point being placed or moved: right angle, straight on, and alignment with other corners. */
  private renderGuides(at: Point): string {
    const h = this.host, d = this.drag;
    let out = '', prev: Point | null = null, prevprev: Point | null = null, next: Point | null = null, nextnext: Point | null = null;
    let skip: { kind: OutlineKind; i: number } | null = null;
    if ((!d || d.type === 'place') && this.drawing) {
      const pts = this.outlines[this.drawing]!.pts.map(p => h.toScreen(p));
      prev = pts.at(-1) ?? null; prevprev = pts.at(-2) ?? null;
    } else if (d?.type === 'corner') {
      const o = this.outlines[d.kind]!, n = o.pts.length, at2 = (k: number) => (o.closed || (k >= 0 && k < n)) ? h.toScreen(o.pts[(k + n) % n]) : null;
      prev = at2(d.i - 1); prevprev = at2(d.i - 2); next = at2(d.i + 1); nextnext = at2(d.i + 2);
      skip = d;
    }
    const others: Point[] = [];
    for (const o of Object.values(this.outlines)) o?.pts.forEach((p, i) => {
      if (skip && skip.kind === o.kind && skip.i === i) return;
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

  private showTip(e: { kind: OutlineKind; i: number }, p: Point) {
    const ft = this.edgeFeet(e.kind, e.i);
    this.tip.textContent = ft ? formatFeet(ft) : 'Tap to set this edge’s length';
    this.tip.style.left = `${p.x + 14}px`; this.tip.style.top = `${p.y + 14}px`;
    this.tip.hidden = false;
  }
  private hideTip() { this.tip.hidden = true; }

  private renderPopover() {
    const e = this.selectedEdge;
    if (!e || !this.outlines[e.kind]?.closed) { this.popover.hidden = true; return; }
    const ft = this.edgeFeet(e.kind, e.i);
    this.popover.innerHTML = `
      <div class="pop-head"><strong>${OUTLINE_LABEL[e.kind]} edge</strong><button type="button" class="icon" data-act="close" aria-label="Close">×</button></div>
      <div class="pop-measure">${ft ? `Measures <b>${formatFeet(ft)}</b>` : 'No scale yet'}</div>
      <form class="pop-form">
        <label for="edge-len">Printed length on the plan</label>
        <div class="row"><input id="edge-len" inputmode="decimal" autocomplete="off" placeholder="e.g. 116.45 or 116' 5&quot;" />
        <button type="submit" class="primary">${this.ftPerPt ? 'Reset scale' : 'Set scale'}</button></div>
        <p class="pop-error" hidden>Type a length in feet, like 116.45 or 116' 5".</p>
      </form>`;
    this.popover.hidden = false;
    this.popover.querySelector<HTMLButtonElement>('[data-act=close]')!.onclick = () => { this.selectedEdge = null; this.update(); };
    const form = this.popover.querySelector('form')!;
    form.onsubmit = ev => {
      ev.preventDefault();
      const feet = parseFeet(this.popover.querySelector<HTMLInputElement>('#edge-len')!.value);
      if (!feet) { this.popover.querySelector<HTMLElement>('.pop-error')!.hidden = false; return; }
      this.setScaleFromEdge(e.kind, e.i, feet);
    };
    this.positionPopover();
  }
  private positionPopover() {
    const e = this.selectedEdge; if (!e || this.popover.hidden) return;
    const o = this.outlines[e.kind]; if (!o) return;
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
        <p class="panel-text">Tap each corner of the <b>${OUTLINE_LABEL[o.kind].toLowerCase()}</b>. ${o.pts.length >= 3 ? 'Double-tap, tap the first corner, or press Close shape to finish.' : `${o.pts.length} of at least 3 corners placed.`}</p>
        <p class="panel-hint">${this.snapOn ? 'Points snap to lines and corners on the plan. Hold Option (Alt) or a second finger to place freely.' : 'Snapping is off.'}</p>
        ${this.nudgePad()}
        <div class="row"><button type="button" data-act="undo" ${o.pts.length ? '' : 'disabled'}>Undo corner</button>
        <button type="button" data-act="close" class="primary" ${o.pts.length >= 3 ? '' : 'disabled'}>Close shape</button>
        <button type="button" data-act="cancel">Cancel</button></div>`;
      p.hidden = false;
    } else {
      const closed = Object.values(this.outlines).filter(x => x?.closed) as Outline[];
      if (!closed.length) { p.hidden = true; return; }
      const b = this.outlines.boundary?.closed ? this.outlines.boundary : null;
      const area = b && this.ftPerPt ? areaPt2(b.pts) * this.ftPerPt * this.ftPerPt : null;
      const off = area && this.printedLotSqft ? percentOff(area, this.printedLotSqft) : null;
      p.innerHTML = `
        <p class="panel-text">${this.ftPerPt ? `Scale: <b>${formatScale(this.ftPerPt)}</b>. Tap or hover an edge to see its length.` : 'Tap an edge and type its printed length to set the scale.'}</p>
        ${area ? `<div class="area-row"><span>Plot area <b>${formatArea(area)}</b></span>
          <label for="lot-size">Printed lot size</label><input id="lot-size" inputmode="numeric" placeholder="13,504" value="${this.printedLotSqft ?? ''}" />
          ${off !== null ? `<span class="${Math.abs(off) <= 1 ? 'ok' : 'warn'}">${Math.abs(off) < 0.05 ? 'matches' : `${Math.abs(off).toFixed(1)}% ${off > 0 ? 'over' : 'under'}`}</span>` : ''}</div>` : ''}
        ${this.nudgePad()}
        <div class="row">${closed.map(c => `<button type="button" data-redo="${c.kind}">Redo ${OUTLINE_LABEL[c.kind].toLowerCase()}</button>`).join('')}</div>`;
      p.hidden = false;
      const lot = p.querySelector<HTMLInputElement>('#lot-size');
      if (lot) lot.onchange = () => { const v = Number(lot.value.replace(/[^\d.]/g, '')); this.printedLotSqft = v > 0 ? v : null; this.renderPanel(); };
    }
    p.querySelectorAll<HTMLButtonElement>('[data-act]').forEach(btn => {
      btn.onclick = () => ({ undo: () => this.undoPoint(), close: () => this.close(), cancel: () => this.cancel() } as Record<string, () => void>)[btn.dataset.act!]();
    });
    p.querySelectorAll<HTMLButtonElement>('[data-nudge]').forEach(btn => {
      btn.onclick = () => { const [dx, dy] = btn.dataset.nudge!.split(',').map(Number); this.nudge(dx, dy); };
    });
    p.querySelectorAll<HTMLButtonElement>('[data-redo]').forEach(btn => { btn.onclick = () => this.start(btn.dataset.redo as OutlineKind); });
  }

  private nudgePad(): string {
    if (!this.selectedCorner || !this.outlines[this.selectedCorner.kind]?.pts[this.selectedCorner.i]) return '';
    return `<div class="nudge"><span class="panel-hint">Nudge the selected corner</span>
      <button type="button" data-nudge="-1,0" aria-label="Nudge left">←</button><button type="button" data-nudge="0,-1" aria-label="Nudge up">↑</button>
      <button type="button" data-nudge="0,1" aria-label="Nudge down">↓</button><button type="button" data-nudge="1,0" aria-label="Nudge right">→</button></div>`;
  }

  private onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[e.key] && this.selectedCorner) { e.preventDefault(); const k = e.shiftKey ? 10 : 1; this.nudge(arrows[e.key][0] * k, arrows[e.key][1] * k); return; }
    if (this.drawing) {
      if (e.key === 'Enter') { e.preventDefault(); this.close(); }
      else if (e.key === 'Escape') this.cancel();
      else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); this.undoPoint(); }
    } else if (e.key === 'Escape') this.tapEmpty();
  }
}

function unit(a: Point, b: Point): Point { const l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (b.x - a.x) / l, y: (b.y - a.y) / l }; }
