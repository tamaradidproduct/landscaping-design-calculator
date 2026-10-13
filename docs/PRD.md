# PRD — Landscaping Plan Builder for Contractors (working name)

> Status: **Draft v0.5 — direction reset 2026-10-12.** Sections 1–3 rewritten; everything from §4 down describes the **parked Figma-takeoff prototype** (branch `feat/figma-takeoff-hardening`) and is kept for reference only.
> Legend: ✅ confirmed by stakeholder · 🔍 inferred · ❓ open question

## 1. Problem & vision
- ✅ Reset reason: the Figma-based takeoff was **too Figma-dependent** — a designer had to be in the loop.
- ✅ Core pain: contractors **can't produce a plan at all** — they lack design tools/skills.
- ✅ Vision: contractors build a scaled landscape plan themselves, **on site on a tablet**, starting from the homeowner's **plot plan PDF**, using a library of landscaping symbols; quantities come out of the drawing.
- ✅ Not related to the Front Range Yards HOA-plan service.

## 2. Users
- ✅ **Primary:** landscaping contractors / installers.
- ✅ Context: on site with the homeowner, on a tablet.
- ❓ Homeowners (DIY) — still a future audience?

## 3. Jobs to be done
- ✅ **Win the job** — show the homeowner a professional proposal.
- ✅ **Accurate quoting** — quantities for their own bid.
- ✅ **Crew instructions** — install guide for the field.
- ✅ Starting input: the homeowner's plot plan PDF (closing documents).
- ✅ HOA submission: nice to have, not a driver.

## 3b. Key flows (draft)
### Scaled base from plot plan PDF ✅ (explore all three, in this order)
1. **Trace the lot** — draw property lines / house by entering measurements.
2. **Auto-detect scale** — read scale bar or dimensions from the PDF.
3. **Fallback: known dimension** — tap two points on a printed dimension, enter its length.
### Drawing ✅
- Simple: draw zones and fill with a material; tap to drop plants/objects from the symbol library. No freeform vector editing.
### Outputs ✅
- **Plan sheet** in the style of the Servin example (branded header, drawing, annotation/plant list).
- **Priced proposal** — quantities × contractor's prices. ⚠️ Pricing is now IN scope (the parked prototype excluded it).
- HOA: nice to have — the plan sheet may double as an HOA submission; not a driver.

### Pricing ⏸ (deferred — focus is the editor)
- Contractor maintains their **own price list** (unit price per sq ft / linear ft / each), reused across jobs.
### Library ✅
- **Built-in shared library** — the Landscaping symbols set ported into the app; contractors don't add their own items (for now).
### Delivery ✅
- Proposal delivered as a **PDF** (plan sheet + priced proposal).
### Validation ❓
- No pilot contractor yet — recruiting is an open task (Servin used only as a visual reference).

### End-to-end workflow ✅ (draft)
1. **Create job on site** — contractor enters client name/address and uploads the plot plan PDF from the tablet.
2. **Scale the base** (trace → auto-detect → known-dimension fallback).
3. **Draw** zones + drop symbols — contractor drafts alone.
4. **Price** from the contractor's price list.
5. **Present at the end** — homeowner sees the finished plan + proposal (not co-designed live).
6. **Send PDF.**
- ✅ Whole session on site, ~30–60 min, with the homeowner present.
- ✅ After the first proposal: nothing yet (no versions, tiers, or job conversion in scope).

### Step details ✅
- **Trace:** contractor taps the property-line and house corners on the PDF image, then types each edge's length → this sets the scale.
- **Draw** captures: zones with materials; symbols; **existing features** (house, driveway, patio — not billed); **edging & walls** as lines; **plant spacing fill** (fill a bed with a plant at a spacing, auto-count); **dimension labels**.
- **Offline:** internet is often unavailable on site → the full on-site workflow must work **offline**, with sync later.
- **Presenting:** show the plan sheet first, then the price.

### Editor ✅
- **Zone drawing input:** to be prototyped — likely a combination of tap corners, freehand trace (smoothed), tap-then-bend curves, and paint-bucket fill inside existing lines.
- **Curves are essential** — natural bed and lawn edges.
- **Zone model: default fill** — the whole lot starts as one material (e.g. rock); zones carve into it. (Matches the parked prototype's "visible area" math.)
- **v1 editing must-haves:** undo/redo · move/reshape points · snap (lot lines, house edges, other zones) · copy/repeat symbols.
- **Library picker:** search + category tabs (surfaces, plants, objects).
- **Symbol size:** true mature size at plan scale (plant spread → symbol diameter). ❓ Requires mature-spread data per plant in the library.
- **Quantities while drawing:** shown on selection (tap a zone/symbol to see its area/count); no always-on totals panel.
- **Platform:** web app for any tablet browser (iPad + Android); offline-capable (PWA implied).

## 3a. Superseded by the reset
- Figma as design source; designer-run takeoff; Figma token handling.
- Everything below this line is the parked prototype's spec.

---

## 4. Current capabilities (as built) 🔍
### 4.1 Connect design
- Paste Figma Personal Access Token + frame URL (must include `node-id`).
- Frame rendered as PNG at 1x; layer tree parsed via Figma REST API.
- Layers starting with `.` skipped; hidden layers excluded; locked layers hidden by default (toggle).

### 4.2 Measure
- Per layer: **Area** (count opaque pixels of exported layer PNG) or **Length** (vector path length; fallback = half boundary pixels).
- Custom polygon drawing on canvas → area or length.
- Global scale input `pixels per foot` (default **12**).
- Component/instance layers auto-counted as **Object Inventory** (by layer name).

### 4.3 Classify
- Hardcoded list of 11 generic materials (Decorative rock, Seating wall, Stamped/Brushed concrete, Artificial turf, Sod, Mulch, Pavers, Wood/Composite decking, Gravel).
- Auto-suggest material from Figma fill/stroke **style name**; manual override via side sheet.

### 4.4 Summarize & export
- Totals per material: sq ft, linear ft, counts.
- Google sign-in → append `[material, value, unit]` rows to a user-supplied Sheet; Sheet ID saved per user in Firestore. ✅ **Sheets export to be removed; sign-in kept for sync.**
- Copy-as-CSV exists but has no button; "Export Report" button is a placeholder.

### 4.5 Not persisted
- Measurements, material assignments, scale — lost on reload.

## 5. Domain conventions
- ✅ Scale convention: **1 px = 1 inch** (= 12 px/ft; matches app default). Plot plans are calibrated to this before drafting (see `landscaping-plan-scale-calibration` skill).
- 🔍 Symbol library ("Landscaping symbols", Servin; Figma `0B2UpvIGBFOE1ZEDx8rXPR`): ~47 plants, 44 surfaces, 17 objects. Each item has a **measurement class: count | area | linear**.
- 🔍 Library names ≠ card titles, and some have typos (`Blue arrrow juniper`, `Perrenials`) — matching must use main-component names.
- ✅ **Library is source of truth** for materials and measurement type; replaces the 11 hardcoded materials. Measurement class (count/area/linear) decides how each item is measured — no manual Area/Length choice for library items.

## 6. Goals & success metrics
- ✅ Accuracy target: **±5%** vs. true quantity (overage covers the rest).
- ✅ Success = **manual validation** by the stakeholder against known plans (Pennycress first).

## 7. Scope
### 7.1 In scope (now)
- ✅ Raw quantities only (sq ft, linear ft, counts).
### 7.2 Explicitly out of scope (now)
- ✅ Waste/overage factors, unit conversions (cu yd, pallets, tons), pricing, labor estimates.
### 7.3 Next milestone — ✅ "Harden the Figma prototype"
- Library-driven classification (count / area / linear from symbol library).
- Accuracy fixes to hit ±5%.
- PDF bid sheet output.
- Remove Google Sheets export; keep Google sign-in + Firestore for profile/project sync.
- ✅ Persistence: **local save** signed-out; **Firestore sync** when signed in with Google.

## 7a. Output: PDF bid sheet ✅
- ✅ **App builds both pages** (not exported from Figma).
- ✅ Structure: **page 1 = plan sheet, page 2 = bid table** (line item, qty, unit, blank unit price, blank total).
- ✅ Header branding is **per contractor** (Servin Landscaping is an example customer).
- ✅ Water consumption **out of scope** this milestone.
- Reference example: Figma `dInKvof2isrTso3C8gb4T5`, node `117:12027` ("040726-8651 Pennycress dr 3", 3300×5100).
- Must contain:
  - **Project header** — company logo/name/phone/email, "Landscaping plan for: <address>", design version + date.
  - **Plan image** — the drawing with dimensions; measured regions keyed.
  - **Line items + quantities** — surfaces (sq ft / linear ft), plants (count per species), objects (count).
  - **Blank price columns** — unit price / line total for contractor to fill in.
- 🔍 Example sheet structure: Header band (400px) → drawing (1775w) + Annotations column (1141w): Surfaces swatches, Plants cards (symbol, name, category, qty, water table, photo), Water consumption summary, Objects, Footer (scale bar 1"=12', version info).
- 🔍 Gap in example: surfaces show swatches **without quantities** (only sod has 772 sq ft) — the bid sheet must add them.

## 7b. Input: Figma source frame ✅
- Designer provides a link to a **drawing-only source frame** (long-term: equivalent drawn in-app).
- Reference example: Figma `dInKvof2isrTso3C8gb4T5`, node `117:11887` (858×2148 px; house 60 ft = 722 px ✓ 1 px = 1 in).
- ✅ Surfaces drawn as **vector shapes with image (texture) fills**.
- 🔍 Observed structure:
  - `Plan/Hardscape` — surface vectors: `Plot`, `Rock` (covers entire plot), `Grass`, `Mulch right` (boolean op), `Paver patio`; 16× `Paver` instances (stepping stones); `Firepit` instance.
  - `Plan/Hardscape/Structures` — existing: `House`, `Deck`, `Porch`, `Driveway`, `Walkway`, `Stairs`, 2× `Window well`.
  - `Plan/Outlines` — duplicate outlines + `Corner` markers (drafting aids).
  - `Plan/Measurements and annotations` — 23× `Measurement` instances + text labels (drafting aids).
  - `Plan/Plants` — plant instances (Eastern redbud, Blue diamond spruce, Crabapple, Common lilac, Fern ×8, Hydrangea ×5, Blue columbine ×11, "Coneflowers 03…28" ×26).
- 🔍 **Implications for the takeoff engine:**
  - Surfaces **overlap** (Rock spans the whole plot under everything) → per-layer area is wrong; need **visible area** after subtracting layers above it and structures.
  - Layer names are **unreliable**: "Coneflowers 03–28" appear on the sheet as "White Nugget (Ice plant) ×26"; "Fern" → "Fernbush". Plants must be identified by **main component**, not layer name.
  - Surface names ("Rock", "Grass", "Mulch right") ≠ library names → need mapping from **image fill / layer name** to library surface.
  - Drafting aids (Outlines, Measurements, Corners, text) must be ignored.
  - Example plan sheet reports sod = 772 sq ft and plant counts → candidate ground truth.

## 8. Requirements
### 8.1 Functional
| ID | Requirement | Pri |
|---|---|---|
| F1 | Load a Figma source frame from a URL (+ PAT); ignore drafting aids (outlines, measurements, corners, text) | P0 |
| F2 | Identify every library item by **main component**, not layer name | P0 |
| F3 | Classify each item via library measurement class: count / area / linear | P0 |
| F4 | Surfaces: compute **visible area** (shape minus everything above it, minus structures) | P0 |
| F5 | Map surface image fills → library surface automatically; designer confirms/overrides when no match | P0 |
| F6 | Structures (House, Driveway, Deck, Porch, Walkway…) default to **existing** (subtracted, not billed); designer can flag any as **new work** to include | P0 |
| F7 | Plants counted per species (library name), regardless of instance names | P0 |
| F8 | Objects counted per library item | P0 |
| F9 | Generate PDF: page 1 plan sheet (header, drawing, annotation column, scale bar, version/date); page 2 bid table (item, qty, unit, blank unit price, blank total) | P0 |
| F10 | Contractor branding on header (logo, name, phone, email) + client address | P0 |
| F15 | Linear footage: **edging** — designer explicitly marks edging; marking UX to be worked out in a prototype (not in this milestone's plan) | P2 |
| F16 | Linear footage: library **walls / fences** (retaining wall, veneer wall, privacy fence) | P0 |
| F20 | Linear quantity mode per item: centerline (thin walls/fences) vs full perimeter (e.g. mulch berms); auto-default by shape thickness, designer can override | P0 |
| F17 | Count-type paving items (e.g. stepping-stone pavers) reported as **count + sq ft** | P1 |
| F18 | Contractor profile (logo, name, phone, email) entered in app and saved locally, reused across projects | P0 |
| F11 | Local save/load of a takeoff project | P1 |
| F12 | Scale fixed at 1 px = 1 in; editable override with validation (>0), quantities recompute | P1 |
| F13 | Manual polygon plotting for items not in Figma (existing feature) | P2 |
| F14 | Remove Google Sheets export and the `spreadsheets` OAuth scope | P0 |
| F19 | Google sign-in syncs contractor profile + saved projects to Firestore; signed-out users keep local save | P0 |
### 8.2 Accuracy
- ✅ ±5% on area and length.
- ✅ Acceptance test: Pennycress source (`117:11887`) must reproduce the example sheet — sod ≈ 772 sq ft; Blue Diamond Spruce 1, Eastern Redbud 1, Crabapple 1, Lilac 1, Hydrangea 5, Fernbush 8, Columbine 11, White Nugget 26; Sitting wall 1.
- 🔍 Current gaps vs. target: curve lengths approximated as chords; raster boundary length overestimates diagonals; scale changes don't recompute.
### 8.3 Non-functional
- ✅ Desktop + tablet browsers; **full workflow on tablet** (touch-friendly canvas, controls ≥44px).
- Google sign-in (Firebase Auth) for cloud sync; app fully usable signed-out with local save.
- Figma token from build-time env var; no token entry UI.

## 9. Known gaps / tech debt
- Code review 2026-10-12: scale=0 crash; scale change doesn't recompute; duplicate rows on re-export; PAT in localStorage; broad Sheets scope; Firestore test read always denied; placeholder UI (fake feed / memory / status bar); Length button no-op with 2 points; no double-click finish.

## 10. Open questions
- ✅ Edging marking: to be explored in a prototype.
- ❓ Edging material — one default or per marked edge?
- ✅ Figma token: build-time variable for now (`VITE_FIGMA_PAT`); no token UI. Will go away with the in-app editor.

## 11. Interview log
### Round 1 (2026-10-12)
- ✅ Primary user: contractors / installers.
- ✅ Output serves: estimate/quote, ordering, install planning, design iteration.
- ✅ Stage: prototype, not used on real work.
- ✅ Scale: fixed convention.

### Round 2 (2026-10-12)
- ✅ Figma = prototype design source, can continue for now; long-term = in-app drawing on scaled plot plan with symbol library, by contractor or homeowner.
- ✅ Scale = 1 px = 1 in.
- ✅ Raw quantities only for now.
- ✅ Accuracy ±5%.

### Round 3 (2026-10-12)
- ✅ Not related to Front Range Yards.
- ✅ Symbol library drives materials + measurement class.
- ✅ Figma phase: designer runs takeoff on contractor's behalf.
- ✅ Output: **PDF bid sheet**.

### Round 4 (2026-10-12)
- ✅ Drop Google Sheets export.
- ✅ Bid sheet: line items + quantities, blank price columns, plan image, project header; example in Figma `117:12027`.
- ✅ Plants included, counted by species.
- ✅ Next milestone: harden Figma prototype.

### Round 5 (2026-10-12)
- ✅ PDF: plan sheet page + bid table page.
- ✅ Servin = example contractor customer → per-contractor branding.
- ✅ Water consumption out for now.
- ✅ Local save.

### Round 6 (2026-10-12)
- ✅ App builds page 1 (plan sheet) and page 2 (bid table).
- ✅ Surfaces = vector + image fill.
- ✅ Input = drawing-only source frame (example `117:11887`); app builds summary of materials, plants, objects with counts / sq ft / linear ft.
- ✅ Platform: desktop + tablet.

### Round 7 (2026-10-12)
- ✅ Visible-area rule for overlapping surfaces.
- ✅ Structures: per-layer flag existing vs new work.
- ✅ Surface mapping: auto-match image fill, manual fallback.
- ✅ Pennycress plan sheet numbers = acceptance ground truth.

### Round 8 (2026-10-12)
- ✅ Linear: edging between surfaces + walls/fences (utility lines out).
- ✅ Stepping-stone pavers: count + sq ft.
- ✅ Contractor branding: entered in app, saved locally.
- ✅ Success: manual validation for now.

### Round 9 (2026-10-12)
- ✅ Edging is designer-marked, not auto-derived.
- ✅ Tablet: full workflow.

### Round 10 (2026-10-12)
- ✅ Keep Google sign-in → sync contractor profile + projects via Firestore.
- ✅ Edging marking → explore in a prototype (deferred).
- ✅ Figma token → env variable, no UI.

### Round 11 (2026-10-12)
- ✅ Mulch berms (and similar) need **full perimeter**, not half → per-item linear mode.
- ✅ Execution: subagent-driven.

### Round 12 — direction reset (2026-10-12)
- ✅ Scratch the Figma-takeoff build; branch parked, not deleted.
- ✅ Reason: too Figma-dependent.
- ✅ First user: contractors / installers. Pain: getting a plan at all (no design tools/skills).
- ✅ Plan used to: win the job, quote accurately, instruct crews.
- ✅ Input: homeowner's plot plan PDF. Device: on site, tablet.

### Round 13 (2026-10-12)
- ✅ Scaling: explore trace → auto-detect → known-dimension fallback.
- ✅ Outputs: Servin-style plan sheet + priced proposal.
- ✅ Drawing: simple zones + symbols.
- ✅ HOA: nice to have.

### Round 14 (2026-10-12)
- ✅ Prices from contractor's own price list.
- ✅ Built-in shared symbol library.
- ✅ No pilot contractor yet.
- ✅ Homeowner gets a PDF.

### Round 15 — workflow (2026-10-12)
- ✅ Job created by contractor on site.
- ✅ Full plan done on site in ~30–60 min.
- ✅ Homeowner shown the plan at the end.
- ✅ Post-proposal steps out of scope for now.

### Round 16 — workflow details (2026-10-12)
- ✅ Trace over the PDF (tap corners, type lengths).
- ✅ Draw: existing features, edging/walls, plant spacing fill, dimensions.
- ✅ Often offline on site.
- ✅ Present plan sheet first.

### Round 17 (2026-10-12)
- ✅ Pricing details (price-list setup, proposal contents, price view) deferred — focus on the **editor**.
- Plant spacing fill behavior: no preference yet.

### Round 18 — editor (2026-10-12)
- ✅ Zone input method → prototype (combination likely).
- ✅ Curves essential.
- ✅ Default-fill zone model.
- ✅ Undo/redo, reshape, snap, copy/repeat all v1.

### Round 19 — editor details (2026-10-12)
- ✅ Library: search + categories.
- ✅ Symbols at true mature size.
- ✅ Quantities on selection.
- ✅ Any tablet browser.

### Round 20 — zone prototype feedback (2026-10-12)
- ❌ Zone Drawing Lab prototype judged **unusable**: couldn't draw at all; too many modes at once; plan too small to see; wrong starting point (should start from the plot plan / lot setup).
- ✅ Process change: go **slowly, one step at a time**, agreeing on each step before building it. Next step: the first screen of the workflow (job + plot plan → scaled base).

### Step 1 — Open the plot plan (agreed 2026-10-12)
- **Scope:** contractor picks the plot plan PDF from the tablet; it fills the screen; pinch to zoom and pan. Nothing else (no job info, no page picker, no drawing).
- **Done when:**
  - PDF opens in under a few seconds.
  - Fills the screen and stays sharp when zoomed (printed dimensions readable).
  - Pinch-zoom and pan feel smooth, like a photo viewer.
  - Works offline once the app is loaded.
- **Test file:** a real plot plan PDF supplied by the stakeholder (path TBD).

### Step 1 — build notes (2026-10-12)
- Built in `plan-builder/` (branch `feat/step1-open-plot-plan`).
- PDF.js was too slow on real plot plans: the Riesberg plan draws its text as ~12k vector shapes → ~12 s to first paint. Switched to **PDFium (WebAssembly)** in a background worker: ~0.7 s to open once the engine has warmed up (~3 s after app launch), ~1.5–2 s if opened immediately.
- Measured in headless Chrome on a Mac (820×1180, 2x); **not yet measured on a real iPad**.
- ⚠️ Later steps: this plan's scale label (`1" = 30'`) disagrees with its title block (`1"=20'`), and its text is drawn as shapes (no extractable text) → auto-detecting scale would need OCR.

### Round 21 (2026-10-12)
- ✅ Two-finger trackpad drag = pan; pinch = zoom (shipped `bc4cca8`).
- 📝 Backlog (low priority): replace "Open another" with an **edit button next to the file name**. ❓ Edit = rename, or replace the file?
- ✅ iPad testing deferred for now.
- ✅ Next step: **Step 2 — scale calibration flow** (to be defined before building).

### Step 2 — Scale calibration (agreed 2026-10-12)
- **Method:** known dimension only — tap both ends of one printed dimension, type its length.
- 📝 Later: try "trace the lot" and "printed scale bar/label" methods.
- **Confidence:** check a second printed dimension — the app shows what it measures vs. what's printed.
- **Done when:** endpoints can be placed precisely (zoom in, land exactly on the tick) · a second Riesberg dimension measures within 1% · calibration can be redone anytime.

### Step 2 — exploration: snapping & outline-first (2026-10-12)
- 💡 Stakeholder idea: **outline first, then set scale** — trace the plot boundary or a structure, then use those outlines to set the scale.
- 💡 Stakeholder idea: **snap tapped points** to the drawing — vector points for true-vector PDFs; corners/lines for image plans.
- 🔬 Feasibility on Riesberg (vector PDF), via PDFium:
  - All 11,861 page objects are paths; 98k straight segments + curves extracted in **~0.15 s** with exact coordinates → vector snapping is feasible.
  - ~95% of segments are under 5 pt (text drawn as shapes) → snapping must ignore tiny glyph strokes and favor long lines.
  - Property lines are **broken into several pieces** (e.g. the 155.55' line is 3–4 segments; the 116.45' line is one 207.8 pt segment) → snap to merged lines and their **intersections (corners)**, not just segment ends.
  - The boundary includes **curves** (top-right corner arc; front edge along Riesberg Lane, L=62.02', R=222.50') → tracing needs arc support.
  - ⚠️ Actual drawing scale ≈ **1" = 40'**: 116.45' measures 207.8 pt → 0.560 ft/pt. Neither printed scale (1"=30', 1"=20') matches the PDF as delivered → calibration from a known dimension is essential.
  - Cross-check available: printed **lot size 13,504 sq ft** can validate a traced boundary's area.
- Image (raster) plans: feasible without heavy libraries — find dark-line pixels near the tap, fit up to two lines, snap to their intersection (corner) or onto the line. Not yet tested (no raster sample).

### Round 22 (2026-10-12)
- ✅ Step 2 becomes **outline first, then set scale**.
- ✅ Contractor picks what to outline (plot boundary or house footprint).
- ✅ Prototype **vector-PDF snapping first**; image-plan snapping later.
- ✅ Plot plans arrive **mostly as vector PDFs**.
