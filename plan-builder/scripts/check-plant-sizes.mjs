// Plant sizes on Riesberg (memory store): a plant draws at install size until the top bar's Install | Mature toggle flips it; the toggle
// shows only once a plant is placed; container chips, the size handle (Custom) and Apply to all change the circle; the handle is gone in
// Mature and in Preview; the Sheet lists two rows when sizes differ, with the footnote; the toggle works in Preview; Now | Grown at
// 900 px and below with a one-row 48 px bar; and the one-time first-open prompt for a plan with plants and no stored view.
// The prompt needs a plan saved without `plantSizeView` (placing a first plant always sets it): the script imports the page's own
// MemoryPlanStore module through the dev server and wraps `save` so it drops the field while a flag is set, the way a plan saved
// before this feature looks. Then it reopens the plan from the Plans list.
// Usage: node scripts/check-plant-sizes.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';
import { setEdgeLength } from './lib/edge.mjs';
import { addVia, onSheet } from './lib/add.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], check = (name, ok, got) => results.push([name, `${ok ? 'ok' : 'FAIL'} · ${got}`]);
const errors = [];
const r1 = n => Math.round(n * 10) / 10;

async function start(width) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForTimeout(3500);
  await page.evaluate(() => localStorage.setItem('plan-builder.shape.outline', 'rect')); await page.reload(); await page.waitForTimeout(3500);
  await openPlan(page, pdf);
  const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(), k = r.width / 612; return [r.left + x * k, r.top + y * k]; }, [x, y]);
  const drag = async (p, q) => { const a = await toScreen(p), b = await toScreen(q); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200); };
  const tap = async p => { await page.mouse.click(...await toScreen(p)); await page.waitForTimeout(250); };
  // Boundary 300 × 500 pt, its left edge set to 100 ft (500 pt), so 0.2 ft/pt.
  await page.click('[data-start=boundary]'); await drag([250, 150], [550, 650]); await page.keyboard.press('Escape');
  await tap([250, 560]); await setEdgeLength(page, '100'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  return { page, toScreen, drag, tap };
}

const sizes = page => page.$$eval('.overlay image.symbol[data-id]', i => Object.fromEntries(i.map(x => [x.dataset.id, { w: +x.getAttribute('width'), h: +x.getAttribute('height') }])));
const toggleText = page => page.$eval('#plant-view-switch', e => [...e.querySelectorAll('button')].map(b => b.innerText.trim()).join(' | ')).catch(() => null);
const pressedView = page => page.$eval('#plant-view-switch [aria-pressed=true]', b => b.dataset.plantview).catch(() => null);
const hasHandle = async page => !!(await page.$('.overlay [data-handle=size]'));
const cardText = page => page.$eval('#symbols [data-card]', e => e.innerText.replace(/\s+/g, ' ')).catch(() => '');
/** One row: the three clusters sit inside the bar and share a vertical centre (they differ in height, so their tops differ). */
const oneRow = page => page.evaluate(() => {
  const b = document.getElementById('top-bar').getBoundingClientRect();
  const r = ['.top-bar-left', '.top-bar-centre', '.top-bar-right'].map(s => document.querySelector(`#top-bar ${s}`).getBoundingClientRect());
  const centres = r.map(x => Math.round((x.top + x.bottom) / 2 * 10) / 10);
  return { ok: r.every(x => x.top >= b.top - 0.5 && x.bottom <= b.bottom + 0.5) && Math.max(...centres) - Math.min(...centres) <= 2, centres };
});
const prompt = page => page.$('.modal[role=dialog]');
const reopen = async page => {
  await page.waitForTimeout(1800); // let autosave run
  await page.click('#back-to-plans'); await page.locator('.plan-row').first().waitFor();
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await page.locator('.plan-row .plan-open').first().click();
  await page.waitForFunction(() => !!document.querySelector('.modal[role=dialog]') || document.getElementById('toast').textContent.startsWith('Opened'), null, { timeout: 60000 });
  await page.waitForTimeout(500);
};

// ---------- 1180 px: the main flow ----------
try {
  const { page, toScreen, tap } = await start(1180);
  check('No toggle before a plant is placed', !(await page.$('#plant-view-switch')), String(await toggleText(page)));
  await addVia(page, 'symbols'); await page.fill('#symbol-search', 'spruce'); await page.waitForTimeout(150);
  await page.click('#symbol-results [data-symbol=blue-diamond-spruce]'); await page.waitForTimeout(150);
  await tap([320, 300]); await tap([460, 300]);
  await page.click('[data-act=stop-placing]'); await page.waitForTimeout(150);
  const placed = await sizes(page), [a, b] = Object.keys(placed);
  check('Toggle shows once a plant is placed, Install pressed, labels Install | Mature', (await pressedView(page)) === 'install' && (await toggleText(page)) === 'Install | Mature', `${await toggleText(page)} · pressed ${await pressedView(page)}`);
  const install = placed[a];
  await page.click('#plant-view-switch [data-plantview=mature]'); await page.waitForTimeout(250);
  const mature = (await sizes(page))[a];
  check('Install circle is smaller than Mature', install.w < mature.w && install.h < mature.h, `install ${r1(install.w)}×${r1(install.h)} px, mature ${r1(mature.w)}×${r1(mature.h)} px`);
  const pxPerPt = await page.evaluate(() => document.getElementById('page').getBoundingClientRect().width / 612);
  const ratio = install.w / mature.w;
  check('Install/Mature ratio matches 4.5 ft / 10 ft (6 ft B&B)', Math.abs(ratio - 0.45) < 0.02, `ratio ${ratio.toFixed(3)} (px/pt ${pxPerPt.toFixed(3)})`);
  // Select a plant in Mature: no handle
  await tap([320, 300]);
  check('No size handle in Mature', !(await hasHandle(page)), `handle ${await hasHandle(page)}, card "${(await cardText(page)).slice(0, 80)}"`);
  await page.click('#plant-view-switch [data-plantview=install]'); await page.waitForTimeout(250);
  check('Size handle shows on the selected plant in Install', await hasHandle(page), 'present');
  // Screenshot of the small selected plant, its halo and handle; measure the gap
  const geo = await page.evaluate(() => {
    const halo = document.querySelector('.overlay .symbol-halo'), h = document.querySelector('.overlay [data-handle=size]');
    if (!halo || !h) return null;
    const hr = halo.getBoundingClientRect(), dr = h.getBoundingClientRect();
    return { haloRight: hr.right, haloR: hr.width / 2, handleLeft: dr.left, handleR: dr.width / 2, gap: dr.left - hr.right, cx: (hr.left + hr.right) / 2, cy: (hr.top + hr.bottom) / 2 };
  });
  check('Size handle sits outside the dashed halo (gap reported)', !!geo && geo.gap > 0, geo ? `halo r ${r1(geo.haloR)} px, handle r ${r1(geo.handleR)} px, gap halo→handle ${r1(geo.gap)} px` : 'no halo/handle');
  if (geo) await page.screenshot({ path: `${outDir}/plant-sizes-1180-handle.png`, clip: { x: geo.cx - 90, y: geo.cy - 70, width: 180, height: 140 } });
  await page.screenshot({ path: `${outDir}/plant-sizes-1180-card.png` });
  // Container chip changes the circle (on plant b)
  await tap([460, 300]);
  const chips = await page.$$eval('#symbols [data-card] button.chip[data-container]', c => c.map(x => ({ c: x.dataset.container, p: x.getAttribute('aria-pressed') })));
  const other = chips.find(c => c.p !== 'true');
  const b0 = (await sizes(page))[b];
  if (other) { await page.click(`#symbols [data-card] button.chip[data-container="${other.c}"]`); await page.waitForTimeout(250); }
  const b1 = (await sizes(page))[b];
  check('Choosing another container chip changes the circle', !!other && Math.abs(b1.w - b0.w) > 0.5, `${chips.map(c => c.c + (c.p === 'true' ? '*' : '')).join(', ')} → ${other?.c}: ${r1(b0.w)} → ${r1(b1.w)} px`);
  // Sheet: two rows + footnote
  const sheet = await onSheet(page, p => p.$$eval('#layers-sheet', s => ({ rows: [...s[0].querySelectorAll('.plant-card[data-sheet-symbol=blue-diamond-spruce]')].map(r => r.querySelector('.plant-size')?.textContent.trim() + ' ×' + r.querySelector('.plant-count')?.textContent.trim()), text: s[0].innerText })));
  check('Sheet: two spruce rows when sizes differ, each with its size line', sheet.rows.length === 2 && sheet.rows.every(r => !r.startsWith('undefined')), sheet.rows.join(' · '));
  check('Sheet: install footnote', sheet.text.includes('Sizes shown at install. Switch to Mature to see grown sizes.'), sheet.text.includes('Sizes shown at install') ? 'Sizes shown at install. …' : 'missing');
  await page.click('[data-view=preview]'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/plant-sizes-1180-sheet.png` });
  await page.click('[data-view=edit]'); await page.waitForTimeout(300);
  // Apply to all from a (6 ft B&B) to b
  await tap([320, 300]);
  const applyLabel = await page.$eval('#symbols [data-act=apply-species]', e => e.innerText.trim()).catch(() => null);
  await page.click('#symbols [data-act=apply-species]'); await page.waitForTimeout(250);
  const s2 = await sizes(page);
  check('Apply to all changes the second spruce to the first one\'s size', Math.abs(s2[b].w - s2[a].w) < 0.1 && Math.abs(s2[b].w - b1.w) > 0.5, `label "${applyLabel}"; b ${r1(b1.w)} → ${r1(s2[b].w)} px (a ${r1(s2[a].w)})`);
  const rowsAfter = await onSheet(page, p => p.$$eval('#layers-sheet .plant-card[data-sheet-symbol=blue-diamond-spruce]', r => r.length));
  check('Sheet: one row once sizes match', rowsAfter === 1, `${rowsAfter} row(s)`);
  // Drag the size handle → Custom
  await tap([320, 300]);
  const hb = await page.$eval('.overlay [data-handle=size]', e => { const r = e.getBoundingClientRect(); return [(r.left + r.right) / 2, (r.top + r.bottom) / 2]; });
  const aBefore = (await sizes(page))[a];
  await page.mouse.move(...hb); await page.mouse.down(); await page.mouse.move(hb[0] + 8, hb[1], { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250);
  const aAfter = (await sizes(page))[a], card = await cardText(page);
  const customPressed = await page.$eval('#symbols [data-act=custom-size]', e => e.getAttribute('aria-pressed')).catch(() => null);
  check('Dragging the size handle grows the plant and the card shows Custom', aAfter.w > aBefore.w + 1 && /Custom [\d.]+ ft across/.test(card) && customPressed === 'true', `${r1(aBefore.w)} → ${r1(aAfter.w)} px; Custom chip pressed ${customPressed}; "${(card.match(/Custom [^·]+· mature [\d.]+ ft/) ?? [''])[0]}"`);
  check('The other spruce did not change with the drag', Math.abs((await sizes(page))[b].w - s2[b].w) < 0.1, `${r1((await sizes(page))[b].w)} px`);
  // Preview: no handle; toggle clickable
  await page.click('[data-view=preview]'); await page.waitForTimeout(300);
  check('No size handle in Preview', !(await hasHandle(page)), `handle ${await hasHandle(page)}`);
  const pv0 = (await sizes(page))[b];
  await page.click('#plant-view-switch [data-plantview=mature]'); await page.waitForTimeout(250);
  const pv1 = (await sizes(page))[b], sheetMature = await page.$eval('#layers-sheet', e => e.innerText);
  check('Toggle works in Preview: flips to Mature, circle grows, footnote follows', (await pressedView(page)) === 'mature' && pv1.w > pv0.w && sheetMature.includes('Sizes shown at mature. Switch to Install to see nursery sizes.'), `pressed ${await pressedView(page)}; ${r1(pv0.w)} → ${r1(pv1.w)} px`);
  await page.click('#plant-view-switch [data-plantview=install]'); await page.waitForTimeout(250);
  await page.click('[data-view=edit]'); await page.waitForTimeout(300);
  // Reopen keeps the view (Install) and the custom size
  await page.click('#plant-view-switch [data-plantview=mature]'); await page.waitForTimeout(250);
  await reopen(page);
  check('Reopening keeps the stored view (Mature), no prompt', (await pressedView(page)) === 'mature' && !(await prompt(page)), `pressed ${await pressedView(page)}, prompt ${!!(await prompt(page))}`);
  await page.click('#plant-view-switch [data-plantview=install]'); await page.waitForTimeout(250);
  check('Reopening keeps the custom size', Math.abs((await sizes(page))[a].w - aAfter.w) < 0.2, `${r1((await sizes(page))[a].w)} px vs ${r1(aAfter.w)}`);
  // Bar layout at 1180 with the toggle
  const bar = await page.$eval('#top-bar', e => { const r = e.getBoundingClientRect(); return { h: r.height }; });
  const inView = await page.evaluate(() => ['#undo', '#redo', '#export'].every(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && r.width > 0; }));
  const rowTops = await oneRow(page);
  check('1180px: bar one row, 48 px, Undo/Redo/Export inside the viewport', Math.abs(bar.h - 48) < 1.5 && inView && rowTops.ok, `h ${r1(bar.h)}, cluster centres ${rowTops.centres.join('/')}, in view ${inView}`);
  await page.screenshot({ path: `${outDir}/plant-sizes-1180-toggle.png`, clip: { x: 0, y: 0, width: 1180, height: 60 } });

  // ---------- First-open prompt ----------
  // Make the stored copy lack plantSizeView (as a plan saved before this feature), via the page's own MemoryPlanStore module.
  const patched = await page.evaluate(async () => {
    const m = await import('/src/memory-plan-store.ts');
    const P = m.MemoryPlanStore.prototype, save = P.save;
    if (!P.__wrapped) { P.save = function (id, state) { if (window.__dropView) { state = { ...state }; delete state.plantSizeView; } return save.call(this, id, state); }; P.__wrapped = true; }
    window.__dropView = true; return true;
  });
  // A move saves the plan (without the field); then stop dropping, and reopen.
  const keysBehind = () => page.evaluate(() => window.__keysBehind ?? 0);
  await page.keyboard.press('Escape');
  const c = await toScreen([460, 300]);
  await page.mouse.move(...c); await page.mouse.down(); await page.mouse.move(c[0] + 10, c[1] + 5, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(1800);
  await page.click('#back-to-plans'); await page.locator('.plan-row').first().waitFor();
  await page.evaluate(() => { window.__dropView = false; });
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await page.locator('.plan-row .plan-open').first().click();
  await page.waitForSelector('.modal[role=dialog]', { timeout: 15000 }).catch(() => null);
  const shown1 = await page.$eval('.modal[role=dialog]', e => e.innerText.replace(/\s+/g, ' ')).catch(() => null);
  check('A plan with plants and no stored view shows the prompt', patched && !!shown1 && shown1.includes('Show plants at install size?'), shown1 ?? 'no prompt');
  const focused = await page.evaluate(() => document.activeElement?.dataset?.choice ?? document.activeElement?.tagName);
  check('Install size has focus when the prompt opens', focused === 'install', String(focused));
  await page.screenshot({ path: `${outDir}/plant-sizes-1180-prompt.png` });
  // Keys while the prompt is up must not reach the editor's window handlers
  await page.evaluate(() => { window.__keysBehind = 0; window.addEventListener('keydown', () => { window.__keysBehind++; }); });
  const undoBefore = await page.$eval('#undo', e => e.disabled);
  await page.keyboard.press('Meta+z'); await page.keyboard.press('Delete'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('x');
  check('Cmd+Z, Delete, arrows and x stay in the prompt (nothing reaches the editor behind)', (await keysBehind()) === 0 && !!(await prompt(page)), `${await keysBehind()} key(s) reached window; Undo disabled before ${undoBefore}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  check('Esc closes the prompt, keeps Mature, and the Esc does not reach the editor', !(await prompt(page)) && (await pressedView(page)) === 'mature' && (await keysBehind()) === 0, `prompt ${!!(await prompt(page))}, pressed ${await pressedView(page)}, ${await keysBehind()} key(s) behind`);
  const undoAfter = await page.$eval('#undo', e => e.disabled);
  check('The prompt\'s answer adds no undo step', undoAfter === undoBefore, `Undo disabled ${undoBefore} → ${undoAfter}`);
  await page.waitForTimeout(500);
  await reopen(page);
  check('Second open (after Esc) does not prompt; Mature stored', !(await prompt(page)) && (await pressedView(page)) === 'mature', `prompt ${!!(await prompt(page))}, pressed ${await pressedView(page)}`);
  // Again, answering Install size
  await page.evaluate(() => { window.__dropView = true; });
  await page.mouse.move(...c); await page.mouse.down(); await page.mouse.move(c[0] + 10, c[1] + 5, { steps: 4 }); await page.mouse.up();
  await page.waitForTimeout(1800);
  await page.click('#back-to-plans'); await page.locator('.plan-row').first().waitFor();
  await page.evaluate(() => { window.__dropView = false; document.getElementById('toast').textContent = ''; });
  await page.locator('.plan-row .plan-open').first().click();
  const shown2 = await page.waitForSelector('.modal[role=dialog]', { timeout: 15000 }).then(() => true).catch(() => false);
  if (shown2) { await page.click('.modal [data-choice=install]'); await page.waitForTimeout(400); }
  const inst = (await sizes(page))[b];
  check('Install size answer: prompt closes, Install pressed, plants at install size', shown2 && !(await prompt(page)) && (await pressedView(page)) === 'install' && inst.w < mature.w, `prompt shown ${shown2}, pressed ${await pressedView(page)}, b ${r1(inst.w)} px`);
  await reopen(page);
  check('Second open (after Install size) does not prompt; Install stored', !(await prompt(page)) && (await pressedView(page)) === 'install', `prompt ${!!(await prompt(page))}, pressed ${await pressedView(page)}`);
  await page.close();
} catch (e) { results.push(['STOPPED (1180)', e.message.split('\n')[0]]); }

// ---------- 900 and 820 px: Now | Grown, bar layout ----------
try {
  const { page, tap } = await start(820);
  await addVia(page, 'symbols'); await page.fill('#symbol-search', 'spruce'); await page.waitForTimeout(150);
  await page.click('#symbol-results [data-symbol=blue-diamond-spruce]'); await page.waitForTimeout(150);
  await tap([320, 300]); await tap([460, 300]); await page.click('[data-act=stop-placing]'); await page.waitForTimeout(150);
  for (const width of [900, 820]) {
    await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(400);
    const bar = await page.$eval('#top-bar', e => e.getBoundingClientRect().height);
    const inView = await page.evaluate(() => ['#undo', '#redo', '#export'].every(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && r.width > 0; }));
    const tops = await oneRow(page);
    check(`${width}px: toggle reads Now | Grown`, (await toggleText(page)) === 'Now | Grown', String(await toggleText(page)));
    check(`${width}px: bar one row, 48 px, Undo/Redo/Export inside the viewport`, Math.abs(bar - 48) < 1.5 && inView && tops.ok, `h ${r1(bar)}, cluster centres ${tops.centres.join('/')}, in view ${inView}`);
  }
  await page.setViewportSize({ width: 901, height: 900 }); await page.waitForTimeout(300);
  check('901px: toggle reads Install | Mature', (await toggleText(page)) === 'Install | Mature', String(await toggleText(page)));
  await page.setViewportSize({ width: 820, height: 900 }); await page.waitForTimeout(300);
  await tap([320, 300]);
  await page.screenshot({ path: `${outDir}/plant-sizes-820-edit.png` });
  await page.click('[data-view=preview]'); await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/plant-sizes-820-sheet.png` });
  await page.click('#plant-view-switch [data-plantview=mature]'); await page.waitForTimeout(250);
  check('820px: toggle clickable in Preview', (await pressedView(page)) === 'mature', `pressed ${await pressedView(page)}`);
  await page.close();
} catch (e) { results.push(['STOPPED (820)', e.message.split('\n')[0]]); }

check('No page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
console.table(results.map(([check, result]) => ({ check, result })));
const fails = results.filter(r => r[1].startsWith('FAIL') || r[0].startsWith('STOPPED')).length, oks = results.filter(r => r[1].startsWith('ok')).length;
console.log(`${oks} ok, ${fails} FAIL`);
await browser.close();
process.exit(fails ? 1 : 0);
