// The slimmer cards on Riesberg: outline card (header + action row only, icon Redraw, trash on features), the three ways a card closes,
// the collapsed surface card and its Corner radius field, the edge chip (Set length -> keypad -> Done, ⋯ menu, "No scale"),
// drag-to-reorder of Outlines and Surfaces (grip drag, Escape, Alt+arrows, one ⌘Z), the touch-only canvas nudge pad with the floating
// Square corners button, and the plant card (no rotation) against the object card (Rotate row).
// Usage: node scripts/check-slim-cards.mjs <plot-plan.pdf> [base-url] [outDir]
//   base-url defaults to $BASE_URL or http://localhost:5180 (`/?store=memory` is added unless the URL already has a query); outDir to $OUT_DIR or ./
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';
import { addVia } from './lib/add.mjs';
import { setEdgeLength } from './lib/edge.mjs';

const [pdf, baseArg, outArg] = process.argv.slice(2);
const base = baseArg ?? process.env.BASE_URL ?? 'http://localhost:5180';
const url = base.includes('?') ? base : `${base.replace(/\/$/, '')}/?store=memory`;
const outDir = outArg ?? process.env.OUT_DIR ?? '.';
const onlyPart = process.env.PART; // 'main' | 'nudge' to run one part

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const errors = [];
const check = (name, ok, got = '') => { results.push([name, `${ok ? 'ok' : 'FAIL'} · ${got}`]); console.log(ok ? 'ok  ' : 'FAIL', name, got ? `· ${got}` : ''); };

/** A fresh page with a closed plot boundary on Riesberg (rect tool). coarse = a touch screen (matchMedia pointer: coarse matches). */
async function start({ width = 1180, coarse = false, touch = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, ...(coarse || touch ? { hasTouch: true } : {}) });
  if (coarse) await context.addInitScript(() => {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = q => /pointer:\s*coarse/.test(q)
      ? { matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }
      : mm(q);
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForTimeout(3500);
  await page.evaluate(() => localStorage.setItem('plan-builder.shape.outline', 'rect')); await page.reload(); await page.waitForTimeout(3500);
  await openPlan(page, pdf);
  const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 792]; }, [x, y]);
  const tap = async p => { await page.mouse.click(...await toScreen(p)); await page.waitForTimeout(400); };
  const drag = async (a, b) => { const [ax, ay] = await toScreen(a), [bx, by] = await toScreen(b); await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250); };
  const dragRect = async (a, b) => { await drag(a, b); await page.keyboard.press('Escape'); await page.waitForTimeout(150); };
  return { context, page, toScreen, tap, drag, dragRect };
}

if (onlyPart !== 'nudge') {
  const { context, page, toScreen, tap, drag, dragRect } = await start({ touch: true });
  const chipText = () => page.evaluate(() => { const m = document.querySelector('.edge-chip-mount'); return m.hidden ? '(hidden)' : m.innerText.replace(/\s+/g, ' ').trim(); });
  const insideStage = () => page.evaluate(() => {
    const m = document.querySelector('.edge-chip-mount'); if (m.hidden) return false;
    const c = m.getBoundingClientRect(), s = document.getElementById('stage').getBoundingClientRect();
    return c.left >= s.left && c.top >= s.top && c.right <= s.right && c.bottom <= s.bottom;
  });
  const keys = async s => { for (const k of s) await page.click(`.edge-chip .keypad-key[data-key="${k}"]`); };
  const hiddenNow = sel => page.$eval(sel, e => e.hidden || getComputedStyle(e).display === 'none');

  // ---- Edge chip (plot boundary) ----
  await page.click('[data-start=boundary]'); await dragRect([250, 150], [550, 650]);
  await tap([250, 560]);
  check('edge chip: no scale yet, reads Set length', (await chipText()).startsWith('Set length'), await chipText());
  check('edge chip: no ⋯ on a straight edge without a reference', !(await page.$('.edge-chip [data-act=menu]')), '');
  check('edge chip: .popover is gone', !(await page.$('.popover')), '');
  check('edge chip: inside the stage', await insideStage(), '');
  await page.screenshot({ path: `${outDir}/slim-chip-1.png` });
  await page.click('.edge-chip [data-act=edit-length]');
  check('edge chip: tapping the length opens field and keypad', !!(await page.$('.edge-chip #edge-len')) && !!(await page.$('.edge-chip .keypad')), '');
  check('edge chip: no button[type=submit] (Done is a keypad key)', !(await page.$('.edge-chip button[type=submit]')) && !!(await page.$('.edge-chip .keypad-key[data-key=done]')), '');
  check('edge chip: open keypad stays inside the stage', await insideStage(), '');
  await page.screenshot({ path: `${outDir}/slim-chip-2.png` });
  await keys('100'); await page.click('.edge-chip .keypad-key[data-key=done]'); await page.waitForTimeout(300);
  check('edge chip: Done sets the scale and closes', (await chipText()) === '(hidden)' && /Scale set/.test(await page.textContent('#toast')), await page.textContent('#toast'));
  await tap([250, 560]);
  check('edge chip: then reads 100.00′', (await chipText()).startsWith('100.00′'), await chipText());
  check('edge chip: ⋯ appears once the edge has a reference', !!(await page.$('.edge-chip [data-act=menu]')), '');
  await page.click('.edge-chip [data-act=menu]');
  const items = await page.$$eval('.edge-menu button', b => b.map(x => x.dataset.act).join());
  check('edge chip: ⋯ lists Make straight only on a curved edge (straight: Remove this length only)', items === 'unref', items);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  check('edge chip: Escape closes it', (await chipText()) === '(hidden)', await chipText());
  const mid = [250, 400];
  await tap([250, 560]); await drag(mid, [200, mid[1]]); await tap([200, mid[1]]);
  await page.click('.edge-chip [data-act=menu]');
  const items2 = await page.$$eval('.edge-menu button', b => b.map(x => x.dataset.act).join());
  check('edge chip: curved edge lists Make straight', items2.includes('straighten'), `${await chipText()} · ${items2}`);
  await page.screenshot({ path: `${outDir}/slim-chip-3.png` });
  await page.click('.edge-menu [data-act=straighten]'); await page.waitForTimeout(250);
  await page.click('.edge-chip [data-act=menu]');
  check('edge chip: Make straight straightens it (item gone)', !(await page.$$eval('.edge-menu button', b => b.some(x => x.dataset.act === 'straighten'))), '');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await tap([400, 650]);
  check('edge chip: bottom edge stays inside the stage', await insideStage(), await chipText());
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');

  // ---- Outline card ----
  const names = ['House', 'Driveway', 'Pool'];
  for (const [i, n] of names.entries()) {
    if (i === 0) await page.click('#outlines button.suggest[data-feature]');
    else { await page.click('#outlines [data-act=name]'); await page.fill('#outline-name', n); await page.click('#outlines form button[type=submit]'); }
    await dragRect([270, 170 + i * 60], [330, 210 + i * 60]);
  }
  const rowOf = n => page.locator(`#outlines .layer-item:has(.layer-name:text-is("${n}"))`);
  const selectRow = async n => { await page.locator(`#outlines [data-layer]:has(.layer-name:text-is("${n}"))`).click(); await page.waitForTimeout(250); };
  const cardIn = sel => page.$(`${sel} [data-card]`);
  await selectRow('Driveway');
  const body = await page.$$eval('#outlines [data-card] .layer-body > *', e => e.map(x => x.className));
  const headActs = await page.$$eval('#outlines [data-card] .layer-head .layer-head-actions > button', e => e.map(x => x.getAttribute('aria-label')));
  check('outline card: header carries Redraw and Delete, no body row', body.length === 0 && headActs.join() === 'Redraw,Delete', `${body.join()} | ${headActs.join()}`);
  check('outline card: no nudge arrows, no layer order, no nudge pad', !(await page.$('#outlines [data-card] .nudge, #outlines [data-card] .layer-order, #outlines [data-card] .nudge-pad, #outlines [data-card] [data-nudge]')), '');
  check('outline card: no up/down/square-all controls, no Square corners button', !(await page.$('#outlines [data-card] [data-act=up], #outlines [data-card] [data-act=down], #outlines [data-card] [data-act=square-all]')) && !(await page.$('#sidebar [aria-label="Square corners"]')), '');
  const redraw = await page.$('#outlines [data-card] [data-act=redraw]');
  check('outline card: Redraw is an icon button labelled Redraw', !!redraw && (await redraw.getAttribute('aria-label')) === 'Redraw' && (await redraw.innerText()).trim() === '', redraw ? await redraw.getAttribute('aria-label') : 'missing');
  check('outline card: the word "Redo" appears nowhere in the card', !/Redo/.test(await page.$eval('#outlines [data-card]', e => `${e.innerText} ${e.innerHTML}`)), '');
  check('panel Undo/Redo ids unchanged on the canvas', await page.evaluate(() => ['undo', 'redo'].every(id => document.getElementById(id)?.closest('.canvas-controls'))), '');
  const trash = await page.$('#outlines [data-card] [data-act=delete]');
  check('feature card: trash labelled Delete', !!trash && (await trash.getAttribute('aria-label')) === 'Delete', '');
  await page.screenshot({ path: `${outDir}/slim-outline-card.png` });
  // Close: header tap, empty plan, Escape
  await page.click('#outlines [data-card] .layer-head .swatch'); await page.waitForTimeout(250); // the name is a field, so tap beside it
  check('card closes by tapping its header', !(await cardIn('#outlines')), '');
  await selectRow('Driveway');
  await tap([100, 700]);
  check('card closes by tapping the empty plan', !(await cardIn('#outlines')), '');
  await selectRow('Driveway'); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  check('card closes by Escape', !(await cardIn('#outlines')), '');
  // Boundary card: no trash. Feature card: trash deletes.
  await page.click('#outlines [data-layer=boundary]'); await page.waitForTimeout(250);
  check('boundary card has Redraw but no trash', !!(await page.$('#outlines [data-card] [data-act=redraw]')) && !(await page.$('#outlines [data-card] [data-act=delete], #outlines [data-card] [aria-label=Delete]')), '');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const order = () => page.$$eval('#outlines .layer-item [data-layer]', b => b.map(x => x.textContent.trim().split(/\s/)[0]).join(','));
  await selectRow('Pool'); await page.click('#outlines [data-card] [aria-label=Delete]'); await page.waitForTimeout(300);
  check('feature card: the trash deletes the feature', !(await order()).includes('Pool'), await order());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  check('⌘Z brings the deleted feature back', (await order()).endsWith(names.join(',')), await order());

  // ---- Reorder: Outlines ----
  const grip = (sec, n) => page.locator(`#${sec} .layer-item:has(.layer-name:text-is("${n}")) [data-grip]`);
  const [N1, N2, N3] = names;
  check('reorder: three features in drawing order', (await order()).endsWith(names.join(',')), await order());
  const hit = await grip('outlines', N3).boundingBox();
  check('reorder: grip hit area is at least 44px', hit.width >= 44 && hit.height >= 44, `${hit.width}x${hit.height}`);
  check('reorder: grip has touch-action none', await grip('outlines', N3).evaluate(e => getComputedStyle(e).touchAction) === 'none', '');
  const pressTo = async (sec, from, target, frac = 0.25) => {
    const g = await grip(sec, from).boundingBox(), t = await page.locator(`#${sec} .layer-item:has(.layer-name:text-is("${target}"))`).boundingBox();
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.down();
    await page.mouse.move(g.x + g.width / 2, t.y + t.height * frac, { steps: 8 });
  };
  await pressTo('outlines', N3, N1);
  check('reorder: drop line and dragging row show', await page.locator('#outlines .layer-item.drop-before').count() === 1 && await page.locator('#outlines .layer-item.dragging').count() === 1, '');
  await page.mouse.up(); await page.waitForTimeout(250);
  check('reorder: dragging the last grip above the first reorders', (await order()).endsWith([N3, N1, N2].join(',')), await order());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  check('reorder: one ⌘Z restores the order', (await order()).endsWith(names.join(',')), await order());
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(250); await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  await pressTo('outlines', N3, N1); await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(250);
  check('reorder: Escape mid-drag cancels', (await order()).endsWith(names.join(',')) && await page.locator('#outlines .dragging, #outlines .drop-before').count() === 0, await order());
  await pressTo('outlines', N1, N3, 0.9); await page.mouse.up(); await page.waitForTimeout(250);
  check('reorder: dropping below the last row moves to the end', (await order()).endsWith([N2, N3, N1].join(',')), await order());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  await pressTo('outlines', N2, N2, 0.5); await page.mouse.up(); await page.waitForTimeout(250);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  check('reorder: a no-op drag adds no undo step (⌘Z undoes the Pool outline instead)', !(await order()).includes(N3), await order());
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(250);
  await grip('outlines', N3).focus(); await page.keyboard.press('Alt+ArrowUp'); await page.waitForTimeout(200);
  check('reorder: Alt+ArrowUp on the grip moves a feature up', (await order()).endsWith([N1, N3, N2].join(',')), await order());
  check('reorder: the grip keeps focus', await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === `Reorder ${N3}`, '');
  await page.keyboard.press('Alt+ArrowDown'); await page.waitForTimeout(200);
  check('reorder: Alt+ArrowDown moves it back', (await order()).endsWith(names.join(',')), await order());
  const cdp = await context.newCDPSession(page);
  const g = await grip('outlines', N3).boundingBox(), t = await rowOf(N1).boundingBox();
  const gx = g.x + g.width / 2, gy = g.y + g.height / 2, ty = t.y + t.height * 0.25;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gx, y: gy }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: gx, y: gy + (ty - gy) * i / 8 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(250);
  check('reorder: a touch drag of the grip works', (await order()).endsWith([N3, N1, N2].join(',')), await order());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);

  // ---- Surface card ----
  await addVia(page, 'surfaces'); await page.click('#surfaces .layer-form [data-material=pavers-classic]');
  await drag([400, 200], [500, 300]);
  check('surface card: collapsed by default (no #zone-width)', !!(await page.$('#surfaces [data-card]')) && !(await page.$('#zone-width')) && (await page.getAttribute('[data-disclosure=adjust]', 'aria-expanded')) === 'false', '');
  check('surface card: no up/down, no Square corners button, no nudge in the card', !(await page.$('#surfaces [data-card] [data-act=up], #surfaces [data-card] [data-act=down], #surfaces [data-card] [data-act=square-all], #surfaces [data-card] .nudge, #surfaces [data-card] .layer-order')), '');
  const sRedraw = await page.$('#surfaces [data-card] [data-act=redraw]'), sTrash = await page.$('#surfaces [data-card] [data-act=delete]');
  check('surface card: icon Redraw and Delete trash', !!sRedraw && (await sRedraw.getAttribute('aria-label')) === 'Redraw' && !!sTrash && (await sTrash.getAttribute('aria-label')) === 'Delete', '');
  const trunc = await page.evaluate(() => ['#surfaces [data-act=change-material]', '#surfaces [data-disclosure=adjust] .layer-name'].map(q => { const e = document.querySelector(q), r = e.getBoundingClientRect(); return { q, text: e.textContent.trim(), clipped: e.scrollWidth > e.clientWidth + 1, w: Math.round(r.width) }; }));
  check('surface card: Material and Shape and texture labels are not truncated', trunc.every(t => !t.clipped), JSON.stringify(trunc));
  check('surface card: the Material button keeps aria-label Change material', (await page.getAttribute('#surfaces [data-act=change-material]', 'aria-label')) === 'Change material', '');
  check('reorder grips carry a title and aria-keyshortcuts', await page.$$eval('#outlines [data-grip]', g => g.length > 0 && g.every(x => x.title && /Alt\+ArrowUp/.test(x.getAttribute('aria-keyshortcuts') ?? ''))), '');
  await page.screenshot({ path: `${outDir}/slim-surface-closed.png` });
  await page.click('[data-disclosure=adjust]'); await page.waitForTimeout(200);
  check('surface card: Shape and texture opens the size fields', !!(await page.$('#zone-width')) && (await page.getAttribute('[data-disclosure=adjust]', 'aria-expanded')) === 'true', '');
  await page.screenshot({ path: `${outDir}/slim-surface-open.png` });
  await page.fill('#round-all', '2'); await page.click('.round-all button[type=submit]'); await page.waitForTimeout(250);
  check('surface card: Corner radius shows 2 after Round all 2′', (await page.inputValue('#round-all')) === '2', await page.inputValue('#round-all'));
  await page.mouse.move(...await toScreen([450, 250])); // zoom in so a corner is well clear of the sides and handles (at Fit the click misses it)
  await page.keyboard.down('Control'); for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, -12); await page.waitForTimeout(20); } await page.keyboard.up('Control'); await page.waitForTimeout(600);
  const zc = await (await page.$('.overlay .corner')).boundingBox(); await page.mouse.click(zc.x + zc.width / 2, zc.y + zc.height / 2); await page.waitForTimeout(400); // a corner of the zone
  await page.fill('#corner-radius', '4'); await page.press('#corner-radius', 'Enter'); await page.waitForTimeout(250);
  const roundVal = await page.inputValue('#round-all').catch(() => '(no field)'), roundPh = await page.getAttribute('#round-all', 'placeholder').catch(() => '(none)');
  check('surface card: Corner radius reads Mixed after rounding one corner', roundVal === '' && roundPh === 'Mixed', `value "${roundVal}" placeholder "${roundPh}"`);
  // keyboard arrows still nudge a selected corner
  const cornerPts = () => page.$$eval('.overlay .corner', c => c.map(x => { const r = x.getBoundingClientRect(); return [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10]; }));
  const c0 = await cornerPts(); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200); const c1 = await cornerPts();
  check('keyboard: ArrowRight nudges the selected corner', c0.length > 0 && c0.some((p, i) => c1[i] && c1[i][0] > p[0]), `${c0.length} corners`);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(200);
  await page.click('#fit'); await page.waitForTimeout(500);
  // Second zone, reorder Surfaces
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await addVia(page, 'surfaces'); await page.click('#surfaces .layer-form [data-material=pavers-classic]');
  await dragRect([400, 350], [500, 450]);
  const zorder = () => page.$$eval('#surfaces [data-grip]', g => g.map(x => x.dataset.grip).join(','));
  const zidList = (await zorder()).split(',');
  const zgrip = id => page.locator(`#surfaces [data-grip="${id}"]`);
  check('surfaces: two zones with grips', zidList.length === 2, await zorder());
  const [zA, zB] = zidList;
  const zdrag = async (from, to, frac = 0.25) => {
    const g2 = await zgrip(from).boundingBox(), t2 = await page.locator(`#surfaces .layer-item:has([data-grip="${to}"])`).boundingBox();
    await page.mouse.move(g2.x + g2.width / 2, g2.y + g2.height / 2); await page.mouse.down(); await page.mouse.move(g2.x + g2.width / 2, t2.y + t2.height * frac, { steps: 8 });
  };
  await zdrag(zB, zA); await page.mouse.up(); await page.waitForTimeout(250);
  check('surfaces: grip drag moves the last zone above the first', (await zorder()) === `${zB},${zA}`, await zorder());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  check('surfaces: one ⌘Z restores the order', (await zorder()) === `${zA},${zB}`, await zorder());
  await zdrag(zB, zA); await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(250);
  check('surfaces: Escape mid-drag cancels', (await zorder()) === `${zA},${zB}`, await zorder());
  await zgrip(zB).focus(); await page.keyboard.press('Alt+ArrowUp'); await page.waitForTimeout(200);
  check('surfaces: Alt+ArrowUp on a grip moves a zone', (await zorder()) === `${zB},${zA}`, await zorder());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  check('surfaces: one ⌘Z restores after Alt+Arrow', (await zorder()) === `${zA},${zB}`, await zorder());
  // Alt+Arrow on a grip must not also nudge the selected zone (the tool's key handler), and is one undo step.
  await page.locator(`#surfaces [data-zone="${zA}"]`).click(); await page.waitForTimeout(250);
  const zpath = id => page.$eval(`.overlay .shape.closed[data-id="${id}"]`, e => e.getAttribute('d'));
  const d0 = await zpath(zA);
  const zall = () => page.$$eval('#surfaces [data-card], #surfaces [data-zone]', e => e.map(x => x.dataset.card ?? x.dataset.zone).join(','));
  await zgrip(zB).focus(); await page.keyboard.press('Alt+ArrowUp'); await page.waitForTimeout(250);
  check('grip Alt+Arrow with a zone selected: the zone is not nudged', (await zpath(zA)) === d0, '');
  check('grip Alt+Arrow with a zone selected: the layer moved', (await zall()) === `${zB},${zA}`, await zall());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  check('grip Alt+Arrow with a zone selected: one ⌘Z restores the order, zone still in place', (await zall()) === `${zA},${zB}` && (await zpath(zA)) === d0, await zall());
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(150);

  // ---- Zone edge chip, with and without a scale ----
  await page.locator(`#surfaces [data-zone="${zA}"]`).click().catch(() => {}); await page.waitForTimeout(250);
  await tap([500, 250]);
  const zt = await chipText();
  check('zone edge chip shows its length', /^\d+(\.\d+)?′/.test(zt), zt);
  await page.click('.edge-chip [data-act=edit-length]'); await keys('15'); await page.click('.edge-chip .keypad-key[data-key=done]'); await page.waitForTimeout(300);
  await tap([500, 250]);
  check('zone edge resized by the keypad', (await chipText()).startsWith('15.00′'), await chipText());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  // Remove the scale (boundary edge, ⋯, Remove this length), then tap a zone edge: "No scale", no keypad.
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  await tap([250, 560]);
  if (await page.$('.edge-chip [data-act=menu]')) {
    await page.click('.edge-chip [data-act=menu]'); await page.click('.edge-menu [data-act=unref]'); await page.waitForTimeout(400);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    const zoneRow = page.locator(`#surfaces [data-zone="${zA}"]`);
    if (await zoneRow.count()) { await zoneRow.click(); await page.waitForTimeout(250); await tap([500, 250]); }
    const nt = await chipText();
    check('zone edge with no scale shows No scale', /No scale/.test(nt), nt);
    check('zone edge with no scale has no keypad and a disabled length', !(await page.$('.edge-chip .keypad')) && (await page.$eval('.edge-chip [data-act=edit-length]', b => b.disabled).catch(() => true)), '');
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  } else check('zone edge with no scale shows No scale', false, 'boundary edge has no reference to remove');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');

  // ---- Plant and object cards ----
  const images = () => page.$$eval('.overlay image.symbol[data-id]', i => i.map(x => ({ id: x.dataset.id, t: x.getAttribute('transform') })));
  const arm = async id => { await addVia(page, 'symbols'); await page.click(`#symbol-results [data-symbol=${id}]`); await page.waitForTimeout(150); };
  await arm('blue-diamond-spruce'); await tap([300, 520]); await tap([360, 520]); await page.click('[data-act=stop-placing]'); await page.waitForTimeout(200);
  await tap([300, 520]);
  check('plant card: opens with prev/next and a Delete trash', !!(await page.$('#symbols [data-card] [data-act=next]')) && (await page.getAttribute('#symbols [data-card] [data-act=delete-symbol]', 'aria-label')) === 'Delete', '');
  check('plant card: no rotation controls', !(await page.$('#symbols [data-card] [data-act=rot-up], #symbols [data-card] [data-act=rot-down], #symbols [data-card] #symbol-rotation')), '');
  await page.screenshot({ path: `${outDir}/slim-plant-card.png` });
  const nBefore = (await images()).length;
  await page.click('#symbols [data-card] [data-act=delete-symbol]'); await page.waitForTimeout(250);
  check('plant card: the trash removes one plant', (await images()).length === nBefore - 1, `${nBefore} -> ${(await images()).length}`);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await arm('hot-tub'); await tap([450, 560]); await page.click('[data-act=stop-placing]'); await page.waitForTimeout(200);
  await tap([450, 560]);
  check('object card: keeps its Rotate row', !!(await page.$('#symbols [data-card] [data-act=rot-up]')) && !!(await page.$('#symbols [data-card] #symbol-rotation')), '');
  await page.screenshot({ path: `${outDir}/slim-object-card.png` });
  await context.close();
}

// ---- Nudge pad and floating Square corners: fine and coarse pointer ----
if (onlyPart !== 'main') for (const coarse of [false, true]) for (const width of [1180, 820]) {
  const { context, page, toScreen, tap, dragRect } = await start({ width, coarse });
  const tag = `${coarse ? 'coarse' : 'fine'} ${width}px: `;
  const hidden = sel => page.$eval(sel, e => e.hidden || getComputedStyle(e).display === 'none');
  const rect = sel => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, hidden: e.hidden || r.width === 0 }; });
  const overlap = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
  const cornerPts = () => page.$$eval('.overlay .corner', c => c.map(x => { const r = x.getBoundingClientRect(); return [r.x, r.y]; }));
  check(tag + 'nothing selected: pad and Square corners hidden', await hidden('.nudge-pad') && await hidden('#square-corners'), '');
  await page.click('[data-start=boundary]'); await dragRect([250, 150], [550, 650]); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  check(tag + 'deselected: pad and Square corners hidden', await hidden('.nudge-pad') && await hidden('#square-corners'), '');
  await tap([250, 400]);
  check(tag + 'outline selected: Square corners shows (aria-label "Square corners")', !(await hidden('#square-corners')) && (await page.getAttribute('#square-corners', 'aria-label')) === 'Square corners', '');
  check(tag + 'outline selected: nothing nudgeable, pad hidden', await hidden('.nudge-pad'), '');
  check(tag + 'no Square corners button in the panel card', !(await page.$('#sidebar [data-act=square-all]')) && !(await page.$('#sidebar [aria-label="Square corners"]')), '');
  const cb = await (await page.$('.overlay .corner')).boundingBox();
  await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2); await page.waitForTimeout(450);
  check(tag + 'corner selected: nudge pad ' + (coarse ? 'shows' : 'stays hidden'), (await hidden('.nudge-pad')) === !coarse, `hidden ${await hidden('.nudge-pad')}`);
  check(tag + 'corner selected: Square corners shows', !(await hidden('#square-corners')), '');
  if (coarse) {
    const pad = await rect('.nudge-pad'), canvas = await rect('#canvas');
    check(tag + 'pad sits bottom-left of the canvas (one control row above the dock)', pad.l - canvas.l < 40 && canvas.b - pad.b < 100, JSON.stringify(pad));
    for (const id of ['#zoom-in', '#zoom-out', '#fit', '#snap', '#undo', '#redo', '#square-corners']) {
      const r = await rect(id); if (r.hidden) continue;
      check(tag + `pad clear of ${id}`, !overlap(pad, r), '');
    }
    const p0 = await cornerPts();
    await page.click('.nudge-pad [data-nudge="1,0"]'); await page.waitForTimeout(250);
    const p1 = await cornerPts();
    const moved = p0.map((p, i) => [p1[i][0] - p[0], p1[i][1] - p[1]]).filter(d => Math.abs(d[0]) > 0.01 || Math.abs(d[1]) > 0.01);
    check(tag + 'pad right arrow moves the selected corner one step', moved.length === 1 && moved[0][0] > 0 && Math.abs(moved[0][1]) < 0.01, JSON.stringify(moved));
    check(tag + 'nudge enables Undo', !(await page.$eval('#undo', e => e.disabled)), '');
    await page.screenshot({ path: `${outDir}/slim-nudge-coarse-${width}.png` });
  }
  const sq = await rect('#square-corners'), st = await rect('#stage');
  check(tag + 'Square corners is at least 44px and inside the stage', sq.h >= 44 && sq.w >= 44 && sq.l >= st.l && sq.r <= st.r && sq.t >= st.t && sq.b <= st.b, JSON.stringify(sq));
  for (const id of ['#zoom-in', '#zoom-out', '#fit', '#snap', '#undo', '#redo']) {
    const r = await rect(id); if (r.hidden) continue;
    check(tag + `Square corners clear of ${id}`, !overlap(sq, r), '');
  }
  const q0 = await cornerPts(); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(200); const q1 = await cornerPts();
  check(tag + 'keyboard ArrowDown still nudges', q0.some((p, i) => q1[i][1] > p[1] + 0.01), '');
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  check(tag + 'Escape: pad and Square corners hidden', await hidden('.nudge-pad') && await hidden('#square-corners'), '');
  await tap([250, 400]);
  await page.click('#square-corners'); await page.waitForTimeout(250);
  check(tag + 'Square corners click runs without error', errors.length === 0, errors.join('|'));
  await context.close();
}

check('no page errors', errors.length === 0, errors.join(' | '));
console.table(results.map(([step, result]) => ({ step, result })));
await browser.close();
process.exit(results.some(r => r[1].startsWith('FAIL')) ? 1 : 0);
