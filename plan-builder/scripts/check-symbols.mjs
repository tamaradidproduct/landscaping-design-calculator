// Plants and objects on Riesberg (memory store): the picker finds and arms a symbol, each tap drops one at its researched size, a
// placed symbol moves, turns and deletes (each undoable), the Plant list counts them, an eye hides a kind or the whole section,
// and placements and hidden state survive closing and reopening the plan.
// Usage: node scripts/check-symbols.mjs <riesberg.pdf> [url] [outDir]
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
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 1008]; }, [x, y]);
const drag = async (p, q) => { const a = await toScreen(p), b = await toScreen(q); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200); };
const tap = async p => { await page.mouse.click(...await toScreen(p)); await page.waitForTimeout(250); };
const images = () => page.$$eval('.overlay image.symbol[data-id]', i => i.map(x => ({ id: x.dataset.id, x: +x.getAttribute('x'), y: +x.getAttribute('y'), w: +x.getAttribute('width'), t: x.getAttribute('transform') })));
const counts = () => page.$$eval('#plant-list .plant-count', c => c.map(x => x.textContent.trim()));
const arm = async (id, query = '') => { await page.click('[data-act=add-symbol]'); if (query) { await page.fill('#symbol-search', query); await page.waitForTimeout(150); } await page.click(`#symbol-results [data-symbol=${id}]`); await page.waitForTimeout(150); };
try {
  await page.click('[data-start=boundary]'); await drag([250, 150], [550, 650]); await page.keyboard.press('Escape');
  await tap([250, 560]); await page.fill('#edge-len', '100'); await page.click('.popover button[type=submit]'); await page.keyboard.press('Escape'); // 500 pt = 100 ft
  // Picker
  await page.click('[data-act=add-symbol]'); await page.fill('#symbol-search', 'spruce'); await page.waitForTimeout(150);
  const found = await page.$$eval('#symbol-results [data-symbol]', b => b.map(x => x.textContent.trim()));
  check('Search "spruce" finds the two spruces', found.length === 2 && found.every(n => /Spruce/.test(n)), found.join(', '));
  await page.click('#symbol-results [data-symbol=blue-diamond-spruce]'); await page.waitForTimeout(150);
  check('Picking one arms placing', !!(await page.$('[data-act=stop-placing]')), 'Done button shown');
  await tap([300, 300]); await tap([420, 300]);
  const two = await images();
  check('Two taps drop two plants', two.length === 2, `${two.length} images`);
  const pxPerPt = await page.evaluate(() => document.getElementById('page').getBoundingClientRect().width / 612);
  const expected = 10 / 0.2 * pxPerPt * 1.08; // 10 ft spread ÷ 0.2 ft/pt, plus the art's shadow allowance
  check('A plant is drawn at its researched spread', Math.abs(two[0].w / expected - 1) < 0.03, `${two[0].w.toFixed(1)} px vs ${expected.toFixed(1)}`);
  await page.click('[data-act=stop-placing]'); await page.waitForTimeout(150);
  check('The Plant list counts them', (await counts()).join() === '2', (await page.$eval('#plant-list', e => e.innerText.replace(/\n+/g, ' | '))));
  // Disarming: the card's ×; and starting a surface while armed
  await arm('hot-tub'); await page.click('#symbols [data-act=collapse]'); await page.waitForTimeout(150);
  check('The × on the placing card stops placing', !(await page.$('[data-act=stop-placing]')), 'Done button gone');
  await arm('hot-tub'); await page.click('[data-act=add-surface]'); await page.click('#surfaces .layer-form [data-material=premium-sod]'); await page.waitForTimeout(150);
  await drag([300, 200], [340, 240]);
  check('Starting a surface while armed draws it, and placing stops', !(await page.$('[data-act=stop-placing]')) && (await page.$$('.overlay .shape.surface')).length > 0 && (await images()).length === 2, `${(await images()).length} symbols`);
  await page.keyboard.press('Escape');
  // Move
  const before = (await images())[0], c0 = await toScreen([300, 300]);
  await page.mouse.move(...c0); await page.mouse.down(); await page.mouse.move(c0[0] + 40, c0[1] + 25, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(250);
  const after = (await images())[0];
  check('Dragging a symbol moves it', Math.abs(after.x - before.x - 40) < 3 && Math.abs(after.y - before.y - 25) < 3, `Δ ${(after.x - before.x).toFixed(0)}, ${(after.y - before.y).toFixed(0)}`);
  check('Selecting it opens its card', !!(await page.$('#symbols [data-act=rot-up]')), 'rotate buttons shown');
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(200);
  check('⌘Z puts it back', Math.abs((await images())[0].x - before.x) < 1, `x ${(await images())[0].x.toFixed(0)}`);
  await page.keyboard.press('Escape');
  // Object: place, turn, undo
  await arm('hot-tub'); await tap([450, 500]); await page.click('[data-act=stop-placing]'); await page.waitForTimeout(150);
  const tub0 = (await images()).find(i => i.id === 'y3');
  const [tx, ty] = await toScreen([450, 500]); await page.mouse.click(tx, ty); await page.waitForTimeout(250);
  await page.click('#symbols [data-act=rot-up]'); await page.waitForTimeout(150);
  const tubR = (await images()).find(i => i.id === 'y3');
  check('Rotate + turns an object 15°', !tub0.t && /rotate\(15 /.test(tubR.t ?? ''), tubR.t);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(200);
  check('⌘Z undoes the turn', !(await images()).find(i => i.id === 'y3').t, 'no rotation');
  await page.fill('#symbol-rotation', '90'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  check('A typed angle turns it', /rotate\(90 /.test((await images()).find(i => i.id === 'y3').t ?? ''), '90°');
  // Delete one plant
  await page.keyboard.press('Escape');
  const [sx, sy] = await toScreen([420, 300]); await page.mouse.click(sx, sy); await page.waitForTimeout(250);
  await page.click('#symbols [data-act=delete-symbol]'); await page.waitForTimeout(200);
  check('Delete removes one plant', (await images()).filter(i => i.id !== 'y3').length === 1 && (await counts()).join() === '1,1', (await counts()).join());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(200);
  check('⌘Z brings it back', (await counts()).join() === '2,1', (await counts()).join());
  // Hide
  await page.click('#symbols [data-eye-symbol=blue-diamond-spruce]'); await page.waitForTimeout(200);
  const imgsHidden = await images();
  check('Hiding a kind hides its symbols but not the others', imgsHidden.length === 1 && imgsHidden[0].id === 'y3', imgsHidden.map(i => i.id).join());
  check('Hidden symbols still count in the Plant list', (await counts()).join() === '2,1', (await counts()).join());
  await page.click('[data-eye-group=symbols]'); await page.waitForTimeout(200);
  check('Hiding the section hides every symbol', (await images()).length === 0, 'none drawn');
  // Persistence
  await page.waitForTimeout(1800);
  await page.click('#back-to-plans'); await page.locator('.plan-row').first().waitFor();
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await page.locator('.plan-row .plan-open').first().click();
  await page.waitForFunction(() => { const t = document.getElementById('toast'); return !t.hidden && t.textContent.startsWith('Opened'); }, null, { timeout: 60000 });
  await page.waitForTimeout(600);
  check('After reopening: still hidden, still counted', (await images()).length === 0 && (await page.$eval('[data-eye-group=symbols]', b => b.getAttribute('aria-pressed'))) === 'false' && (await counts()).join() === '2,1', (await counts()).join());
  await page.click('[data-eye-group=symbols]'); await page.waitForTimeout(200);
  const partly = await images();
  check('Showing the section leaves the hidden kind hidden', partly.length === 1 && partly[0].id === 'y3', partly.map(i => i.id).join());
  await page.click('#symbols [data-eye-symbol=blue-diamond-spruce]'); await page.waitForTimeout(200);
  const back = await images();
  check('Showing that kind restores all three where they were', back.length === 3, back.map(i => i.id).join());
  await page.screenshot({ path: `${outDir}/symbols-end.png` });
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); }
check('No page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
