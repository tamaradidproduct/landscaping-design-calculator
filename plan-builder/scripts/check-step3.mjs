// Step 3 check on Riesberg: mark the house, driveway and porch as existing features, rename one,
// delete one, and undo/redo through it all.
// Usage: node scripts/check-step3.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';

const [pdf, url = 'http://localhost:5180/', outDir = '.'] = process.argv.slice(2);
// Corners in PDF points, read off the drawn plan (approximate: this checks the flow, not precision).
const F = {
  House: [[291.3, 301.1], [376.1, 301.1], [376.1, 314.8], [432.6, 314.8], [432.6, 504.4], [377.6, 504.4], [377.6, 435.8], [278.9, 435.8], [278.9, 400.5], [291.3, 400.5]],
  Driveway: [[278.9, 435.8], [377.6, 435.8], [377.6, 498.0], [342.6, 508.4], [323.0, 545.0], [278.9, 545.0]],
  Porch: [[354.8, 400.5], [374.4, 400.5], [374.4, 420.1], [354.8, 420.1]],
};
const INSIDE = { House: [362, 360], Driveway: [300, 480], Porch: [364, 410] };

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
await page.$eval('#snap', b => b.click()); // shown only while drawing; exact placement from the known coordinates

const labels = () => page.$$eval('.overlay .label.feature', ts => ts.map(t => t.textContent).join(', ') || '(none)');
const step = async (label, fn) => { await fn(); await page.waitForTimeout(150); results.push([label, await labels()]); };
const outline = async name => {
  // Layers panel: a suggestion row or quick pick named `name`, else type it into the custom-outline form.
  if (!(await page.$(`#outlines [data-feature="${name}"]`))) await page.click('#outlines [data-act=name]');
  const pick = await page.$(`#outlines [data-feature="${name}"]`);
  if (pick) await pick.click(); else { await page.fill('#outline-name', name); await page.press('#outline-name', 'Enter'); }
  for (const p of F[name]) { await page.mouse.click(...await toScreen(p)); await page.waitForTimeout(380); }
  await page.click('#outlines [data-act=close]');
};
const tapInside = async name => { await page.mouse.click(...await toScreen(INSIDE[name])); await page.waitForTimeout(150); };

await step('Outline House (quick pick)', () => outline('House'));
await step('Outline Driveway (quick pick)', () => outline('Driveway'));
await step('Outline Porch (typed)', () => outline('Porch'));
// Drawn wholly inside the house, the porch goes straight above it in Layers (so it isn't hidden).
results.push(['Layer order (porch drawn inside the house)', await page.$$eval('#outlines [data-layer], #outlines [data-card]', e => e.map(x => x.querySelector('.layer-name, .layer-rename')?.value || x.querySelector('.layer-name')?.textContent).join(' > '))]);
// Zoom in on the porch so a tap in its middle is clear of its corners.
await page.mouse.move(...await toScreen(INSIDE.Porch));
await page.keyboard.down('Control'); for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -30); await page.waitForTimeout(20); } await page.keyboard.up('Control');
await page.waitForTimeout(500);
results.push(['Grey filled features', String(await page.$$eval('.overlay .shape.feature.closed', s => s.length))]);
await tapInside('Porch');
results.push(['Tap inside the porch (inside the house) selects', await page.inputValue('#outline-rename')]);
await step('Rename porch → Covered porch', async () => { await page.fill('#outline-rename', 'Covered porch'); await page.press('#outline-rename', 'Enter'); });
await page.screenshot({ path: `${outDir}/step3.png` });
await page.click('#fit'); await page.waitForTimeout(300);
await page.mouse.move(...await toScreen(INSIDE.Driveway));
await page.keyboard.down('Control'); for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -30); await page.waitForTimeout(20); } await page.keyboard.up('Control');
await page.waitForTimeout(300);
await tapInside('Driveway');
results.push(['Tap inside the driveway selects', await page.inputValue('#outline-rename')]);
await step('Delete driveway', () => page.click('#outlines [data-act=delete]'));
await step('⌘Z (driveway back)', () => page.keyboard.press('Meta+z'));
await step('⌘Z (rename undone)', () => page.keyboard.press('Meta+z'));
await step('⇧⌘Z (rename redone)', () => page.keyboard.press('Meta+Shift+z'));
await step('⇧⌘Z (driveway deleted again)', () => page.keyboard.press('Meta+Shift+z'));
await page.mouse.click(1100, 700); await page.waitForTimeout(150);
results.push(['Tap outside clears the selection', (await page.$('#outline-rename')) ? 'still selected' : 'cleared']);
await tapInside('House');
await step('Redo outline of the house, then Cancel (house kept)', async () => { await page.click('#outlines [data-act=redraw]'); await page.click('#outlines [data-act=cancel]'); });

console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
