// The Layers panel's tool row on Riesberg (memory store): Add, Surface, Edge and Plant are dimmed until the scale is set; Surface
// starts drawing and opens the grid; material first or shape first both end with an assigned zone, and dismissing the grid leaves a
// hatched "Not counted yet" zone the Sheet omits; Add searches every kind and a typed query ignores the tag; Recent lists the last
// picks; Edge starts a line and Plant arms placing; Duplicate as surface copies a custom outline (not the House); Fill the plot is
// offered only with a closed boundary; the old + Add menu and pickers are gone.
// Usage: node scripts/check-tools.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';
import { setEdgeLength } from './lib/edge.mjs';
import { addVia, onSheet, openTool } from './lib/add.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 1000 } });
const results = [], check = (name, ok, got) => results.push([name, `${ok ? 'ok' : 'FAIL'} · ${got}`]);
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(url); await page.waitForTimeout(3500);
await page.evaluate(() => { localStorage.setItem('plan-builder.shape.outline', 'rect'); localStorage.setItem('plan-builder.shape.surface', 'rect'); localStorage.removeItem('recent-picks'); });
await page.reload(); await page.waitForTimeout(3500);
await openPlan(page, pdf);
await page.$eval('#snap', b => b.click()); // exact placement
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 1008]; }, [x, y]);
const drag = async (p, q) => { const a = await toScreen(p), b = await toScreen(q); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(300); };
const tap = async p => { await page.mouse.click(...await toScreen(p)); await page.waitForTimeout(400); };
const esc = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(150); };
const dimmed = () => page.$$eval('#add .tool', b => b.length === 4 && b.every(x => x.classList.contains('dim') && x.getAttribute('aria-disabled') === 'true'));
const active = () => page.$$eval('#add .tool', b => b.length === 4 && b.every(x => !x.classList.contains('dim') && !x.hasAttribute('aria-disabled')));
const popOpen = () => page.evaluate(() => !!document.querySelector('#add .tool-popover'));
const picks = (scope = '#add') => page.$$eval(`${scope} [data-pick]`, c => c.map(x => x.dataset.pick));
const pressedTag = () => page.textContent('#add .chip[aria-pressed=true]').catch(() => '(none)');
const zoneIds = () => page.$$eval('#surfaces [data-zone], #surfaces [data-card]', r => [...new Set(r.map(x => x.dataset.zone ?? x.dataset.card))]);
const sheet = () => onSheet(page, p => p.$eval('#layers-sheet', e => e.innerText.replace(/\n+/g, ' | ')));
const fillCell = () => page.evaluate(() => { const g = document.querySelector('#add .tool-grid'); return !!g && g.firstElementChild?.matches('[data-act=fill-plot]'); });
const shapeFill = id => page.$eval(`.overlay .shape.closed[data-id="${id}"]`, e => e.getAttribute('style') ?? '').catch(() => '(missing)');

try {
  // ---- Before the scale ----
  check('Before the boundary: the four tools are dimmed', await dimmed(), (await page.$$eval('#add .tool', b => b.map(x => x.textContent.trim()))).join());
  await page.click('#add .tool[data-tool=surfaces]', { force: true }); await page.waitForTimeout(150); // aria-disabled: Playwright would wait for it to enable
  check('Tapping a dimmed tool shows the hint, no grid', !(await popOpen()) && /set the scale first/.test(await page.textContent('#add .tool-hint').catch(() => '')), await page.textContent('#add .tool-hint').catch(() => '(no hint)'));
  await page.click('[data-start=boundary]'); await drag([250, 150], [550, 650]); await esc();
  check('Closed boundary, no scale: still dimmed', await dimmed(), '');
  await tap([250, 560]); await setEdgeLength(page, '100'); await esc(); // 500 pt = 100 ft
  check('Scale set: the tools are active', await active(), '');

  // ---- The old menu and pickers are gone ----
  const old = await page.evaluate(() => ({
    addButton: !!document.querySelector('#add-button, [data-add], [data-act=cancel-add]'),
    pickers: !!document.querySelector('#symbol-search, #line-search, #symbol-results, #line-results, [data-material], [data-fill-material], [data-act=add-surface]'),
    plusAdd: /\+ Add\b/.test(document.getElementById('sidebar')?.innerText ?? document.body.innerText),
  }));
  check('No + Add menu or old picker remains', !old.addButton && !old.pickers && !old.plusAdd, JSON.stringify(old));

  // ---- Surface: starts drawing, opens the grid; Fill the plot first ----
  await openTool(page, 'surfaces');
  check('Surface opens the grid on the Surfaces tag', (await popOpen()) && (await pressedTag()) === 'Surfaces' && (await picks()).length > 0, `${await pressedTag()} · ${(await picks()).length} cells`);
  check('Surface starts drawing at once (Surfaces section shown with a draft)', !(await page.$eval('#section-surfaces', s => s.hidden)), '');
  check('With a closed boundary, Fill the plot is the first cell', await fillCell(), '');
  await page.fill('#tool-search', 'sod'); await page.waitForTimeout(100);
  check('A typed query drops the Fill the plot cell', !(await fillCell()), (await picks()).join());
  await page.fill('#tool-search', ''); await page.waitForTimeout(100);

  // ---- Shape first, dismissed: hatched, Not counted yet, omitted from the Sheet ----
  await esc(); // closes the grid; the draft stays
  check('Esc closes the grid, the draft stays', !(await popOpen()) && !(await page.$eval('#section-surfaces', s => s.hidden)), '');
  await drag([270, 170], [330, 230]);
  const [z1] = await zoneIds();
  check('Closing the shape opens the material grid in its card', !!(await page.$('#material-search')) && /Assign material/.test(await page.$eval('#surfaces [data-card]', c => c.innerText).catch(() => '')), z1 ?? 'no zone');
  await page.focus('#material-search'); await esc();
  const card1 = await page.$eval('#surfaces [data-card]', c => c.innerText).catch(() => '(no card)');
  check('Dismissing the grid leaves the zone, Not counted yet, with Assign material', !(await page.$('#material-search')) && /Not counted yet/.test(card1) && !!(await page.$('#surfaces [data-act=assign-material]')), card1.replace(/\n+/g, ' | ').slice(0, 100));
  check('The unassigned zone is hatched on the plan', (await shapeFill(z1)).includes('unassigned-hatch'), await shapeFill(z1));
  const s1 = await sheet();
  check('The Sheet omits the unassigned zone', !/sq ft/.test(s1), s1.slice(0, 120));

  // ---- Shape first, then pick in the card grid ----
  await esc(); await openTool(page, 'surfaces'); await esc();
  await drag([350, 170], [410, 230]);
  const z2 = (await zoneIds()).find(id => id !== z1);
  await page.click('#surfaces [data-card] [data-pick=wood-mulch]'); await page.waitForTimeout(250);
  check('Draw first, then pick: the zone is assigned', !!z2 && (await shapeFill(z2)).includes(`zone-${z2}`) && /Wood mulch \| [\d,]+ sq ft/.test(await sheet()), `${z2} · ${await shapeFill(z2)}`);

  // ---- Assign material later on the dismissed zone ----
  await esc(); await page.click(`#surfaces [data-zone="${z1}"]`); await page.waitForTimeout(200);
  await page.click('#surfaces [data-act=assign-material]'); await page.waitForTimeout(150);
  await page.click('#surfaces [data-card] [data-pick=deck-wood]'); await page.waitForTimeout(250);
  check('Assign material later counts the zone', (await shapeFill(z1)).includes(`zone-${z1}`) && /Deck wood \| [\d,]+ sq ft/.test(await sheet()), await shapeFill(z1));

  // ---- Material first, then draw ----
  await esc(); await addVia(page, 'surfaces', 'premium-sod');
  check('Picking a material closes the grid and keeps drawing', !(await popOpen()), '');
  await drag([430, 170], [490, 230]);
  const z3 = (await zoneIds()).find(id => id !== z1 && id !== z2);
  check('Material first, then draw: that material', !!z3 && !(await page.$('#material-search')) && /Premium sod \| [\d,]+ sq ft/.test(await sheet()), z3 ?? 'no zone');
  await esc();

  // ---- Add: one search over every kind; a query ignores the tag; Recent ----
  await openTool(page, 'add');
  check('Add opens on All', (await pressedTag()) === 'All', await pressedTag());
  await page.fill('#tool-search', 'sod'); await page.waitForTimeout(100);
  check('Add finds a material with one query ("sod")', (await picks()).includes('premium-sod'), (await picks()).join());
  await page.fill('#tool-search', 'spruce'); await page.waitForTimeout(100);
  check('Add finds a plant with one query ("spruce")', (await picks()).includes('blue-diamond-spruce'), (await picks()).join());
  await page.fill('#tool-search', ''); await page.click('#add .chip[data-tag="Edges & walls"]'); await page.waitForTimeout(100);
  const linesOnly = await picks();
  await page.fill('#tool-search', 'sod'); await page.waitForTimeout(100);
  check('A typed query ignores the active tag (Edges & walls + "sod" finds sod)', !linesOnly.includes('premium-sod') && (await picks()).includes('premium-sod'), `${linesOnly.length} edges · ${(await picks()).join()}`);
  await page.fill('#tool-search', ''); await page.click('#add .chip[data-tag=Recent]'); await page.waitForTimeout(100);
  const recent = await picks();
  check('Recent shows the last picks, newest first', recent[0] === 'premium-sod' && recent.includes('deck-wood') && recent.includes('wood-mulch'), recent.join());
  await esc();

  // ---- Edge and Plant ----
  await addVia(page, 'lines', 'wood-privacy-fence');
  check('Edge: picking the fence starts a line', !!(await page.$('[data-act=finish-line]')) && !(await popOpen()), '');
  await esc(); await esc();
  await addVia(page, 'symbols', 'blue-diamond-spruce');
  check('Plant: picking a spruce arms placing', !!(await page.$('[data-act=stop-placing]')), '');
  await tap([300, 450]);
  check('…and a tap drops one', (await page.$$('.overlay image.symbol[data-id]')).length === 1, `${(await page.$$('.overlay image.symbol[data-id]')).length} placed`);
  await page.click('[data-act=stop-placing]'); await page.waitForTimeout(150); await esc();

  // ---- Duplicate as surface ----
  await page.click('#outlines [data-feature=House]'); await drag([420, 300], [520, 380]); await esc();
  if (!(await page.$('#outlines [data-feature=Patio]'))) await page.click('#outlines [data-act=name]');
  const quick = await page.$('#outlines [data-feature=Patio]');
  if (quick) await quick.click(); else { await page.fill('#outline-name', 'Patio'); await page.press('#outline-name', 'Enter'); }
  await drag([280, 520], [380, 600]); await esc();
  const outlineNames = () => page.$$eval('#outlines .layer-name, #outlines .layer-rename', e => e.map(x => (x.value || x.textContent).trim()));
  await page.click('#outlines .layer-row:has-text("House")').catch(() => {}); await page.waitForTimeout(200);
  const houseCard = await page.$eval('#outlines [data-card]', c => c.innerText).catch(() => '');
  check('The House card has no Duplicate as surface', /House/.test(houseCard) || !!(await page.$('#outline-rename')), houseCard.slice(0, 40));
  check('…(no duplicate action on it)', !(await page.$('#outlines [data-card] [data-act=duplicate-surface]')), '');
  await esc(); await page.click('#outlines .layer-row:has-text("Patio")'); await page.waitForTimeout(200);
  const dup = await page.$('#outlines [data-card] [data-act=duplicate-surface]');
  check('A custom outline (Patio) offers Duplicate as surface', !!dup && (await dup.getAttribute('aria-label')) === 'Duplicate as surface', '');
  const zonesBefore = (await zoneIds()).length;
  if (dup) { await dup.click(); await page.waitForTimeout(300); }
  check('Duplicate adds one zone and keeps the outline', (await zoneIds()).length === zonesBefore + 1 && (await outlineNames()).includes('Patio'), `${zonesBefore} → ${(await zoneIds()).length} zones · outlines ${(await outlineNames()).join(', ')}`);
  check('…and opens the new zone\'s material grid', !!(await page.$('#material-search')), '');
  await page.focus('#material-search'); await esc(); await esc();
  await page.click('#outlines [data-layer=boundary]'); await page.waitForTimeout(200);
  check('The plot boundary card has no Duplicate', !(await page.$('#outlines [data-card] [data-act=duplicate-surface]')) && !!(await page.$('#outlines [data-card=boundary] [data-act=fill-plot]')), 'Fill the plot on the boundary card');
  await esc();

  // ---- Fill the plot: only with a closed boundary ----
  await page.click('#outlines [data-layer=boundary]'); await page.click('#outlines [data-card=boundary] [data-act=redraw]'); await page.waitForTimeout(200);
  let offered = false;
  if (await active()) { await openTool(page, 'surfaces'); offered = await fillCell(); await esc(); }
  check('While the boundary is redrawn (open), Fill the plot is not offered', !offered && !(await page.$('#outlines [data-act=fill-plot]')), `tools active ${await active()}`);
  await page.click('#outlines [data-act=cancel]'); await page.waitForTimeout(200); await esc();
  await openTool(page, 'surfaces');
  check('Boundary closed again: Fill the plot leads the Surface grid', await fillCell(), '');
  await page.click('#add .tool-grid [data-act=fill-plot]'); await page.waitForTimeout(250);
  check('Tapping it opens the boundary card\'s grid', !(await popOpen()) && !!(await page.$('#fill-search')), '');
  await page.click('#outlines [data-pick=white-river-rock]'); await page.waitForTimeout(300);
  check('Picking fills the plot', (await page.$$('.overlay path[data-id=fill]')).length >= 1 && /White river rock \| [\d,]+ sq ft/.test(await sheet()), '');
  await esc(); await openTool(page, 'surfaces');
  check('Once filled, Fill the plot is no longer offered', !(await fillCell()), '');
  await esc(); await esc();
  await page.screenshot({ path: `${outDir}/tools-end.png` });
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); }
check('No page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
process.exit(results.some(r => /^FAIL/.test(r[1]) || r[0] === 'STOPPED') ? 1 : 0);
