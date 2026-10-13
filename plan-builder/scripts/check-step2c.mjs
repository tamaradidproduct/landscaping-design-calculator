// Step 2c check on Riesberg: outline the boundary including the curved street edge, bend that edge
// onto the drawn curve, then compare the arc length and lot area with the printed values.
// Usage: node scripts/check-step2c.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';

const [pdf, url = 'http://localhost:5180/', outDir = '.'] = process.argv.slice(2);
// Property corners in PDF points, from the drawn lines (see scripts/check-step2a.mjs):
// P is where the 12.40' straight piece meets the street curve; BR is where the right line meets it.
const C = { TL: [253.15, 213.24], TR: [532.62, 206.88], BR: [429.95, 565.85], P: [282.96, 545.22], BL: [253.21, 545.22] };
const ARC_MID = [357.18, 550.40]; // on the drawn street curve, halfway between BR and P

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = [];
await page.goto(url); await page.waitForTimeout(3500);
await page.setInputFiles('#file', pdf);
await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('Opened'));
const toScreen = ([x, y]) => page.evaluate(([x, y]) => {
  const r = document.getElementById('page').getBoundingClientRect();
  return [r.left + x * r.width / 612, r.top + y * r.height / 1008];
}, [x, y]);
await page.mouse.move(...await toScreen([390, 380]));
await page.keyboard.down('Control'); for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -12); await page.waitForTimeout(20); } await page.keyboard.up('Control');
await page.waitForTimeout(800);
await page.click('#snap'); // exact placement from the known coordinates

await page.click('#outline'); await page.click('[data-outline=boundary]');
for (const k of ['TL', 'TR', 'BR', 'P', 'BL']) { await page.mouse.click(...await toScreen(C[k])); await page.waitForTimeout(400); }
await page.click('#panel [data-act=close]');
await page.mouse.click(...await toScreen([(C.TL[0] + C.TR[0]) / 2, (C.TL[1] + C.TR[1]) / 2]));
await page.fill('#edge-len', '116.45');
await page.click('.popover button[type=submit]');
const area = async () => page.$eval('#panel .area-row b', b => b.textContent);
results.push(['Area with the street edge straight', await area()]);

// Bend the street edge (BR → P) by dragging its middle handle onto the drawn curve.
const chordMid = await toScreen([(C.BR[0] + C.P[0]) / 2, (C.BR[1] + C.P[1]) / 2]);
const target = await toScreen(ARC_MID);
await page.mouse.move(...chordMid); await page.mouse.down();
await page.mouse.move(...target, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(150);
results.push(['Area with the street edge bent', await area()]);
await page.fill('#lot-size', '13504'); await page.press('#lot-size', 'Tab'); await page.waitForTimeout(100);
results.push(['vs printed lot size 13,504 sq ft', await page.$eval('#panel .area-row .ok, #panel .area-row .warn', e => e.textContent)]);

await page.mouse.move(...await toScreen([ARC_MID[0] - 30, ARC_MID[1] - 2.6])); await page.waitForTimeout(150);
results.push(['Curved edge length (printed L = 62.02′)', await page.$eval('.edge-tip', e => e.textContent)]);
await page.screenshot({ path: `${outDir}/step2c.png` });

await page.keyboard.press('Meta+z'); await page.waitForTimeout(100);
results.push(['⌘Z undoes the bend', await area()]);
await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(100);
results.push(['⇧⌘Z redoes it', await area()]);

console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
