// Texture scale and show/hide on Riesberg (memory store): a zone's texture scale steps, resets and undoes; a layer's eye and a
// section's eye hide shapes (a hidden layer can't be tapped); the section eye leaves each layer's own eye alone; hidden
// layers stay hidden when the plan is closed and reopened.
// Usage: node scripts/check-visibility.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = [], check = (name, ok, got) => results.push([name, `${ok ? 'ok' : 'FAIL'} · ${got}`]);
await page.goto(url); await page.waitForTimeout(3500);
await page.evaluate(() => localStorage.setItem('plan-builder.shape.outline', 'rect'));
await page.reload(); await page.waitForTimeout(3500);
await openPlan(page, pdf);
await page.$eval('#snap', b => b.click());
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 1008]; }, [x, y]);
const drag = async (p, q) => { const a = await toScreen(p), b = await toScreen(q); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200); };
const tap = async p => { await page.mouse.click(...await toScreen(p)); await page.waitForTimeout(200); };
const shapes = () => page.$$eval('.overlay .shape.closed[data-id]', e => e.map(x => x.dataset.id).sort().join(','));
const pressed = sel => page.$eval(sel, b => b.getAttribute('aria-pressed'));
const tile = id => page.$eval(`#zone-defs pattern#zone-${id}`, p => Number(p.getAttribute('width')));
try {
  await page.click('[data-start=boundary]'); await drag([250, 150], [550, 650]); await page.keyboard.press('Escape');
  await page.click('[data-act=add-surface]'); await page.click('#surfaces [data-material=premium-sod]'); await drag([280, 180], [520, 400]);
  // Before any scale is set, the texture scale still works (and follows zoom).
  if (await page.$('#surfaces [data-zone=s1]')) await page.click('#surfaces [data-zone=s1]'); // else its card is already open
  const u0 = await tile('s1');
  await page.click('#surfaces [data-act=tex-up]'); await page.waitForTimeout(150);
  const u1 = await tile('s1');
  await page.click('#zoom-in'); await page.waitForTimeout(250);
  const u2 = await tile('s1');
  check('No scale yet: + still enlarges the texture', Math.abs(u1 / u0 - 1.25) < 0.001, `${u0.toFixed(1)} → ${u1.toFixed(1)}`);
  check('No scale yet: the texture follows zoom', u2 > u1 * 1.1, `${u1.toFixed(1)} → ${u2.toFixed(1)}`);
  await page.click('#surfaces [data-act=tex-reset]'); await page.click('#fit'); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  await tap([250, 560]); await page.fill('#edge-len', '100'); await page.click('.popover button[type=submit]'); await page.keyboard.press('Escape');
  await page.click('[data-act=add-surface]'); await page.click('#surfaces .layer-form [data-material=deck-wood]'); await drag([300, 420], [480, 620]); await page.keyboard.press('Escape');
  await page.click('#outlines [data-feature=House]'); await drag([400, 200], [500, 300]); await page.keyboard.press('Escape');

  // Texture scale (zone s2 = the deck): select it and step.
  await page.click('#surfaces [data-zone=s2]');
  const t0 = await tile('s2');
  await page.click('#surfaces [data-act=tex-up]'); await page.waitForTimeout(150);
  check('+ makes the texture 25% larger', Math.abs(await tile('s2') / t0 - 1.25) < 0.001, `${t0} → ${await tile('s2')} · readout ${await page.textContent('#surfaces [data-act=tex-reset]')}`);
  await page.click('#surfaces [data-act=tex-up]'); await page.click('#surfaces [data-act=tex-down]'); await page.click('#surfaces [data-act=tex-down]'); await page.waitForTimeout(150);
  check('− brings it back', Math.abs(await tile('s2') / t0 - 1) < 0.001, await page.textContent('#surfaces [data-act=tex-reset]'));
  await page.click('#surfaces [data-act=tex-up]'); await page.click('#surfaces [data-act=tex-reset]'); await page.waitForTimeout(150);
  check('Tapping the percent resets to 100%', await tile('s2') === t0, await page.textContent('#surfaces [data-act=tex-reset]'));
  await page.click('#surfaces [data-act=tex-up]'); await page.keyboard.press('Meta+z'); await page.waitForTimeout(200);
  check('⌘Z undoes a scale step', await tile('s2') === t0, `${await tile('s2')}`);
  await page.click('#surfaces [data-act=tex-up]');
  const other = await tile('s1');
  check('Another zone keeps its own scale', other === (await tile('s1')) && other !== (await tile('s2')), `s1 ${other} · s2 ${await tile('s2')}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);

  // Layer eyes.
  check('Everything shows to start', (await shapes()) === 's1,s2' || (await shapes()).includes('s1'), await shapes());
  await page.click('#surfaces [data-eye=s1]'); await page.waitForTimeout(150);
  const afterHide = await shapes();
  check('Hiding a zone removes its shape, not the others', !afterHide.includes('s1') && afterHide.includes('s2'), afterHide);
  check('Its eye reads off and its row dims', (await pressed('#surfaces [data-eye=s1]')) === 'false' && !!(await page.$('#surfaces .layer-row.off')), await pressed('#surfaces [data-eye=s1]'));
  await page.mouse.click(...await toScreen([300, 300])); await page.waitForTimeout(200);
  check('A hidden zone cannot be selected on the plan', !(await page.$('#surfaces [data-card]')), 'no card');
  await page.click('#surfaces [data-eye=s1]'); await page.waitForTimeout(150);
  check('Showing it brings the shape back', (await shapes()).includes('s1'), await shapes());

  // Section eyes leave each layer's own eye alone.
  await page.click('#surfaces [data-eye=s2]'); await page.click('[data-eye-group=surfaces]'); await page.waitForTimeout(150);
  check('Hiding Surfaces hides every zone', !(await shapes()).match(/s\d/), await shapes());
  await page.click('[data-eye-group=surfaces]'); await page.waitForTimeout(150);
  check('Showing Surfaces restores each zone\'s own state', (await shapes()).includes('s1') && !(await shapes()).includes('s2'), `${await shapes()} · s2 eye ${await pressed('#surfaces [data-eye=s2]')}`);
  await page.click('#surfaces [data-eye=s2]'); await page.waitForTimeout(150);
  await page.click('[data-eye-group=outlines]'); await page.waitForTimeout(150);
  check('Hiding Outlines hides the boundary and House', !(await page.$('.overlay .label.feature')) && (await pressed('[data-eye-group=outlines]')) === 'false', await shapes());
  await page.click('[data-eye-group=outlines]'); await page.waitForTimeout(150);

  // Saved with the plan.
  const houseEye = await page.$eval('#outlines [data-eye]:not([data-eye=boundary])', b => b.dataset.eye);
  await page.click(`#outlines [data-eye=${houseEye}]`); await page.click('[data-eye-group=surfaces]'); await page.waitForTimeout(1800);
  await page.click('#back-to-plans');
  await page.locator('.plan-row').first().waitFor();
  await page.evaluate(() => { document.getElementById('toast').textContent = ''; });
  await page.locator('.plan-row .plan-open').first().click();
  await page.waitForFunction(() => { const t = document.getElementById('toast'); return !t.hidden && t.textContent.startsWith('Opened'); }, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  check('Hidden layers and sections are still hidden after reopening', (await pressed('[data-eye-group=surfaces]')) === 'false' && (await pressed(`#outlines [data-eye=${houseEye}]`)) === 'false' && !(await page.$('.overlay .label.feature')), `${await shapes() || 'no zone shapes'}`);
  await page.click('[data-eye-group=surfaces]'); await page.waitForTimeout(300);
  await page.click('#surfaces [data-zone=s2]');
  check('Texture scale is still 125% after reopening', (await page.textContent('#surfaces [data-act=tex-reset]')) === '125%', await page.textContent('#surfaces [data-act=tex-reset]'));
  await page.screenshot({ path: `${outDir}/visibility-end.png` });
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); }
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
