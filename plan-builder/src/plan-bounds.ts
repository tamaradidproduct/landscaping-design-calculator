// Bounding box of everything drawn, in page points: what Preview fits to the view.
import type { Outline } from './outline';
import type { PlacedLine, PlacedSymbol } from './plan-model';

export interface Rect { x: number; y: number; w: number; h: number }

export function planBounds(state: { outlines: Record<string, Outline>; symbols?: Record<string, PlacedSymbol>; lines?: Record<string, PlacedLine> }): Rect | null {
  const pts: { x: number; y: number }[] = [];
  for (const o of Object.values(state.outlines)) pts.push(...o.pts);
  for (const s of Object.values(state.symbols ?? {})) pts.push({ x: s.x, y: s.y });
  for (const l of Object.values(state.lines ?? {})) pts.push(...l.points);
  if (!pts.length) return null;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
