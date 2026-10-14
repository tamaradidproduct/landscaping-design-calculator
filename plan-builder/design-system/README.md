# Design system tokens

`tokens.json` is a copy of the **Plan Builder** design system's tokens
(https://claude.ai/artifact/JKnSFiSuXHsQ977zniZkYo, private). It is the source of truth for
`src/styles/tokens.css`, which is generated from it — never edit `tokens.css` by hand.

## Sync the app from the design system

1. Change tokens on the design-system page (or edit `tokens.json` here directly).
2. Replace this folder's `tokens.json` with the artifact's `project/tokens.json`
   (ask Claude Code: "sync the app from the design system").
3. `npm run tokens` — regenerates `src/styles/tokens.css`.
4. `npm test` — fails if `tokens.css` is stale or a stylesheet uses a token that no longer exists.

`npm run tokens -- --check` only reports whether `tokens.css` is up to date.

## What the script accepts

- Families `color` (with `themes`; a `dark` theme becomes a `prefers-color-scheme: dark` block),
  `text`, `spacing`, `radius`, `shadow`, `control`, `stroke`, `opacity`, `layout`, plus
  `type.families` as `--font-<key>`. Type styles and `meta` are documentation only.
- Colour aliases like `"{color-ink}"` become `var(--color-ink)`.
- Values must be plain (letters, digits, `# % ( ) , . / + _ -` and spaces). Anything else —
  quotes, `;`, braces, `url("…")` — is rejected, because the design system can be edited by others.

Not covered: the plan-mark geometry in `src/overlay-tokens.ts`, and the `theme-color` meta tags in
`index.html` (literal copies of `color-bg`).
