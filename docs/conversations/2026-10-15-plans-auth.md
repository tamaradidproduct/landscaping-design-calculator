# Plan Builder: Saved plans + invite-only sign-in (2026-10-15)

Distilled summary of the design session behind this PR. Current requirements: `docs/PRD.md` §6.9. Spec: `docs/superpowers/specs/2026-10-15-plans-auth-design.md`.

## Backend
- **Supabase was considered, then dropped for Firebase:** Firestore's built-in offline cache covers the offline requirement.
- Firebase project owner is tamara.did.product@gmail.com; **Blaze plan** (Cloud Storage needs it), Firestore in `nam5`, PDFs in Cloud Storage `us-central1`.
- `firebase` pinned to 12.19.0 (13 was too new).

## Access
- **Invite-only** via `invites/{email}` docs plus security rules; no in-app admin and no invite email.
- Each user sees **only their own plans**; sharing is out of scope.
- Google sign-in only.

## Offline
- Full offline (open, edit, create) after **one online sign-in per device**.
- PDFs are cached on the device; uploads wait until the tablet is back online.

## Storage and saving
- **One doc per plan**; **autosave 1 s** after each change; last write wins.
- The PDF can be **replaced** from the editor; **drawings are kept** and the contractor re-checks them against the new plan.
- The failed-open message points to **Delete** as the way out for a plan that can't be opened.

## Deferred
- Rules emulator tests (needs Java).
- Automated offline check (needs a built preview).
- Contractor profile.
- Sharing.
