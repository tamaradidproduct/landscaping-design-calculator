// Prints the review table of symbol sizes as Markdown: node scripts/symbol-sizes-table.mjs > ../docs/symbol-sizes.md
import { SYMBOL_SOURCES } from './symbol-sources.mjs';
import { SYMBOL_SIZES } from './symbol-sizes.mjs';

const fmt = n => (Number.isInteger(n) ? String(n) : String(n));
const rows = kind => SYMBOL_SOURCES.filter(s => s.kind === kind).map(s => {
  const z = SYMBOL_SIZES[s.id], size = kind === 'plant' ? `${fmt(z.w)} ft` : `${fmt(z.w)} × ${fmt(z.d)} ft`;
  return `| ${s.name} | ${s.family} | ${size}${z.approximate ? ' ⚠️' : ''} | ${z.note} | [source](${z.url}) |`;
});
const approx = SYMBOL_SOURCES.filter(s => SYMBOL_SIZES[s.id].approximate).length;
console.log(`# Symbol sizes (for review)

Researched ${new Date().toISOString().slice(0, 10)}. A plant's size is its typical **mature spread** (the plan symbol is a circle of that width); an object's is its **footprint** (width × depth). ⚠️ marks ${approx} approximate entries (an assumed cultivar or type, or a drawn length). Change a value in \`plan-builder/scripts/symbol-sizes.mjs\`.

## Plants (51)

| Plant | Family | Spread | Range found | Source |
|---|---|---|---|---|
${rows('plant').join('\n')}

## Objects (14)

| Object | Family | Footprint | Range found | Source |
|---|---|---|---|---|
${rows('object').join('\n')}
`);
