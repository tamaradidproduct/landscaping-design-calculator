// Messages between the viewer and the PDF worker.
export type WorkerRequest =
  | { type: 'warmup'; id: number }
  | { type: 'open'; id: number; bytes: ArrayBuffer }
  | { type: 'render'; id: number; width: number; height: number; scale: number; tx: number; ty: number };

export type WorkerResponse =
  | { type: 'ready'; id: number }
  | { type: 'opened'; id: number; pageCount: number; pageSize: { w: number; h: number } }
  | { type: 'rendered'; id: number; width: number; height: number; pixels: Uint8ClampedArray }
  | { type: 'error'; id: number; message: string };
