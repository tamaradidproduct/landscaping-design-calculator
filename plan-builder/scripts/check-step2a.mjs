// Step 2a check on the Riesberg plot plan: outline the boundary, set the scale from the top edge,
// then read the other edges. Corner positions come from the PDF's own drawn property lines.
// Usage: node scripts/check-step2a.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';

const [pdf, url = 'http://localhost:5180/', outDir = '.'] = process.argv.slice(2);
// PDF points (page 612 x 1008). TL/TR/BL: intersections/ends of the drawn property lines.
// BR: along the drawn right line, 155.55 ft from TR at the printed 1" = 30' (0.41667 ft/pt).
const C = { TL: [253.15, 213.24], TR: [532.62, 206.88], BL: [253.21, 545.22] };
const u = [-23.27, 81.36], ul = Math.hypot(...u), runPt = 155.55 / (30 / 72);
C.BR = [C.TR[0] + u[0] / ul * runPt, C.TR[1] + u[1] / ul * runPt];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = [];
await page.goto(url);
await page.waitForTimeout(3500); // engine warm-up
await page.setInputFiles('#file', pdf);
await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('Opened'));

const toScreen = async ([x, y]) => page.evaluate(([x, y]) => {
  const r = document.getElementById('page').getBoundingClientRect();
  return [r.left + x * r.width / 612, r.top + y * r.height / 1008];
}, [x, y]);
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

// Zoom so the lot fills the screen (ctrl+wheel = pinch) around the lot's middle.
const center = await toScreen(mid(C.TL, C.BR));
await page.mouse.move(...center);
await page.keyboard.down('Control');
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -12); await page.waitForTimeout(20); }
await page.keyboard.up('Control');
await page.waitForTimeout(600);

await page.click('#outline'); await page.click('[data-outline=boundary]');
for (const k of ['TL', 'TR', 'BR', 'BL']) { const s = await toScreen(C[k]); await page.mouse.click(...s); await page.waitForTimeout(150); }
await page.click('#panel [data-act=close]');
results.push(['Closes with the Close button', String(await page.evaluate(() => document.querySelector('.overlay .shape.closed') !== null))]);

// Set the scale on the top edge.
await page.mouse.click(...await toScreen(mid(C.TL, C.TR)));
await page.fill('#edge-len', '116.45');
await page.click('.popover button[type=submit]');
results.push(['Scale', await page.evaluate(() => document.querySelector('#panel .text-body b')?.textContent ?? '(none)')]);

async function hoverLength(a, b) {
  await page.mouse.move(...await toScreen(mid(a, b))); await page.waitForTimeout(100);
  return page.evaluate(() => document.querySelector('.tip').textContent);
}
const pct = (txt, printed) => `${txt} (printed ${printed}′, ${(((parseFloat(txt) - printed) / printed) * 100).toFixed(2)}%)`;
results.push(['Left edge (independent check)', pct(await hoverLength(C.TL, C.BL), 138.31)]);
results.push(['Right edge', pct(await hoverLength(C.TR, C.BR), 155.55)]);
await page.screenshot({ path: `${outDir}/step2a.png` });

// A corner can be dragged freely.
const bl = await toScreen(C.BL);
await page.mouse.move(...bl); await page.mouse.down(); await page.mouse.move(bl[0] + 40, bl[1] + 25, { steps: 5 });
const magnifierShown = await page.evaluate(() => !document.querySelector('.magnifier').hidden);
await page.mouse.up();
results.push(['Drag corner: magnifier shown while dragging', String(magnifierShown)]);
results.push(['Left edge after moving the corner', await hoverLength(C.TL, [C.BL[0] + 40 / 2, C.BL[1]])]);

// Redo, then close with a double-click instead of the button.
await page.click('[data-redo=boundary]');
for (const k of ['TL', 'TR', 'BR']) { await page.mouse.click(...await toScreen(C[k])); await page.waitForTimeout(400); }
await page.mouse.dblclick(...await toScreen(C.BL));
results.push(['Redo + close with double-click (4 corners)', await page.evaluate(() => {
  const d = document.querySelector('.overlay .shape.closed')?.getAttribute('d') ?? '';
  return d ? `${(d.match(/[ML]/g) || []).length} corners` : 'not closed';
})]);

console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
