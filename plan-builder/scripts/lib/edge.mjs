// Shared by the check scripts: types a length into the selected edge's chip and submits it. Opens the field first when the
// chip shows only the length button. On a touch screen (coarse pointer) the field is readonly: the digits are set directly
// and the keypad's Done key submits; with a mouse the field takes real typing and Enter submits.
export async function setEdgeLength(page, feet) {
  const edit = await page.$('.edge-chip [data-act=edit-length]');
  if (edit) await edit.click();
  const done = await page.$('.edge-chip .keypad-key[data-key=done]');
  if (done) {
    await page.$eval('#edge-len', (e, v) => { e.value = v; }, String(feet));
    await done.click();
  } else {
    await page.fill('#edge-len', String(feet));
    await page.press('#edge-len', 'Enter');
  }
}
