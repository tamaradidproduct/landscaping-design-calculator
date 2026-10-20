// Moving lines like zones and objects, and outline labels that scale with the plan (memory store): press and drag a line's body to move
// the whole run (a tap still selects it; a drag elsewhere pans), ⌘Z puts it back, arrow keys nudge it; the House label grows and shrinks with zoom.
// Usage: node scripts/check-move-lines.mjs <riesberg.pdf> [url] [outDir]
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
const drag = async (a, b) => { await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300); };
const pointsAt = () => page.$$eval('.overlay .line-point', c => c.map(x => [+x.getAttribute('cx'), +x.getAttribute('cy')]));
const labelPx = () => page.$eval('.overlay text.label.feature', t => parseFloat(getComputedStyle(t).fontSize));
try {
  await page.click('[data-start=boundary]'); await drag(await at(0.2, 0.2), await at(0.9, 0.9)); await page.keyboard.press('Escape');
  // A feature label, at fit and zoomed
  await page.click('[data-feature=House]'); await drag(await at(0.4, 0.4), await at(0.6, 0.6)); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const fit = await labelPx();
  await page.click('#zoom-in'); await page.click('#zoom-in'); await page.waitForTimeout(400);
  const zin = await labelPx();
  check('The House label grows when zoomed in', zin > fit * 1.3, `${fit}px → ${zin}px`);
  await page.click('#fit'); await page.waitForTimeout(400);
  check('…and returns at fit', Math.abs((await labelPx()) - fit) < 0.2, `${await labelPx()}px`);
  // A line: draw, then move it
  await page.click('[data-act=add-line]'); await page.click('#line-results [data-line-item=wood-privacy-fence]');
  for (const f of [[0.3, 0.75], [0.55, 0.75], [0.7, 0.85]]) { await page.mouse.click(...await at(...f)); await page.waitForTimeout(450); }
  await page.click('[data-act=finish-line]'); await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const before = (await page.$eval('#page', e => e.getBoundingClientRect().left)), pBefore = await (async () => { await page.mouse.click(...await at(0.4, 0.75)); await page.waitForTimeout(250); return pointsAt(); })();
  check('A tap on the line body selects it (3 points shown)', pBefore.length === 3, `${pBefore.length} points`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  // Press on the body, drag 70 px right and 40 px down
  const [sx, sy] = await at(0.4, 0.75); await drag([sx, sy], [sx + 70, sy + 40]);
  const pAfter = await pointsAt();
  check('Dragging the body moves every point by the drag', pAfter.length === 3 && pAfter.every((p, i) => Math.abs(p[0] - pBefore[i][0] - 70) < 3 && Math.abs(p[1] - pBefore[i][1] - 40) < 3), pAfter.map((p, i) => `Δ${(p[0] - pBefore[i][0]).toFixed(0)},${(p[1] - pBefore[i][1]).toFixed(0)}`).join(' '));
  check('…and the plan did not pan', Math.abs((await page.$eval('#page', e => e.getBoundingClientRect().left)) - before) < 1, 'page left unchanged');
  check('The moved line stays selected (card shown)', !!(await page.$('#lines [data-act=width-up]')), 'card open');
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
  const pBack = await pointsAt();
  check('⌘Z puts it back as one step', pBack.length === 3 && pBack.every((p, i) => Math.abs(p[0] - pBefore[i][0]) < 2 && Math.abs(p[1] - pBefore[i][1]) < 2), 'original place');
  // Arrow keys nudge
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowDown'); await page.waitForTimeout(250);
  const pNudge = await pointsAt();
  check('Arrow keys nudge the line (2 px right, 10 px down; Shift is ×10)', Math.abs(pNudge[0][0] - pBefore[0][0] - 2) < 2 && Math.abs(pNudge[0][1] - pBefore[0][1] - 10) < 2, `Δ${(pNudge[0][0] - pBefore[0][0]).toFixed(0)},${(pNudge[0][1] - pBefore[0][1]).toFixed(0)}`);
  // A drag away from the line pans
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const l0 = await page.$eval('#page', e => e.getBoundingClientRect().left);
  await drag(await at(0.12, 0.3), [(await at(0.12, 0.3))[0] + 50, (await at(0.12, 0.3))[1]]);
  check('A drag that starts off the line still pans', Math.abs((await page.$eval('#page', e => e.getBoundingClientRect().left)) - l0) > 30, 'plan moved');
  await page.screenshot({ path: `${outDir}/move-lines-end.png` });
} catch (e) { results.push(['STOPPED', e.message.split('\n')[0]]); }
check('No page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'none');
console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
