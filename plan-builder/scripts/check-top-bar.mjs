// The editor's top bar on Riesberg (memory store): above canvas and panel; Back, the gear menu (Rename), Edit | Preview (plot plan hidden,
// drawing fitted, drawing tools off), Undo/Redo from the bar and by ⌘Z / ⇧⌘Z, Export's toast, nothing left of the old header, 820 px.
// Usage: node scripts/check-top-bar.mjs <plot-plan.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], check = (name, ok, got) => results.push([name, `${ok ? 'ok' : 'FAIL'} · ${got}`]);
const errors = [];
for (const width of [1180, 820]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForTimeout(3500);
  await page.evaluate(() => localStorage.setItem('plan-builder.shape.outline', 'rect')); await page.reload(); await page.waitForTimeout(3500);
  const long = width === 820 ? 'A very long address for a job that keeps going, 12345 North Somewhere Boulevard' : 'Riesberg test';
  await openPlan(page, pdf, long);
  const tag = `${width}px: `;
  const box = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 792]; }, [x, y]);
  const bar = await box('#top-bar'), canvas = await box('#canvas'), side = await box('#sidebar');
  check(tag + 'bar is 48 px and sits above canvas and panel', Math.abs(bar.b - bar.t - 48) < 1.5 && bar.b <= canvas.t + 1 && bar.b <= side.t + 1, JSON.stringify(bar));
  check(tag + 'no old plan header, canvas top-right controls or panel toggle', await page.evaluate(() => !document.querySelector('.plan-head, .canvas-controls.top-right, #layers-view')), '');
  const right = await box('.top-bar-right');
  check(tag + 'right cluster inside the viewport, Undo Redo Export visible', right.r <= width + 0.5 && right.l > 0 && await page.isVisible('#undo') && await page.isVisible('#redo') && await page.isVisible('#export'), JSON.stringify(right));
  const sw = await box('#view-switch'), left = await box('.top-bar-left');
  check(tag + 'long name truncates without overlapping the switch', left.r <= sw.l + 0.5 && sw.r <= right.l + 0.5, `${JSON.stringify(left)} ${JSON.stringify(sw)}`);
  check(tag + 'Redo faint with nothing to redo, Undo too on a fresh plan', await page.$eval('#redo', e => e.disabled) && await page.$eval('#undo', e => e.disabled), '');

  // gear menu
  await page.click('#plan-more');
  const items = await page.$$eval('.plan-menu [role=menuitem]', b => b.map(x => x.textContent.trim()));
  check(tag + 'gear lists Rename, Archive, Delete', items.join() === 'Rename,Archive,Delete…', items.join());
  await page.click('[data-act=rename]'); await page.fill('#plan-rename', 'Renamed job'); await page.click('[data-act=rename-save]'); await page.waitForTimeout(200);
  check(tag + 'Rename works', (await page.textContent('#plan-title')) === 'Renamed job', await page.textContent('#plan-title'));

  // draw a boundary, then undo/redo
  await page.click('[data-start=boundary]');
  const a = await toScreen([250, 150]), b = await toScreen([550, 650]);
  await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const count = () => page.$$eval('#outlines .layer-row', r => r.length);
  const n1 = await count();
  check(tag + 'Undo enabled after drawing', !(await page.$eval('#undo', e => e.disabled)), `${n1} outline(s)`);
  await page.click('#undo'); await page.waitForTimeout(150); const n2 = await count();
  check(tag + 'Undo from the bar removes it, Redo becomes enabled', n2 < n1 && !(await page.$eval('#redo', e => e.disabled)), `${n1} → ${n2}`);
  await page.click('#redo'); await page.waitForTimeout(150);
  check(tag + 'Redo from the bar brings it back', (await count()) === n1, `${await count()}`);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(150); const n3 = await count();
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(150);
  check(tag + '⌘Z and ⇧⌘Z act like the bar', n3 === n2 && (await count()) === n1, `${n3} · ${await count()}`);

  // Preview
  const eyeBefore = await page.getAttribute('#plan-visible', 'aria-pressed');
  const viewBefore = await page.$eval('#page', e => e.style.transform);
  await page.click('[data-view=preview]'); await page.waitForTimeout(300);
  const pageVis = await page.$eval('#page', e => getComputedStyle(e).visibility);
  check(tag + 'Preview hides the plot plan, shows the Sheet list', pageVis === 'hidden' && await page.$eval('#layers-edit', e => e.hidden) && !(await page.$eval('#layers-sheet', e => e.hidden)), pageVis);
  const fit = await page.evaluate(() => { const s = document.getElementById('stage').getBoundingClientRect(), o = document.querySelector('.overlay')?.getBoundingClientRect(); const p = [...document.querySelectorAll('.overlay path, .overlay polygon')].map(e => e.getBoundingClientRect()).filter(r => r.width > 20); const l = Math.min(...p.map(r => r.left)) - s.left, r = s.right - Math.max(...p.map(r => r.right)), t = Math.min(...p.map(r => r.top)) - s.top, bt = s.bottom - Math.max(...p.map(r => r.bottom)); return { l, r, t, b: bt }; });
  check(tag + 'Preview fits the drawing inside the stage', fit.l >= 0 && fit.r >= 0 && fit.t >= 0 && fit.b >= 0 && Math.min(fit.l, fit.r, fit.t, fit.b) < 80, JSON.stringify(fit));
  await page.screenshot({ path: `${outDir}/top-bar-${width}-preview.png` });
  const ov = () => page.evaluate(() => document.querySelectorAll('.overlay path, .overlay polygon').length); const ov0 = await ov();
  await page.$eval('#undo', e => e.click()); await page.keyboard.press('Meta+z'); await page.waitForTimeout(150);
  check(tag + 'Undo and ⌘Z do nothing in Preview', (await ov()) === ov0 && ov0 > 0 && (await count()) === n1, `${ov0} → ${await ov()}`);
  await page.click('[data-view=edit]'); await page.waitForTimeout(300);
  check(tag + 'Edit restores the plot plan, its eye and the view', (await page.$eval('#page', e => getComputedStyle(e).visibility)) === 'visible' && (await page.getAttribute('#plan-visible', 'aria-pressed')) === eyeBefore && (await page.$eval('#page', e => e.style.transform)) === viewBefore && !(await page.$eval('#layers-edit', e => e.hidden)), eyeBefore);
  // eye hidden stays hidden through a round trip
  await page.click('#plan-visible'); await page.click('[data-view=preview]'); await page.click('[data-view=edit]'); await page.waitForTimeout(200);
  check(tag + 'a hidden plot plan stays hidden after a Preview round trip', (await page.getAttribute('#plan-visible', 'aria-pressed')) === 'false' && (await page.$eval('#page', e => getComputedStyle(e).visibility)) === 'hidden', '');
  await page.click('#plan-visible');

  // Export
  await page.click('#export'); await page.waitForTimeout(150);
  check(tag + 'Export shows the coming-soon toast', (await page.textContent('#toast')) === 'Export is coming soon', await page.textContent('#toast'));
  await page.screenshot({ path: `${outDir}/top-bar-${width}-edit.png` });

  // Back
  await page.click('#back-to-plans'); await page.locator('.plan-row').first().waitFor();
  check(tag + 'Back reaches Plans and hides the bar', await page.$eval('#top-bar', e => e.hidden), '');
  await page.close();
}
console.table(results.map(([step, result]) => ({ step, result })));
if (errors.length) console.log('page errors:', errors);
await browser.close();
process.exit(results.some(r => r[1].startsWith('FAIL')) || errors.length ? 1 : 0);
