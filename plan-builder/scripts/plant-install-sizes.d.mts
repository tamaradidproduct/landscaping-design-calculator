export interface InstallSize { container: string; d: number }
export interface PlantInstallSize { install: InstallSize[]; approximate?: true }
export const PLANT_INSTALL_SIZES: Record<string, PlantInstallSize>;
