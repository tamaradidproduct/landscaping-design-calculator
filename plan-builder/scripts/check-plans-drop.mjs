// Drop-to-New-plan flow (memory store). Usage: node scripts/check-plans-drop.mjs [url]
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const [url = 'http://localhost:5180/?store=memory'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const drop = (name, type) => page.evaluate(({ name, type }) => {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(new File(['plot plan'], name, { type }));
  const root = document.querySelector('#new-plan, #new-address').closest('.plans').parentElement;
  root.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
}, { name, type });

try {
  for (const [name, type] of [['job-plot.pdf', 'application/pdf'], ['job-plot.png', 'image/png']]) {
    await page.goto(url);
    await page.waitForSelector('#new-plan');
    await drop(name, type);
    assert.equal(await page.$eval('#new-address', el => document.activeElement === el), true, 'Drop focuses the naming field');
    assert.equal(await page.inputValue('#new-address'), 'job plot', 'Drop prefills the file name');
    assert.equal(await page.locator('#create-plan').count(), 1, 'Dropped file is attached');
    assert.equal(await page.locator('.plan-row').count(), 0, 'Drop does not create a plan');

    await page.fill('#new-address', 'Typed job name');
    await page.focus('#account');
    await drop('replacement.png', 'image/png');
    assert.equal(await page.inputValue('#new-address'), 'Typed job name', 'Another drop preserves the typed name');
    assert.equal(await page.$eval('#new-address', el => document.activeElement === el), false, 'An open form does not steal focus');

    await page.click('[data-act=new-cancel]');
    await page.click('#new-plan');
    assert.equal(await page.$eval('#new-address', el => document.activeElement === el), true, 'Button still focuses the naming field');
  }
  console.log('Plans drop checks passed (PDF and image).');
} finally {
  await browser.close();
}
