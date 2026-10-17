// Rectangle tool on Riesberg: the Corners | Rectangle bar shows only while drawing; a drag from corner to
// corner makes a closed 4-corner outline square to the plan; tap-then-tap works too; a tiny drag is refused;
// switching tools (or X) mid-shape starts over (⌘Z brings the corner back); the choice is remembered.
// Usage: node scripts/check-rect.mjs <riesberg.pdf> [url] [outDir]
import { chromium } from 'playwright-core';
import { openPlan } from './lib/open-plan.mjs';

const [pdf, url = 'http://localhost:5180/?store=memory', outDir = '.'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2 });
const results = [];
const open = async () => {
  await openPlan(page, pdf);
  await page.$eval('#snap', b => b.click()); // exact placement
};
await page.goto(url); await page.waitForTimeout(3500);
await page.evaluate(() => { localStorage.removeItem('plan-builder.shape.outline'); localStorage.removeItem('plan-builder.shape.surface'); });
await open();
const toScreen = ([x, y]) => page.evaluate(([x, y]) => { const r = document.getElementById('page').getBoundingClientRect(); return [r.left + x * r.width / 612, r.top + y * r.height / 1008]; }, [x, y]);
const corners = () => page.$$eval('.overlay .corner', cs => cs.map(c => [+c.getAttribute('cx'), +c.getAttribute('cy')]));
const closedShapes = () => page.$$eval('.overlay .shape.closed', s => s.length);
const bar = () => page.evaluate(() => document.getElementById('shape').hidden ? 'hidden' : [...document.querySelectorAll('#shape [aria-pressed=true]')].map(b => b.textContent).join());
const square = cs => cs.length === 4 && cs.every((c, i) => { const n = cs[(i + 1) % 4]; return Math.abs(c[0] - n[0]) < 0.01 || Math.abs(c[1] - n[1]) < 0.01; });

results.push(['Bar before drawing', await bar()]);
await page.click('[data-feature=House]');
results.push(['Bar while drawing', await bar()]);
await page.click('#shape [data-shape=rect]');
results.push(['Pick Rectangle', `${await bar()} · card: ${await page.textContent('#outlines .layer-body .text-hint')}`]);

// Drag from one corner of the house to the opposite one.
const a = await toScreen([300, 300]), b = await toScreen([420, 410]);
await page.mouse.move(...a); await page.mouse.down(); await page.mouse.move(...b, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(200);
const house = await corners();
results.push(['Drag corner to corner', `closed shapes ${await closedShapes()} · ${house.length} corners · square to the plan: ${square(house)} · bar ${await bar()}`]);

// A tiny drag is refused, then tap-then-tap.
await page.click('[data-start=boundary]');
const c = await toScreen([253, 213]);
await page.mouse.move(...c); await page.mouse.down(); await page.mouse.move(c[0] + 7, c[1] + 5, { steps: 3 }); await page.mouse.up(); await page.waitForTimeout(150);
results.push(['Tiny rectangle', `${await page.textContent('#toast')} · closed shapes ${await closedShapes()}`]);
await page.click('#outlines [data-act=cancel]');
await page.click('[data-start=boundary]');
await page.mouse.click(...await toScreen([253, 213])); await page.waitForTimeout(400);
results.push(['Tap the first corner', await page.textContent('#outlines .layer-body .text-hint')]);
await page.mouse.click(...await toScreen([500, 545])); await page.waitForTimeout(200);
results.push(['Tap the opposite corner', `closed shapes ${await closedShapes()} · square to the plan: ${square(await corners())}`]);

// Switching tools mid-shape starts over; ⌘Z brings the corner back.
await page.click('#outlines [data-act=name]'); await page.click('#outlines [data-feature=Driveway]');
await page.mouse.click(...await toScreen([330, 470])); await page.waitForTimeout(400);
const dots = () => page.$$eval('.overlay .corner', cs => cs.length);
const before = await dots();
await page.click('#shape [data-shape=freehand]'); await page.waitForTimeout(150);
const after = await dots();
await page.keyboard.press('Meta+z'); await page.waitForTimeout(150);
results.push(['Switch to Freehand mid-rectangle', `corners on the outline: ${before} → ${after} · ⌘Z → ${await dots()} · bar ${await bar()}`]);
await page.screenshot({ path: `${outDir}/rect.png` });

// The pointer shows which tool is on: a dot for Freehand; a ⌐ and dashed guides across the plan for Rectangle.
const pointerMark = () => page.evaluate(() => [
  document.querySelector('.overlay .hover-dot') ? 'dot' : '', document.querySelector('.overlay .corner-bracket') ? '⌐' : '',
  document.querySelector('.overlay .rect-guide') ? 'guides' : '',
].filter(Boolean).join(' + '));
await page.mouse.move(...await toScreen([200, 700])); await page.waitForTimeout(100);
const markBefore = await pointerMark(), cursorCss = await page.$eval('#stage', s => getComputedStyle(s).cursor);
await page.screenshot({ path: `${outDir}/pointer-${(await bar()).toLowerCase()}.png`, clip: { x: (await toScreen([200, 700]))[0] - 60, y: (await toScreen([200, 700]))[1] - 60, width: 120, height: 120 } });
await page.keyboard.press('x'); await page.waitForTimeout(100);
results.push(['Pointer mark follows the tool', `${markBefore} → X → ${await pointerMark()} · cursor ${cursorCss}`]);
await page.screenshot({ path: `${outDir}/pointer-${(await bar()).toLowerCase()}.png`, clip: { x: (await toScreen([200, 700]))[0] - 60, y: (await toScreen([200, 700]))[1] - 60, width: 120, height: 120 } });
await page.keyboard.press('x'); await page.waitForTimeout(100);

// X switches tools.
await page.keyboard.press('x'); await page.waitForTimeout(100);
const afterX = await bar();
await page.keyboard.press('x'); await page.waitForTimeout(100);
results.push(['X switches tools', `${afterX} → ${await bar()}`]);

// Remembered on this device.
await page.click('#shape [data-shape=rect]');
await page.reload(); await page.waitForTimeout(3000); await open();
await page.click('#outlines [data-act=name]'); await page.click('#outlines [data-feature=Shed]');
results.push(['After reload', `bar ${await bar()}`]);

console.table(results.map(([check, result]) => ({ check, result })));
await browser.close();
