// Drag-to-reorder of layer rows: the grip drags (mouse and touch), one undo step, Escape cancels, Alt+arrows on the grip move a layer.
// Usage: node scripts/check-reorder.mjs <plot-plan.pdf> [url]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [], check = (name, ok, got) => results.push([name, `${ok ? 'ok' : 'FAIL'} · ${got}`]);
const errors = [];
const context = await browser.newContext({ viewport: { width: 1180, height: 900 }, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
await page.goto(url); await page.waitForTimeout(3500);
await page.evaluate(() => localStorage.setItem('plan-builder.shape.outline', 'rect')); await page.reload(); await page.waitForTimeout(3500);
await openPlan(page, pdf);
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 792]; }, [x, y]);
const dragRect = async (a, b) => { const [ax, ay] = await toScreen(a), [bx, by] = await toScreen(b); await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(150); };
await page.click('[data-start=boundary]'); await dragRect([250, 150], [550, 650]);
await page.mouse.click(...await toScreen([250, 560])); await page.waitForTimeout(450);
await page.$eval('#edge-len', (e, v) => { e.value = v; }, '100'); await page.click('.popover button[type=submit]'); await page.keyboard.press('Escape');
const names = ['House', 'Driveway', 'Pool'];
for (const [i, n] of names.entries()) {
  if (i === 0) await page.click('#outlines button.suggest[data-feature]');
  else { await page.click('#outlines [data-act=name]'); await page.fill('#outline-name', n); await page.click('#outlines form button[type=submit]'); }
  await dragRect([270, 170 + i * 60], [330, 210 + i * 60]);
}
const order = () => page.$$eval('#outlines .layer-item [data-layer]', b => b.map(x => x.textContent.trim().split(/\s/)[0]).join(','));
const [N1, N2, N3] = names;
const grip = n => page.locator(`#outlines .layer-item:has(.layer-name:text-is("${n}")) [data-grip]`);
check('three features in drawing order', (await order()).endsWith(names.join(',')), await order());
const hit = await grip(N3).boundingBox();
check('grip hit area is at least 44px', hit.width >= 44 && hit.height >= 44, `${hit.width}x${hit.height}`);
check('grip has touch-action none', await grip(N3).evaluate(e => getComputedStyle(e).touchAction) === 'none', '');
// Mouse drag: last feature's grip above the first
const to = async (from, target, frac = 0.25, end = true) => {
  const g = await grip(from).boundingBox(), t = await page.locator(`#outlines .layer-item:has(.layer-name:text-is("${target}"))`).boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2, t.y + t.height * frac, { steps: 8 });
  return end;
};
await to(N3, N1);
check('drop line shows while dragging', await page.locator('#outlines .layer-item.drop-before').count() === 1 && await page.locator('#outlines .layer-item.dragging').count() === 1, '');
await page.mouse.up(); await page.waitForTimeout(250);
check('drag moves Pool above House', (await order()).endsWith([N3,N1,N2].join(',')), await order());
await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
check('one ⌘Z restores the order', (await order()).endsWith(names.join(',')), await order());
await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(250); await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
// Escape mid-drag
await to(N3, N1); await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(250);
check('Escape mid-drag cancels', (await order()).endsWith(names.join(',')) && await page.locator('#outlines .dragging, #outlines .drop-before').count() === 0, await order());
// Cancelled drag adds no undo step: undo count unchanged (⌘Z now should undo the last feature, not a reorder)
// Drop at the end
await to(N1, N3, 0.9); await page.mouse.up(); await page.waitForTimeout(250);
check('drop below the last row moves to the end', (await order()).endsWith([N2,N3,N1].join(',')), await order());
await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
check('undo restores again', (await order()).endsWith(names.join(',')), await order());
// Drag onto itself/unchanged spot: no undo step
await to(N2, N2, 0.5); await page.mouse.up(); await page.waitForTimeout(250);
await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
check('no-op drag adds no undo step (⌘Z undoes the Pool outline instead)', !(await order()).includes(N3), await order());
await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(250);
// Keyboard
await grip(N3).focus(); await page.keyboard.press('Alt+ArrowUp'); await page.waitForTimeout(200);
check('Alt+ArrowUp moves Pool up one', (await order()).endsWith([N1,N3,N2].join(',')), await order());
check('grip keeps focus after the move', await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === `Reorder ${N3}`, '');
await page.keyboard.press('Alt+ArrowDown'); await page.waitForTimeout(200);
check('Alt+ArrowDown moves it back', (await order()).endsWith(names.join(',')), await order());
// Touch drag via CDP
const cdp = await context.newCDPSession(page);
const g = await grip(N3).boundingBox(), t = await page.locator(`#outlines .layer-item:has(.layer-name:text-is("${N1}"))`).boundingBox();
const gx = g.x + g.width / 2, gy = g.y + g.height / 2, ty = t.y + t.height * 0.25;
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: gx, y: gy }] });
for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: gx, y: gy + (ty - gy) * i / 8 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(250);
check('touch drag moves Pool above House', (await order()).endsWith([N3,N1,N2].join(',')), await order());
check('no page errors', errors.length === 0, errors.join(' | '));
for (const [n, r] of results) console.log(`${r.startsWith('ok') ? 'PASS' : 'FAIL'}  ${n}  (${r})`);
await browser.close();
process.exit(results.some(([, r]) => r.startsWith('FAIL')) ? 1 : 0);
