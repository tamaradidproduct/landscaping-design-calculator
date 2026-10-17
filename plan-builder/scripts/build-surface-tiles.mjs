// Builds src/assets/surfaces/<id>.webp (and thumbs/<id>.webp) from 4× exports of the Figma symbols (the Figma MCP's
// download_assets with defaultScale 4 on each Surfaces symbol, saved as <exportDir>/<id>.png), and records each tile's
// average colour in edges.json (a zone's edge colour). The export is the swatch as designed (image adjustments
// included), which the raw source images are not. A symbol is 184 × 214 pt: a 30 pt card title, then a 184 pt square.
// Usage: node scripts/build-surface-tiles.mjs <exportDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { SURFACE_SOURCES } from './surface-sources.mjs';

const K = 4, SWATCH = 184 * K, TITLE = 30 * K, FULL_H = 214 * K; // export scale, swatch edge and title height in px
const INSET = 6 * K; // trims the swatches' drop shadow and dashed border
const THUMB = 64;    // swatch thumbnail edge in px
const [dir] = process.argv.slice(2);
if (!dir) { console.error('Usage: node scripts/build-surface-tiles.mjs <exportDir>'); process.exit(1); }
const out = new URL('../src/assets/surfaces/', import.meta.url).pathname;
mkdirSync(`${out}thumbs`, { recursive: true });

const hex = n => Math.round(n).toString(16).padStart(2, '0');
const edges = {};
for (const m of SURFACE_SOURCES) {
  const file = `${dir}/${m.id}.png`, { width, height } = await sharp(file).metadata();
  // Effects (a shadow) widen the export evenly around the symbol's 736 × 856 box.
  const dx = (width - SWATCH) >> 1, dy = (height - FULL_H) >> 1, side = SWATCH - 2 * INSET;
  const cut = await sharp(file).extract({ left: dx + INSET, top: dy + TITLE + INSET, width: side, height: side }).png().toBuffer();
  await sharp(cut).webp({ quality: 72 }).toFile(`${out}${m.id}.webp`);
  await sharp(cut).resize(THUMB).webp({ quality: 70 }).toFile(`${out}thumbs/${m.id}.webp`);
  const { channels } = await sharp(cut).stats();
  edges[m.id] = `#${hex(channels[0].mean)}${hex(channels[1].mean)}${hex(channels[2].mean)}`;
}
writeFileSync(`${out}edges.json`, JSON.stringify(edges, null, 2) + '\n');
console.log(`${SURFACE_SOURCES.length} tiles (${SWATCH - 2 * INSET} px) written to ${out}`);
