// Regenerate src/styles/tokens.css from design-system/tokens.json.
// Usage: npm run tokens            (write)
//        npm run tokens -- --check (exit 1 if tokens.css is out of date)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tokensToCss } from './tokens-css.mjs';

const at = p => fileURLToPath(new URL(`../${p}`, import.meta.url));
const json = JSON.parse(readFileSync(at('design-system/tokens.json'), 'utf8'));
const css = tokensToCss(json), out = at('src/styles/tokens.css');
const current = readFileSync(out, 'utf8');
if (process.argv.includes('--check')) {
  if (current !== css) { console.error('src/styles/tokens.css is out of date: run `npm run tokens`.'); process.exit(1); }
  console.log('tokens.css is up to date.');
} else if (current === css) console.log('tokens.css already up to date.');
else { writeFileSync(out, css); console.log('Wrote src/styles/tokens.css from design-system/tokens.json.'); }
