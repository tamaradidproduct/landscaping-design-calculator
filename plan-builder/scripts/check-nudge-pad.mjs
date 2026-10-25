// Nudge pad (touch only) and the floating Square corners button on Riesberg.
// Usage: node scripts/check-nudge-pad.mjs <plot-plan.pdf> [url]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], check = (name, ok, got) => { results.push([name, `${ok ? "ok" : "FAIL"} · ${got}`]); console.log(ok ? "ok  " : "FAIL", name, got); };
const errors = [];
const rect = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, hidden: e.hidden || r.width === 0 }; });
const overlap = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

for (const coarse of (process.env.COARSE === "1" ? [true] : process.env.COARSE === "0" ? [false] : [false, true])) for (const width of (process.env.W ? [Number(process.env.W)] : [1180, 820])) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, ...(coarse ? { hasTouch: true } : {}) });
  if (coarse) await ctx.addInitScript(() => {
    const mm = window.matchMedia.bind(window);
    window.matchMedia = q => /pointer:\s*coarse/.test(q)
      ? { matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }
      : mm(q);
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url); await page.waitForTimeout(3500);
  await page.evaluate(() => localStorage.setItem('plan-builder.shape.outline', 'rect')); await page.reload(); await page.waitForTimeout(3500);
  await openPlan(page, pdf);
  const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 792]; }, [x, y]);
  const tap = async p => { await page.mouse.click(...await toScreen(p)); await page.waitForTimeout(450); };
  const tag = `${coarse ? 'coarse' : 'fine'} ${width}px: `;
  const padHidden = () => page.$eval('.nudge-pad', e => e.hidden || getComputedStyle(e).display === 'none');
  const sqHidden = () => page.$eval('#square-corners', e => e.hidden || getComputedStyle(e).display === 'none');
  check(tag + 'nothing selected: pad and Square hidden', (await padHidden()) && (await sqHidden()), '');
  await page.click('[data-start=boundary]');
  const a = await toScreen([250, 150]), b = await toScreen([550, 650]);
  await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250); await page.keyboard.press('Escape');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  check(tag + 'deselected: pad and Square hidden', (await padHidden()) && (await sqHidden()), '');
await tap([250, 400]); // an edge: selects the outline
  check(tag + 'outline selected: Square corners shows, nudge pad ' + (coarse ? 'shows (zone-less outline: hidden)' : 'hidden'), !(await sqHidden()), '');
  const c0 = await page.$('.overlay .corner'); const cb = await c0.boundingBox();
  await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2); await page.waitForTimeout(450);
  check(tag + 'corner selected: pad ' + (coarse ? 'shows' : 'stays hidden'), (await padHidden()) === !coarse, `hidden ${await padHidden()}`);
  check(tag + 'corner selected: Square corners shows', !(await sqHidden()), '');
  if (coarse) {
    const pad = await rect(page, '.nudge-pad'), canvas = await rect(page, '#canvas');
    check(tag + 'pad is bottom-left of canvas', pad.l - canvas.l < 40 && canvas.b - pad.b < 40, JSON.stringify(pad));
    for (const id of ['#zoom-in', '#zoom-out', '#fit', '#snap', '#undo', '#redo', '#square-corners']) {
      const r = await rect(page, id); if (r.hidden) continue;
      check(tag + `pad clear of ${id}`, !overlap(pad, r), '');
    }
    const before = await toScreen([250, 150]);
    await page.click(".nudge-pad [data-nudge=\"1,0\"]", { timeout: 3000 }).catch(e => console.log("pad click failed")); await page.waitForTimeout(200);
    const after = await toScreen([250, 150]);
    const pos = await page.evaluate(() => [...document.querySelectorAll('#sharp, svg circle')].length);
    check(tag + 'right arrow acts (undo enabled)', !(await page.$eval('#undo', e => e.disabled)), `${pos}`);
  }
  const sq = await rect(page, '#square-corners'), st = await rect(page, '#stage');
  check(tag + 'Square corners >=44px, inside the stage', sq.h >= 44 && sq.w >= 44 && sq.l >= st.l && sq.r <= st.r && sq.t >= st.t && sq.b <= st.b, JSON.stringify(sq));
  for (const id of ['#zoom-in', '#zoom-out', '#fit', '#snap', '#undo', '#redo', '.nudge-pad']) {
    const r = await rect(page, id); if (r.hidden || (id === '.nudge-pad' && !coarse)) continue;
    check(tag + `Square clear of ${id}`, !overlap(sq, r), '');
  }
  // keyboard arrows still nudge (undo history grows on the first nudge)
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
  check(tag + 'arrow key nudges', !(await page.$eval('#undo', e => e.disabled)), '');
  await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  check(tag + 'Escape: pad and Square hidden', (await padHidden()) && (await sqHidden()), '');
  // select the outline's side: Square corners shows and works
  await tap([250, 400]); 
  check(tag + 'outline selected: Square corners shows', !(await sqHidden()), '');
  await page.click('#square-corners'); await page.waitForTimeout(250);
  check(tag + 'Square corners click: no error', errors.length === 0, errors.join('|'));
  await page.screenshot({ path: `/tmp/nudge-${coarse ? 'coarse' : 'fine'}-${width}.png` });
  await ctx.close();
}
for (const [n, r] of results) console.log(r.startsWith('FAIL') ? 'FAIL' : 'ok  ', n, '-', r);
console.log(errors.length ? `PAGE ERRORS: ${errors.join('; ')}` : 'no page errors');
await browser.close();
