// Turns the design system's tokens.json (the Plan Builder design-system artifact) into
// src/styles/tokens.css. Pure: no file access, so the unit test and the sync script share it.

const FAMILY_ORDER = [
  ['color', 'Colour'], ['text', 'Type scale'], ['spacing', 'Space'], ['radius', 'Radius'],
  ['shadow', 'Elevation'], ['control', 'Controls'], ['stroke', 'Plan overlay: strokes'],
  ['opacity', 'Plan overlay: opacity and tints'], ['layout', 'Layout and misc'],
];
const NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
// Values go straight into CSS, and the artifact can be edited by others: allow plain values only.
const SAFE = /^[A-Za-z0-9 #%(),./+_-]{1,200}$/;
const ALIAS = /^\{([A-Za-z0-9][A-Za-z0-9_.-]{0,63})\}$/;
const FONT_STACK = /^[A-Za-z0-9 ,"'_-]{1,200}$/;

function value(v, where) {
  const a = ALIAS.exec(v);
  if (a) return `var(--${a[1]})`;
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string' || !SAFE.test(v)) throw new Error(`${where}: unsupported value ${JSON.stringify(v)}`);
  return v;
}
/** First sentence of a usage note, without markdown, as a short CSS comment. */
function note(usage) {
  if (!usage) return '';
  let s = String(usage).replace(/`/g, '').split(/(?<=[.!?])\s/)[0].replace(/\*\//g, '* /').trim();
  if (s.length > 90) s = s.slice(0, 87).trimEnd() + '…';
  return ` /* ${s} */`;
}
/** A colour or shadow value may be one string or { [themeId]: string }; missing themes inherit the first. */
function perTheme(v, themes) {
  const out = {};
  if (typeof v === 'string' || typeof v === 'number') { for (const t of themes) out[t] = v; return out; }
  const first = v?.[themes[0]] ?? Object.values(v ?? {})[0];
  for (const t of themes) out[t] = v?.[t] ?? first;
  return out;
}

export function tokensToCss(tokens) {
  const themes = (tokens.color?.themes ?? [{ id: 'light' }]).map(t => t.id);
  const [light, ...others] = themes;
  const root = [], dark = Object.fromEntries(others.map(t => [t, []])), seen = new Set();
  const add = (name, where) => {
    if (!NAME.test(name)) throw new Error(`${where}: bad token name ${JSON.stringify(name)}`);
    if (seen.has(name)) throw new Error(`${where}: duplicate token ${name}`);
    seen.add(name);
  };

  for (const [key, title] of FAMILY_ORDER) {
    const fam = tokens[key]; if (!fam?.tokens?.length) continue;
    root.push('', `  /* ---------- ${title} ---------- */`);
    if (key === 'text') {
      for (const [k, stack] of Object.entries(tokens.type?.families ?? {})) {
        if (!FONT_STACK.test(stack)) throw new Error(`type.families.${k}: unsupported font stack`);
        add(`font-${k}`, 'type.families'); root.push(`  --font-${k}: ${stack};`);
      }
    }
    for (const t of fam.tokens) {
      const where = `${key}.${t.name}`; add(t.name, where);
      if (key === 'color' || key === 'shadow') {
        const v = perTheme(t.value, themes);
        root.push(`  --${t.name}: ${value(v[light], where)};${note(t.usage)}`);
        for (const th of others) if (v[th] !== v[light]) dark[th].push(`    --${t.name}: ${value(v[th], where)};`);
      } else root.push(`  --${t.name}: ${value(t.value, where)};${note(t.usage)}`);
    }
  }
  if (!tokens.text?.tokens?.length) for (const [k, stack] of Object.entries(tokens.type?.families ?? {})) {
    if (!FONT_STACK.test(stack)) throw new Error(`type.families.${k}: unsupported font stack`);
    add(`font-${k}`, 'type.families'); root.push(`  --font-${k}: ${stack};`);
  }

  let css = `/*
 * Design tokens — GENERATED from design-system/tokens.json by \`npm run tokens\`. Do not edit by hand:
 * change the Plan Builder design system (or design-system/tokens.json), then re-run the script.
 * Everything else in the app uses var(--…); no raw values outside this file.
 */
:root {${root.join('\n')}
}
`;
  for (const th of others) {
    if (!dark[th].length) continue;
    const media = th === 'dark' ? '@media (prefers-color-scheme: dark)' : null;
    css += media
      ? `\n${media} {\n  :root {\n${dark[th].join('\n')}\n    color-scheme: dark;\n  }\n}\n`
      : `\n[data-theme="${th}"] {\n${dark[th].join('\n')}\n}\n`;
  }
  return css;
}
