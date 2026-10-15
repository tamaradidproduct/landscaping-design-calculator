// Undo/redo check: dots on an unfinished outline, closing, dragging a corner, setting the scale.
// Usage: node scripts/check-undo.mjs <plot-plan.pdf> [url]
import { chromium } from 'playwright-core';

const [pdf, url = 'http://localhost:5180/'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const results = [];
await page.goto(url); await page.waitForTimeout(3500);
await page.setInputFiles('#file', pdf);
await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('Opened'));
await page.$eval('#snap', b => b.click()); // shown only while drawing; exact clicks

const dots = () => page.$$eval('.overlay circle.corner', cs => cs.map(c => `${Math.round(+c.getAttribute('cx'))},${Math.round(+c.getAttribute('cy'))}`).join(' '));
const state = async () => `${(await dots()) || '(none)'}${await page.evaluate(() => document.querySelector('.overlay .shape.closed') ? ' [closed]' : '')}`;
const step = async (label, fn) => { await fn(); await page.waitForTimeout(120); results.push([label, await state()]); };

await page.click('[data-start=boundary]');
await step('place dots 1-3', async () => { for (const [x, y] of [[400, 300], [600, 300], [600, 500]]) { await page.mouse.click(x, y); await page.waitForTimeout(400); } });
await step('⌘Z (undo dot 3)', () => page.keyboard.press('Meta+z'));
await step('⌘Z (undo dot 2)', () => page.keyboard.press('Meta+z'));
await step('⇧⌘Z (redo dot 2)', () => page.keyboard.press('Meta+Shift+z'));
await step('⇧⌘Z (redo dot 3)', () => page.keyboard.press('Meta+Shift+z'));
await step('⇧⌘Z again (nothing to redo)', () => page.keyboard.press('Meta+Shift+z'));
await step('place dot 4, close', async () => { await page.mouse.click(400, 500); await page.waitForTimeout(400); await page.click('#panel [data-act=close]'); });
await step('⌘Z (reopen: back to 4 dots, not closed)', () => page.keyboard.press('Meta+z'));
await step('⇧⌘Z (closed again)', () => page.keyboard.press('Meta+Shift+z'));
await step('drag corner 600,500 → 650,560', async () => { await page.mouse.move(600, 500); await page.mouse.down(); await page.mouse.move(650, 560, { steps: 4 }); await page.mouse.up(); });
await step('toolbar Undo (corner back)', () => page.click('#undo'));
await step('toolbar Redo (corner moved again)', () => page.click('#redo'));
results.push(['Undo/Redo buttons enabled', JSON.stringify(await page.evaluate(() => ({ undo: !document.getElementById('undo').disabled, redo: !document.getElementById('redo').disabled })))]);

console.table(results.map(([step, result]) => ({ step, result })));
await browser.close();
