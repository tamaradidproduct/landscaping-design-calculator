// Shared by the check scripts: the global + Add menu (ready once the scale is set). type: 'symbols' | 'lines' | 'surfaces'.
export async function addVia(page, type) {
  await page.click('#add-button');
  await page.click(`#add [data-add=${type}]`);
}

/** Runs `read(page)` with the Layers panel in Preview (the Sheet view) (the plan's contents as the customer sheet shows them), then back on Edit. */
export async function onSheet(page, read) {
  await page.click('[data-view=preview]');
  try { return await read(page); } finally { await page.click('[data-view=edit]'); }
}
