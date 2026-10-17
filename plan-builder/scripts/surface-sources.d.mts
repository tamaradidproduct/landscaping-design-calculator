export type Family = 'Turf & seed' | 'Mulch & soil' | 'Rock & gravel' | 'Pavers & stone' | 'Concrete' | 'Decking';
export interface SurfaceSource { id: string; name: string; family: Family; trade: 'hardscape' | 'softscape'; x: number; y: number }
export const SURFACE_SOURCES: readonly SurfaceSource[];
