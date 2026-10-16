import type { Outline } from './outline';

/** Outlines as last committed: an outline still being drawn is left out, a redraw in progress shows the old one. Deep copies. */
export function committedOutlines(outlines: Record<string, Outline>, drawing: string | null, replaced: Outline | null): Record<string, Outline> {
  const out = structuredClone(outlines);
  if (drawing) { if (replaced) out[drawing] = structuredClone(replaced); else delete out[drawing]; }
  return out;
}
