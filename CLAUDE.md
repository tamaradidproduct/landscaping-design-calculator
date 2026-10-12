# Landscaping Design Calculator

Do not push, open a PR, or enable auto-merge until the user explicitly says so.
Workflow conventions (branches, CI, staging, production gate, Airtable QA loop) come from the `dev-setup` skill; this file supplies the repo-specific values.

## Dev workflow

Read by the `dev-setup` skill. Unknown values are marked `TODO`.

- **Check commands:** `npm run lint`, `npm run typecheck`, `npm test`
- **Build output:** `dist/` (Vite; `VITE_BASE` sets the Pages sub-path)
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
- **Deploy webhook:** `AIRTABLE_DEPLOY_WEBHOOK` secret — TODO (Airtable automation not created yet; the staging step skips until set)
- **`qa-flagged` issue automation:** TODO (not created yet)
- **Feedback intake:** none yet

## Docs

- Product requirements: `docs/PRD.md`
- Decision summaries: `docs/conversations/<YYYY-MM-DD>-<slug>.md`
