// #61: the edge-length field takes physical-keyboard typing on a mouse/trackpad device (no on-screen keypad) and stays
// readonly with the keypad on a touch-primary device (iPad).
// Usage: node scripts/check-length-keyboard.mjs <riesberg.pdf> [url]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';
const [pdf, url = 'http://localhost:5180/?store=memory'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const C = { TL: [180, 250], TR: [420, 250], BR: [420, 450], BL: [180, 450] };

async function openEdgeField(ctx, touch) {
  const page = await ctx.newPage();
  await page.goto(url); await page.waitForTimeout(3500);
  await openPlan(page, pdf);
  const at = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 1008]; }, [x, y]);
  await page.click('[data-start=boundary]');
  for (const k of ['TL', 'TR', 'BR', 'BL']) { await page.mouse.click(...await at(C[k])); await page.waitForTimeout(150); }
  await page.click('#outlines [data-act=close]');
  await page.mouse.click(...await at([300, 250])); await page.waitForTimeout(200);
  await page.click('.edge-chip [data-act=edit-length]');
  return page;
}

// Desktop: fine pointer + hover.
const desk = await openEdgeField(await browser.newContext({ viewport: { width: 1180, height: 820 } }), false);
results.push(['Desktop: field editable, no keypad', JSON.stringify({ readonly: await desk.$eval('#edge-len', e => e.readOnly), keypad: await desk.$$eval('.keypad', k => k.length) })]);
await desk.fill('#edge-len', '');
await desk.keyboard.type(`116' 5a-"`);
results.push(['Desktop: typed value filtered', await desk.inputValue('#edge-len')]);
await desk.keyboard.press('Escape');
results.push(['Desktop: Esc cancels', String(await desk.$('.edge-chip [data-act=edit-length]') !== null)]);
await desk.click('.edge-chip [data-act=edit-length]');
await desk.keyboard.type('116.45'); await desk.keyboard.press('Enter'); await desk.waitForTimeout(300);
results.push(['Desktop: Enter commits', await desk.textContent('#toast')]);

// Touch: coarse pointer, no hover.
const tch = await openEdgeField(await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true }), true);
results.push(['Touch: field readonly, keypad shown', JSON.stringify({ readonly: await tch.$eval('#edge-len', e => e.readOnly), keypad: await tch.$$eval('.keypad', k => k.length) })]);

for (const r of results) console.log(r.join(' → '));
await browser.close();
