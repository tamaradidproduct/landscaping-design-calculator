// Guides are hints only without Shift: a corner ~2° off square or near an alignment lands exactly where clicked.
// Also checks deselect. Draws in empty space beside the page so nothing on the plan can pull.
// Usage: node scripts/check-guides.mjs <plot-plan.pdf> [url]
import { chromium } from 'playwright-core';
const [pdf, url = 'http://localhost:5180/'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const results = [];
await page.goto(url); await page.waitForTimeout(3500);
await page.setInputFiles('#file', pdf);
await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('Opened'));
const corners = () => page.$$eval('.overlay circle.corner', cs => cs.map(c => [+(+c.getAttribute('cx')).toFixed(1), +(+c.getAttribute('cy')).toFixed(1)]));
const label = () => page.$$eval('.overlay .label.snap', ls => ls.map(l => l.textContent).join(' + '));
await page.click('#outline'); await page.click('[data-outline=boundary]');
// empty space left of the page (x ≈ 60–200)
await page.mouse.click(60, 200); await page.waitForTimeout(400);
await page.mouse.click(200, 200); await page.waitForTimeout(400);
await page.mouse.move(204, 320); await page.waitForTimeout(80);           // ~1.9° off square
results.push(['3rd corner ~2° off square (hover)', await label()]);
await page.mouse.click(204, 320); await page.waitForTimeout(400);
results.push(['→ placed', JSON.stringify((await corners())[2]) + ' (expect 204,320: no pull)']);
await page.mouse.move(63, 318); await page.waitForTimeout(80);             // near column of corner 1 and row of corner 3
results.push(['4th corner near column of #1 and row of #3', await label()]);
await page.mouse.click(63, 318); await page.waitForTimeout(400);
results.push(['→ placed', JSON.stringify((await corners())[3]) + ' (expect 63,318: no pull)']);
await page.click('#panel [data-act=close]'); await page.waitForTimeout(200);
// select a corner, then click empty space
await page.mouse.click(200, 200); await page.waitForTimeout(200);
results.push(['Corner selected (ring shown)', String(await page.$('.overlay .selected-corner') !== null)]);
await page.mouse.click(130, 500); await page.waitForTimeout(200);
results.push(['Click outside the shape → selection cleared', String(await page.$('.overlay .selected-corner') === null) + ', nudge pad gone: ' + String(await page.$('#panel .nudge') === null)]);
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
