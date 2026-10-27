// Stretch correction on the Riesberg plot plan. The real plan is true to scale, so typing its printed top and
// left lengths must leave it unstretched; typing a left length 10% too long must stretch it 10% down the page
// (as a plan printed 10% short vertically would need), and removing that length (edge chip) must undo it.
// Usage: node scripts/check-stretch.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';
import { setEdgeLength } from './lib/edge.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
// Same corners as check-step2a (PDF points on the 612 x 1008 page).
const C = { TL: [253.15, 213.24], TR: [532.62, 206.88], BL: [253.21, 545.22] };
const u = [-23.27, 81.36], ul = Math.hypot(...u), runPt = 155.55 / (30 / 72);
C.BR = [C.TR[0] + u[0] / ul * runPt, C.TR[1] + u[1] / ul * runPt];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = [];
await page.goto(url);
await page.waitForTimeout(3500); // engine warm-up
await openPlan(page, pdf);
await page.$eval('#snap', b => b.click()); // exact placement from the known coordinates

const toScreen = async ([x, y]) => page.evaluate(([x, y]) => {
  const r = document.getElementById('page').getBoundingClientRect();
  return [r.left + x * r.width / 612, r.top + y * r.height / 1008];
}, [x, y]);
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
// A third of the way along an edge: clear of the bend handle at its middle (hovering that shows "Drag to curve the side").
const along = (a, b, t = 1 / 3) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const aspect = () => page.evaluate(() => { const r = document.getElementById('page').getBoundingClientRect(); return (r.height / r.width) / (1008 / 612); });
const scaleText = () => page.textContent('#toast'); // the toast after typing a length names the scale
async function typeLength(a, b, feet) {
  await page.mouse.click(...await toScreen(mid(a, b))); await page.waitForTimeout(150);
  await setEdgeLength(page, feet); await page.waitForTimeout(600);
}
async function hoverLength(a, b) {
  await page.mouse.move(...await toScreen(along(a, b))); await page.waitForTimeout(150);
  return page.evaluate(() => document.querySelector('.tip').textContent);
}

await page.click('[data-start=boundary]');
for (const k of ['TL', 'TR', 'BR', 'BL']) { await page.mouse.click(...await toScreen(C[k])); await page.waitForTimeout(150); }
await page.click('#outlines [data-act=close]');

await typeLength(C.TL, C.TR, '116.45');
results.push(['Top edge typed (116.45′): one scale', `${await scaleText()} · page stretch ×${(await aspect()).toFixed(4)}`]);
await typeLength(C.TL, C.BL, '138.31');
results.push(['Left edge typed (138.31′): true-scale plan stays unstretched', `${await scaleText()} · page stretch ×${(await aspect()).toFixed(4)}`]);
results.push(['  left edge reads', await hoverLength(C.TL, C.BL)]);
results.push(['  right edge (printed 155.55′)', await hoverLength(C.TR, C.BR)]);

await typeLength(C.TL, C.BL, String((138.31 * 1.1).toFixed(2)));
results.push(['Left edge retyped 10% long (152.14′): plan stretches down', `${await scaleText()} · page stretch ×${(await aspect()).toFixed(4)} (expect ~1.10)`]);
results.push(['  left edge reads', await hoverLength(C.TL, C.BL)]);
results.push(['  top edge still', await hoverLength(C.TL, C.TR)]);
results.push(['  right edge (mostly vertical: ~10% longer)', await hoverLength(C.TR, C.BR)]);
await page.screenshot({ path: `${outDir}/stretch.png` });

await page.keyboard.press('Meta+z'); await page.waitForTimeout(600);
results.push(['⌘Z: back to the true lengths', `page stretch ×${(await aspect()).toFixed(4)}`]);
await page.mouse.click(...await toScreen(mid(C.TL, C.BL))); await page.waitForTimeout(150);
await page.click('.edge-chip [data-act=menu]'); await page.click('.edge-menu [data-act=unref]'); await page.waitForTimeout(600);
results.push(['Remove the left length (edge chip): one scale again', `page stretch ×${(await aspect()).toFixed(4)} · left edge ${await hoverLength(C.TL, C.BL)}`]);
results.push(['Plot area on the boundary row', await page.textContent('#outlines [data-layer=boundary] .layer-sub, #outlines [data-card=boundary] .layer-sub')]);

console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
