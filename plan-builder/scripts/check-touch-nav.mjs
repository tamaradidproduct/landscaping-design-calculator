// Touch navigation check (simulated iPad multi-touch via Chrome DevTools): while outlining,
// one finger places, two fingers pan/zoom without placing, press-and-hold places freely.
// Usage: node scripts/check-touch-nav.mjs <plot-plan.pdf> [url]
import { chromium } from 'playwright-core';
const [pdf, url = 'http://localhost:5180/'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: false });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const results = [];
await page.goto(url); await page.waitForTimeout(3500);
await page.setInputFiles('#file', pdf);
await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('Opened'));
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
const wait = ms => page.waitForTimeout(ms);
const corners = () => page.$$eval('.overlay circle.corner', cs => cs.length);
const view = () => page.evaluate(() => document.getElementById('page').style.transform);
await page.click('#outline'); await page.click('[data-outline=boundary]');

// 1) one-finger tap places a corner
await touch('touchStart', [[300, 400]]); await wait(60); await touch('touchEnd', []); await wait(400);
results.push(['One-finger tap', `${await corners()} corner(s)`]);

// 2) two-finger pan: first finger lands slightly before the second
const v0 = await view();
await touch('touchStart', [[500, 400]]); await wait(40);
await touch('touchStart', [[500, 400], [600, 400]]); await wait(30);
for (let i = 1; i <= 8; i++) { await touch('touchMove', [[500 + i * 10, 400 + i * 6], [600 + i * 10, 400 + i * 6]]); await wait(16); }
await touch('touchEnd', [[580, 448]]); await wait(30); await touch('touchEnd', []); await wait(300);
results.push(['Two-finger drag', `${await corners()} corner(s) (should still be 1) · view moved: ${v0 !== await view()}`]);

// 3) two-finger pinch zoom
const s0 = await view();
await touch('touchStart', [[450, 400]]); await wait(30);
await touch('touchStart', [[450, 400], [550, 400]]); await wait(30);
for (let i = 1; i <= 8; i++) { await touch('touchMove', [[450 - i * 8, 400], [550 + i * 8, 400]]); await wait(16); }
await touch('touchEnd', []); await wait(300);
const sc = t => +t.match(/scale\(([\d.]+)\)/)[1];
results.push(['Pinch out', `${await corners()} corner(s) · zoom ${sc(s0).toFixed(2)} → ${sc(await view()).toFixed(2)}`]);

// 4) press and hold, then drag: places freely, shows "Free"
await touch('touchStart', [[250, 260]]); await wait(600);
await touch('touchMove', [[254, 262]]); await wait(50);
const label = await page.$$eval('.overlay .label.snap', ls => ls.map(l => l.textContent).join(' + '));
await touch('touchEnd', []); await wait(300);
results.push(['Press-and-hold then move', `label "${label}" · ${await corners()} corner(s)`]);

console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
