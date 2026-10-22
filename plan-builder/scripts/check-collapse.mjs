// Collapsible Layers sections on Riesberg: collapsed headers show counts (Outlines = boundary + features, not the
// plot plan); the plot plan collapses with Outlines; selecting a layer on the plan opens its section; the state
// survives a reload.
// Usage: node scripts/check-collapse.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';
import { addVia } from './lib/add.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = [];
const open = async () => {
  await openPlan(page, pdf);
};
await page.goto(url); await page.waitForTimeout(3500);
await page.evaluate(() => { localStorage.setItem('plan-builder.shape.outline', 'rect'); localStorage.removeItem('plan-builder.sections'); });
await page.reload(); await page.waitForTimeout(3500);
await open();
await page.$eval('#snap', b => b.click());
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 1008]; }, [x, y]);
const drag = async (p, q) => { const a = await toScreen(p), b = await toScreen(q); await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200); };
const head = g => page.$eval(`.group-head[data-group=${g}]`, b => `${b.getAttribute('aria-expanded') === 'true' ? 'open' : 'closed'} "${b.textContent.replace(/\s+/g, ' ').trim()}"`);
const planShown = () => page.$eval('#plan-opacity', e => e.checkVisibility());

try {
  results.push(['Start', `surfaces ${await head('surfaces')} · outlines ${await head('outlines')} · plot plan shown ${await planShown()}`]);
  await page.click('[data-start=boundary]'); await drag([250, 150], [550, 650]); await page.keyboard.press('Escape');
  await page.mouse.click(...await toScreen([250, 560])); await page.waitForTimeout(450); await page.$eval('#edge-len', (e, v) => { e.value = v; }, '100'); await page.click('.popover button[type=submit]'); await page.keyboard.press('Escape'); // the scale unlocks + Add
  await page.click('#outlines [data-feature=House]'); await drag([400, 200], [500, 300]); await page.keyboard.press('Escape');
  await addVia(page, 'surfaces'); await page.click('#surfaces .layer-form [data-material=premium-sod]'); await drag([280, 420], [520, 600]); await page.keyboard.press('Escape');

  await page.click('.group-head[data-group=outlines]');
  results.push(['Collapse Outlines', `${await head('outlines')} (expect "· 2") · plot plan shown ${await planShown()}`]);
  await page.click('.group-head[data-group=surfaces]');
  results.push(['Collapse Surfaces', `${await head('surfaces')} (expect "· 1")`]);
  await page.screenshot({ path: `${outDir}/collapse.png` });

  await page.mouse.click(...await toScreen([450, 250])); await page.waitForTimeout(200); // tap inside the house
  results.push(['Tap the house on the plan', `outlines ${await head('outlines')} · card ${await page.$eval('#outline-rename', e => e.value).catch(() => 'none')} · surfaces ${await head('surfaces')}`]);
  await page.click('.group-head[data-group=outlines]');
  results.push(['Collapse again with the house still selected', await head('outlines')]);

  await page.reload(); await page.waitForTimeout(3500); await open();
  results.push(['After reload', `surfaces ${await head('surfaces')} · outlines ${await head('outlines')}`]);
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); }
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
