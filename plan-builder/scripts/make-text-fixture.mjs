// Writes test-fixtures/address-text.pdf: a one-page letter-size PDF with a text layer holding a site address.
import { mkdirSync, writeFileSync } from 'node:fs';

const stream = 'BT /F1 14 Tf 72 700 Td (Site Address: 12 Oak Ln, Denver, CO 80202) Tj ET';
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];

let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(pdf.length);
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = pdf.length;
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

const out = new URL('../test-fixtures/address-text.pdf', import.meta.url);
mkdirSync(new URL('../test-fixtures/', import.meta.url), { recursive: true });
writeFileSync(out, pdf, 'latin1');
