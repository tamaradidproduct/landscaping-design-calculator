// Saved-plans flow on Riesberg (memory store): create → outline House → back to Plans → reopen → rename → delete.
// Usage: node scripts/check-plans.mjs <riesberg.pdf> [url]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory'] = process.argv.slice(2);
const HOUSE = [[291.3, 301.1], [376.1, 301.1], [376.1, 314.8], [432.6, 314.8], [432.6, 504.4], [377.6, 504.4], [377.6, 435.8], [278.9, 435.8], [278.9, 400.5], [291.3, 400.5]];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = [];
const check = (name, ok, detail = '') => results.push([name, ok ? 'pass' : 'FAIL', detail]);
try {
await page.goto(url); await page.waitForTimeout(3500);
await openPlan(page, pdf);
const toScreen = ([x, y]) => page.evaluate(([x, y]) => {
  const r = document.getElementById('page').getBoundingClientRect();
  return [r.left + x * r.width / 612, r.top + y * r.height / 1008];
}, [x, y]);
await page.$eval('#snap', b => b.click()); // exact placement
await page.click('#outlines [data-feature="House"]');
for (const p of HOUSE) { await page.mouse.click(...await toScreen(p)); await page.waitForTimeout(380); }
await page.click('#outlines [data-act=close]');
const labels = () => page.$$eval('.overlay .label.feature', ts => ts.map(t => t.textContent).join(', '));
check('House outlined', (await labels()).includes('House'), await labels());
const bytes = await page.evaluate(() => window.__planBytes());
check('Saved document is 100..800 000 bytes', bytes > 100 && bytes < 800000, `${bytes} bytes`);
await page.waitForTimeout(1500);

await page.click('#back-to-plans');
const row = page.locator('.plan-row');
await row.first().waitFor();
const text = await row.first().innerText();
check('Row shows address and "Edited just now"', text.includes('Riesberg test') && text.includes('Edited just now'), text.replace(/\s+/g, ' '));

await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
await row.first().locator('.plan-open').click();
await page.waitForFunction(() => { const t = document.getElementById('toast'); return !t.hidden && t.textContent.startsWith('Opened'); }, null, { timeout: 60000 });
await page.waitForFunction(() => [...document.querySelectorAll('.overlay .label.feature')].some(t => t.textContent.includes('House')), null, { timeout: 10000 });
check('Reopened plan has the House label', (await labels()).includes('House'), await labels());

await page.click('#back-to-plans');
await page.locator('.plan-row [data-act=rename]').click();
await page.fill('.plan-rename', '14 Elm St');
await page.press('.plan-rename', 'Enter');
await page.waitForFunction(() => document.querySelector('.plan-address')?.textContent === '14 Elm St', null, { timeout: 5000 });
check('Renamed to 14 Elm St', true);

await page.locator('.plan-row [data-act=delete]').click();
check('Delete asks for confirmation', (await page.locator('.plan-confirm').innerText()).includes('14 Elm St'));
await page.locator('.plan-row [data-act=delete-confirm]').click();
await page.waitForSelector('.plans-empty');
const empty = await page.innerText('.plans-empty');
check('Empty state copy shown', empty === 'No plans yet. Start one for your next job.', empty);

} catch (e) {
  check('Script completed', false, String(e).split('\n')[0].slice(0, 160));
}
console.table(results.map(([check, result, detail]) => ({ check, result, detail })));
await browser.close();
if (results.some(r => r[1] !== 'pass')) process.exit(1);
