export interface SymbolSource { id: string; name: string; kind: 'plant' | 'object'; family: string; category: string; figma: string }
export const SYMBOL_SOURCES: readonly SymbolSource[];
