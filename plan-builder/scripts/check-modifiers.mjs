// Modifier-key check: Shift (45° steps) and Option/Alt (place freely) follow the keys actually held,
// even when a keyup is missed (window loses focus, e.g. a ⇧⌘4 screenshot).
// Usage: node scripts/check-modifiers.mjs <plot-plan.pdf> [url]
import { chromium } from 'playwright-core';

const [pdf, url = 'http://localhost:5180/'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const results = [];
await page.goto(url); await page.waitForTimeout(3500);
await page.setInputFiles('#file', pdf);
await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('Opened'));

const label = () => page.$$eval('.overlay .label.snap', ts => ts.map(t => t.textContent).join(' ') || '(none)');
const check = async (name, fn) => { await fn(); await page.waitForTimeout(120); results.push([name, await label()]); };

await page.click('[data-start=boundary]');
await page.mouse.click(400, 300); await page.waitForTimeout(400);
await check('Hover, no keys', () => page.mouse.move(520, 340));
await check('Shift down', () => page.keyboard.down('Shift'));
await check('Window loses focus while Shift held (keyup never comes)', async () => {
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
});
await page.keyboard.up('Shift');
await check('Shift down again', () => page.keyboard.down('Shift'));
await check('Mouse moves with Shift no longer reported (missed keyup)', async () => {
  await page.evaluate(() => {
    const s = document.getElementById('stage'), r = s.getBoundingClientRect();
    s.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', pointerId: 1, clientX: r.left + 530, clientY: r.top + 345, shiftKey: false }));
  });
});
await page.keyboard.up('Shift');
await page.mouse.click(520, 340); await page.waitForTimeout(400);
const n = await page.$$eval('.overlay circle.corner', cs => cs.length);
results.push(['Tap after releasing Shift places a point', `${n} corners`]);

console.table(results.map(([check, result]) => ({ check, 'label shown': result })));
await browser.close();
