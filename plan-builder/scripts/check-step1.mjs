// Checks Step 1's "done when" list against a built preview, in installed Google Chrome (headless).
// Usage: node scripts/check-step1.mjs <path-to-plot-plan.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';
import fs from 'node:fs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
if (!pdf || !fs.existsSync(pdf)) { console.error('Pass the path to a plot plan PDF.'); process.exit(1); }

const browser = await chromium.launch({ channel: 'chrome', headless: true });
// iPad Air-ish: 820x1180 CSS px, 2x pixels, touch.
const context = await browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true });
const page = await context.newPage();
const results = [];

async function openPdf() {
  const t0 = Date.now();
  await openPlan(page, pdf);
  return { wall: (Date.now() - t0) / 1000, toast: await page.textContent('#toast') };
}

let engineReady = false;
page.on('console', m => { if (m.text().startsWith('[open]')) { console.log('  ', m.text()); if (m.text().includes('engine ready')) engineReady = true; } });
await page.goto(url);
await page.waitForSelector('#new-plan');
// A contractor takes a few seconds to find the file; give the engine that long to warm up.
await page.waitForTimeout(3000);
for (let i = 0; i < 100 && !engineReady; i++) await page.waitForTimeout(100);
results.push(['Engine warm before open', String(engineReady)]);
const first = await openPdf();
results.push(['Opens fast (cold)', `${first.wall.toFixed(2)} s wall · app says "${first.toast}"`]);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/step1-fit.png` });

// Zoom toward the right-hand property line label (~"155.55'") with trackpad pinch (ctrl+wheel), then let the sharp pass finish.
const box = await page.locator('#page').boundingBox();
const target = { x: box.x + box.width * 0.79, y: box.y + box.height * 0.37 };
await page.mouse.move(target.x, target.y);
await page.keyboard.down('Control');
for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -12); await page.waitForTimeout(16); }
await page.keyboard.up('Control');
await page.waitForTimeout(1500);
const zoom = await page.evaluate(() => document.getElementById('page').style.transform);
const sharpShown = await page.evaluate(() => !document.getElementById('sharp').hidden);
await page.screenshot({ path: `${outDir}/step1-zoomed.png` });
// Two-finger trackpad drag (plain wheel) must pan, not zoom.
const before = await page.evaluate(() => document.getElementById('page').style.transform);
await page.mouse.wheel(0, 200); await page.waitForTimeout(100);
const after = await page.evaluate(() => document.getElementById('page').style.transform);
const sc = t => t.match(/scale\(([\d.]+)\)/)[1];
results.push(['Two-finger drag pans', `zoom ${sc(before)} -> ${sc(after)} (same = pan) · ${before === after ? 'did not move' : 'moved'}`]);
results.push(['Sharp when zoomed', `transform ${zoom} · sharp layer shown: ${sharpShown}`]);

// Offline: service worker must be controlling, then reload with the network off and open the PDF again.
const swReady = await Promise.race([page.evaluate(() => navigator.serviceWorker.ready.then(() => true)), new Promise(r => setTimeout(() => r(false), 5000))]);
if (!swReady) results.push(['Works offline', "SKIP offline section: needs a built preview (service worker isn't registered on the dev server)"]);
else {
await page.reload(); await page.waitForSelector('#new-plan');
const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
await context.setOffline(true);
await page.reload();
const offlineLoaded = await page.waitForSelector('#new-plan', { timeout: 5000 }).then(() => true).catch(() => false);
let offlineOpen = 'not tried';
if (offlineLoaded) { const o = await openPdf().catch(e => ({ wall: NaN, toast: String(e).slice(0, 80) })); offlineOpen = `${o.wall.toFixed(2)} s · "${o.toast}"`; }
results.push(['Works offline', `SW controlling: ${controlled} · app loads offline: ${offlineLoaded} · opens PDF offline: ${offlineOpen}`]);
}

console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
