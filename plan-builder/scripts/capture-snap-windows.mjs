// Captures the luminance windows snapping sees around real plan corners (dev server only), so they
// can be replayed in unit tests. Writes JSON with each window and the true corner inside it.
// Usage: node scripts/capture-snap-windows.mjs <riesberg.pdf> <out.json> [devUrl]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [pdf, out, url = 'http://localhost:5180/'] = process.argv.slice(2);
const C = { TL: [253.15, 213.24], TR: [532.62, 206.88], BL: [253.21, 545.22] };
const OFFSETS = [[7, -5], [-6, 6], [4, 8], [-8, -3]];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
await page.goto(url); await page.waitForTimeout(3500);
await page.setInputFiles('#file', pdf);
await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('Opened'));
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 1008]; }, [x, y]);
const windows = [];
for (const zoomSteps of [8, 14]) {
  await page.evaluate(() => document.getElementById('fit').click()); await page.waitForTimeout(400);
  await page.mouse.move(...await toScreen([390, 380]));
  await page.keyboard.down('Control'); for (let i = 0; i < zoomSteps; i++) { await page.mouse.wheel(0, -12); await page.waitForTimeout(20); } await page.keyboard.up('Control');
  await page.waitForTimeout(900);
  for (const [k, pt] of Object.entries(C)) for (const off of OFFSETS) {
    const t = await toScreen(pt), at = [t[0] + off[0], t[1] + off[1]];
    const stageR = await page.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return [r.left, r.top]; });
    const lum = await page.evaluate(([x, y]) => window.__sample(x, y, 48), [at[0] - stageR[0], at[1] - stageR[1]]);
    windows.push({ name: `${k} zoom${zoomSteps} off${off}`, corner: [t[0] - at[0] + 24, t[1] - at[1] + 24], lum: lum.map(v => Math.round(v)) });
  }
}
fs.writeFileSync(out, JSON.stringify(windows));
console.log(`wrote ${windows.length} windows`);
await browser.close();
