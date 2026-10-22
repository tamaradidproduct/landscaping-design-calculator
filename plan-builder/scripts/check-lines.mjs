// Lines, stepping stones and utility markers on Riesberg (memory store): the picker finds a line and starts drawing, taps add points,
// Done saves one run at its true width; a point moves, a segment bends, the width changes, a point is deleted (each undoable); an eye
// hides the Lines section (the run still counts); runs, stones and markers survive closing and reopening the plan and count in the list.
// Usage: node scripts/check-lines.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';
import { addVia, onSheet } from './lib/add.mjs';

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
const listText = () => onSheet(page, p => p.$eval('#layers-sheet', e => e.innerText.replace(/\n+/g, ' | ')));
try {
  await page.click('[data-start=boundary]'); await page.mouse.move(...await toScreen([250, 150]));
  const a = await toScreen([250, 150]), b = await toScreen([550, 650]); await drag(a, b); await page.keyboard.press('Escape');
  await tap([250, 560]); await page.$eval('#edge-len', (e, v) => { e.value = v; }, '100'); await page.click('.popover button[type=submit]'); await page.keyboard.press('Escape'); // 500 pt = 100 ft
  const k = await pxPerPt();
  // Picker
  await addVia(page, 'lines'); await page.fill('#line-search', 'fence'); await page.waitForTimeout(150);
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
  const widthValue = () => page.$eval('#line-width', i => i.value);
  check('Done stores the fence default as drawn: 0.33 ft (4 in), not a rounded step', (await widthValue()) === '0.33', `width ${await widthValue()}`);
  check('It is selected, with its card, handles and bend squares', !!(await page.$('#lines [data-act=width-up]')) && (await page.$$('.overlay .line-point')).length === 3 && (await page.$$('.overlay .line-bend')).length === 2, 'card + 3 points + 2 bends');
  // Move a point
  const p1 = await centre('.line-point[data-point="1"]'); await drag(p1, [p1[0] + 50, p1[1] + 40]);
  const p1b = await centre('.line-point[data-point="1"]');
  check('Dragging a point moves it', Math.abs(p1b[0] - p1[0] - 50) < 4 && Math.abs(p1b[1] - p1[1] - 40) < 4, `Δ ${(p1b[0] - p1[0]).toFixed(0)}, ${(p1b[1] - p1[1]).toFixed(0)}`);
  // Bend a segment
  const straightPolys = (await runs())[0].polys, m0 = await centre('.line-bend[data-bend="0"]'); await drag(m0, [m0[0], m0[1] - 40]);
  check('Dragging a bend square curves the segment (more pieces)', (await runs())[0].polys > straightPolys, `${straightPolys} → ${(await runs())[0].polys} pieces`);
  // Width
  await page.click('#lines [data-act=width-up]'); await page.waitForTimeout(200);
  check('+ widens the run to the next 0.25 ft step (0.33 → 0.5)', (await widthValue()) === '0.5', `width ${await widthValue()}`);
  await page.fill('#line-width', '2'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const t3 = await thickness();
  check('A typed width applies (2 ft, stored as typed)', (await widthValue()) === '2' && t3 > 4, `width ${await widthValue()}, tile ${t3.toFixed(1)} px`);
  await page.fill('#line-width', '4 in'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  check('A typed 4 in is 0.33 ft, not snapped to a step', (await widthValue()) === '0.33', `width ${await widthValue()}`);
  // Delete a point, undo
  const p2 = await centre('.line-point[data-point="2"]'); await page.mouse.click(...p2); await page.waitForTimeout(250);
  await page.click('#lines [data-act=delete-line-point]'); await page.waitForTimeout(250);
  check('Delete point leaves two points', (await page.$$('.overlay .line-point')).length === 2, `${(await page.$$('.overlay .line-point')).length} points`);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  check('⌘Z brings the point back', (await page.$$('.overlay .line-point')).length === 3, `${(await page.$$('.overlay .line-point')).length} points`);
  // Esc mid-draft: nothing saved
  await page.keyboard.press('Escape');
  await addVia(page, 'lines'); await page.click('#line-results [data-line-item=dry-river]'); await tap([150, 450]); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  check('Esc cancels a draft without saving', (await runs()).length === 1 && !(await page.$('[data-act=finish-line]')), `${(await runs()).length} run`);
  // ⌘Z mid-draft takes back one point and leaves the saved line alone
  await addVia(page, 'lines'); await page.click('#line-results [data-line-item=dry-river]'); await tap([150, 450]); await tap([250, 480]);
  const dots = () => page.$$eval('.overlay .corner', d => d.length);
  check('Two taps make two draft points', (await dots()) === 2, `${await dots()} dots`);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  check('⌘Z mid-draft removes the last point only (draft stays, the saved fence is untouched)', (await dots()) === 1 && !!(await page.$('[data-act=finish-line]')) && (await runs()).length === 1, `${await dots()} dot, ${(await runs()).length} run`);
  // A double-tap on the last point after a pause finishes the run (l2)
  await tap([350, 520]); await page.waitForTimeout(700);
  const [bx, by] = await toScreen([350, 520]); await page.mouse.dblclick(bx, by); await page.waitForTimeout(500);
  check('A double-tap on a point placed earlier ends the run', (await runs()).length === 2 && !(await page.$('[data-act=finish-line]')), `${(await runs()).length} runs, draft ${!!(await page.$('[data-act=finish-line]'))}`);
  // Second line l3: double-tap on a new spot adds the point and finishes
  await page.keyboard.press('Escape');
  await addVia(page, 'lines'); await page.click('#line-results [data-line-item=dry-river]'); await tap([150, 520]);
  const [dx, dy] = await toScreen([350, 560]); await page.mouse.dblclick(dx, dy); await page.waitForTimeout(500);
  check('A double-tap on a new spot adds the point and ends the run', (await runs()).length === 3 && !(await page.$('[data-act=finish-line]')), `${(await runs()).length} runs`);
  await page.keyboard.press('Escape');
  // Edging along the plot boundary's left edge: tapping it selects the line, not the outline's edge
  await addVia(page, 'lines'); await page.click('#line-results [data-line-item=white-stone-edging]'); await tap([250, 200]); await tap([250, 400]); await page.click('[data-act=finish-line]'); await page.waitForTimeout(250);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  await tap([250, 300]);
  check('Tapping edging that lies on the boundary selects the line, not the edge', (await page.$$('.overlay .line-point')).length === 2 && (await page.$$('.popover:not([hidden])')).length === 0, `${(await page.$$('.overlay .line-point')).length} points, ${(await page.$$('.popover:not([hidden])')).length} popovers`);
  await page.keyboard.press('Escape');
  // Starting a symbol while a line is selected leaves no stuck state
  await addVia(page, 'symbols'); await page.fill('#symbol-search', 'hot'); await page.click('#symbol-results [data-symbol=hot-tub]'); await page.waitForTimeout(150);
  check('Arming a symbol drops the line selection', (await page.$$('.overlay .line-point')).length === 0 && !!(await page.$('[data-act=stop-placing]')), 'no handles, Done shown');
  await page.click('[data-act=stop-placing]'); await page.waitForTimeout(150);
  // Stepping stone and utility marker: one per tap, direction on the marker, both counted
  const pickSymbol = async (query, id) => { await addVia(page, 'symbols'); await page.fill('#symbol-search', query); await page.waitForTimeout(150); await page.click(`#symbol-results [data-symbol=${id}]`); await page.waitForTimeout(150); };
  const symImgs = () => page.$$eval('.overlay image.symbol[data-id]', i => i.map(x => ({ id: x.dataset.id, src: x.getAttribute('href'), w: +x.getAttribute('width'), h: +x.getAttribute('height'), t: x.getAttribute('transform') })));
  await pickSymbol('porcelain', 'porcelain-pavers'); await tap([300, 300]); await page.click('[data-act=stop-placing]'); await page.waitForTimeout(150);
  await pickSymbol('gas', 'gas-line'); await tap([450, 300]); await page.click('[data-act=stop-placing]'); await page.waitForTimeout(150);
  const placed = await symImgs(), stone = placed.find(i => /porcelain-pavers/.test(i.src)), gas = placed.find(i => /gas-line/.test(i.src));
  check('A stepping stone and a gas marker are placed', !!stone && !!gas, `${placed.length} symbols`);
  check('The stone is 2 ft square at plan scale', !!stone && Math.abs(stone.w / stone.h - 1) < 0.02, stone ? `${stone.w.toFixed(1)} × ${stone.h.toFixed(1)} px` : 'missing');
  check('The marker is at least 20 px long', !!gas && Math.max(gas.w, gas.h) >= 19.9, gas ? `${gas.w.toFixed(1)} × ${gas.h.toFixed(1)} px` : 'missing');
  const [gx, gy] = await toScreen([450, 300]); await page.mouse.click(gx, gy); await page.waitForTimeout(250);
  check('A marker card says Direction', /Direction/.test(await page.$eval('#symbols [data-card]', c => c.innerText)), 'hint shown');
  for (let i = 0; i < 6; i++) await page.click('#symbols [data-act=rot-up]');
  await page.waitForTimeout(200);
  check('Turning a marker 90° points it along the run', /rotate\(90 /.test((await symImgs()).find(i => /gas-line/.test(i.src)).t ?? ''), '90°');
  await page.keyboard.press('Escape');
  const list = await listText();
  check('The Sheet shows lines with feet and runs', /Edges & walls \| Wood privacy fence \| \d+(\.\d)? ft · 1 run \| White stone edging \| \d+(\.\d)? ft · 1 run \| Dry river \| \d+(\.\d)? ft · 2 runs/.test(list), list.slice(0, 160));
  check('…stepping stones under Objects and the gas marker under Utility markers', /Objects \| .*Porcelain stepping stones.*1/.test(list) && /Utility markers \| .*Gas line.*1/.test(list), list.slice(-160));
  // Hide
  await page.click('#lines [data-eye-line=wood-privacy-fence]'); await page.waitForTimeout(200);
  check('Hiding a kind hides its runs only', (await runs()).length === 3 && !(await runs()).some(r => r.id === 'l1'), (await runs()).map(r => r.id).join());
  await page.click('[data-eye-group=lines]'); await page.waitForTimeout(200);
  check('Hiding the section hides every run', (await runs()).length === 0, 'none drawn');
  check('Hidden runs still count in the Sheet', /Wood privacy fence \| \d/.test(await listText()), 'still listed');
  // Persistence
  await page.waitForTimeout(1800);
  await page.click('#back-to-plans'); await page.locator('.plan-row').first().waitFor();
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await page.locator('.plan-row .plan-open').first().click();
  await page.waitForFunction(() => { const t = document.getElementById('toast'); return !t.hidden && t.textContent.startsWith('Opened'); }, null, { timeout: 60000 });
  await page.waitForTimeout(600);
  check('After reopening: still hidden', (await runs()).length === 0 && (await page.$eval('[data-eye-group=lines]', b => b.getAttribute('aria-pressed'))) === 'false', 'section hidden');
  await page.click('[data-eye-group=lines]'); await page.waitForTimeout(200);
  check('Showing the section leaves the hidden kind hidden', (await runs()).length === 3 && !(await runs()).some(r => r.id === 'l1'), (await runs()).map(r => r.id).join());
  await page.click('#lines [data-eye-line=wood-privacy-fence]'); await page.waitForTimeout(200);
  check('Showing that kind restores all four runs', (await runs()).length === 4, (await runs()).map(r => r.id).join());
  check('Stone and marker survived reopening', (await symImgs()).length === 2, `${(await symImgs()).length} symbols`);
  check('The list still shows lines and markers', /Edges & walls \|/.test(await listText()) && /Utility markers/.test(await listText()), (await listText()).slice(0, 80));
  await page.screenshot({ path: `${outDir}/lines-end.png` });
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); }
check('No page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
