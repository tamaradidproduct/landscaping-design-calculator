// Step 2b check on the Riesberg plot plan: tap slightly off each property corner and see whether it
// snaps onto the drawn corner; Option/Alt and the Snap toggle place freely; arrow keys nudge.
// Usage: node scripts/check-step2b.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';

const [pdf, url = 'http://localhost:5181/', outDir = '.'] = process.argv.slice(2);
const C = { TL: [253.15, 213.24], TR: [532.62, 206.88], BL: [253.21, 545.22] }; // drawn property-line corners (PDF pt)
const OFF = [7, -5]; // tap this many screen px away from the true corner

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
await page.keyboard.down('Control');
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -12); await page.waitForTimeout(20); }
await page.keyboard.up('Control');
await page.waitForTimeout(800); // sharp layer drawn

const corners = () => page.$$eval('.overlay circle.corner', cs => cs.map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]));
const err = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(2);

await page.click('#outline'); await page.click('[data-outline=boundary]');
for (const k of ['TL', 'TR', 'BL']) {
  const t = await toScreen(C[k]);
  await page.mouse.move(t[0] + OFF[0], t[1] + OFF[1]);
  await page.mouse.down();
  await page.mouse.move(t[0] + OFF[0] + 0.5, t[1] + OFF[1], { steps: 2 });
  const label = await page.$eval('.overlay .label.snap', el => el.textContent).catch(() => '(none)');
  await page.mouse.up(); await page.waitForTimeout(150);
  const placed = (await corners()).at(-1);
  const ppt = await page.evaluate(() => document.getElementById('page').getBoundingClientRect().width / 612);
  results.push([`${k}: tapped ${Math.hypot(...OFF).toFixed(1)} px off`, `snap: ${label} · lands ${err(placed, t)} px (${(err(placed, t) / ppt * 30 / 72 * 12).toFixed(1)} in on the ground) from the drawn corner · placed at pt ${((placed[0] - t[0]) / ppt + C[k][0]).toFixed(2)},${((placed[1] - t[1]) / ppt + C[k][1]).toFixed(2)}`]);
}
await page.screenshot({ path: `${outDir}/step2b.png` });

// Option/Alt held: place freely.
await page.click('#undo');
const bl = await toScreen(C.BL);
await page.keyboard.down('Alt');
await page.mouse.move(bl[0] + OFF[0], bl[1] + OFF[1]); await page.mouse.down();
await page.mouse.move(bl[0] + OFF[0] + 0.5, bl[1] + OFF[1], { steps: 2 }); await page.mouse.up();
await page.keyboard.up('Alt'); await page.waitForTimeout(150);
results.push(['Alt held: placed freely', `lands ${err((await corners()).at(-1), [bl[0] + OFF[0] + 0.5, bl[1] + OFF[1]])} px from where the pointer was`]);

// Nudge with the arrow key.
const before = (await corners()).at(-1);
await page.keyboard.press('ArrowLeft');
const after = (await corners()).at(-1);
results.push(['Arrow key nudges 1 px', `moved ${(before[0] - after[0]).toFixed(2)} px left`]);

// Snap toggle off: place freely without a key.
await page.click('#undo');
await page.click('#snap');
await page.mouse.click(bl[0] + OFF[0], bl[1] + OFF[1]); await page.waitForTimeout(150);
results.push(['Snap off: placed freely', `lands ${err((await corners()).at(-1), [bl[0] + OFF[0], bl[1] + OFF[1]])} px from the click · button says "${await page.textContent('#snap')}"`]);

console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
