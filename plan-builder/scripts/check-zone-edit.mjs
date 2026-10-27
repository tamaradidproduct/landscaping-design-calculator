// Editing surfaces on Riesberg: Snap off by default for zones (on for outlines); hover labels; drag inside to move;
// drag a side to push it; round a corner by typing a radius or dragging its handle; Round all corners; the rename
// field reads as editable.
// Usage: node scripts/check-zone-edit.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';
import { setEdgeLength } from './lib/edge.mjs';
import { addVia } from './lib/add.mjs';
import { openAdjust } from './lib/adjust.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = [];
await page.goto(url); await page.waitForTimeout(3500);
await page.evaluate(() => { localStorage.setItem('plan-builder.shape.outline', 'rect'); localStorage.removeItem('plan-builder.sections'); });
await page.reload(); await page.waitForTimeout(3500);
await openPlan(page, pdf);
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 1008]; }, [x, y]);
const drag = async (p, q) => { const a = await toScreen(p), b = await toScreen(q); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(200); };
const tap = async p => { await page.mouse.click(...await toScreen(p)); await page.waitForTimeout(200); };
const snapLabel = () => page.textContent('#snap');
// The zone's visible shape in page points: bounding box and area (rings by winding).
const shape = id => page.evaluate(id => {
  const d = document.querySelector(`.overlay .shape.closed[data-id="${id}"]`)?.getAttribute('d'); if (!d) return null;
  const r = document.getElementById('page').getBoundingClientRect(), st = document.getElementById('stage').getBoundingClientRect();
  const kx = 612 / r.width, ky = 1008 / r.height;
  const pts = [...d.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map(m => [(+m[1] + st.left - r.left) * kx, (+m[2] + st.top - r.top) * ky]);
  let a = 0; pts.forEach((q, i) => { const n = pts[(i + 1) % pts.length]; a += q[0] * n[1] - n[0] * q[1]; });
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { x0: Math.round(Math.min(...xs)), x1: Math.round(Math.max(...xs)), y0: Math.round(Math.min(...ys)), y1: Math.round(Math.max(...ys)), area: Math.round(Math.abs(a) / 2), n: pts.length };
}, id);
const tipAt = async p => { await page.mouse.move(...await toScreen(p)); await page.waitForTimeout(150); return page.evaluate(() => { const t = document.querySelector('.tip'); return t.hidden ? '(no tip)' : t.textContent; }); };
const cursor = () => page.$eval('#stage', e => e.style.cursor || 'default');

try {
  await page.click('[data-start=boundary]');
  results.push(['Snap while tracing the boundary', await snapLabel()]);
  await drag([250, 150], [550, 650]); await page.keyboard.press('Escape');
  await tap([250, 560]); await setEdgeLength(page, '100'); // 0.2 ft/pt
  await page.keyboard.press('Escape');
  await addVia(page, 'surfaces', 'pavers-classic');
  results.push(['Snap while drawing a surface', await snapLabel()]);
  await drag([300, 250], [360, 350]); // 12′ × 20′, stays selected
  results.push(['Rename field', `wrap ${!!await page.$('#surfaces .layer-rename-wrap')} · pencil ${!!await page.$('#surfaces .layer-rename-wrap svg')} · ${await page.$eval('#surfaces .layer-rename-wrap', e => getComputedStyle(e).borderBottomStyle)} underline`]);

  // Zoom in so sides, corners and handles are well apart.
  await page.mouse.move(...await toScreen([330, 300]));
  await page.keyboard.down('Control'); for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -12); await page.waitForTimeout(20); } await page.keyboard.up('Control');
  await page.waitForTimeout(600);

  results.push(['Hover inside', `${await tipAt([330, 300])} · cursor ${await cursor()}`]);
  results.push(['Hover the right side', `${await tipAt([360, 275])} · cursor ${await cursor()}`]);
  results.push(['Hover the middle square', await tipAt([360, 300])]);
  await page.mouse.move(...await toScreen([357, 347])); await page.waitForTimeout(150);
  results.push(['Hover near the bottom-right corner (not selected)', `round handle shown ${!!await page.$('.overlay .round-handle')}`]);
  await page.mouse.move(...await toScreen([330, 300])); await page.waitForTimeout(150);
  results.push(['Pointer back in the middle', `round handle shown ${!!await page.$('.overlay .round-handle')}`]);
  results.push(['Material in the card', `material fill ${await page.$eval('#surfaces [data-card] [data-act=change-material] .swatch rect', e => e.getAttribute('fill'))} · cells shown ${await page.$$eval('#surfaces [data-card] [data-pick]', e => e.length)}`]);
  await page.click('#surfaces [data-act=change-material]');
  results.push(['Change', `cells shown ${await page.$$eval('#surfaces [data-card] [data-pick]', e => e.length)}`]);
  await page.click('#surfaces [data-card] [data-pick=red-flagstone]'); await page.waitForTimeout(150);
  results.push(['Pick Flagstone', `material fill ${await page.$eval('#surfaces [data-card] [data-act=change-material] .swatch rect', e => e.getAttribute('fill'))} · cells shown ${await page.$$eval('#surfaces [data-card] [data-pick]', e => e.length)}`]);

  const before = await shape('s1');
  await drag([330, 320], [345, 330]);
  const moved = await shape('s1');
  results.push(['Drag inside by (+15, +10) pt', `x ${before.x0}→${moved.x0} · y ${before.y0}→${moved.y0} · size ${moved.x1 - moved.x0}×${moved.y1 - moved.y0} (60×100)`]);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(150);
  results.push(['⌘Z', `x ${(await shape('s1')).x0} (300)`]);

  await drag([360, 330], [380, 335]); // right side out by 20 pt
  const pushed = await shape('s1');
  results.push(['Drag the right side out 20 pt', `x ${pushed.x0}..${pushed.x1} (300..380) · y ${pushed.y0}..${pushed.y1} (250..350) · area ${pushed.area} (8000)`]);

  // Select the top-left corner: the chip offers a radius.
  await tap([300, 250]);
  results.push(['Corner selected', `round field ${await page.$eval('.square-chip .chip-field', e => !e.hidden).catch(() => false)} · handle ${!!await page.$('.overlay .round-handle')}`]);
  await page.fill('#corner-radius', '2'); await page.press('#corner-radius', 'Enter'); await page.waitForTimeout(200);
  const r2 = await shape('s1');
  results.push(['Rounded 2′: hover on the arc', await tipAt([301.3, 251.3])]);
  results.push(['Rounded 2′: hover on the top side next to the arc', `${await tipAt([315, 250])} · cursor ${await cursor()}`]);
  await page.focus('#corner-radius');
  await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Shift+ArrowUp'); await page.waitForTimeout(150);
  const stepped = `${await page.inputValue('#corner-radius')}′ · area ${(await shape('s1')).area}`;
  await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(100);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(150);
  results.push(['↑ ↑ ⇧↑ in the radius field, then ⌘Z', `${stepped} (2 → 2.5 → 3 → 4′) · after ⌘Z area ${(await shape('s1')).area} (${r2.area}: one undo step)`]);
  results.push(['Radius 2′ (10 pt)', `area ${r2.area} (8000 − 100·(1 − π/4) ≈ 7979)`]);
  const h = await page.$eval('.overlay .round-handle', e => [+e.getAttribute('cx'), +e.getAttribute('cy')]);
  const st = await page.$eval('#stage', e => { const r = e.getBoundingClientRect(); return [r.left, r.top]; });
  await page.mouse.move(h[0] + st[0], h[1] + st[1]); await page.waitForTimeout(100);
  const handleTip = await page.evaluate(() => document.querySelector('.tip').textContent);
  await page.mouse.down(); await page.mouse.move(h[0] + st[0] + 30, h[1] + st[1] + 30, { steps: 6 });
  const dragTip = await page.evaluate(() => document.querySelector('.tip').textContent);
  await page.mouse.up(); await page.waitForTimeout(150);
  results.push(['Drag the round handle inward', `hover "${handleTip}" · while dragging "${dragTip}" · area ${(await shape('s1')).area} (< ${r2.area})`]);

  await page.keyboard.press('Escape'); await page.click('#surfaces [data-zone=s1]').catch(() => {});
  await openAdjust(page);
  await page.fill('#round-all', '1'); await page.click('.round-all button[type=submit]'); await page.waitForTimeout(200);
  results.push(['Round all corners 1′ (5 pt)', `area ${(await shape('s1')).area} (8000 − 4·25·(1 − π/4) ≈ 7979)`]);
  await page.screenshot({ path: `${outDir}/zone-edit.png` });
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); }
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
