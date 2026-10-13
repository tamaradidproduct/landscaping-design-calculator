// PDFium (the engine behind Chrome's PDF viewer), compiled to WebAssembly, running off the main thread.
// Plot plans often draw their text as thousands of tiny vector shapes; PDFium renders those in
// ~0.1 s where PDF.js needed 10 s+.
import { PDFiumLibrary } from '@hyzyla/pdfium';
import wasmUrl from '@hyzyla/pdfium/pdfium.wasm?url';
import type { WorkerRequest, WorkerResponse } from './pdf-protocol';
import { WARMUP_PDF_BASE64 } from './warmup-pdf';

type Lib = Awaited<ReturnType<typeof PDFiumLibrary.init>>;
type Doc = Awaited<ReturnType<Lib['loadDocument']>>;

let lib: Lib | null = null;
let doc: Doc | null = null;
// Low-level PDFium functions; the wrapper library keeps them on non-public fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = () => (lib as any).module;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const docIdx = () => (doc as any).documentIdx as number;

// One shared init, started by the warmup message when the app loads.
let loading: Promise<Lib> | null = null;
async function engine() { lib ??= await (loading ??= PDFiumLibrary.init({ wasmUrl }).then(warm)); return lib; }

// Load and draw a tiny drawing once so the browser compiles PDFium's parsing and drawing code now.
async function warm(l: Lib): Promise<Lib> {
  const bytes = Uint8Array.from(atob(WARMUP_PDF_BASE64), c => c.charCodeAt(0));
  lib = l; doc = await l.loadDocument(bytes);
  // Several passes: the browser optimizes WebAssembly code only after it has run for a while.
  for (let i = 0; i < 12; i++) render(1200, 1500, 2, 0, 0);
  doc.destroy(); doc = null;
  return l;
}

const post = (msg: WorkerResponse, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(msg, transfer);

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === 'warmup') {
      await engine();
      post({ type: 'ready', id: req.id });
    } else if (req.type === 'open') {
      await engine();
      doc?.destroy();
      doc = await lib!.loadDocument(new Uint8Array(req.bytes));
      const m = raw(), page = m._FPDF_LoadPage(docIdx(), 0);
      const size = { w: m._FPDF_GetPageWidthF(page) as number, h: m._FPDF_GetPageHeightF(page) as number };
      m._FPDF_ClosePage(page);
      post({ type: 'opened', id: req.id, pageCount: doc.getPageCount(), pageSize: size });
    } else if (req.type === 'render') {
      if (!doc) throw new Error('No document open');
      const pixels = render(req.width, req.height, req.scale, req.tx, req.ty);
      post({ type: 'rendered', id: req.id, width: req.width, height: req.height, pixels }, [pixels.buffer]);
    }
  } catch (err) {
    post({ type: 'error', id: req.id, message: err instanceof Error ? err.message : String(err) });
  }
};

/**
 * Render page 1 into a width x height RGBA buffer. Page point (px, py) lands at device
 * (px * scale + tx, py * scale + ty). The page sheet is white; everything outside it is transparent.
 */
function render(width: number, height: number, scale: number, tx: number, ty: number): Uint8ClampedArray {
  const m = raw();
  const page = m._FPDF_LoadPage(docIdx(), 0);
  const pw = m._FPDF_GetPageWidthF(page) * scale, ph = m._FPDF_GetPageHeightF(page) * scale;
  const stride = width * 4, bytes = stride * height;
  const buf = m._malloc(bytes), matrix = m._malloc(24), clip = m._malloc(16);
  const bitmap = m._FPDFBitmap_CreateEx(width, height, 4 /* BGRA */, buf, stride);
  try {
    m._FPDFBitmap_FillRect(bitmap, 0, 0, width, height, 0x00000000);
    const left = Math.max(0, Math.floor(tx)), top = Math.max(0, Math.floor(ty));
    const right = Math.min(width, Math.ceil(tx + pw)), bottom = Math.min(height, Math.ceil(ty + ph));
    if (right > left && bottom > top) m._FPDFBitmap_FillRect(bitmap, left, top, right - left, bottom - top, 0xffffffff);
    m.HEAPF32.set([scale, 0, 0, scale, tx, ty], matrix >> 2);
    m.HEAPF32.set([0, 0, width, height], clip >> 2);
    m._FPDF_RenderPageBitmapWithMatrix(bitmap, page, matrix, clip, 0);
    const out = new Uint8ClampedArray(m.HEAPU8.buffer.slice(buf, buf + bytes));
    for (let i = 0; i < out.length; i += 4) { const b = out[i]; out[i] = out[i + 2]; out[i + 2] = b; } // BGRA -> RGBA
    return out;
  } finally {
    m._FPDFBitmap_Destroy(bitmap); m._free(buf); m._free(matrix); m._free(clip); m._FPDF_ClosePage(page);
  }
}
