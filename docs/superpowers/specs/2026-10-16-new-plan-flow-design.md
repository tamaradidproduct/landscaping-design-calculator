# New plan flow: optional address, name from the plan — design

- **Date:** 2026-10-16
- **Branch:** `feat/new-plan-flow` (from `main` after PR #10)
- **Builds on:** [Saved plans + invite-only sign-in](2026-10-15-plans-auth-design.md) §5 "New plan"

## 1. Goal
- Creating a plan no longer starts with a required address.
- The plan gets a sensible name on its own: an address read from the PDF when possible, otherwise the file name.
- The contractor can still type or correct the address before creating the plan.

## 2. Decisions
| Topic | Decision |
|---|---|
| Address field | Stays on the New plan form, **optional** |
| Form order | Pick PDF first, then confirm: the picked file is held in memory, the field is prefilled, "Create plan" finishes |
| Name chain | typed/edited value → extracted address → cleaned file name → "Untitled plan" |
| Extraction | **PDF text layer only**, page 1, on the device (PDFium worker). No OCR, no vision model, no backend |
| Known limit | Plans whose text is drawn as vector shapes (e.g. the Riesberg sample, `pdftotext` returns nothing) have no text layer, so they get the file name. Expected, not a bug |
| User input wins | Extraction never overwrites text the user has typed or edited |
| Store | `PlanStore.create(address, file)` unchanged; the fallback chain lives in the UI so the store still gets a non-empty name |
| Rename | Unchanged; still requires a non-empty name |
| Offline | Works: PDFium runs on the device |
| Out of scope | OCR / vision extraction, multi-page scanning, extracting other fields (owner, lot, scale), renaming existing plans automatically |

## 3. Flow
- **New plan** opens the form: optional "Job's address" input and "Pick plot plan PDF".
- **After a PDF is picked** (`checkPdf` runs first; its errors show as today):
  - The file is held in memory; the button row becomes "Create plan" / "Change PDF" / "Cancel".
  - The address field prefills with the cleaned file name immediately, unless the user already typed.
  - Page-1 text extraction starts. If it finds an address and the field has not been edited by the user, the field is replaced with it.
- **Create plan** calls `store.create(suggestName(...), file)` and opens the editor, as today.
- The file is never uploaded or cached before "Create plan"; Cancel drops it.
- If the user clears the field, "Create plan" falls back to the chain (extracted → file name → "Untitled plan").

## 4. Units (`plan-builder/src/`)
| Unit | Job | Depends on |
|---|---|---|
| `address-extract.ts` (new, pure) | `extractAddress(text): string \| null`; `fileNameToTitle(name): string`; `suggestName({ typed, extracted, fileName }): string` | — |
| `pdf-protocol.ts` / `pdf-worker.ts` | New `text` request: page-1 text via PDFium's text API; any failure resolves `''` (the 3 s budget lives in `PdfClient.text`, since a running worker call can't be interrupted; it starts once the PDF engine is ready) | pdfium |
| `plans-ui.ts` | "File picked" form state, "Create plan" / "Change PDF", prefill and the user-edited guard; the "address required" check on create is removed | address-extract, pdf client |
| `plan-store.ts` / `plan-model.ts` | No change | — |

### 4.1 `extractAddress`
- Finds a US street address: number, street name, street suffix (St, Ave, Rd, Dr, Ln, Ct, Way, Blvd, Cir, Pl, Pkwy…), optionally followed by city, state and ZIP.
- Prefers lines near title-block words ("address", "site", "lot", "property"); otherwise takes the first match.
- Rejects phone numbers, dates, and coordinates/dimensions (e.g. `120.5'`).
- Returns the matched text, whitespace-normalised, capped at the 200-char address limit (`cleanAddress`). `null` if nothing matches.

### 4.2 `fileNameToTitle`
- Drops the extension; replaces `-`, `_` and runs of spaces with single spaces; trims. `riesberg-plot-plan.pdf` becomes "riesberg plot plan".
- Does not use the PDF's embedded title (it is often a server path).
- Empty result → falls through to "Untitled plan".

### 4.3 Extraction in the UI
- Runs once per picked file; a stale result (Change PDF or Cancel pressed meanwhile) is ignored.
- "User edited" is tracked by an `input` event on the field, not by comparing values.
- A rejected or timed-out extraction is silent: the file name stays.

## 5. Error handling
- Wrong file type or over 25 MB: same messages as today, shown on the form; the form stays in the pre-pick state.
- Extraction failure: silent fallback to the file name; nothing is shown.
- `store.create` failures: same handling as today (`device-storage` message, other errors via `onError`).
- The `'address'` `PlanInputError` reason now applies only to rename.

## 6. Testing
- **Unit (vitest):**
  - `extractAddress`: typical addresses with and without city/state/ZIP, title-block preference, and false positives (phone, date, dimension) return `null`.
  - `fileNameToTitle`: separators, extension case, empty input.
  - `suggestName`: each step of the chain.
- **Playwright (`?store=memory`):** update `check-plans.mjs` and `lib/open-plan.mjs` for the two-step form: pick the Riesberg PDF → field prefilled with "riesberg plot plan" → Create plan → opens; typed address wins; empty field falls back; Cancel creates nothing.
- **Manual:** a PDF that does have a text layer with an address (prefill replaces the file name); offline create.

## 7. Risks
- **Low hit rate:** vector-text plans (like the sample) never yield an address, so the file name does the work for them. If this proves common, vision extraction is the follow-up (needs a backend; out of scope here).
- **Wrong address:** the regex can pick the wrong line (e.g. a surveyor's office address). The user sees and can edit it before creating, which is why it prefills rather than auto-names.
- **PDFium text API:** the wrapper library keeps low-level functions on non-public fields (see `pdf-worker.ts`); confirm the text call works there during planning.

## 8. Doc updates (with the implementation)
- `docs/PRD.md` §6.9 and the plans-auth spec §5: "New plan" description, and the address is optional.
