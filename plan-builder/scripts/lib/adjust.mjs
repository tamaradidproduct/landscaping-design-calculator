// Shared by the check scripts: opens the surface card's "Shape and texture" disclosure (closed by default, and again whenever the selection changes).
export async function openAdjust(page) {
  const head = await page.$('[data-disclosure=adjust]');
  if (head && (await head.getAttribute('aria-expanded')) === 'false') { await head.click(); await page.waitForTimeout(150); }
}
