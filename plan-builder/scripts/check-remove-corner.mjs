// Removing an outline corner (#64): a selected corner shows a trash icon beside it; tapping it removes the corner as one
// undo step; a shape keeps 3 corners.
// Usage: node scripts/check-remove-corner.mjs <riesberg.pdf> [url]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = { push: (r) => console.log(`${r[0]}: ${r[1]}`) };
await page.goto(url); await page.waitForTimeout(3500);
await openPlan(page, pdf);
await page.$eval('#snap', b => b.click());
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 1008]; }, [x, y]);
const corners = () => page.$$eval('.overlay .corner', cs => cs.length);
const closed = () => page.$$eval('.overlay .shape.closed', s => s.length);

await page.click('[data-start=boundary]');
const pts = [[253, 213], [500, 213], [500, 545], [253, 545]];
for (const p of pts) { await page.mouse.click(...await toScreen(p)); await page.waitForTimeout(600); }
await page.mouse.click(...await toScreen(pts[0])); await page.waitForTimeout(600); // first corner closes
results.push(['Closed 4-corner boundary', `closed ${await closed()} · corners ${await corners()} · trash ${await page.$$eval('.overlay .trash-handle', t => t.length)}`]);
await page.mouse.click(...await toScreen(pts[2])); await page.waitForTimeout(600);
const trash = await page.$('.overlay .trash-handle circle');
results.push(['Select a corner', trash ? 'trash icon shown' : 'NO trash icon']);
const box = await trash.boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(600);
results.push(['Tap trash', `corners ${await corners()} · trash ${await page.$$eval('.overlay .trash-handle', t => t.length)}`]);
await page.keyboard.press('Control+z'); await page.waitForTimeout(400);
results.push(['Undo', `corners ${await corners()}`]);
await browser.close();
