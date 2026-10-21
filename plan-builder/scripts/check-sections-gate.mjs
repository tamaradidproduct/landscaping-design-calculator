// Lines and Plants & objects stay out of the Layers panel until the plot boundary is outlined (memory store).
// Usage: node scripts/check-sections-gate.mjs <riesberg.pdf> [url]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 1000 } });
const results = [], check = (name, ok, got) => results.push([name, `${ok ? 'ok' : 'FAIL'} · ${got}`]);
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(url); await page.waitForTimeout(3500);
await page.evaluate(() => localStorage.setItem('plan-builder.shape.outline', 'rect')); await page.reload(); await page.waitForTimeout(3500);
await openPlan(page, pdf);
const shown = g => page.$eval(`[data-group=${g}]`, b => !b.closest('.group-line').hidden);
try {
  check('Before the boundary: only Outlines shows', (await shown('outlines')) && !(await shown('surfaces')), 'Outlines visible, Surfaces hidden');
  check('Before the boundary: Lines and Plants & objects are not shown either', !(await shown('lines')) && !(await shown('symbols')), 'headers hidden');
  check('…nor their Add buttons', !(await page.$eval('[data-act=add-line]', e => e.offsetParent !== null)) && !(await page.$eval('[data-act=add-symbol]', e => e.offsetParent !== null)), 'not visible');
  await page.click('[data-start=boundary]');
  const r = await page.evaluate(() => { const b = document.getElementById('page').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
  const at = (fx, fy) => [r[0] + r[2] * fx, r[1] + r[3] * fy];
  await page.mouse.move(...at(0.3, 0.3)); await page.mouse.down(); await page.mouse.move(...at(0.8, 0.8), { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300);
  check('After the boundary is outlined: Surfaces, Lines and Plants & objects appear', (await shown('surfaces')) && (await shown('lines')) && (await shown('symbols')), 'headers visible');
  check('…with their Add buttons', await page.$eval('[data-act=add-line]', e => e.offsetParent !== null) && await page.$eval('[data-act=add-symbol]', e => e.offsetParent !== null), 'visible');
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); }
check('No page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
