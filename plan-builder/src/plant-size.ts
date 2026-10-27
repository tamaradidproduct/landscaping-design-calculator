import { PLANT_INSTALL_SIZES } from '../scripts/plant-install-sizes.mjs';
import { symbolById } from './symbols';

export type PlantSizeView = 'install' | 'mature';
export interface SizeChoice { container?: string; customInstall?: number }
type Container = { container: string; d: number };

const NONE: readonly Container[] = [];
const fmt = (n: number): string => String(Math.round(n * 100) / 100);
const mature = (id: string): number => symbolById(id)?.size.w ?? 0;

export function containersFor(symbolId: string): readonly Container[] {
  return PLANT_INSTALL_SIZES[symbolId]?.install ?? NONE;
}

export function defaultContainer(symbolId: string): Container | null {
  const list = containersFor(symbolId);
  return list.length ? list[list.length - 1] : null;
}

export function clampCustom(symbolId: string, ft: number): number | null {
  if (!Number.isFinite(ft) || ft <= 0 || !containersFor(symbolId).length) return null;
  return Math.min(ft, mature(symbolId));
}

/** The smallest diameter the canvas size handle sets (ft). */
export const MIN_HANDLE_FT = 0.25;
/** The diameter (ft) the size handle sets with the pointer at `pointer`: twice its distance from the plant's centre (both in page points), never under 0.25 ft. */
export function handleDiameterFt(centre: { x: number; y: number }, pointer: { x: number; y: number }, ftPerPt: number): number {
  return Math.max(MIN_HANDLE_FT, 2 * Math.hypot(pointer.x - centre.x, pointer.y - centre.y) * ftPerPt);
}

function installEntry(symbolId: string, choice: SizeChoice): Container | null {
  const list = containersFor(symbolId);
  return list.find(c => c.container === choice.container) ?? defaultContainer(symbolId);
}

export function plantDiameter(symbolId: string, choice: SizeChoice, view: PlantSizeView): number {
  if (view === 'mature' || !containersFor(symbolId).length) return mature(symbolId);
  if (choice.customInstall !== undefined) {
    const c = clampCustom(symbolId, choice.customInstall);
    if (c !== null) return c;
  }
  return installEntry(symbolId, choice)?.d ?? mature(symbolId);
}

export function sizeLabel(symbolId: string, choice: SizeChoice, view: PlantSizeView): string {
  const sym = symbolById(symbolId);
  if (!sym || sym.kind !== 'plant') return '';
  if (view === 'mature' || !containersFor(symbolId).length) return `${fmt(mature(symbolId))} ft`;
  if (choice.customInstall !== undefined) {
    const c = clampCustom(symbolId, choice.customInstall);
    if (c !== null) return `Custom ${fmt(c)} ft`;
  }
  const e = installEntry(symbolId, choice);
  return e ? `${e.container} (${fmt(e.d)} ft)` : '';
}

export function effectiveView(view: PlantSizeView | undefined, hasPlants: boolean): PlantSizeView {
  return view ?? (hasPlants ? 'mature' : 'install');
}

export function normalizeChoice(symbolId: string, choice: SizeChoice): SizeChoice {
  if (choice.customInstall !== undefined) {
    const c = clampCustom(symbolId, choice.customInstall);
    if (c !== null) return { customInstall: c };
  }
  if (choice.container !== undefined && containersFor(symbolId).some(c => c.container === choice.container)) {
    return { container: choice.container };
  }
  return {};
}
