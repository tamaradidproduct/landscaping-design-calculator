// Overlapping layers on Riesberg: a porch rectangle drawn after the house loses the part under the house; a tap
// there selects the house; moving the porch up flips which is cut; the plot boundary clips both; undo restores.
// Usage: node scripts/check-overlap.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';

const [pdf, url = 'http://localhost:5180/', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = [];
await page.goto(url); await page.waitForTimeout(3500);
await page.setInputFiles('#file', pdf);
await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('Opened'));
await page.$eval('#snap', b => b.click()); // exact placement
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 1008]; }, [x, y]);
// Visible area of a layer in page points², from its drawn path (rings: outer minus holes by winding).
const area = id => page.evaluate(id => {
  const d = document.querySelector(`.overlay .shape.closed[data-id="${id}"]`)?.getAttribute('d'); if (!d) return 0;
  const r = document.getElementById('page').getBoundingClientRect(), k = (612 / r.width) * (1008 / r.height);
  let total = 0;
  for (const ring of d.split('Z').filter(s => s.trim())) {
    const p = [...ring.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map(m => [+m[1], +m[2]]);
    let a = 0; p.forEach((q, i) => { const n = p[(i + 1) % p.length]; a += q[0] * n[1] - n[0] * q[1]; });
    total += a / 2;
  }
  return Math.round(Math.abs(total) * k);
}, id);
const drag = async (p, q) => { const a = await toScreen(p), b = await toScreen(q); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200); };
const selectedName = () => page.evaluate(() => document.querySelector('#outline-rename')?.value ?? '(none)');

await page.click('[data-feature=House]'); await page.click('#shape [data-shape=rect]');
await drag([300, 300], [400, 360]);                                                // 100 × 60
await page.click('#outlines [data-act=name]'); await page.click('#outlines [data-feature=Porch]');
await drag([380, 340], [440, 380]);                                                // 60 × 40, 20 × 20 under the house
results.push(['House, then a porch running into it', `house ${await area('f1')} pt² (100×60 = 6000) · porch ${await area('f2')} pt² (60×40 − 20×20 = 2000)`]);
await page.keyboard.press('Escape');
await page.mouse.click(...await toScreen([390, 350])); await page.waitForTimeout(150);
results.push(['Tap where they overlap', `selects ${await selectedName()}`]);
// Well clear of the house's corners (with the house selected, a tap within 24 px of one grabs that corner).
await page.mouse.click(...await toScreen([432, 352])); await page.waitForTimeout(150);
results.push(['Tap the porch\'s own part', `selects ${await selectedName()}`]);
await page.screenshot({ path: `${outDir}/overlap.png` });
await page.click('#outlines [data-act=up]'); await page.waitForTimeout(150);
results.push(['Porch ↑ Move up', `house ${await area('f1')} (expect 5600) · porch ${await area('f2')} (expect 2400) · order ${await page.$$eval('#outlines .layer-name, #outlines .layer-rename', e => e.map(x => x.value || x.textContent).join(' > '))}`]);
await page.keyboard.press('Meta+z'); await page.waitForTimeout(150);
results.push(['⌘Z', `house ${await area('f1')} · porch ${await area('f2')}`]);

await page.keyboard.press('Escape');
await page.click('[data-start=boundary]'); await drag([250, 250], [420, 500]);       // the lot ends at x = 420
results.push(['Plot boundary clips both', `house ${await area('f1')} (6000) · porch ${await area('f2')} (40×40 − 20×20 = 1200)`]);

console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
