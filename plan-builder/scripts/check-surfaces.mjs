// Surfaces on Riesberg: the section waits for the plot boundary; zones are cut by existing features whatever the
// drawing order; typing a zone edge length resizes it (never the scale); material change and rename; layer order
// stays within Surfaces; solid when selected, see-through only while drawing; redrawing the boundary keeps the zones.
// Usage: node scripts/check-surfaces.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';
import { addVia } from './lib/add.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = [];
await page.goto(url); await page.waitForTimeout(3500);
await page.evaluate(() => localStorage.setItem('plan-builder.shape.outline', 'rect'));
await page.reload(); await page.waitForTimeout(3500);
await openPlan(page, pdf);
await page.$eval('#snap', b => b.click()); // exact placement (edge snapping is covered by hand)
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 1008]; }, [x, y]);
const drag = async (p, q) => { const a = await toScreen(p), b = await toScreen(q); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200); };
const tap = async p => { await page.mouse.click(...await toScreen(p)); await page.waitForTimeout(200); };
// A layer's visible path in page points: rings and bounding box.
const shape = id => page.evaluate(id => {
  const d = document.querySelector(`.overlay .shape.closed[data-id="${id}"]`)?.getAttribute('d'); if (!d) return null;
  const r = document.getElementById('page').getBoundingClientRect(), kx = 612 / r.width, ky = 1008 / r.height;
  const rings = d.split('Z').filter(s => s.trim()).map(ring => [...ring.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map(m => [(+m[1] - r.left + document.getElementById('stage').getBoundingClientRect().left) * kx, (+m[2] - r.top + document.getElementById('stage').getBoundingClientRect().top) * ky]));
  const xs = rings.flat().map(p => p[0]), ys = rings.flat().map(p => p[1]);
  return { rings: rings.length, x0: Math.round(Math.min(...xs)), x1: Math.round(Math.max(...xs)), y0: Math.round(Math.min(...ys)), y1: Math.round(Math.max(...ys)) };
}, id);
const zones = () => page.$$eval('#surfaces .layer-row .layer-name, #surfaces .layer-rename', e => e.map(x => x.value || x.textContent).join(' > '));
const fillOpacity = id => page.$eval(`.overlay .shape.closed[data-id="${id}"]`, e => getComputedStyle(e).fillOpacity);
const toast = () => page.textContent('#toast');

try {
results.push(['Before the plot boundary', `${await page.textContent('#surfaces')} · Add surface shown: ${!!await page.$('[data-act=add-surface]')}`.trim()]);

// Lot 250..550 × 150..650 (rect tool).
await page.click('[data-start=boundary]'); await drag([250, 150], [550, 650]);
await page.keyboard.press('Escape');
results.push(['After the plot boundary', `${(await page.textContent('#surfaces')).trim()}`]);

// Sod before any scale: tapping its edge offers no length field.
await addVia(page, 'surfaces'); await page.click('#surfaces [data-material=premium-sod]');
await drag([280, 180], [520, 400]);
results.push(['Zone closed before a scale: toast', await toast()]);
await tap([400, 400]);
results.push(['Zone edge before a scale', `field shown: ${!!await page.$('#edge-len')} · ${(await page.textContent('.popover')).replace(/\s+/g, ' ').trim().slice(0, 80)}`]);
await page.keyboard.press('Escape');

// Scale from the boundary's left edge: 500 pt = 100 ft (0.2 ft/pt).
await tap([250, 560]);
await page.fill('#edge-len', '100'); await page.click('.popover button[type=submit]');
results.push(['Scale set on the boundary', await toast()]);
await page.keyboard.press('Escape');

// House drawn after the sod still cuts it.
await page.click('#outlines [data-feature=House]'); await drag([400, 200], [500, 300]);
await page.keyboard.press('Escape');
const sod = await shape('s1');
results.push(['House (drawn later) cuts the sod', `sod rings ${sod?.rings} (2 = with a hole)`]);

// Pavers 12′ × 20′ (60 × 100 pt), inside the sod → placed above it.
await addVia(page, 'surfaces'); await page.click('#surfaces [data-material=pavers-classic]');
await drag([300, 250], [360, 350]);
results.push(['Pavers drawn inside the sod', `order ${await zones()} · sod rings now ${(await shape('s1'))?.rings}`]);
results.push(['Plan look', `boundary fill ${await page.$eval('.overlay .shape.boundary.closed', e => getComputedStyle(e).fill)} (expect none) · surface labels ${await page.$$eval('.overlay .label.surface', e => e.length)} (expect 0)`]);
results.push(['Selected zone stays solid (expect 1 · 1)', `pavers ${await fillOpacity('s2')} · sod ${await fillOpacity('s1')}`]);
await page.screenshot({ path: `${outDir}/surfaces.png` });

// With the pavers still selected, Add surface… starts a new zone (it must not re-material the pavers).
await addVia(page, 'surfaces'); await page.click('#surfaces .layer-form [data-material=wood-mulch]');
results.push(['Add surface… while a zone is selected', `${await zones()} · ${(await page.textContent('#surfaces .layer-meta').catch(() => 'no drawing card')) ?? ''}`]);
await drag([250, 150], [330, 190]); // its top edge lies on the lot line
await tap([290, 150]);
results.push(['Tap the mulch edge on the lot line', `${(await page.textContent('.popover .card-head').catch(() => '?')).trim()} · field label "${await page.textContent('.popover .text-label').catch(() => '?')}"`]);
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
// Zoom in on the patio so its edge can be tapped clear of corners and the bend handle.
await page.mouse.move(...await toScreen([330, 300]));
await page.keyboard.down('Control'); for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -12); await page.waitForTimeout(20); } await page.keyboard.up('Control');
await page.waitForTimeout(600);
await tap([320, 250]); // top edge, near the left corner → the left corner stays
results.push(['Pavers top edge', `${(await page.textContent('.popover .text-figure')).trim()} · label "${(await page.textContent('.popover .text-label'))}" · fixed mark in accent ${await page.$eval('.overlay .fixed-end', e => getComputedStyle(e).stroke === getComputedStyle(document.querySelector('button.primary') ?? document.body).backgroundColor).catch(() => 'missing')}`]);
await page.fill('#edge-len', '16'); await page.click('.popover button[type=submit]');
const p16 = await shape('s2');
results.push(['Typed 16′', `${await toast()} · x ${p16.x0}..${p16.x1} (expect 300..380) · y ${p16.y0}..${p16.y1} (expect 250..350)`]);
await page.keyboard.press('Meta+z'); await page.waitForTimeout(150);
const back = await shape('s2');
results.push(['⌘Z', `x ${back.x0}..${back.x1} (expect 300..360)`]);
await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(150);

// Material and name.
await page.click('#surfaces [data-card] [data-act=change-material]'); await page.click('#surfaces [data-card] [data-material=red-flagstone]'); await page.waitForTimeout(100);
results.push(['Pavers → Flagstone', await zones()]);
await page.fill('#surface-rename', 'Back patio'); await page.press('#surface-rename', 'Enter'); await page.waitForTimeout(100);
await page.click('#surfaces [data-card] [data-act=change-material]'); await page.click('#surfaces [data-card] [data-material=clear-mountain-granite]'); await page.waitForTimeout(100);
const mat = () => page.$eval('#surfaces [data-card] .layer-head .swatch rect', e => e.getAttribute('fill'));
results.push(['Renamed, then → Gravel', `${await zones()} · ${await mat()}`]);
await page.keyboard.press('Meta+z'); await page.waitForTimeout(150);
results.push(['⌘Z (material only)', `${await zones()} · ${await mat()}`]);

// Layer order stays within Surfaces.
const outlinesBefore = await page.$$eval('#outlines .layer-name, #outlines .layer-rename', e => e.length);
await page.click('#surfaces [data-act=down]'); await page.waitForTimeout(150);
results.push(['Back patio ↓', `${await zones()} · patio visible rings ${(await shape('s2'))?.rings ?? 0} (0 = under the sod) · outlines rows ${outlinesBefore} → ${await page.$$eval('#outlines .layer-name, #outlines .layer-rename', e => e.length)} · down disabled ${await page.$eval('#surfaces [data-act=down]', b => b.disabled)}`]);
await page.click('#surfaces [data-act=up]'); await page.waitForTimeout(150);

// Redraw the boundary: zones stay; Add surface hidden until it closes; Cancel restores.
await page.keyboard.press('Escape');
await page.click('#outlines [data-layer=boundary]'); await page.click('#outlines [data-card=boundary] [data-act=redraw]');
results.push(['Redrawing the boundary', `${await zones()} · Add surface shown: ${!!await page.$('[data-act=add-surface]')}`]);
await page.click('#outlines [data-act=cancel]'); await page.waitForTimeout(150);
results.push(['Cancel', `${await zones()} · Add surface shown: ${!!await page.$('[data-act=add-surface]')}`]);

// The boundary's left edge still reads 100′ (no zone changed the scale).
await page.click('#fit'); await page.waitForTimeout(400);
await page.mouse.move(...await toScreen([250, 600])); await page.waitForTimeout(150);
results.push(['Boundary left edge', await page.textContent('.tip')]);
await page.screenshot({ path: `${outDir}/surfaces-end.png` });

} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); }
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
