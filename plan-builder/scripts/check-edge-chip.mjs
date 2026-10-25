// The edge chip: tap a plot edge -> "Set length" -> keypad -> Done sets the scale; ⋯ lists Make straight only on a curved edge;
// the chip stays inside the stage and clear of the floating Square corners button; a zone edge shows its length and resizes via the keypad.
// Usage: node scripts/check-edge-chip.mjs <plot-plan.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';
import { addVia } from './lib/add.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], check = (name, ok, got) => results.push([name, `${ok ? 'ok' : 'FAIL'} · ${got}`]);
const errors = [];
const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
page.on('pageerror', e => errors.push(e.message));
await page.goto(url); await page.waitForTimeout(3500);
await page.evaluate(() => localStorage.setItem('plan-builder.shape.outline', 'rect')); await page.reload(); await page.waitForTimeout(3500);
await openPlan(page, pdf);
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 792]; }, [x, y]);
const tap = async p => { await page.mouse.click(...await toScreen(p)); await page.waitForTimeout(400); };
const drag = async (a, b) => { await page.mouse.move(...await toScreen(a)); await page.mouse.down(); await page.mouse.move(...await toScreen(b), { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250); };
const chipText = () => page.evaluate(() => { const m = document.querySelector('.edge-chip-mount'); return m.hidden ? '(hidden)' : m.innerText.replace(/\s+/g, ' ').trim(); });
const inside = () => page.evaluate(() => {
  const m = document.querySelector('.edge-chip-mount'); if (m.hidden) return false;
  const c = m.getBoundingClientRect(), s = document.getElementById('stage').getBoundingClientRect();
  return c.left >= s.left && c.top >= s.top && c.right <= s.right && c.bottom <= s.bottom;
});
const keys = async s => { for (const k of s) await page.click(`.edge-chip .keypad-key[data-key="${k}"]`); };

await page.click('[data-start=boundary]');
await drag([250, 150], [550, 650]); await page.keyboard.press('Escape');
await tap([250, 560]);
check('plot edge, no scale: chip reads Set length', (await chipText()).startsWith('Set length'), await chipText());
check('no ⋯ on a straight edge without a reference', !(await page.$('.edge-chip [data-act=menu]')), '');
check('chip inside the stage', await inside(), '');
await page.screenshot({ path: `${outDir}/edge-chip-1.png` });
await page.click('.edge-chip [data-act=edit-length]');
check('tap opens the field and keypad', !!(await page.$('.edge-chip #edge-len')) && !!(await page.$('.edge-chip .keypad')), '');
check('chip with keypad inside the stage', await inside(), '');
await page.screenshot({ path: `${outDir}/edge-chip-2.png` });
await keys('100'); await page.click('.edge-chip .keypad-key[data-key=done]'); await page.waitForTimeout(300);
check('Done sets the scale (chip closes)', (await chipText()) === '(hidden)' && /Scale set/.test(await page.textContent('#toast')), await page.textContent('#toast'));
await tap([250, 560]);
check('chip then reads 100.00′', (await chipText()).startsWith('100.00′'), await chipText());
check('⋯ appears now the edge has a reference', !!(await page.$('.edge-chip [data-act=menu]')), '');
await page.click('.edge-chip [data-act=menu]');
const items = await page.$$eval('.edge-menu button', b => b.map(x => x.dataset.act).join());
check('menu on a straight referenced edge lists Remove this length only', items === 'unref', items);
await page.keyboard.press('Escape'); await page.waitForTimeout(200);
check('Escape closes the chip', (await chipText()) === '(hidden)', await chipText());
// Curve an edge: drag its middle square.
await tap([250, 560]);
const mid = [250, (150 + 650) / 2];
await drag(mid, [200, mid[1]]);
await tap([200, mid[1]]);
const t2 = await chipText();
await page.click('.edge-chip [data-act=menu]');
const items2 = await page.$$eval('.edge-menu button', b => b.map(x => x.dataset.act).join());
check('curved edge menu lists Make straight', items2.includes('straighten'), `${t2} · ${items2}`);
await page.screenshot({ path: `${outDir}/edge-chip-3.png` });
await page.click('.edge-menu [data-act=straighten]'); await page.waitForTimeout(200);
check('Make straight straightens the edge', !(await page.evaluate(() => !!document.querySelector('.edge-chip [data-act=menu]') && document.querySelector('.edge-chip').innerText.includes('curve'))), '');
// Near the stage bottom: the chip flips and stays inside.
await page.keyboard.press('Escape');
await tap([400, 650]);
check('bottom edge: chip inside the stage', await inside(), await chipText());
// Square corners button is not covered.
const overlap = () => page.evaluate(() => {
  const m = document.querySelector('.edge-chip-mount'), b = document.getElementById('square-corners');
  if (m.hidden || b.hidden) return 'n/a';
  const c = m.getBoundingClientRect(), r = b.getBoundingClientRect();
  return c.left < r.right && c.right > r.left && c.top < r.bottom && c.bottom > r.top;
});
await page.keyboard.press('Escape');
await tap([550, 400]);
check('right edge: chip clear of Square corners button', (await overlap()) !== true, `${await overlap()} · ${await chipText()}`);
await tap([400, 150]);
check('top edge: chip clear of Square corners button', (await overlap()) !== true, `${await overlap()} · ${await chipText()}`);
await page.keyboard.press('Escape');
// Zone edge.
await addVia(page, 'surfaces'); await page.click('#surfaces .layer-form [data-material=pavers-classic]');
await drag([300, 250], [360, 350]);
await tap([360, 300]);
const zt = await chipText();
check('zone edge shows its length', /^\d+(\.\d+)?′/.test(zt), zt);
check('no Make straight / Swap in ⋯ ... Swap fixed end offered', !!(await page.$('.edge-chip [data-act=menu]')), '');
await page.click('.edge-chip [data-act=edit-length]');
await keys('15'); await page.click('.edge-chip .keypad-key[data-key=done]'); await page.waitForTimeout(300);
await tap([360, 300]);
const after = await chipText();
check('zone edge resized by the keypad', after.startsWith('15.00′'), after);
await page.screenshot({ path: `${outDir}/edge-chip-4.png` });
console.table(results.map(([step, result]) => ({ step, result })));
if (errors.length) console.log('page errors:', errors);
await browser.close();
process.exit(results.some(r => r[1].startsWith('FAIL')) || errors.length ? 1 : 0);
