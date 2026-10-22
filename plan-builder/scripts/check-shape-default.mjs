// Draw defaults: outlines start Freehand, surfaces start Rectangle; each kind remembers its own choice.
// Usage: node scripts/check-shape-default.mjs <riesberg.pdf> [url]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';
import { addVia } from './lib/add.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = [];
await page.goto(url); await page.waitForTimeout(3500);
await page.evaluate(() => { localStorage.removeItem('plan-builder.shape.outline'); localStorage.removeItem('plan-builder.shape.surface'); localStorage.removeItem('plan-builder.sections'); });
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
  const pressed = () => page.$$eval('#shape [data-shape]', bs => bs.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.shape).join());
  await page.click('[data-start=boundary]');
  results.push(['Plot boundary starts as', await pressed()]);
  await page.keyboard.press('x');
  results.push(['X on the boundary', await pressed()]);
  await drag([250, 150], [550, 650]); await page.keyboard.press('Escape');
  await tap([250, 560]); await page.$eval('#edge-len', (e, v) => { e.value = v; }, '100'); await page.click('.popover button[type=submit]');
  await page.keyboard.press('Escape');
  await addVia(page, 'surfaces'); await page.click('#surfaces .layer-form [data-material=pavers-classic]');
  results.push(['First surface starts as', await pressed()]);
  await page.keyboard.press('x');
  results.push(['X on the surface', await pressed()]);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  await addVia(page, 'surfaces'); await page.click('#surfaces .layer-form [data-material=premium-sod]');
  results.push(['Next surface remembers', await pressed()]);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  await page.click('#outlines [data-layer=boundary]'); await page.click('#outlines [data-card=boundary] [data-act=redraw]');
  results.push(['Redrawing the boundary still starts as', await pressed()]);
  results.push(['Saved', await page.evaluate(() => `${localStorage.getItem('plan-builder.shape.outline')} / ${localStorage.getItem('plan-builder.shape.surface')}`)]);
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); }
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
