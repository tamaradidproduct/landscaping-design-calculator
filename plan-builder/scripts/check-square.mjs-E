// Square check on Riesberg: outline the boundary with the top-left corner placed a little off, bend the
// street edge, then Square from the corner chip (lines the corner up with its neighbours; only it moves) and
// Square all corners. The 16°-slanted side line and the bent street edge must be left alone; ⌘Z undoes.
// Usage: node scripts/check-square.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
// Corners from scripts/check-step2c.mjs; TL is placed 6 pt off to the right so it isn't square.
const C = { TL: [259.15, 213.24], TR: [532.62, 206.88], BR: [429.95, 565.85], P: [282.96, 545.22], BL: [253.21, 545.22] };
const ARC_MID = [357.18, 550.40];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = [];
await page.goto(url); await page.waitForTimeout(3500);
await openPlan(page, pdf);
const toScreen = ([x, y]) => page.evaluate(([x, y]) => {
  const r = document.getElementById('page').getBoundingClientRect();
  return [r.left + x * r.width / 612, r.top + y * r.height / 1008];
}, [x, y]);
await page.mouse.move(...await toScreen([390, 380]));
await page.keyboard.down('Control'); for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -12); await page.waitForTimeout(20); } await page.keyboard.up('Control');
await page.waitForTimeout(800);
await page.$eval('#snap', b => b.click()); // exact placement from the known coordinates

await page.click('[data-start=boundary]');
for (const k of ['TL', 'TR', 'BR', 'P', 'BL']) { await page.mouse.click(...await toScreen(C[k])); await page.waitForTimeout(400); }
await page.click('#outlines [data-act=close]');
// Bend the street edge (BR → P) onto the drawn curve.
await page.mouse.move(...await toScreen([(C.BR[0] + C.P[0]) / 2, (C.BR[1] + C.P[1]) / 2])); await page.mouse.down();
await page.mouse.move(...await toScreen(ARC_MID), { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(150);

const corners = () => page.$$eval('.overlay .corner', cs => cs.map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]));
const angleAt = (pts, i) => {
  const n = pts.length, c = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
  const u = [a[0] - c[0], a[1] - c[1]], v = [b[0] - c[0], b[1] - c[1]];
  return Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])) * 180 / Math.PI;
};
const chip = () => page.evaluate(() => { const c = document.querySelector('.square-chip'); return c.hidden ? '(hidden)' : c.querySelector('.text-figure').textContent; });
const moved = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(2);
const bent = () => page.$$eval('.overlay .bend-handle.bent', h => h.length);

// Top-left corner (straight edges).
await page.mouse.click(...await toScreen(C.TL)); await page.waitForTimeout(150);
const before = await corners();
results.push(['Select the off-square top-left corner', `chip: ${await chip()} · on-screen angle ${angleAt(before, 0).toFixed(2)}°`]);
await page.screenshot({ path: `${outDir}/square.png` }); // the chip beside the selected corner
await page.click('.square-chip [data-act=square]'); await page.waitForTimeout(150);
const after = await corners();
results.push(['Square it', `angle ${angleAt(after, 0).toFixed(3)}° · chip ${await chip()}`]);
results.push(['  only that corner moved', `TL ${moved(before[0], after[0])} px · TR ${moved(before[1], after[1])} · BR ${moved(before[2], after[2])} · P ${moved(before[3], after[3])} · BL ${moved(before[4], after[4])}`]);

// Bottom-right corner: its edges are the slanted side line and the curved street, neither near across or
// down, so there's nothing to line up and no chip.
await page.mouse.click(...await toScreen(C.BR)); await page.waitForTimeout(150);
results.push(['Select the bottom-right corner (slanted side, curved street)', `chip: ${await chip()} · bent edges ${await bent()}`]);

// Square all corners, after knocking the bottom-left corner off.
const bl = await toScreen(C.BL);
await page.mouse.click(...bl); await page.waitForTimeout(150);
await page.mouse.move(...bl); await page.mouse.down(); await page.mouse.move(bl[0] - 9, bl[1] + 6, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(150);
const all0 = await corners();
results.push(['Knock bottom-left off', `angle there ${angleAt(all0, 4).toFixed(2)}°`]);
await page.click('#outlines [data-act=square-all]'); await page.waitForTimeout(150);
const all1 = await corners();
results.push(['Square all corners', `bottom-left ${angleAt(all1, 4).toFixed(3)}° · top-left ${angleAt(all1, 0).toFixed(3)}° · bent edges ${await bent()}`]);
results.push(['  moved', `TL ${moved(all0[0], all1[0])} · TR ${moved(all0[1], all1[1])} · BR ${moved(all0[2], all1[2])} · P ${moved(all0[3], all1[3])} · BL ${moved(all0[4], all1[4])} px`]);
await page.keyboard.press('Meta+z'); await page.waitForTimeout(150);
results.push(['⌘Z', `bottom-left back ${moved(all0[4], (await corners())[4])} px from where it was`]);

console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
