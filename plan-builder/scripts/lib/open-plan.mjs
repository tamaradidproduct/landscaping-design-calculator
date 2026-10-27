// Shared by the check scripts: start a plan through the Plans screen's New plan flow (type the address, pick the PDF, confirm).
// Needs the dev server with ?store=memory (skips sign-in; plans live only in this page load).
export async function openPlan(page, pdfPath, address = 'Riesberg test') {
  page.setDefaultTimeout(120000); // a busy machine renders the plan slowly; 30 s clicks time out mid-run
  await page.click('#new-plan');
  await page.fill('#new-address', address);
  await page.setInputFiles('#file', pdfPath);
  await page.click('#create-plan');
  await page.waitForFunction(() => document.getElementById('toast').textContent.startsWith('Opened'), null, { timeout: 180000 }); // a cold PDFium start on a busy machine can take over a minute
}
