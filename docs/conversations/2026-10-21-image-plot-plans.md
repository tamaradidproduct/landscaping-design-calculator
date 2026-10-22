# Plan Builder: JPG/PNG plot plans (2026-10-21)

## Context
- Issue #20 ("[Enhancement] Expand allowed file formats"): "We'll need to be able to accept file formats other than PDFs – image formats, such as JPG, PNG, iPhone image, etc."
- A suggested-approach comment was posted and approved ("go ahead") before this work started. It found the file-type gate centralized and simple (`<input accept>` in `index.html`, `checkPdf()` in `src/plan-store.ts`), but noted the real work is the render path: the viewer is PDFium-only, and outlining/snapping/scale assume a scanned raster plan at a fixed scale — not a perspective-distorted phone photo.

## Decisions
- **Approved first slice: JPG/PNG only**, rendered as a single flat image layer at native size/DPI — fills the screen, pinch/zoom/pan, stays sharp when zoomed, offline-capable (PRD §6.1). No multi-page (never applied to images), no perspective correction.
- **A parallel render path, not a PDFium change.** `src/image-client.ts` (`ImageClient`) decodes with `createImageBitmap` and draws through an `OffscreenCanvas` with the same affine-matrix contract PDFium's worker uses (`src/page-engine.ts`'s `PageEngine` shape: `open(bytes)` → `{pageCount, pageSize}`, `render(w, h, matrix)` → `ImageData`). `main.ts` holds one `engine: PageEngine` and picks `pdf` or `img` per open; everything downstream (zoom, pan, pinch, the plot-plan layer, outlining, snapping, the stretch correction) is unchanged and unaware of which engine produced the pixels.
- **Engine choice is sniffed from the bytes' own header** (`sniffPlanFileType` in `src/plan-store.ts`: `%FFD8` → JPEG, `\x89PNG` → PNG, else PDF), not from the file name or a stored "kind" field. `PlanMeta`/`PlanDoc`/Firestore schema are untouched — a plan's `pdf.name` stays whatever the picked file was called, and the cache (`pdf-cache.ts`) already stores raw bytes keyed by plan id with no PDF-specific shape, so offline reopening needed no changes at all.
- **`checkPdf()` was widened in place** (not replaced) to accept PDF or JPG/PNG by MIME type or extension (iPad Files can hand it an empty MIME type, same as it already did for PDFs); anything else, including HEIC, is still rejected with a clear message. The `PlanInputError` reason stays `'not-pdf'` to avoid rippling a rename through the store/UI layers — it now means "not an accepted plot-plan file."
- **Cloud Storage**: `firebase-plan-store.ts` now uploads with the sniffed content type instead of a hardcoded `application/pdf`; `storage.rules` now allows `application/pdf`, `image/jpeg` or `image/png` for the plot-plan object. The rules change needs `npx firebase-tools deploy --only storage` before an image plot plan can sync to a real account (not run as part of this PR).
- **Address extraction stays PDF-only**: `plans-ui.ts` skips the page-1-text extraction step for a picked image (there's nothing to extract), so the address field just falls back to the file name, same as a PDF with no readable text today.
- **Copy**: the file-type-rejection message, the picker's `accept` attribute, and the "Pick/Change file" button labels were generalized from PDF-specific wording; other pre-existing "PDF" wording elsewhere (e.g. generic sync-failure toasts) was left alone — out of scope for this slice.

## Explicitly out of scope (follow-ups)
- **HEIC** (iPhone's default photo format): needs its own decode path (not supported by `createImageBitmap` in every browser) — a later issue.
- **Perspective correction** for a photo taken at an angle: the outlining/snapping/scale machinery assumes a plan drawn at a fixed scale with traceable lines, same as a scan. A phone photo taken square-on already works today (JPG); a photo taken at an angle does not, and isn't handled here — a later issue.
- Multi-page: never applicable to a single flat image, so not touched.

## Build rulings
- `ImageClient` is tested the way `PdfClient` already is (`pdf-client.test.ts`'s pattern): stub the browser APIs it calls (`createImageBitmap`, `OffscreenCanvas`) and assert its own logic (decode → page size, matrix → draw → pixels, "load first" semantics on a failed re-open), not real pixel decoding.
- `checkPdf`/`sniffPlanFileType` got a direct unit test file (`plan-store.test.ts`); there wasn't one before (only the shared `PlanStore` contract exercised `checkPdf` indirectly), so this also covers the PDF path's existing behavior going forward.
