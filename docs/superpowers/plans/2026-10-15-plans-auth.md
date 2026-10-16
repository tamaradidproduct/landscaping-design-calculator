# Saved Plans + Invite-only Sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contractors sign in with Google (invite-only), keep many plans (one per job address) synced through Firebase, and keep working offline.

**Architecture:** A `PlanStore` interface hides Firebase (Firestore doc per plan + PDF in Cloud Storage + own IndexedDB PDF cache); a `MemoryPlanStore` with a dev-only auth bypass keeps Playwright checks running without Google. New screens (sign-in, not invited, plans list, new plan) live in `plans-ui.ts`; `main.ts` routes between them and the existing editor, which gains `load()`/`state()` and an autosave hook.

**Tech Stack:** TypeScript, Vite 6, vitest 3, Firebase JS SDK v13 (`firebase/app`, `/auth`, `/firestore`, `/storage`), `fake-indexeddb` (tests only), playwright-core scripts.

**Spec:** `docs/superpowers/specs/2026-10-15-plans-auth-design.md`

## Global Constraints
- All commands run in `plan-builder/`; checks: `npm run lint`, `npm run typecheck`, `npm test`.
- Firebase project `landscaping-design-calculator`; owner/invite account `tamara.did.product@gmail.com`.
- `firebase/analytics` is never imported.
- Plan doc schema `v: 1`; `address` 1–200 chars after trimming; PDF ≤ 25 MB, `application/pdf`.
- Autosave debounce **1000 ms**; size warning above **800 KB** (doc limit 1 MB).
- Storage path `users/{uid}/plans/{planId}/plan.pdf`; Firestore path `users/{uid}/plans/{planId}`; invites `invites/{lowercase email}`.
- Firestore writes are never awaited for UI flow (offline they resolve only on server ack); failures surface as toasts.
- Dev/test bypass `?store=memory` works only when `import.meta.env.DEV`.
- Copy is fixed by spec §5 and §7 — use those strings verbatim.
- UI colours/spacing come from `src/styles/tokens.css` variables; never edit `tokens.css` by hand.
- Do not push or open a PR until Tamara says so.

## Review Focus
- **`undefined` fields in outlines** (e.g. `material: undefined` after an edit): Firestore rejects the whole write → `toDoc` strips them (test in Task 2).
- **Leaving right after an edit** (← Plans, closing the tab, switching apps): the last change must still be saved → autosave flushes on demand and on `pagehide` (tests in Task 3, wiring in Task 9).
- **Switching plans while a save is pending:** the pending save must land on the plan it came from, not the newly opened one (test in Task 3).
- **Address input of spaces only or 500 chars:** rejected / cut to 200, never written raw (test in Task 2).
- **A malformed or newer-version plan doc** (missing `outlines`, `v: 2`, NaN coordinates): opening shows the spec's error copy, never a crash or a write-back (test in Task 2).

---

### Task 1: Firebase project files, rules and SDK setup

**Files:**
- Create: `firebase.json`, `.firebaserc`, `firestore.rules`, `storage.rules` (repo root)
- Create: `plan-builder/src/firebase-config.ts`, `plan-builder/src/firebase.ts`
- Modify: `plan-builder/package.json` (deps)

**Interfaces:**
- Produces: `firebaseConfig` (object); `getFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage }` (lazy, initialises once).

- [ ] **Step 1: Install** `npm i firebase@13` and `npm i -D fake-indexeddb@6`. Before installing, check `npm view firebase time` and pick the newest version published ≥ 2 weeks ago; pin it exactly (no `^`).
- [ ] **Step 2: Write `firebase-config.ts`** with the config from the console (apiKey `AIzaSyBF2wGIjWz2qXFHnbMdEU4fffNzzteZfe0`, authDomain `landscaping-design-calculator.firebaseapp.com`, projectId `landscaping-design-calculator`, storageBucket `landscaping-design-calculator.firebasestorage.app`, messagingSenderId `831517248083`, appId `1:831517248083:web:de4e6f8e57c8c964c954a6`); omit `measurementId`. Comment: values are public; rules protect data.
- [ ] **Step 3: Write `firebase.ts`**: `initializeApp`; `initializeAuth` with `browserLocalPersistence` + `browserPopupRedirectResolver`; `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`; `getStorage(app)`. Imported dynamically by `main.ts` so memory mode never loads Firebase.
- [ ] **Step 4: Write rules** exactly per spec §4:
  - `firestore.rules`: `invited()` = `request.auth != null && request.auth.token.email_verified == true && exists(/databases/$(database)/documents/invites/$(request.auth.token.email.lower()))`; `invites/{email}` allow `get` if `request.auth.token.email.lower() == email`; `users/{uid}/plans/{planId}` allow read, delete if `invited() && request.auth.uid == uid`; allow create, update if that and `request.resource.data.v == 1 && request.resource.data.address is string && request.resource.data.address.size() >= 1 && request.resource.data.address.size() <= 200`.
  - `storage.rules`: `match /users/{uid}/plans/{planId}/plan.pdf` allow read, delete if owner and `firestore.exists(/databases/(default)/documents/invites/$(request.auth.token.email.lower()))`; allow write if that and `request.resource.contentType == 'application/pdf' && request.resource.size <= 25 * 1024 * 1024`.
  - `firebase.json`: `{ "firestore": { "rules": "firestore.rules" }, "storage": { "rules": "storage.rules" } }`; `.firebaserc`: default project `landscaping-design-calculator`.
- [ ] **Step 5: Verify** `npx firebase-tools deploy --only firestore:rules,storage --dry-run` from repo root → "Dry run complete" with both rulesets compiled. (Real deploy is Task 10, after Tamara confirms.)
- [ ] **Step 6: Verify** `npm run typecheck && npm test` → pass.
- [ ] **Step 7: Commit** `chore(firebase): project config, security rules, SDK init`.

### Task 2: Plan model (pure)

**Files:**
- Create: `plan-builder/src/plan-model.ts`, `plan-builder/src/plan-model.test.ts`

**Interfaces:**
- Consumes: `Outline` (`src/outline.ts`), `Reference` (`src/scale.ts`).
- Produces:
  - `interface PdfInfo { name: string; size: number; rev: number; uploaded: boolean }`
  - `interface PlanState { outlines: Record<string, Outline>; refs: Reference[] }`
  - `interface PlanDoc extends PlanState { v: 1; address: string; createdAt: number; updatedAt: number; pdf: PdfInfo }`
  - `interface PlanMeta { id: string; address: string; createdAt: number; updatedAt: number; pdf: PdfInfo; pending: boolean }`
  - `cleanAddress(raw: string): string | null` — trim, collapse inner whitespace, cut to 200; `null` if empty.
  - `toDoc(state: PlanState, meta: Omit<PlanDoc, 'v' | 'outlines' | 'refs'>): PlanDoc` — deep copy with `undefined` keys removed.
  - `fromDoc(data: unknown): PlanDoc` — throws `PlanFormatError` (`reason: 'newer' | 'invalid'`).
  - `docBytes(doc: PlanDoc): number` — UTF-8 length of `JSON.stringify` (estimate).
  - `SIZE_WARN_BYTES = 800_000`
  - `sortPlans(plans: PlanMeta[]): PlanMeta[]` — `updatedAt` desc, then address asc.
  - `editedAgo(updatedAt: number, now: number): string` — `"Edited just now"` (<1 min), `"Edited 5 min ago"`, `"Edited 2 h ago"`, `"Edited yesterday"`, else `"Edited Oct 3"` (en-US short month).

- [ ] **Step 1: Write failing tests** in `plan-model.test.ts`:
  - `round-trips a surface with bulges and radii` — `fromDoc(toDoc(state, meta))` deep-equals the input for an outline `{ id:'s1', kind:'surface', name:'Sod', pts:[{x:1,y:2},{x:3,y:2},{x:3,y:5}], closed:true, bulges:[0,4,0], radii:[0,2,0], material:'sod' }` and refs `[{ id:'s1', i:0, feet:12 }]`.
  - `drops undefined fields` — outline with `material: undefined, bulges: undefined` → `'material' in doc.outlines.o1 === false`.
  - `has no nested arrays` — recursive walk over `toDoc(...)` finds no array whose element is an array.
  - `cleanAddress` — `'  12  Elm St '` → `'12 Elm St'`; `'   '` → `null`; 500×`'a'` → length 200.
  - `fromDoc rejects` — `{...valid, v: 2}` → reason `'newer'`; missing `outlines` → `'invalid'`; a point `{x: NaN, y: 1}` → `'invalid'`; `address: ''` → `'invalid'`.
  - `sortPlans` — newest `updatedAt` first; ties by address.
  - `editedAgo` — `now - 30_000` → `'Edited just now'`; `now - 5*60_000` → `'Edited 5 min ago'`; `now - 2*3_600_000` → `'Edited 2 h ago'`.
- [ ] **Step 2: Run** `npx vitest run src/plan-model.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `plan-model.ts` per the Interfaces block. `fromDoc` validates shape by hand (no schema library): numbers finite, `pts` array of `{x,y}`, `kind` in the three `OutlineKind`s.
- [ ] **Step 4: Run** the test file → PASS. Run `npm test` → all pass.
- [ ] **Step 5: Commit** `feat(plans): plan document model`.

### Task 3: Autosave scheduler (pure)

**Files:**
- Create: `plan-builder/src/autosave.ts`, `plan-builder/src/autosave.test.ts`

**Interfaces:**
- Produces: `class Autosave { constructor(save: (planId: string) => void, delayMs = 1000); changed(planId: string): void; flush(): void; cancel(): void; get pending(): boolean }`.
  - `changed` restarts the timer; if a different `planId` is pending, that one is flushed first.
  - `flush` runs the pending save now (no-op if none).

- [ ] **Step 1: Write failing tests** (vitest fake timers):
  - `saves once 1000 ms after the last change` — 3 `changed('a')` 400 ms apart → `save` called once, at 1800 ms, with `'a'`.
  - `flush saves immediately and clears pending`.
  - `switching plans saves the previous plan first` — `changed('a')`, then `changed('b')` at 200 ms → `save` called with `'a'` at 200 ms and `'b'` at 1200 ms.
  - `cancel drops the pending save`.
- [ ] **Step 2: Run** `npx vitest run src/autosave.test.ts` → FAIL.
- [ ] **Step 3: Implement** `autosave.ts`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(plans): debounced autosave`.

### Task 4: PDF cache (IndexedDB)

**Files:**
- Create: `plan-builder/src/pdf-cache.ts`, `plan-builder/src/pdf-cache.test.ts`

**Interfaces:**
- Produces: `interface CachedPdf { rev: number; bytes: ArrayBuffer }`; `pdfCache.get(planId): Promise<CachedPdf | null>`, `pdfCache.put(planId, rev, bytes): Promise<void>`, `pdfCache.delete(planId): Promise<void>`. DB name `plan-builder-pdfs`, store `pdfs`. Any IndexedDB failure → `get` returns `null`, `put`/`delete` resolve (cache is best effort) and `console.warn`.

- [ ] **Step 1: Write failing tests** with `import 'fake-indexeddb/auto'`: put then get returns same `rev` and byte length; put again with higher rev replaces; delete → `null`; get unknown → `null`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with raw `indexedDB` (no wrapper library).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(plans): on-device PDF cache`.

### Task 5: PlanStore interface + MemoryPlanStore

**Files:**
- Create: `plan-builder/src/plan-store.ts`, `plan-builder/src/memory-plan-store.ts`, `plan-builder/src/plan-store.contract.ts`, `plan-builder/src/memory-plan-store.test.ts`

**Interfaces:**
- Consumes: Task 2 types, `cleanAddress`, `toDoc`, `fromDoc`.
- Produces (in `plan-store.ts`):
  ```ts
  export interface PlanStore {
    watchPlans(onPlans: (plans: PlanMeta[]) => void, onError: (e: Error) => void): () => void;
    create(address: string, pdf: File): Promise<string>;            // returns planId; throws PlanInputError
    load(id: string): Promise<{ meta: PlanMeta; state: PlanState }>; // throws PlanFormatError
    save(id: string, state: PlanState): void;                         // fire-and-forget; errors via onError
    rename(id: string, address: string): Promise<void>;
    replacePdf(id: string, pdf: File): Promise<void>;                 // rev + 1
    remove(id: string): Promise<void>;
    getPdf(id: string): Promise<ArrayBuffer>;                         // throws PdfUnavailableError
    flushUploads(): Promise<void>;
    onError(cb: (e: Error) => void): void;
  }
  export class PlanInputError extends Error { reason: 'address' | 'not-pdf' | 'too-big' }
  export class PdfUnavailableError extends Error {}
  export const MAX_PDF_BYTES = 25 * 1024 * 1024;
  export function checkPdf(file: File): void; // throws PlanInputError('not-pdf' | 'too-big')
  ```
- `plan-store.contract.ts` exports `runPlanStoreContract(make: () => PlanStore)` — the suite both stores must pass.

- [ ] **Step 1: Write the contract suite** (`describe` block inside the exported function):
  - `create then list` — `create('12 Elm St', pdf)` → `watchPlans` emits one plan with that address, `pdf.rev === 1`.
  - `create rejects blank address` → `PlanInputError` reason `'address'`; non-PDF file → `'not-pdf'`; 26 MB → `'too-big'`.
  - `save then load returns the state`.
  - `rename updates address and updatedAt`.
  - `replacePdf bumps rev and getPdf returns the new bytes; outlines unchanged`.
  - `remove drops it from the list and getPdf throws PdfUnavailableError`.
  - `list is newest-edited first` (uses `sortPlans`).
- [ ] **Step 2: Write `memory-plan-store.test.ts`** calling `runPlanStoreContract(() => new MemoryPlanStore())`; run → FAIL.
- [ ] **Step 3: Implement** `plan-store.ts` and `MemoryPlanStore` (Maps; `pending` always `false`; `Date.now()` timestamps; ids from `crypto.randomUUID()`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(plans): plan store interface and in-memory store`.

### Task 6: FirebasePlanStore

**Files:**
- Create: `plan-builder/src/firebase-plan-store.ts`

**Interfaces:**
- Consumes: `getFirebase()` (Task 1), `pdfCache` (Task 4), Task 2/5 types.
- Produces: `class FirebasePlanStore implements PlanStore { constructor(uid: string) }`.

- [ ] **Step 1: Implement** using the spec §3 and §5 rules:
  - `watchPlans`: `onSnapshot(collection(db,'users',uid,'plans'), { includeMetadataChanges: true })` → `PlanMeta` with `pending = doc.metadata.hasPendingWrites || !pdf.uploaded`, sorted via `sortPlans`. Docs failing `fromDoc` are listed with their address if readable, else skipped with `console.warn`.
  - `create`: `checkPdf`, `cleanAddress`, new doc ref id; `setDoc` (not awaited) with `pdf.uploaded: false, rev: 1`; `pdfCache.put`; start upload (`uploadBytes` then `updateDoc` `pdf.uploaded: true`) without awaiting; return id.
  - `save`: `setDoc(ref, toDoc(...), { merge: false })` keeping meta fields, `updatedAt: Date.now()`; warn via `onError` callback with a `SizeWarning` (add `class SizeWarning extends Error` to `plan-store.ts`) when `docBytes > SIZE_WARN_BYTES`.
  - `getPdf`: cache hit with `rev >= doc rev` → bytes; else `getBytes(storageRef)` → cache → bytes; offline/not found → `PdfUnavailableError`.
  - `replacePdf`: `checkPdf`; `rev + 1`, `uploaded: false`; cache; upload as in create.
  - `remove`: `deleteDoc`, `deleteObject` (ignore `storage/object-not-found`), `pdfCache.delete`.
  - `flushUploads`: for each listed plan with `uploaded === false` whose cached `rev` equals doc `rev`, upload; called on start and `window` `online`.
  - Every caught error goes to the `onError` callback; `permission-denied` errors are rethrown as `class AccessDeniedError extends Error` (add to `plan-store.ts`).
- [ ] **Step 2: Verify** `npm run typecheck` → pass.
- [ ] **Step 3: Commit** `feat(plans): Firestore + Cloud Storage plan store`.

### Task 7: Auth

**Files:**
- Create: `plan-builder/src/auth.ts`, `plan-builder/src/auth.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AuthState =
    | { kind: 'loading' } | { kind: 'signed-out' }
    | { kind: 'not-invited'; email: string } | { kind: 'ready'; uid: string; email: string };
  export interface AuthGate { watch(cb: (s: AuthState) => void): () => void; signIn(): Promise<void>; signOut(): Promise<void>; recheck(): void }
  export function resolveInvite(check: 'invited' | 'not-invited' | 'offline', remembered: boolean): 'invited' | 'not-invited' | 'unknown';
  export class FirebaseAuthGate implements AuthGate {}
  export class DevAuthGate implements AuthGate {} // always { kind:'ready', uid:'dev', email:'dev@localhost' }
  ```
- Invite memory: `localStorage` key `plan-builder.invited.<uid>` = `'1'`, wrapped in try/catch.

- [ ] **Step 1: Write failing tests** for `resolveInvite`: `('invited', false)` → `'invited'`; `('not-invited', true)` → `'not-invited'` (revocation wins online); `('offline', true)` → `'invited'`; `('offline', false)` → `'unknown'`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; `FirebaseAuthGate.watch` uses `onAuthStateChanged`, then `getDocFromServer(doc(db,'invites',email.toLowerCase()))` (`permission-denied`/missing → `'not-invited'`, `unavailable` → `'offline'`); `'unknown'` maps to `signed-out` with a toast-able flag `offlineFirstSignIn` (copy: "Connect to the internet to sign in."). `signIn` = `signInWithPopup(auth, new GoogleAuthProvider())` with `prompt: 'select_account'`. Run tests → PASS.
- [ ] **Step 4: Commit** `feat(auth): invite-only Google sign-in gate`.

### Task 8: Editor load/state hooks

**Files:**
- Modify: `plan-builder/src/outline-ui.ts` (class `OutlineTool`, near `snapshot()` ~line 135)
- Modify: `plan-builder/src/history.ts` (add `clear(): void`)
- Test: `plan-builder/src/history.test.ts`

**Interfaces:**
- Produces: `OutlineTool.load(state: PlanState): void` — replaces `outlines`/`refs`, clears `drawing`, selection and history, calls `update()`; `OutlineTool.state(): PlanState` — `structuredClone` of `outlines` and `refs`, excluding an outline still being drawn (`this.drawing`) and restoring `this.replaced` in its place if a redraw is in progress.

- [ ] **Step 1: Write failing test** `clear empties undo and redo` in `history.test.ts`; run → FAIL; implement `History.clear()`; run → PASS.
- [ ] **Step 2: Implement** `load` and `state` on `OutlineTool`.
- [ ] **Step 3: Verify** `npm run typecheck && npm test` → pass.
- [ ] **Step 4: Commit** `feat(editor): load and read back plan state`.

### Task 9: Screens and routing

**Files:**
- Create: `plan-builder/src/plans-ui.ts`, `plan-builder/src/styles/plans.css`
- Modify: `plan-builder/index.html`, `plan-builder/src/main.ts`, `plan-builder/src/style.css` (import `plans.css`)

**Interfaces:**
- Consumes: `AuthGate`, `PlanStore`, `Autosave`, `OutlineTool.load/state`, `editedAgo`, `cleanAddress`.
- Produces: `class PlansScreen { constructor(root: HTMLElement, store: PlanStore, opts: { onOpen(id: string): void; onSignOut(): void; email: string }); show(): void; hide(): void }` plus `renderSignIn(root, gate)`, `renderNotInvited(root, email, gate)`.

- [ ] **Step 1: Markup.** In `index.html` add `<section id="screen-auth" hidden>` and `<section id="screen-plans" hidden>` siblings of `.canvas`; remove the `#empty` block's open button flow (Plans replaces it); add `<button id="back-to-plans">← Plans</button>` as the first `.side-section`. Keep `<input type="file" id="file">` (reused for New plan and Replace).
- [ ] **Step 2: `plans-ui.ts`** renders, with copy verbatim from spec §5:
  - Sign-in: title "Plan Builder", button `#sign-in` "Sign in with Google"; offline first sign-in → "Connect to the internet to sign in."; popup closed/blocked → "Sign-in didn't finish. Allow pop-ups for this site and try again."
  - Not invited: "This Google account (<email>) hasn't been invited to Plan Builder. Ask Tamara for an invite." + `#use-another` "Use another account".
  - Plans: `#new-plan` "New plan"; rows `.plan-row[data-id]` with address, `editedAgo`, and "Not synced yet" when `pending`; per-row Rename (inline input, Enter saves via `cleanAddress`) and Delete (inline confirm "Delete <address>? This can't be undone." with Delete / Cancel); empty state "No plans yet. Start one for your next job."; account menu with email + `#sign-out` (if any plan `pending`: inline warning "Some changes haven't synced yet. Signing out now loses them." + "Sign out anyway").
  - New plan form: `#new-address` (required) + `#new-pdf` "Pick plot plan PDF" (clicks `#file`); on file → `store.create` → `onOpen(id)`; `PlanInputError` reasons map to: address → "Enter the job's address."; not-pdf → "That file isn't a PDF. Pick the plot plan PDF."; too-big → "This PDF is over 25 MB. Export a smaller copy and try again."
- [ ] **Step 3: `main.ts` routing.**
  - On start: `?store=memory` and `import.meta.env.DEV` → `DevAuthGate` + `MemoryPlanStore`; else dynamic-import `FirebaseAuthGate` + `FirebasePlanStore(uid)` on `ready`.
  - Auth state → show auth screen / not-invited / Plans; hide editor + sidebar outside the editor.
  - `openPlan(id)`: `store.load` → `tool.load(state)` → `store.getPdf` → existing open path refactored from `openFile` into `openBytes(bytes: ArrayBuffer, name: string)`; `#name` shows the address. `PdfUnavailableError` → toast "This plan's PDF isn't on this device yet. Connect to the internet to open it." and stay on Plans; `PlanFormatError('newer')` → "This plan was saved by a newer version of Plan Builder. Reload to update."
  - Autosave: `new Autosave(id => store.save(id, tool.state()))`; call `autosave.changed(currentId)` from `ToolHost.changed()` only when state actually changed (compare `JSON.stringify(tool.state())` with last saved string); `flush()` on `#back-to-plans` and `pagehide`.
  - Replace plot plan: `#file-button` opens in-page confirm "Replace the plot plan for <address>? Your outlines and surfaces stay where they are." → `#file` → `store.replacePdf` → `openBytes`.
  - `store.onError`: `SizeWarning` → toast "This plan is getting large. Split very detailed outlines into simpler ones."; `AccessDeniedError` → `gate.recheck()`; others → toast "Couldn't save to the cloud. Your changes are kept on this device."
  - `window` `online` → `store.flushUploads()`.
- [ ] **Step 4: Styles** in `plans.css` using existing token variables and component classes (`.card`, `.primary`, `.layer-row`-like rows); controls ≥ 44 px.
- [ ] **Step 5: Verify** `npm run lint && npm run typecheck && npm test` → pass; `npm run dev`, open `http://localhost:5180/?store=memory` in the browser pane: New plan → address + `samples/riesberg-plot-plan.pdf` → editor opens with the address; draw one outline; ← Plans; reopen → outline present; screenshot.
- [ ] **Step 6: Commit** `feat(plans): sign-in, plans list, new plan, editor routing and autosave`.

### Task 10: Deploy rules and verify against Firebase (needs Tamara)

- [ ] **Step 1: Ask Tamara** to confirm the console checklist is done (Storage bucket `us-central1`, budget alert, `invites/tamara.did.product@gmail.com`) and to approve deploying rules.
- [ ] **Step 2: Deploy** from repo root: `npx firebase-tools deploy --only firestore:rules,storage` → "Deploy complete!".
- [ ] **Step 2b: Bucket CORS** (the browser's `getBytes` needs it), from repo root, before any testing: `gsutil cors set cors.json gs://landscaping-design-calculator.firebasestorage.app` (or `gcloud storage buckets update gs://landscaping-design-calculator.firebasestorage.app --cors-file=cors.json`). Check with `gsutil cors get gs://landscaping-design-calculator.firebasestorage.app`.
- [ ] **Step 3: Manual check on `npm run dev` (no `?store`)**, signed in as `tamara.did.product@gmail.com`: create plan → doc appears in Firestore console and `plan.pdf` in Storage; reload → plan listed; rename, replace PDF (`pdf.rev` 2), delete → doc and file gone.
- [ ] **Step 4: Offline check:** DevTools → Network → Offline; edit plan + create plan → "Not synced yet" shown; back online → marker clears, PDF uploaded.
- [ ] **Step 4b: Second device check:** a second browser profile (or cleared site data) → sign in → the plan is listed and its PDF downloads.
- [ ] **Step 4c: Offline cold start:** `npm run build && npm run preview` (port 5181); sign in online once, open a plan; then DevTools → Offline, close the tab and reload → reaches Plans and opens the cached plan.
- [ ] **Step 5: Not-invited check:** sign in with an account that has no invite → Not invited screen; nothing readable (console shows `permission-denied` only).
- [ ] **Step 6:** Record results in the commit body of Task 11's commit (no code change here).

### Task 11: Playwright checks

**Files:**
- Create: `plan-builder/scripts/lib/open-plan.mjs`, `plan-builder/scripts/check-plans.mjs`
- Modify: every `plan-builder/scripts/check-*.mjs` that calls `setInputFiles('#file', pdf)`

**Interfaces:**
- Produces: `openPlan(page, pdfPath, address = 'Riesberg test')` — clicks `#new-plan`, fills `#new-address`, `setInputFiles('#file', pdfPath)`, waits for the "Opened" toast.

- [ ] **Step 1:** Replace each script's `setInputFiles('#file', pdf)` + "Opened" wait with `await openPlan(page, pdf)`; default URL → `http://localhost:5180/?store=memory`.
- [ ] **Step 2: Write `check-plans.mjs`**: create plan → outline House (reuse coordinates from `check-step3.mjs`) → wait 1.5 s → ← Plans → row shows "Riesberg test" + "Edited just now" → reopen → House label present → rename to "14 Elm St" → delete with confirm → empty state copy shown. Also log `docBytes` of the saved state via a dev-only `window.__planBytes` hook, asserting < 800 000.
- [ ] **Step 3: Run** `node scripts/check-plans.mjs ../samples/riesberg-plot-plan.pdf` and `check-step3.mjs`, `check-surfaces.mjs`, `check-undo.mjs` → all report pass.
- [ ] **Step 4: Commit** `test(plans): Playwright checks for saved plans; scripts open via New plan`.

### Task 12: Docs

**Files:**
- Modify: `docs/PRD.md` (§8 open question; new §6.9 "Plans & sign-in"; §5 build steps row), `CLAUDE.md` (Firebase project line under Dev workflow)
- Create: `docs/conversations/2026-10-15-plans-auth.md`

- [ ] **Step 1:** PRD §8: replace "❓ Saving jobs…" with "✅ Saving jobs: Google sign-in, invite-only, Firebase sync, works offline (§6.9)". Add §6.9 summarising spec §2 and §5 in the PRD's bullet style.
- [ ] **Step 2:** `CLAUDE.md` Dev workflow: add "**Firebase:** project `landscaping-design-calculator` (Blaze, owner tamara.did.product@gmail.com); rules in `firestore.rules` / `storage.rules`, deploy with `npx firebase-tools deploy --only firestore:rules,storage`; invite = add `invites/<email>` doc".
- [ ] **Step 3:** Conversation summary (decisions: Supabase → Firebase, invite-only via rules, Blaze + Cloud Storage, replace PDF keeps drawings).
- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test` → pass. **Commit** `docs: saved plans and sign-in in PRD, CLAUDE.md, decision summary`.
