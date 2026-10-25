// The plot fill on Riesberg (memory store): Fill the plot… covers the lot with one surface that follows the boundary, counts its
// visible area in the Sheet view (the lot, minus whatever is drawn on it), cannot be reshaped, and undoes, deletes, hides and reopens.
// Usage: node scripts/check-plot-fill.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';
import { addVia, onSheet } from './lib/add.mjs';

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
const listText = () => onSheet(page, p => p.$eval('#layers-sheet', e => e.innerText.replace(/\n+/g, ' | ')));
const sqft = async name => { const m = new RegExp(`${name} \\| ([\\d,]+) sq ft`).exec(await listText()); return m ? Number(m[1].replace(/,/g, '')) : null; };
const lotSqft = async () => Number((await page.$eval('#outlines .layer-sub', e => e.textContent)).replace(/[^\d]/g, ''));
const fillPaths = () => page.$$eval('.overlay path[data-id=fill]', p => p.length);
// The offer lives in the global + Add menu's Surface picker (Add is locked until the scale is set).
const offerShown = async () => { const sel = await page.$eval('#surfaces [data-card]', c => c.dataset.card).catch(() => null); await addVia(page, 'surfaces'); const shown = !!(await page.$('[data-act=fill-plot]')); await page.click('#surfaces [data-act=cancel-picker]'); if (sel) await page.click(`#surfaces [data-zone=${sel}]`); return shown; };
const pickFill = async material => { await addVia(page, 'surfaces'); await page.click('[data-act=fill-plot]'); await page.click(`#surfaces .layer-form [data-material=${material}]`); await page.waitForTimeout(300); };
try {
  await page.click('[data-start=boundary]'); await drag(await at(0.3, 0.3), await at(0.8, 0.8)); await page.keyboard.press('Escape');
  check('Before the lot is scaled, Add (and so the fill offer) is locked', !(await page.$('#add-button:not([disabled])')) || !(await page.$eval('#add-button', b => b.offsetParent !== null)), 'Add hidden or disabled');
  await page.click('[data-layer=boundary]'); await page.waitForTimeout(200);
  const [ex, ey] = await at(0.3, 0.55); await page.mouse.click(ex, ey); await page.waitForTimeout(250);
  if (await page.$('#edge-len')) { await page.$eval('#edge-len', e => { e.value = '100'; }); await page.click('.popover button[type=submit]'); }
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const lot0 = await lotSqft();
  check('The boundary has an area once scaled', lot0 > 1000, `${lot0} sq ft`);
  check('Once scaled, the Surface picker offers Fill the plot…', await offerShown(), 'offer shown in Add › Surface');
  // Fill
  await pickFill('premium-sod');
  check('Fill the plot… creates one fill, drawn on the plan', (await fillPaths()) >= 1 && !!(await page.$('#surfaces [data-card=fill]')) && !(await offerShown()), `${await fillPaths()} path(s); offer gone`);
  const card = await page.$eval('#surfaces [data-card=fill]', c => c.innerText);
  check('Its card says it follows the boundary and has no size, rounding or order controls', /Follows the plot boundary/.test(card) && !(await page.$('#zone-width')) && !(await page.$('form.round-all')) && !(await page.$('#surfaces [data-act=up]')) && !(await page.$('#surfaces [data-act=redraw]')), 'material, texture, Delete only');
  check('It shows no corner handles on the plan', (await page.$$('.overlay .corner')).length === 0, `${(await page.$$('.overlay .corner')).length} handles`);
  const fill0 = await sqft('Premium sod');
  check('The Sheet counts the fill as the whole lot', fill0 !== null && Math.abs(fill0 - lot0) <= 1, `${fill0} vs lot ${lot0} sq ft`);
  // Follows the boundary
  await page.click('[data-layer=boundary]'); await page.waitForTimeout(250);
  const corner = await page.$eval('.overlay .corner', e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  const dBefore = await page.$eval('.overlay path[data-id=fill]', p => p.getAttribute('d'));
  await drag(corner, [corner[0] + 60, corner[1] + 40]); await page.keyboard.press('Escape');
  const lot1 = await lotSqft(), fill1 = await sqft('Premium sod');
  check('Dragging a boundary corner reshapes the fill, and its area follows the lot', lot1 !== lot0 && Math.abs(fill1 - lot1) <= 1 && (await page.$eval('.overlay path[data-id=fill]', p => p.getAttribute('d'))) !== dBefore, `lot ${lot0} → ${lot1}, fill ${fill1} sq ft`);
  // Something on top cuts it
  await addVia(page, 'surfaces'); await page.click('#surfaces .layer-form [data-material=deck-wood]');
  await drag(await at(0.45, 0.4), await at(0.55, 0.5)); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const deck = await sqft('Deck wood'), fill2 = await sqft('Premium sod');
  check('A zone on the fill is counted and cut out of it', deck > 0 && Math.abs((fill1 - fill2) - deck) <= 2, `deck ${deck}, fill ${fill1} → ${fill2} sq ft`);
  const order = (await page.$$eval('#surfaces .layer-name', n => n.map(x => x.textContent.trim()))).filter(n => !/^(Add surface|Fill the plot)/.test(n));
  check('The fill stays the last (lowest) row in Surfaces', order[order.length - 1] === 'Plot fill', order.join(' / '));
  // Undo / redo (drawing a zone is a few steps: undo until it is gone)
  const undoUntil = async (done, max = 8) => { for (let i = 0; i < max && !(await done()); i++) { await page.keyboard.press('Meta+z'); await page.waitForTimeout(250); } return done(); };
  const redoUntil = async (done, max = 8) => { for (let i = 0; i < max && !(await done()); i++) { await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(250); } return done(); };
  const goneDeck = await undoUntil(async () => (await sqft('Deck wood')) === null);
  check('Undo removes the zone and gives the area back', goneDeck && Math.abs((await sqft('Premium sod')) - fill1) <= 1, `fill ${await sqft('Premium sod')}`);
  const backCorner = await undoUntil(async () => (await lotSqft()) === lot0);
  check('Undo puts the boundary corner back, and the fill with it', backCorner && Math.abs((await sqft('Premium sod')) - lot0) <= 1, `fill ${await sqft('Premium sod')}, lot ${await lotSqft()}`);
  const noFill = await undoUntil(async () => (await fillPaths()) === 0);
  check('Undo removes the fill (the offer returns)', noFill && !!(await offerShown()), 'no fill; offer shown');
  const refilled = await redoUntil(async () => (await fillPaths()) >= 1);
  check('Redo brings the fill back in step with the boundary', refilled && Math.abs((await sqft('Premium sod')) - (await lotSqft())) <= 1, `fill ${await sqft('Premium sod')}, lot ${await lotSqft()}`);
  // Delete and refill
  if (!(await page.$('#surfaces [data-card=fill]'))) { await page.click('#surfaces [data-zone=fill]'); await page.waitForTimeout(200); }
  await page.click('#surfaces [data-act=delete]'); await page.waitForTimeout(300);
  check('Delete removes the fill and brings the offer back', (await fillPaths()) === 0 && !!(await offerShown()) && (await sqft('Premium sod')) === null, 'gone');
  await pickFill('white-river-rock');
  check('Filling again works with another material', (await fillPaths()) >= 1 && (await sqft('White river rock')) !== null, `${await sqft('White river rock')} sq ft`);
  // Fill into a hidden section, and after a stale hidden id: the new fill is always visible
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  await page.click('#surfaces [data-eye=fill]'); await page.waitForTimeout(200);          // hide this fill's eye (not an undo step)…
  await undoUntil(async () => (await fillPaths()) === 0 && !!(await offerShown()));   // …undo back past the fill
  await pickFill('premium-sod');
  check('A new fill is drawn even though an earlier one was hidden', (await fillPaths()) >= 1, `${await fillPaths()} path(s)`);
  await page.click('#surfaces [data-act=delete]'); await page.waitForTimeout(300);
  // (the section's eye only shows once a surface exists: draw a small zone so there is one to hide)
  await addVia(page, 'surfaces'); await page.click('#surfaces .layer-form [data-material=deck-wood]');
  await drag(await at(0.45, 0.4), await at(0.5, 0.45)); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.click('[data-eye-group=surfaces]'); await page.waitForTimeout(200);          // hide the whole Surfaces section
  await pickFill('premium-sod');
  check('Filling while the Surfaces section is hidden shows it again', (await fillPaths()) >= 1 && (await page.$eval('[data-eye-group=surfaces]', b => b.getAttribute('aria-pressed'))) === 'true', `${await fillPaths()} path(s)`);
  await page.click('#surfaces [data-zone]:not([data-zone=fill])'); await page.waitForTimeout(200);
  await page.click('#surfaces [data-act=delete]'); await page.waitForTimeout(300);          // the small zone was only there for the eye
  // A drag on the fill moves nothing
  const dNow = await page.$eval('.overlay path[data-id=fill]', p => p.getAttribute('d')), boxNow = await pageBox();
  await drag(await at(0.5, 0.6), await at(0.55, 0.65));
  const boxAfter = await pageBox(), dAfter = await page.$eval('.overlay path[data-id=fill]', p => p.getAttribute('d'));
  check('A drag on the fill moves nothing (the view pans, the fill stays on the lot)', boxNow.join() !== boxAfter.join() ? true : dNow === dAfter, `page moved ${boxNow.join() !== boxAfter.join()}, path same ${dNow === dAfter}`);
  await page.click('[data-act=fit], #fit').catch(() => {});
  // Hide, reopen
  await page.keyboard.press('Escape'); await page.click('#surfaces [data-eye=fill]'); await page.waitForTimeout(250);
  check('Hiding the fill hides it but its area still counts', (await fillPaths()) === 0 && (await sqft('Premium sod')) !== null, 'not drawn; still listed');
  await page.click('#surfaces [data-eye=fill]'); await page.waitForTimeout(250);
  await page.waitForTimeout(1800);
  await page.click('#back-to-plans'); await page.locator('.plan-row').first().waitFor();
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await page.locator('.plan-row .plan-open').first().click();
  await page.waitForFunction(() => { const t = document.getElementById('toast'); return !t.hidden && t.textContent.startsWith('Opened'); }, null, { timeout: 60000 });
  await page.waitForTimeout(600);
  check('After reopening: the fill and its area are still there', (await fillPaths()) >= 1 && Math.abs((await sqft('Premium sod')) - (await lotSqft())) <= 1, `fill ${await sqft('Premium sod')}, lot ${await lotSqft()}`);
  await page.screenshot({ path: `${outDir}/plot-fill-end.png` });
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); }
check('No page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
