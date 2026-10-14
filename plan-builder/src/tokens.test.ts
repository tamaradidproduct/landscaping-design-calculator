import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { tokensToCss } from '../scripts/tokens-css.mjs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

describe('design tokens', () => {
  test('src/styles/tokens.css is generated from design-system/tokens.json (run `npm run tokens`)', () => {
    expect(read('src/styles/tokens.css')).toBe(tokensToCss(JSON.parse(read('design-system/tokens.json'))));
  });
  test('every var(--…) the stylesheets use is a token (or the per-shape --c)', () => {
    const tokens = new Set([...read('src/styles/tokens.css').matchAll(/--([a-z0-9-]+):/g)].map(m => m[1]));
    const css = ['base', 'components', 'plan'].map(f => read(`src/styles/${f}.css`)).join('\n');
    const used = new Set([...css.matchAll(/var\(--([a-z0-9-]+)/g)].map(m => m[1]));
    expect([...used].filter(n => n !== 'c' && !tokens.has(n))).toEqual([]);
  });
  const theme = (color: unknown) => ({ color: { themes: [{ id: 'light' }, { id: 'dark' }], tokens: [color] } });
  test('dark values go in a prefers-color-scheme block; aliases become var()', () => {
    const css = tokensToCss({ color: { themes: [{ id: 'light' }, { id: 'dark' }], tokens: [
      { name: 'ink', value: { light: '#111111', dark: '#eeeeee' } }, { name: 'tip', value: '{ink}' }] } });
    expect(css).toContain('--ink: #111111;');
    expect(css).toContain('--tip: var(--ink);');
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\) \{\n {2}:root \{\n {4}--ink: #eeeeee;/);
  });
  test('rejects values that could inject CSS', () => {
    expect(() => tokensToCss(theme({ name: 'x', value: 'red; } body { display: none' }))).toThrow(/unsupported value/);
    expect(() => tokensToCss(theme({ name: 'x', value: 'url("https://example.com/a.png")' }))).toThrow(/unsupported value/);
  });
});
