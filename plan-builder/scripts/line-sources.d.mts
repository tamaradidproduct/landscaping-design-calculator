export interface LineSource { id: string; name: string; family: string; figma: string; strokePx: number; roundCaps: boolean; strip: { x: number; y: number; w: number; h: number } | null; tileWidths: number }
export const LINE_SOURCES: readonly LineSource[];
