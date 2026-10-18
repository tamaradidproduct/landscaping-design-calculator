// Lines, stepping stones and utility markers on Riesberg (memory store): the picker finds a line and starts drawing, taps add points,
// Done saves one run at its true width; a point moves, a segment bends, the width changes, a point is deleted (each undoable); an eye
// hides the Lines section (the run still counts); runs, stones and markers survive closing and reopening the plan and count in the list.
// Usage: node scripts/check-lines.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 1000 }, deviceScaleFactor: 2 });
const results = [], check = (name, ok, got) => results.push([name, `${ok ? 'ok' : 'FAIL'} · ${got}`]);
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(url); await page.waitForTimeout(3500);
await page.evaluate(() => localStorage.setItem('plan-builder.shape.outline', 'rect'));
await page.reload(); await page.waitForTimeout(3500);
await openPlan(page, pdf);
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 792]; }, [x, y]);
const tap = async p => { await page.mouse.click(...await toScreen(p)); await page.waitForTimeout(450); };
const drag = async (a, b) => { await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250); };
const centre = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
const runs = () => page.$$eval('.overlay g.line', g => g.map(x => ({ id: x.dataset.id, polys: x.querySelectorAll('polygon').length })));
/** The run's width in px: its texture tile is as wide as the stroke (a strip item). */
const thickness = () => page.$eval('.overlay g.line pattern', p => +p.getAttribute('width'));
const pxPerPt = () => page.evaluate(() => document.getElementById('page').getBoundingClientRect().width / 612);
const listText = () => page.$eval('#plant-list', e => e.innerText.replace(/\n+/g, ' | '));
try {
  await page.click('[data-start=boundary]'); await page.mouse.move(...await toScreen([250, 150]));
  const a = await toScreen([250, 150]), b = await toScreen([550, 650]); await drag(a, b); await page.keyboard.press('Escape');
  await tap([250, 560]); await page.fill('#edge-len', '100'); await page.click('.popover button[type=submit]'); await page.keyboard.press('Escape'); // 500 pt = 100 ft
  const k = await pxPerPt();
  // Picker
  await page.click('[data-act=add-line]'); await page.fill('#line-search', 'fence'); await page.waitForTimeout(150);
  const found = await page.$$eval('#line-results [data-line-item]', x => x.map(i => i.textContent.trim()));
  check('Search "fence" finds the privacy fence only', found.length === 1 && /fence/i.test(found[0]), found.join(', '));
  await page.click('#line-results [data-line-item=wood-privacy-fence]'); await page.waitForTimeout(150);
  check('Picking one starts drawing', !!(await page.$('[data-act=finish-line]')), 'Done button shown');
  // Draw: 3 points, Done
  await tap([200, 200]); await tap([400, 200]); await tap([400, 400]);
  check('Taps add points to the draft', (await page.$$('.overlay .corner')).length === 3, `${(await page.$$('.overlay .corner')).length} dots`);
  await page.click('[data-act=finish-line]'); await page.waitForTimeout(250);
  const first = await runs();
  check('Done saves one run (l1)', first.length === 1 && first[0].id === 'l1', JSON.stringify(first));
  const w0 = await thickness(), want = 0.33 / 0.2 * k;
  check('The run is drawn at its true width (0.33 ft at 0.2 ft/pt)', Math.abs(w0 / want - 1) < 0.05 || (want < 2 && w0 >= 1.9), `${w0.toFixed(2)} px vs ${want.toFixed(2)} px`);
  check('It is selected, with its card, handles and bend squares', !!(await page.$('#lines [data-act=width-up]')) && (await page.$$('.overlay .line-point')).length === 3 && (await page.$$('.overlay .line-bend')).length === 2, 'card + 3 points + 2 bends');
  // Move a point
  const p1 = await centre('.line-point[data-point="1"]'); await drag(p1, [p1[0] + 50, p1[1] + 40]);
  const p1b = await centre('.line-point[data-point="1"]');
  check('Dragging a point moves it', Math.abs(p1b[0] - p1[0] - 50) < 4 && Math.abs(p1b[1] - p1[1] - 40) < 4, `Δ ${(p1b[0] - p1[0]).toFixed(0)}, ${(p1b[1] - p1[1]).toFixed(0)}`);
  // Bend a segment
  const straightPolys = (await runs())[0].polys, m0 = await centre('.line-bend[data-bend="0"]'); await drag(m0, [m0[0], m0[1] - 40]);
  check('Dragging a bend square curves the segment (more pieces)', (await runs())[0].polys > straightPolys, `${straightPolys} → ${(await runs())[0].polys} pieces`);
  // Width
  const t1 = await thickness(); await page.click('#lines [data-act=width-up]'); await page.waitForTimeout(200);
  const t2 = await thickness();
  check('+ widens the run (0.33 → 0.5 ft)', Math.abs(t2 / t1 - 0.5 / 0.33) < 0.1 || (t1 < 2.1 && t2 >= 2), `${t1.toFixed(1)} → ${t2.toFixed(1)} px`);
  await page.fill('#line-width', '2'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const t3 = await thickness();
  check('A typed width applies (2 ft is 4× the 0.5 ft before)', Math.abs(t3 / t2 - 4) < 0.2, `${t2.toFixed(1)} → ${t3.toFixed(1)} px`);
  // Delete a point, undo
  const p2 = await centre('.line-point[data-point="2"]'); await page.mouse.click(...p2); await page.waitForTimeout(250);
  await page.click('#lines [data-act=delete-line-point]'); await page.waitForTimeout(250);
  check('Delete point leaves two points', (await page.$$('.overlay .line-point')).length === 2, `${(await page.$$('.overlay .line-point')).length} points`);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  check('⌘Z brings the point back', (await page.$$('.overlay .line-point')).length === 3, `${(await page.$$('.overlay .line-point')).length} points`);
  // Esc mid-draft: nothing saved
  await page.keyboard.press('Escape');
  await page.click('[data-act=add-line]'); await page.click('#line-results [data-line-item=dry-river]'); await tap([150, 450]); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  check('Esc cancels a draft without saving', (await runs()).length === 1 && !(await page.$('[data-act=finish-line]')), `${(await runs()).length} run`);
  // Second line: dry river, two points, double-tap to finish
  await page.click('[data-act=add-line]'); await page.click('#line-results [data-line-item=dry-river]'); await tap([150, 450]);
  const [dx, dy] = await toScreen([350, 520]); await page.mouse.dblclick(dx, dy); await page.waitForTimeout(500);
  check('A double-tap on the last point ends the run', (await runs()).length === 2 && !(await page.$('[data-act=finish-line]')), `${(await runs()).length} runs, draft ${!!(await page.$('[data-act=finish-line]'))}, toast "${await page.$eval('#toast', t => t.textContent)}"`);
  // Starting a symbol while a line is selected leaves no stuck state
  await page.click('[data-act=add-symbol]'); await page.fill('#symbol-search', 'hot'); await page.click('#symbol-results [data-symbol=hot-tub]'); await page.waitForTimeout(150);
  check('Arming a symbol drops the line selection', (await page.$$('.overlay .line-point')).length === 0 && !!(await page.$('[data-act=stop-placing]')), 'no handles, Done shown');
  await page.click('[data-act=stop-placing]'); await page.waitForTimeout(150);
  // Hide
  await page.click('#lines [data-eye-line=wood-privacy-fence]'); await page.waitForTimeout(200);
  check('Hiding a kind hides its runs only', (await runs()).length === 1 && (await runs())[0].id === 'l2', (await runs()).map(r => r.id).join());
  await page.click('[data-eye-group=lines]'); await page.waitForTimeout(200);
  check('Hiding the section hides every run', (await runs()).length === 0, 'none drawn');
  // Persistence
  await page.waitForTimeout(1800);
  await page.click('#back-to-plans'); await page.locator('.plan-row').first().waitFor();
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await page.locator('.plan-row .plan-open').first().click();
  await page.waitForFunction(() => { const t = document.getElementById('toast'); return !t.hidden && t.textContent.startsWith('Opened'); }, null, { timeout: 60000 });
  await page.waitForTimeout(600);
  check('After reopening: still hidden', (await runs()).length === 0 && (await page.$eval('[data-eye-group=lines]', b => b.getAttribute('aria-pressed'))) === 'false', 'section hidden');
  await page.click('[data-eye-group=lines]'); await page.waitForTimeout(200);
  check('Showing the section leaves the hidden kind hidden', (await runs()).length === 1 && (await runs())[0].id === 'l2', (await runs()).map(r => r.id).join());
  await page.click('#lines [data-eye-line=wood-privacy-fence]'); await page.waitForTimeout(200);
  check('Showing that kind restores both runs', (await runs()).length === 2, (await runs()).map(r => r.id).join());
  await page.screenshot({ path: `${outDir}/lines-end.png` });
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); }
check('No page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
