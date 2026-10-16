# Saved plans + invite-only sign-in — design

- **Date:** 2026-10-15
- **Branch:** `feat/plans-auth` (based on `feat/material-zones`; rebase onto `main` once that merges)
- **Backend:** Firebase project `landscaping-design-calculator` (Blaze; owner `tamara.did.product@gmail.com`)

## 1. Goal
- A contractor keeps **many plans, one per job/address**, and picks up any of them on any of their devices.
- Only people Tamara has **invited** can use the app; nobody can sign themselves up.
- Everything keeps working **offline on site**, and syncs when the tablet is back online.

## 2. Decisions
| Topic | Decision |
|---|---|
| Backend | **Firebase** (Auth + Firestore + Cloud Storage); Supabase dropped because Firestore's offline cache covers the offline requirement |
| Sign-in | Google only (Firebase Auth); signing in is required to use the app |
| Invite-only | `invites/{email}` docs added by hand in the Firebase console; security rules refuse everything else. An un-invited Google account can sign in but sees "not invited" and can read/write nothing. No invite email is sent |
| Who sees what | Each user sees **only their own plans**; no sharing |
| Offline | Full offline: open, edit and create plans offline after one online sign-in on that device |
| Plan storage | **One Firestore doc per plan** (state) + the plot plan PDF in **Cloud Storage** |
| Replacing the PDF | Allowed from the editor (e.g. a revised survey). Outlines, surfaces and typed lengths are **kept as they are**; the contractor re-checks them against the new plan |
| Saving | Autosave ~1 s after each change; no Save button |
| Conflicts | Last write wins per plan (single owner; only bites when one plan is edited offline on two devices) |
| Environments | One Firebase project for local dev, staging and production |
| Config | Firebase web config committed in `plan-builder/src/firebase-config.ts` (not secret; rules protect data) |
| Analytics | Not loaded (`firebase/analytics` stays out of the bundle) |
| Out of scope | Contractor profile (F18), sharing/teams, version history, in-app invite admin, importing old local-only work, multi-page PDFs |

## 3. Data
### 3.1 Firestore
- `invites/{email}` — doc ID is the Google email, lowercase; `{ invited: true }`. Managed by hand.
- `users/{uid}/plans/{planId}` — one per plan:

| Field | Type | Notes |
|---|---|---|
| `v` | number | Schema version, `1` |
| `address` | string | The job's address; the plan's name in the list (1–200 chars) |
| `createdAt` | number | Client ms epoch |
| `updatedAt` | number | Client ms epoch; the list sorts on it (works offline, unlike server timestamps) |
| `pdf` | map | `{ name: string, size: number, rev: number, uploaded: boolean }` — `rev` goes up by 1 on each replace |
| `outlines` | map | `Record<id, Outline>` — boundary, features and surfaces, exactly the editor's model |
| `refs` | array | `Reference[]` — typed edge lengths; the scale and stretch correction are recomputed from them on open |

- Firestore forbids nested arrays; `Outline.pts` is an array of `{x, y}` maps and `bulges`/`radii` are flat number arrays, so the model stores as-is. A round-trip test guards this.
- Not stored: undo history, selection, zoom/pan, plot plan visibility/opacity (they reset on open).
- Doc limit is 1 MB. The Riesberg fixture is measured in the plan; the editor shows a warning toast above 800 KB.

### 3.2 Cloud Storage
- `users/{uid}/plans/{planId}/plan.pdf` — written when the plan is created and overwritten when the PDF is replaced; only the latest PDF is kept.

### 3.3 On-device
- Firestore persistent cache (IndexedDB, multi-tab) holds plan docs and queued writes.
- `pdf-cache` (own small IndexedDB store, keyed by `planId`) holds `{ rev, bytes }`: filled on create, replace and first download, so a plan opened once opens offline. A cached `rev` older than the doc's → download again.
- `localStorage` remembers "this uid was invited" so an offline start skips the invite check.

## 4. Security rules
- **Firestore** (`firestore.rules`):
  - `invited()` = signed in, `email_verified`, and `invites/{lower(email)}` exists.
  - `invites/{email}`: `get` only when it is the caller's own email; no list, no writes.
  - `users/{uid}/plans/{planId}`: read/write only when `invited()` and `uid == request.auth.uid`; writes must carry `v == 1` and a string `address` of 1–200 chars (Firestore enforces the 1 MB doc limit itself).
  - Everything else denied.
- **Storage** (`storage.rules`):
  - `users/{uid}/plans/{planId}/plan.pdf`: read/write only for the owner, when `firestore.exists` finds their invite; `contentType == 'application/pdf'`, size ≤ 25 MB; create, overwrite and delete allowed.
- `firebase.json` + `.firebaserc` at the repo root; deployed by hand: `npx firebase-tools deploy --only firestore:rules,storage`.

## 5. Screens and flow
- **Start:** Firebase restores the session (works offline). Signed out → Sign-in. Signed in → invite check → Plans.
- **Sign-in:** app name, one "Sign in with Google" button (`signInWithPopup`). Offline → "Connect to the internet to sign in."
- **Not invited:** "This Google account (email) hasn't been invited to Plan Builder. Ask Tamara for an invite." + "Use another account" (signs out).
- **Plans (new home, replaces today's empty screen):**
  - "New plan" + list newest-edited first: address, "Edited 2 h ago", a "Not synced yet" marker while writes or the PDF upload are pending.
  - Each row: open (tap), rename address, delete (inline "Delete <address>? This can't be undone." confirm in the page).
  - Empty state: "No plans yet. Start one for your next job."
  - Account menu: email + Sign out (warns if anything isn't synced yet).
- **New plan:** a two-step form — "Pick plot plan PDF" (address field optional; prefilled from the file name, then from an address found in the PDF's first-page text, never over what was typed) → "Create plan" (name: typed, else extracted, else file name, else "Untitled plan") → creates the doc, caches + uploads the PDF, opens the editor. Works offline (upload waits).
- **Editor:** today's screen, plus "← Plans" at the top of the side panel; the plot plan layer row shows the address.
- **Replace plot plan:** the plot plan layer row's edit button (today's "open a different file") → in-page confirm "Replace the plot plan for <address>? Your outlines and surfaces stay where they are." → pick PDF → `rev` + 1, cache, upload (waits if offline). Undo does not cover it.
- **Open a plan:** PDF from `pdf-cache`, else download from Storage (offline and not cached → "This plan's PDF isn't on this device yet. Connect to the internet to open it.").
- **Pending uploads:** on start and on `online`, any plan with `pdf.uploaded == false` whose cached `rev` matches the doc is uploaded, then the flag is set. (Replacing on a device where an older upload is still pending just uploads the newest.)

## 6. Code structure (`plan-builder/src/`)
| Unit | Job | Depends on |
|---|---|---|
| `firebase-config.ts` | Web config object | — |
| `firebase.ts` | Init app, Auth (local persistence), Firestore (persistent multi-tab cache), Storage | config |
| `plan-model.ts` | Pure: `PlanDoc` type, `toDoc(outlines, refs, meta)`, `fromDoc(doc)` with validation, size estimate, list sort | outline, scale types |
| `plan-store.ts` | `PlanStore` interface (list/watch, create, save, rename, replacePdf, delete, getPdf, flushUploads) + `FirebasePlanStore` + `MemoryPlanStore` | firebase, plan-model, pdf-cache |
| `pdf-cache.ts` | IndexedDB get/put/delete of PDF bytes by planId | — |
| `auth.ts` | `watchAuth` → signed-out / not-invited / ready(user); sign in/out; invite check with offline memory | firebase |
| `autosave.ts` | Debounce (1 s) + flush on `pagehide`/"← Plans"; pure scheduling, testable with fake timers | — |
| `plans-ui.ts` | Sign-in, Not invited, Plans list, New plan screens | auth, plan-store |
| `main.ts` | Routes between screens; editor loads a plan instead of a picked file; tells autosave on every `changed()` | all |

- `OutlineTool` gains `load(outlines, refs)` (clears history) and `state()` (outlines + refs) — the only editor change.
- **Dev/test mode:** in dev builds, `?store=memory` uses `MemoryPlanStore` and skips sign-in, so the Riesberg Playwright checks keep running without a Google account. Production builds ignore the flag.

## 7. Error handling
- Every Firestore/Storage failure shows a toast that says what failed and what to do; edits stay on the device.
- `permission-denied` on any call → re-run the invite check (invite revoked → Not invited screen).
- Storage quota/size errors → "This PDF is over 25 MB. Export a smaller copy and try again."
- Newer-version plan doc → "This plan was saved by a newer version of Plan Builder. Reload to update."; corrupt plan doc → "This plan couldn't be read. Delete it and start a new plan." (no write back either way; saves that would write an unreadable doc are refused).
- Popup blocked/closed → stay on Sign-in with a one-line hint.

## 8. Testing
- **Unit (vitest):** `plan-model` round-trip incl. surfaces, bulges, radii; no nested arrays; validation rejects bad docs; list sort; size estimate. `autosave` debounce/flush with fake timers. `MemoryPlanStore` contract tests (the same suite would run against Firebase via emulators later).
- **Rules:** written and reviewed now; emulator tests (`@firebase/rules-unit-testing`, needs Java) are a follow-up, not a blocker.
- **Playwright (`?store=memory`):** create plan → draw outline → back to Plans → reopen → outline still there; rename; delete; existing Riesberg checks still pass.
- **Manual on staging:** sign in as invited account; sign in as un-invited account → Not invited; airplane mode → edit + create plan → reconnect → "Not synced yet" clears and plan appears on a second device.

## 9. Setup outside the repo (Tamara)
- Done: project, Google provider, authorized domain `tamaradidproduct.github.io`, Firestore `nam5`, web app, CLI login.
- To do: Storage bucket `us-central1`, budget alert, `invites/tamara.did.product@gmail.com`, then deploy rules.

## 10. Risks
- **iPad installed-PWA popups:** `signInWithPopup` can fail in an installed (home-screen) PWA on iOS; Safari tab works. iPad testing is deferred per PRD §6.6; fall back to opening in Safari for first sign-in if needed.
- **Third-party storage partitioning:** the auth helper lives on `firebaseapp.com`, not `github.io`; popup flow is the supported path for this setup. If browsers break it, move hosting to Firebase Hosting (same-origin `/__/auth`).
- **Doc size:** very dense freehand plans could near 1 MB; warning at 800 KB, splitting outlines into a subcollection is the escape hatch.

## 11. PRD updates (with the implementation)
- §8: resolve "Saving jobs" → accounts + sync, invite-only, offline.
- New §6.9 "Plans & sign-in" summarising §2 and §5.
