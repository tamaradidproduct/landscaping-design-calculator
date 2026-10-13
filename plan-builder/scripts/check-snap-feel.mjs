// Snap feel + Shift check on Riesberg: approach a corner with the mouse from ~25 px and watch the
// preview get pulled onto it (and stay there); hold Shift to lock edges to 45° steps.
// Usage: node scripts/check-snap-feel.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
const [pdf, url = 'http://localhost:5180/', outDir = '.'] = process.argv.slice(2);
const TL = [253.15, 213.24], TR = [532.62, 206.88];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = [];
await page.goto(url); await page.waitForTimeout(3500);
await page.setInputFiles('#file', pdf);
await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('Opened'));
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 1008]; }, [x, y]);
await page.mouse.move(...await toScreen([390, 380]));
await page.keyboard.down('Control'); for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -12); await page.waitForTimeout(20); } await page.keyboard.up('Control');
await page.waitForTimeout(900);
await page.click('#outline'); await page.click('[data-outline=boundary]');
const preview = () => page.evaluate(() => { const d = document.querySelector('.overlay .hover-dot'); const l = document.querySelector('.overlay .snap-label'); return d ? { x: +d.getAttribute('cx'), y: +d.getAttribute('cy'), label: l?.textContent ?? null } : null; });
const tl = await toScreen(TL);
for (const off of [30, 24, 18, 10, 4]) {
  await page.mouse.move(tl[0] + off, tl[1] - off * 0.6); await page.waitForTimeout(60);
  const p = await preview();
  results.push([`Pointer ${Math.hypot(off, off * 0.6).toFixed(0)} px from the TL corner`, p ? `${p.label ?? 'no snap'} · preview ${Math.hypot(p.x - tl[0], p.y - tl[1]).toFixed(1)} px from corner` : 'no preview']);
}
await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(400);
const placed = await page.$$eval('.overlay circle.corner', cs => cs.map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]));
results.push(['Click there → corner placed', `${Math.hypot(placed[0][0] - tl[0], placed[0][1] - tl[1]).toFixed(1)} px from the drawn corner`]);
// Shift: move to a spot ~10° off horizontal from the first corner
await page.keyboard.down('Shift');
await page.mouse.move(tl[0] + 200, tl[1] - 35); await page.waitForTimeout(80);
const sp = await preview();
results.push(['Shift held, pointer 10° above horizontal', sp ? `angle label ${sp.label} · preview dy ${(sp.y - placed[0][1]).toFixed(1)} px (0 = horizontal)` : 'no preview']);
await page.mouse.move(tl[0] + 150, tl[1] + 140); await page.waitForTimeout(80);
const sp2 = await preview();
results.push(['Shift held, pointer ~43° down-right', sp2 ? `angle label ${sp2.label} · |dx|-|dy| ${(Math.abs(sp2.x - placed[0][0]) - Math.abs(sp2.y - placed[0][1])).toFixed(2)} px (0 = 45°)` : 'no preview']);
await page.keyboard.up('Shift'); await page.waitForTimeout(80);
results.push(['Shift released', `label now ${(await preview())?.label ?? 'none'}`]);
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
