// Layering on Riesberg (memory store): plants stack automatically (trees over shrubs over perennials whatever the placing order), a tap on
// the overlap picks the tree, the Layers sections move up and down and the plan stacks in the panel's order (Plants & objects on top by
// default), and the order survives closing and reopening the plan.
// Usage: node scripts/check-layering.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 1000 }, deviceScaleFactor: 2 });
const results = [], check = (name, ok, got) => results.push([name, `${ok ? 'ok' : 'FAIL'} · ${got}`]);
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(url); await page.waitForTimeout(3500);
await page.evaluate(() => localStorage.setItem('plan-builder.shape.outline', 'rect')); await page.reload(); await page.waitForTimeout(3500);
await openPlan(page, pdf);
const pageBox = () => page.evaluate(() => { const b = document.getElementById('page').getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; });
const at = async (fx, fy) => { const r = await pageBox(); return [r[0] + r[2] * fx, r[1] + r[3] * fy]; };
const drag = async (a, b) => { await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300); };
const placeOne = async (query, id, f) => {
  await page.click('[data-act=add-symbol]'); await page.fill('#symbol-search', query); await page.waitForTimeout(150);
  await page.click(`#symbol-results [data-symbol=${id}]`); await page.waitForTimeout(150);
  await page.mouse.click(...await at(...f)); await page.waitForTimeout(300); await page.click('[data-act=stop-placing]'); await page.waitForTimeout(200);
};
const paintIds = () => page.$$eval('.overlay > *', els => els.map(e => e.tagName === 'image' ? (e.getAttribute('href').match(/\/([a-z-]+)\.webp/) ?? [])[1] : e.classList.contains('feature') && e.tagName === 'path' ? 'HOUSE' : null).filter(Boolean));
const panelOrder = () => page.$$eval('.layers .group-head', h => h.map(x => x.dataset.group));
try {
  await page.click('[data-start=boundary]'); await drag(await at(0.2, 0.2), await at(0.9, 0.9)); await page.keyboard.press('Escape');
  await page.click('[data-feature=House]'); await drag(await at(0.4, 0.4), await at(0.7, 0.7)); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // Placed perennial, tree, shrub: overlapping
  await placeOne('phlox', 'creeping-phlox', [0.5, 0.5]); await placeOne('spruce', 'blue-diamond-spruce', [0.505, 0.5]); await placeOne('boxwood', 'boxwood', [0.51, 0.5]);
  const order1 = (await paintIds()).filter(x => x !== 'HOUSE');
  check('Plants stack perennial, shrub, tree whatever the placing order (placed: perennial, tree, shrub)', order1.join() === 'creeping-phlox,boxwood,blue-diamond-spruce', order1.join(' < '));
  await page.mouse.click(...await at(0.5, 0.5)); await page.waitForTimeout(300);
  const picked = await page.$eval('#symbols [data-card] .layer-name', e => e.textContent.trim()).catch(() => '');
  check('A tap where they overlap picks the tree', /Blue Diamond Spruce/.test(picked), picked || 'no card');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  // Default order
  check('The default panel order is Plants & objects, Lines, Surfaces, Outlines (Outlines last)', (await panelOrder()).join() === 'symbols,lines,surfaces,outlines', (await panelOrder()).join());
  const all1 = await paintIds();
  check('By default the plants paint above the House shape', all1.indexOf('HOUSE') >= 0 && all1.indexOf('HOUSE') < all1.indexOf('creeping-phlox'), all1.join(' < '));
  check('The top section cannot move up; the bottom one cannot move down', await page.$eval('[data-move-group=symbols][data-dir="-1"]', b => b.disabled) && await page.$eval('[data-move-group=outlines][data-dir="1"]', b => b.disabled), 'both disabled');
  // Drawing an outline over the tree: its in-progress path is visible above the plants
  await page.click('#outlines [data-act=name]'); await page.fill('#outline-name', 'Shed'); await page.press('#outline-name', 'Enter'); await page.waitForTimeout(250);
  await page.mouse.click(...await at(0.45, 0.45)); await page.waitForTimeout(250); await page.mouse.move(...await at(0.55, 0.55)); await page.waitForTimeout(250);
  const drawOrder = await page.$$eval('.overlay > *', els => els.map(e => e.tagName === 'image' ? 'IMG' : e.tagName === 'path' && e.classList.contains('feature') && !e.classList.contains('closed') ? 'DRAWING' : null).filter(Boolean));
  check('An outline being drawn paints above the plants (rubber band visible over the tree)', drawOrder.includes('DRAWING') && drawOrder.lastIndexOf('IMG') < drawOrder.indexOf('DRAWING'), drawOrder.join(' < '));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  // Keyboard: a move button keeps focus after it is pressed
  await page.focus('[data-move-group=surfaces][data-dir="-1"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  const focused = await page.evaluate(() => document.activeElement?.dataset?.moveGroup ?? document.activeElement?.tagName);
  check('A move button keeps focus after it moves a section', focused === 'surfaces', `focus on ${focused}`);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  check('…so pressing it again moves it again', (await panelOrder()).join() === 'surfaces,symbols,lines,outlines', (await panelOrder()).join());
  await page.focus('[data-eye-group=surfaces]'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  check('An eye button keeps focus after it is pressed', await page.evaluate(() => document.activeElement?.dataset?.eyeGroup === 'surfaces'), 'focus kept');
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  await page.click('[data-move-group=surfaces][data-dir="1"]'); await page.click('[data-move-group=surfaces][data-dir="1"]'); await page.waitForTimeout(300); // back to the default order
  // Move Outlines up
  for (let i = 0; i < 3; i++) { await page.click('[data-move-group=outlines][data-dir="-1"]'); await page.waitForTimeout(200); }
  check('Moving Outlines up three times puts it first in the panel', (await panelOrder()).join() === 'outlines,symbols,lines,surfaces', (await panelOrder()).join());
  const all2 = await paintIds();
  check('…and the plan: the House now paints over the plants', all2.indexOf('HOUSE') > all2.indexOf('blue-diamond-spruce'), all2.join(' < '));
  check('The Plot plan block stays below all the sections', await page.evaluate(() => { const kids = [...document.querySelector('.layers').children]; return kids.indexOf(document.querySelector('.plan-layer')) === kids.length - 1; }), 'last in Layers');
  check('The button states follow (Outlines is now first)', await page.$eval('[data-move-group=outlines][data-dir="-1"]', b => b.disabled) && !(await page.$eval('[data-move-group=symbols][data-dir="-1"]', b => b.disabled)), 'updated');
  // Plants & objects to the bottom: the selection halo is still on top of everything
  for (let i = 0; i < 2; i++) { await page.click('[data-move-group=symbols][data-dir="1"]'); await page.waitForTimeout(150); }
  await page.mouse.click(...await at(0.5, 0.5)); await page.waitForTimeout(300);
  const topOrder = await page.$$eval('.overlay > *', els => els.map(e => e.classList.contains('symbol-halo') ? 'HALO' : e.tagName === 'image' ? 'IMG' : e.tagName === 'path' && e.classList.contains('closed') ? 'SHAPE' : null).filter(Boolean));
  check('With Plants & objects at the bottom, the selection halo is still drawn last', topOrder.includes('HALO') && topOrder.lastIndexOf('SHAPE') < topOrder.indexOf('HALO'), topOrder.join(' < '));
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  for (let i = 0; i < 2; i++) { await page.click('[data-move-group=symbols][data-dir="-1"]'); await page.waitForTimeout(150); }
  // Reopen
  await page.waitForTimeout(1800);
  await page.click('#back-to-plans'); await page.locator('.plan-row').first().waitFor();
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await page.locator('.plan-row .plan-open').first().click();
  await page.waitForFunction(() => { const t = document.getElementById('toast'); return !t.hidden && t.textContent.startsWith('Opened'); }, null, { timeout: 60000 });
  await page.waitForTimeout(600);
  check('After reopening: the order is kept', (await panelOrder()).join() === 'outlines,symbols,lines,surfaces', (await panelOrder()).join());
  const all3 = await paintIds();
  check('…and so is the stacking on the plan', all3.indexOf('HOUSE') > all3.indexOf('blue-diamond-spruce'), all3.join(' < '));
  await page.screenshot({ path: `${outDir}/layering-end.png` });
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); console.log('DEBUG outlines:', await page.$eval('#outlines', x => x.innerText.replace(/\n+/g, ' | ')).catch(() => '?')); }
check('No page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
