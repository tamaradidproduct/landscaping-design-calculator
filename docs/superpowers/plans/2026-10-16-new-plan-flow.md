# New plan flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the address optional on New plan, and name the plan from an address read off the PDF's text layer, else the file name.

**Architecture:** Pure name/extraction helpers in `address-extract.ts`; a new `text` request in the existing PDFium worker (own temp document, so the viewer's open document is untouched) exposed as `PdfClient.text`; `PlansScreen` gains a "file picked" form state and gets the text reader through its options. `PlanStore` is unchanged.

**Tech Stack:** TypeScript, Vite, vitest, `@hyzyla/pdfium` (WASM, in a worker), Playwright (`playwright-core`) check scripts.

**Spec:** `docs/superpowers/specs/2026-10-16-new-plan-flow-design.md`

## Global Constraints

- Address max length 200 chars (`cleanAddress` in `plan-model.ts`); the plan name passed to `store.create` is never empty.
- Name chain: typed/edited value → extracted address → cleaned file name → `"Untitled plan"`.
- Extraction: PDF text layer, page 1 only, on the device; no OCR, no vision model, no backend.
- Extraction never overwrites text the user typed or edited; failures and timeouts are silent (3 s timeout).
- `PlanStore.create(address, file)` and rename validation are unchanged; the `'address'` `PlanInputError` applies only to rename.
- `checkPdf` limits unchanged: PDF type, ≤ 25 MB, same messages.
- Run all commands from `plan-builder/`; `npm test` = `vitest run`, `npm run lint` = `tsc --noEmit`.

## Review Focus

- Change PDF (or Cancel) pressed while extraction is running: the late result must be ignored. (Task 3)
- User types an address, then extraction returns: the typed text stays. (Task 3)
- Field cleared or whitespace-only at Create plan: falls back through the chain, never an empty name. (Tasks 1, 3)
- Wrong file type or over 25 MB picked: error shown, form stays in the pre-pick state, nothing held. (Task 3)
- Corrupt, encrypted, or image-only PDF, or a file named just `.pdf`: extraction yields nothing silently; the name is the file name or `"Untitled plan"`. (Tasks 1, 2)

---

### Task 1: Name and address helpers

**Files:**
- Create: `plan-builder/src/address-extract.ts`
- Test: `plan-builder/src/address-extract.test.ts`

**Interfaces:**
- Consumes: `cleanAddress(raw: string): string | null` from `./plan-model`.
- Produces:
  - `extractAddress(text: string): string | null`
  - `fileNameToTitle(fileName: string): string`
  - `suggestName(parts: { typed: string; extracted: string | null; fileName: string }): string`
  - `UNTITLED = 'Untitled plan'`

- [ ] **Step 1: Write failing tests** in `address-extract.test.ts` (vitest). Assertions:
  - `extractAddress('1234 Elm Street, Denver, CO 80202')` → `'1234 Elm Street, Denver, CO 80202'`.
  - `extractAddress('SITE ADDRESS: 5678 W Maple Ave\nBoulder, CO 80301')` → `'5678 W Maple Ave Boulder, CO 80301'` (label stripped, newline collapsed, city/state/ZIP on the next line appended).
  - `extractAddress('12 Oak Ln')` → `'12 Oak Ln'`.
  - Title-block preference: `'Surveyor: 99 Office Park Dr\nScale 1"=20\'\nSite address: 12 Oak Ln'` → `'12 Oak Ln'`; with no label word anywhere, the first match wins.
  - Returns `null` for `'Phone 303-555-1212'`, `"120.5' x 80'"`, `'02/24/2025'`, `''`, and `'Lot 39 Block 2'`.
  - Output is capped at 200 chars.
  - `fileNameToTitle('riesberg-plot-plan.pdf')` → `'riesberg plot plan'`; `'My_Plan  v2.PDF'` → `'My Plan v2'`; `'.pdf'` → `''`.
  - `suggestName`: typed `'  14 Elm St '` wins → `'14 Elm St'`; typed `''` + extracted `'12 Oak Ln'` → `'12 Oak Ln'`; typed `'   '`, extracted `null`, fileName `'a-b.pdf'` → `'a b'`; all empty with fileName `'.pdf'` → `'Untitled plan'`.
- [ ] **Step 2: Run** `npx vitest run src/address-extract.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the four exports in `address-extract.ts`.
  - `extractAddress`: scan lines; a match is house number + 1–4 words + a street suffix (St/Street, Ave/Avenue, Rd/Road, Dr/Drive, Ln/Lane, Ct/Court, Way, Blvd, Cir/Circle, Pl/Place, Pkwy/Parkway, Ter/Terrace, Trl/Trail, case-insensitive), optional leading directional (N/S/E/W/NE…). If the next line starts with `City, ST` (+ optional ZIP), or the match line already continues with it, append it. Prefer matches on a line containing or directly following `address|site|property|lot` ; else the first match. Strip a leading `label:` prefix. Return through `cleanAddress`.
  - `fileNameToTitle`: drop the last `.ext`, replace `[-_]+` and whitespace runs with one space, trim.
  - `suggestName`: `cleanAddress(typed) ?? cleanAddress(extracted ?? '') ?? (cleanAddress(fileNameToTitle(fileName)) ?? UNTITLED)`.
- [ ] **Step 4: Run** `npx vitest run src/address-extract.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add plan-builder/src/address-extract.ts plan-builder/src/address-extract.test.ts
git commit -m "feat(plans): address extraction and plan-name helpers"
```

---

### Task 2: Page-1 text from the PDF worker

**Files:**
- Modify: `plan-builder/src/pdf-protocol.ts`, `plan-builder/src/pdf-worker.ts`, `plan-builder/src/pdf-client.ts`
- Create: `plan-builder/scripts/make-text-fixture.mjs`, `plan-builder/test-fixtures/address-text.pdf`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `PdfClient.text(bytes: ArrayBuffer): Promise<string>` — page-1 text, `''` on any failure or after 3 s. Transfers `bytes`. Does not touch the document the viewer has open.

- [ ] **Step 1: Add protocol types** in `pdf-protocol.ts`: request `{ type: 'text'; id: number; bytes: ArrayBuffer }`, response `{ type: 'text'; id: number; text: string }`.
- [ ] **Step 2: Handle `text` in `pdf-worker.ts`:** `await engine()`, `lib.loadDocument(new Uint8Array(req.bytes))` into a local variable (not the shared `doc`), read `getPage(0).getText()`, destroy the local document in `finally`, post `{ type: 'text', id, text }`. Errors go through the existing catch (`error` reply).
- [ ] **Step 3: Add `PdfClient.text`** in `pdf-client.ts`: `send({ type: 'text', bytes }, [bytes])`, race against a 3 s timer, catch everything and return `''`. The timeout lives in the client because a running worker call can't be interrupted.
- [ ] **Step 4: Create the fixture** — `scripts/make-text-fixture.mjs` writes `test-fixtures/address-text.pdf`: a one-page letter-size PDF with a Helvetica text object reading `Site Address: 12 Oak Ln, Denver, CO 80202`, with correct xref offsets. Run it: `node scripts/make-text-fixture.mjs`. Check with `pdftotext test-fixtures/address-text.pdf -`; expected output contains `12 Oak Ln`.
- [ ] **Step 5: Run** `npm run lint && npm test`. Expected: both pass. (`PdfClient.text` itself needs WASM and is exercised end to end by the Playwright check in Task 3.)
- [ ] **Step 6: Commit**

```bash
git add plan-builder/src/pdf-protocol.ts plan-builder/src/pdf-worker.ts plan-builder/src/pdf-client.ts plan-builder/scripts/make-text-fixture.mjs plan-builder/test-fixtures/address-text.pdf
git commit -m "feat(pdf): read page-1 text in the worker without touching the open document"
```

---

### Task 3: Two-step New plan form, check scripts, docs

**Files:**
- Modify: `plan-builder/src/plans-ui.ts`, `plan-builder/src/app-shell.ts` (pass the option at the `new PlansScreen(...)` call, ~line 160), `plan-builder/scripts/lib/open-plan.mjs`, `plan-builder/scripts/check-plans.mjs`, `docs/PRD.md` (§6.9), `docs/superpowers/specs/2026-10-15-plans-auth-design.md` (§5 New plan), `docs/superpowers/specs/2026-10-16-new-plan-flow-design.md` (§4: the 3 s timeout lives in `PdfClient.text`)

**Interfaces:**
- Consumes: `suggestName`, `fileNameToTitle`, `UNTITLED` (Task 1); `PdfClient.text` (Task 2).
- Produces: `PlansScreenOptions.readPdfText?(bytes: ArrayBuffer): Promise<string>`; DOM contract for scripts: `#new-plan` opens the form; `#new-address` (optional, no `required`); `#new-pdf` (label "Pick plot plan PDF", becomes "Change PDF" once a file is held); `#create-plan` (present only while a file is held); `[data-act=new-cancel]`.

- [ ] **Step 1: Update `scripts/lib/open-plan.mjs` and `check-plans.mjs` first (failing checks).** `openPlan(page, pdfPath, address = 'Riesberg test')`: click `#new-plan`, fill `#new-address`, `setInputFiles('#file', pdfPath)`, wait for `#create-plan`, click it, then the existing wait for the `Opened` toast. Add to `check-plans.mjs` (new block before the existing flow, using separate page loads of `?store=memory`):
  - Riesberg PDF picked with an empty field → `#new-address` value is `'riesberg plot plan'` (file `riesberg-plot-plan.pdf`; use the real file name of the path passed in, derive the expected string the same way) and `#create-plan` is visible.
  - `test-fixtures/address-text.pdf` picked → within 5 s `#new-address` value is `'12 Oak Ln, Denver, CO 80202'`.
  - Type `'Typed Name'` before picking `address-text.pdf` → after 1.5 s the value is still `'Typed Name'`.
  - Clear the field after picking, click `#create-plan` → the created row's `.plan-address` is the extracted address or file name, not empty.
  - Pick a non-PDF (`package.json`) → error text `"That file isn't a PDF. Pick the plot plan PDF."` shown and `#create-plan` absent.
  - `[data-act=new-cancel]` after picking → form gone, no `.plan-row` created.
  - Change PDF mid-extraction: pick `address-text.pdf`, immediately `setInputFiles` Riesberg → value ends as `'riesberg plot plan'`.
- [ ] **Step 2: Run to see it fail.** Start the dev server (`npx vite --port 5180`), then `node scripts/check-plans.mjs <path to samples/riesberg-plot-plan.pdf>`. Expected: FAIL (no `#create-plan`).
- [ ] **Step 3: Implement the form in `plans-ui.ts`.** Add state `picked: File | null`, `userEdited: boolean`, `extractSeq: number`, `extracted: string | null`. Behavior:
  - Form renders the optional address field (no `required`), `#new-pdf`, `Cancel`; with a held file also `#create-plan` ("Create plan", "Creating…" while `creating`).
  - The file picker callback (`armNew`) validates with `checkPdf(file)` from `./plan-store`; a `PlanInputError` sets `newError` using `INPUT_MESSAGES` and leaves `picked` unchanged (`null` on first pick).
  - On a valid pick: `picked = file`; bump `extractSeq`; if `!userEdited` set the field to `fileNameToTitle(file.name)`; then `file.arrayBuffer()` → `opts.readPdfText?.(buf)`; when it resolves with the same `extractSeq`, `extractAddress(text)` non-null and `!userEdited`, set the field. Catch everything silently.
  - `input` events on `#new-address` set `userEdited = true`; Cancel and closing the form reset `picked`, `userEdited`, and bump `extractSeq`.
  - `#create-plan` calls `store.create(suggestName({ typed: field value, extracted, fileName: picked.name }), picked)`; success/failure handling is today's `create`. Remove the `'address required'` check in the `new-pdf` click handler (`#new-pdf` now only opens the picker); Enter in `#new-address` clicks `#create-plan` when a file is held, otherwise does nothing.
  - `render()` already preserves typed input across re-renders; programmatic prefill must set the value in state/DOM so a re-render doesn't lose it.
- [ ] **Step 4: Wire `readPdfText`** in `app-shell.ts`: pass `readPdfText: bytes => pdf.text(bytes)` using the app's existing `PdfClient` instance (if it isn't reachable from `app-shell.ts`, pass it in from `main.ts` where it is created, line ~21).
- [ ] **Step 5: Run** `npm run lint && npm test`, restart the dev server if needed, then `node scripts/check-plans.mjs <riesberg.pdf>`. Expected: all checks `pass`. Also run `node scripts/check-step1.mjs <riesberg.pdf>` and one editor check that uses `openPlan` (`check-undo.mjs`). Expected: still pass.
- [ ] **Step 6: Update docs** — PRD §6.9 and plans-auth spec §5 "New plan": address optional, pick-then-confirm, name from PDF text or file name; spec §4 timeout note.
- [ ] **Step 7: Manual check** (note result in the PR): offline (DevTools offline) create with `address-text.pdf` still prefills the extracted address.
- [ ] **Step 8: Commit**

```bash
git add plan-builder/src plan-builder/scripts docs
git commit -m "feat(plans): optional address, name from PDF text or file name"
```
