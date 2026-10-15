// Messages between the viewer and the PDF worker.
export type WorkerRequest =
  | { type: 'warmup'; id: number }
  | { type: 'open'; id: number; bytes: ArrayBuffer }
  /** matrix [a, b, c, d, e, f]: page point (x, y) lands at device (a·x + c·y + e, b·x + d·y + f). */
  | { type: 'render'; id: number; width: number; height: number; matrix: Matrix };

export type Matrix = [number, number, number, number, number, number];

export type WorkerResponse =
  | { type: 'ready'; id: number }
  | { type: 'opened'; id: number; pageCount: number; pageSize: { w: number; h: number } }
  | { type: 'rendered'; id: number; width: number; height: number; pixels: Uint8ClampedArray }
  | { type: 'error'; id: number; message: string };
