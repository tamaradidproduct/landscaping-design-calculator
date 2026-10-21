// Shared shape for anything that can open a file's bytes and render an arbitrary affine view of
// it into RGBA pixels: PdfClient (PDFium-in-a-worker) and ImageClient (a plain JPG/PNG layer) both
// satisfy this structurally, so the viewer (main.ts) can hold either one in a single `engine`
// variable and drive zoom/pan/outlining/snapping the same way regardless of file type.
import type { Matrix } from './pdf-protocol';

export interface PageEngine {
  open(bytes: ArrayBuffer): Promise<{ pageCount: number; pageSize: { w: number; h: number } }>;
  /** RGBA pixels: page/image point (x, y) lands at device (a·x + c·y + e, b·x + d·y + f). */
  render(width: number, height: number, matrix: Matrix): Promise<ImageData>;
}
