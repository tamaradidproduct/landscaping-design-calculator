// Render path for a JPG/PNG plot plan: a single flat image layer, drawn at its native size with
// a plain canvas instead of PDFium. No worker needed — createImageBitmap decodes off the main
// thread already, and drawing one bitmap per frame is cheap — so this satisfies the same
// PageEngine shape as PdfClient without touching the PDFium path at all.
import type { Matrix } from './pdf-protocol';
import type { PageEngine } from './page-engine';

export class ImageClient implements PageEngine {
  private bitmap: ImageBitmap | null = null;

  /** Decodes the image; a decode failure leaves whatever was open before untouched. */
  async open(bytes: ArrayBuffer): Promise<{ pageCount: number; pageSize: { w: number; h: number } }> {
    const bitmap = await createImageBitmap(new Blob([bytes]));
    this.bitmap?.close();
    this.bitmap = bitmap;
    return { pageCount: 1, pageSize: { w: bitmap.width, h: bitmap.height } };
  }

  /** RGBA pixels of the image: image point (x, y) lands at (a·x + c·y + e, b·x + d·y + f). */
  async render(width: number, height: number, [a, b, c, d, e, f]: Matrix): Promise<ImageData> {
    const bitmap = this.bitmap;
    if (!bitmap) throw new Error('No image open');
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
    return ctx.getImageData(0, 0, width, height);
  }
}
