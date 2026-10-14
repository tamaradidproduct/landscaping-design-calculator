# Landscaping Design Calculator

Do not push, open a PR, or enable auto-merge until the user explicitly says so.
Workflow conventions (branches, CI, staging, production gate, Airtable QA loop) come from the `dev-setup` skill; this file supplies the repo-specific values.

## Dev workflow

Read by the `dev-setup` skill. Unknown values are marked `TODO`.

- **App directory:** `plan-builder/` (run all commands there; workflows set `working-directory: plan-builder`)
- **Check commands:** `npm run lint`, `npm run typecheck`, `npm test`
- **Build output:** `plan-builder/dist/` (Vite; `VITE_BASE` sets the Pages sub-path)
- **Staging URL:** https://tamaradidproduct.github.io/landscaping-design-calculator-staging/
- **Staging repo:** `tamaradidproduct/landscaping-design-calculator-staging` (`gh-pages`), pushed with the `STAGING_PAGES_TOKEN` secret
- **Production URL:** https://tamaradidproduct.github.io/landscaping-design-calculator/
- **Production:** GitHub Pages (Actions source), `production` environment with required approval
- **Airtable base:** `appLliDgZbFLAhOMi` (Landscaping Design Calculator QA)
  - **Findings:** `tblkcKVd0AozSsxWz`; look up by issue number via `GitHub Issue # (parsed)`
  - **Test Cases:** `tblj2vRehLq1JVOnV`
  - **Test Runs:** `tblsa6DH6parJzkBR`
  - **Deployments:** `tblbkFgm1fExMEyc5`
  - **Requirements:** `tblh0hQyqs0SlpcCs`
- **Findings issue-number match:** `GitHub Issue # (text)` (text copy used by the deploy automation)
- **Airtable automations** (created off; turn on in Airtable):
  - `Record successful staging deployment` — webhook from `deploy-staging.yml` (`AIRTABLE_DEPLOY_WEBHOOK` secret); creates a Deployments record and moves Findings named in `issue_numbers` to `Ready to retest`. The workflow, not Airtable, extracts `#N` from behavior commits.
  - `Flag open Findings to GitHub` / `Flag untyped Findings to GitHub` — daily 12:30 AM MT; open `qa-flagged` issues for New / Need clarification Findings
  - `Close GitHub issue when Finding is Resolved`, `Reopen GitHub issue when Finding fails retest`
- **Not ported from Designer:** GitHub issue close/reopen → Finding sync webhook, test-case retest matching, latest-run rollups
- **Feedback intake:** none yet

## Design system

- Tokens come from the **Plan Builder** design-system artifact (https://claude.ai/artifact/JKnSFiSuXHsQ977zniZkYo). `plan-builder/design-system/tokens.json` is its copy; `npm run tokens` regenerates `plan-builder/src/styles/tokens.css` (never edit that by hand). Steps: `plan-builder/design-system/README.md`.
- After a sync, run the check commands and the Riesberg Playwright checks; when the app's tokens change in code, update the artifact too.

## Docs

- Product requirements: `docs/PRD.md`
- Decision summaries: `docs/conversations/<YYYY-MM-DD>-<slug>.md`
