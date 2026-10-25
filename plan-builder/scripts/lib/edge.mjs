// Shared by the check scripts: types a length into the selected edge's chip and presses the keypad's Done key.
// Opens the keypad first when the chip shows only the length button. Digits are set on the readonly field directly.
export async function setEdgeLength(page, feet) {
  const edit = await page.$('.edge-chip [data-act=edit-length]');
  if (edit) await edit.click();
  await page.$eval('#edge-len', (e, v) => { e.value = v; }, String(feet));
  await page.click('.edge-chip .keypad-key[data-key=done]');
}
