// Cuts the surface swatches out of a screenshot of the Figma Surfaces section (get_screenshot of node 170:1977 at
// the largest size it gives, which has 40 px of margin) into src/assets/surfaces/<id>.webp, and records each tile's
// average colour in edges.json (a zone's edge colour).
// Usage: node scripts/build-surface-tiles.mjs <sheet.png>
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { SURFACE_SOURCES } from './surface-sources.mjs';

const MARGIN = 40, TITLE = 30, SIZE = 184, INSET = 6; // INSET trims the swatches' drop shadow and dashed border
const [sheet] = process.argv.slice(2);
if (!sheet) { console.error('Usage: node scripts/build-surface-tiles.mjs <sheet.png>'); process.exit(1); }
const out = new URL('../src/assets/surfaces/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const hex = n => Math.round(n).toString(16).padStart(2, '0');
const edges = {};
for (const m of SURFACE_SOURCES) {
  const region = { left: MARGIN + m.x + INSET, top: MARGIN + m.y + TITLE + INSET, width: SIZE - 2 * INSET, height: SIZE - 2 * INSET };
  const cut = await sharp(sheet).extract(region).png().toBuffer(); // stats() ignores a pending extract, so cut first
  await sharp(cut).webp({ quality: 80 }).toFile(`${out}${m.id}.webp`);
  const { channels } = await sharp(cut).stats();
  edges[m.id] = `#${hex(channels[0].mean)}${hex(channels[1].mean)}${hex(channels[2].mean)}`;
}
writeFileSync(`${out}edges.json`, JSON.stringify(edges, null, 2) + '\n');
console.log(`${SURFACE_SOURCES.length} tiles written to ${out}`);
