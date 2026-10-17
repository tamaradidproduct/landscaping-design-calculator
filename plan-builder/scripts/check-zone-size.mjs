// Width × Depth in a surface's card on Riesberg: typed sizes resize about the center; the aspect lock scales both
// axes in proportion; a bad entry snaps back; undo restores.
// Usage: node scripts/check-zone-size.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';

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
  await drag([250, 150], [550, 650]); await page.keyboard.press('Escape');
  await tap([250, 560]); await page.fill('#edge-len', '100'); await page.click('.popover button[type=submit]'); // 0.2 ft/pt
  await page.keyboard.press('Escape');
  await page.click('[data-act=add-surface]'); await page.click('#surfaces .layer-form [data-material=pavers-classic]');
  await drag([300, 250], [360, 350]); // 12′ × 20′ (60 × 100 pt), stays selected
  const sizes = () => page.evaluate(() => [document.querySelector('#zone-width').value, document.querySelector('#zone-depth').value]);
  const box = async () => { const s = await shape('s1'); return `${s.x1 - s.x0} × ${s.y1 - s.y0} pt at (${(s.x0 + s.x1) / 2}, ${(s.y0 + s.y1) / 2})`; };
  results.push(['Card fields', `${await sizes()} · lock pressed ${await page.getAttribute('[data-act=aspect-lock]', 'aria-pressed')} · ${await box()}`]);
  await page.fill('#zone-width', '16'); await page.press('#zone-width', 'Enter'); await page.waitForTimeout(250);
  results.push(['Width 16′ (60 → 80 pt, depth unchanged, center 330, 300)', `${await sizes()} · ${await box()}`]);
  await page.fill('#zone-depth', '999x'); await page.press('#zone-depth', 'Enter'); await page.waitForTimeout(250);
  results.push(['Unreadable depth snaps back', `${await sizes()}`]);
  await page.click('[data-act=aspect-lock]'); await page.waitForTimeout(150);
  await page.fill('#zone-depth', '10'); await page.press('#zone-depth', 'Enter'); await page.waitForTimeout(250);
  results.push(['Locked, Depth 10′ (16 × 20 → 8 × 10)', `${await sizes()} · ${await box()} · lock ${await page.getAttribute('[data-act=aspect-lock]', 'aria-pressed')}`]);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  results.push(['⌘Z', `${await sizes()}`]);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  await page.click('#surfaces [data-zone]'); await page.waitForTimeout(150);
  results.push(['Reselect: lock resets', await page.getAttribute('[data-act=aspect-lock]', 'aria-pressed')]);
  await page.screenshot({ path: `${outDir}/zone-size.png` });
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); }
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
