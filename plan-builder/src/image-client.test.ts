import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageClient } from './image-client';

// Fakes for the canvas/bitmap APIs a real browser provides; same spirit as pdf-client.test.ts's
// FakeWorker — this tests ImageClient's own logic, not actual pixel decoding (that's the browser's).
class FakeBitmap {
  closed = false;
  constructor(public width: number, public height: number) {}
  close() { this.closed = true; }
}
class FakeContext {
  transform: number[] | null = null;
  drawn: { image: unknown; dw: number; dh: number } | null = null;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { this.transform = [a, b, c, d, e, f]; }
  drawImage(image: unknown, _sx: number, _sy: number, dw: number, dh: number) { this.drawn = { image, dw, dh }; }
  getImageData(x: number, y: number, w: number, h: number) { return { sentinel: 'image-data', x, y, w, h }; }
}
class FakeCanvas {
  static last: FakeCanvas;
  ctx = new FakeContext();
  constructor(public width: number, public height: number) { FakeCanvas.last = this; }
  getContext() { return this.ctx; }
}

describe('ImageClient', () => {
  let createImageBitmap: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createImageBitmap = vi.fn();
    vi.stubGlobal('createImageBitmap', createImageBitmap);
    vi.stubGlobal('OffscreenCanvas', FakeCanvas);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('open() decodes the bytes and returns the bitmap size as the page size', async () => {
    createImageBitmap.mockResolvedValue(new FakeBitmap(800, 600));
    const c = new ImageClient();
    const opened = await c.open(new ArrayBuffer(8));
    expect(opened).toEqual({ pageCount: 1, pageSize: { w: 800, h: 600 } });
  });

  it('render() throws when nothing has been opened yet', async () => {
    const c = new ImageClient();
    await expect(c.render(10, 10, [1, 0, 0, 1, 0, 0])).rejects.toThrow('No image open');
  });

  it('render() draws the open bitmap through the given matrix and returns the pixels', async () => {
    const bitmap = new FakeBitmap(400, 300);
    createImageBitmap.mockResolvedValue(bitmap);
    const c = new ImageClient();
    await c.open(new ArrayBuffer(8));
    const result = await c.render(200, 150, [2, 0, 0, 2, 5, 7]);
    const canvas = FakeCanvas.last;
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(150);
    expect(canvas.ctx.transform).toEqual([2, 0, 0, 2, 5, 7]);
    expect(canvas.ctx.drawn).toEqual({ image: bitmap, dw: 400, dh: 300 });
    expect(result).toEqual({ sentinel: 'image-data', x: 0, y: 0, w: 200, h: 150 });
  });

  it("a later open() replaces the bitmap and closes the previous one; render() uses the new one", async () => {
    const first = new FakeBitmap(10, 10), second = new FakeBitmap(20, 20);
    createImageBitmap.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const c = new ImageClient();
    await c.open(new ArrayBuffer(8));
    await c.open(new ArrayBuffer(8));
    expect(first.closed).toBe(true);
    await c.render(5, 5, [1, 0, 0, 1, 0, 0]);
    expect(FakeCanvas.last.ctx.drawn?.image).toBe(second);
  });

  it("a failed open() leaves the previous bitmap in place (matches the PDF path's 'load first')", async () => {
    createImageBitmap.mockResolvedValueOnce(new FakeBitmap(10, 10)).mockRejectedValueOnce(new Error('bad image'));
    const c = new ImageClient();
    await c.open(new ArrayBuffer(8));
    await expect(c.open(new ArrayBuffer(8))).rejects.toThrow('bad image');
    await expect(c.render(5, 5, [1, 0, 0, 1, 0, 0])).resolves.toBeDefined();
  });

  it('close() releases the bitmap; render() afterward throws like nothing was ever opened', async () => {
    const bitmap = new FakeBitmap(10, 10);
    createImageBitmap.mockResolvedValue(bitmap);
    const c = new ImageClient();
    await c.open(new ArrayBuffer(8));
    c.close();
    expect(bitmap.closed).toBe(true);
    await expect(c.render(5, 5, [1, 0, 0, 1, 0, 0])).rejects.toThrow('No image open');
  });

  it('render() reuses the same canvas across calls instead of allocating a new one each time', async () => {
    createImageBitmap.mockResolvedValue(new FakeBitmap(10, 10));
    const c = new ImageClient();
    await c.open(new ArrayBuffer(8));
    await c.render(100, 50, [1, 0, 0, 1, 0, 0]);
    const first = FakeCanvas.last;
    await c.render(20, 20, [1, 0, 0, 1, 0, 0]);
    expect(FakeCanvas.last).toBe(first); // no new canvas constructed
    expect(first.width).toBe(20);
    expect(first.height).toBe(20);
  });

  it('render() clamps zero-sized dimensions to 1×1 instead of throwing (a 0×0 canvas would throw)', async () => {
    createImageBitmap.mockResolvedValue(new FakeBitmap(10, 10));
    const c = new ImageClient();
    await c.open(new ArrayBuffer(8));
    const result = await c.render(0, 0, [1, 0, 0, 1, 0, 0]);
    expect(FakeCanvas.last.width).toBe(1); expect(FakeCanvas.last.height).toBe(1);
    expect(result).toEqual({ sentinel: 'image-data', x: 0, y: 0, w: 1, h: 1 });
  });
});
