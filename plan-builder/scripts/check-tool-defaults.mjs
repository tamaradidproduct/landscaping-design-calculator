// The drawing tools' defaults and what remembers them (memory store, a FRESH browser: nothing seeded in localStorage): outlines start in
// Freehand and surfaces in Rectangle; X and the bar change (and remember) the tool only while something is being drawn; undo back into a
// drawing in progress brings back that kind's tool. Also: selecting a plant opens a collapsed Plants & objects section, and the plot fill
// does not show the Snap toggle. Exits non-zero when anything fails.
// Usage: node scripts/check-tool-defaults.mjs <riesberg.pdf> [url]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 1000 } });
const results = [], check = (name, ok, got) => results.push([name, `${ok ? 'ok' : 'FAIL'} · ${got}`, ok]);
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(url); await page.waitForTimeout(3500);
await openPlan(page, pdf);
const box = await page.evaluate(() => { const b = document.getElementById('page').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
const at = (fx, fy) => [box[0] + box[2] * fx, box[1] + box[3] * fy];
const click = async f => { await page.mouse.click(...at(...f)); await page.waitForTimeout(350); };
const tool = () => page.evaluate(() => { const on = [...document.querySelectorAll('#shape [data-shape]')].find(b => b.getAttribute('aria-pressed') === 'true'); return { bar: on ? on.dataset.shape : null, hidden: document.getElementById('shape').hidden }; });
const stored = g => page.evaluate(g => localStorage.getItem(`plan-builder.shape.${g}`), g);
try {
  // Nothing drawn yet: X must not store anything
  await page.keyboard.press('x'); await page.waitForTimeout(150);
  check('X with nothing being drawn stores nothing', (await stored('outline')) === null && (await stored('surface')) === null, `outline=${await stored('outline')} surface=${await stored('surface')}`);
  // Outlines start in Freehand
  await page.click('[data-start=boundary]'); await page.waitForTimeout(200);
  check('The plot boundary starts in Freehand', (await tool()).bar === 'freehand', JSON.stringify(await tool()));
  for (const f of [[0.3, 0.3], [0.8, 0.3], [0.8, 0.8], [0.3, 0.8], [0.3, 0.3]]) await click(f);
  check('…and closes with a click on its first corner', await page.$$eval('.overlay path.shape.boundary.closed', p => p.length) === 1, 'closed');
  await page.keyboard.press('x'); await page.waitForTimeout(150);
  check('X with only a finished outline stores nothing (no stray switch to Rectangle)', (await stored('outline')) === null, `outline=${await stored('outline')}`);
  await page.click('#outlines [data-feature=House]'); await page.waitForTimeout(200);
  check('A feature (House) starts in Freehand', (await tool()).bar === 'freehand', JSON.stringify(await tool()));
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  // Undo back into the boundary in progress after a surface changed the tool
  await page.click('[data-act=add-surface]'); await page.click('#surfaces .layer-form [data-material=sand]'); await page.waitForTimeout(250);
  check('A surface starts in Rectangle', (await tool()).bar === 'rect', JSON.stringify(await tool()));
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  let resumed = false;
  for (let i = 0; i < 12 && !resumed; i++) {
    await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
    const t = await tool(); resumed = !t.hidden && (await page.$$('.overlay .corner')).length >= 3;
    if (resumed) check('Undo back into the plot boundary in progress brings back Freehand', t.bar === 'freehand', JSON.stringify(t));
  }
  if (!resumed) check('Undo back into the plot boundary in progress', false, 'never resumed');
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  await page.click('[data-start=boundary]'); for (const f of [[0.3, 0.3], [0.8, 0.3], [0.8, 0.8], [0.3, 0.8], [0.3, 0.3]]) await click(f); // a fresh boundary to carry on with
  // X while drawing a surface switches and remembers only the surface
  await page.click('[data-act=add-surface]'); await page.click('#surfaces .layer-form [data-material=sand]'); await page.waitForTimeout(250);
  await page.keyboard.press('x'); await page.waitForTimeout(200);
  check('X while drawing a surface switches it to Freehand and remembers that for surfaces only', (await tool()).bar === 'freehand' && (await stored('surface')) === 'freehand' && (await stored('outline')) === null, `bar=${(await tool()).bar} surface=${await stored('surface')} outline=${await stored('outline')}`);
  await page.keyboard.press('x'); await page.waitForTimeout(200);
  check('X again returns it to Rectangle', (await tool()).bar === 'rect' && (await stored('surface')) === 'rect', `bar=${(await tool()).bar}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  // Selecting a plant opens a collapsed section
  await page.click('[data-act=add-symbol]'); await page.fill('#symbol-search', 'boxwood'); await page.click('#symbol-results [data-symbol=boxwood]'); await click([0.6, 0.6]); await page.click('[data-act=stop-placing]'); await page.waitForTimeout(200);
  await page.click('.group-head[data-group=symbols]'); await page.waitForTimeout(200);
  const collapsed = (await page.$eval('.group-head[data-group=symbols]', b => b.getAttribute('aria-expanded'))) === 'false';
  await click([0.6, 0.6]); await page.waitForTimeout(300);
  check('Selecting a plant opens its collapsed section', collapsed && (await page.$eval('.group-head[data-group=symbols]', b => b.getAttribute('aria-expanded'))) === 'true' && !!(await page.$('#symbols [data-act=delete-symbol]')), `was collapsed ${collapsed}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  // The plot fill is not edited: no Snap toggle
  await page.click('[data-act=fill-plot]'); await page.click('#surfaces .layer-form [data-material=premium-sod]'); await page.waitForTimeout(300);
  check('With the plot fill selected the Snap toggle is hidden', await page.$eval('#snap', b => b.hidden), 'hidden');
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0], false]); }
check('No page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
if (results.some(r => !r[2])) process.exit(1);
