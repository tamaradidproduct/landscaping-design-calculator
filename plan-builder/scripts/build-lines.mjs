// Builds src/assets/lines/<id>.webp (the tile a drawn run is textured with), thumbs/<id>.webp and lines.json ({ w, h, color } per item:
// the tile's size in px and its mean colour, used for round caps). Input folders (see the Figma MCP):
//   <dir>/lines/<id>.png   download_assets of the line's card at scale 4 (the strip is cut out at its `strip` rectangle, 1× card coords)
//   <dir>/raw/<id>.png     for an item without a strip (the dry river): the stroke's raw source image, used whole
// Usage: node scripts/build-lines.mjs <dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { LINE_SOURCES } from './line-sources.mjs';

const K = 4, THUMB = 64;
const [dir] = process.argv.slice(2);
if (!dir) { console.error('Usage: node scripts/build-lines.mjs <dir>'); process.exit(1); }
const out = new URL('../src/assets/lines/', import.meta.url).pathname;
mkdirSync(`${out}thumbs`, { recursive: true });
const hex = n => Math.round(n).toString(16).padStart(2, '0');

const info = {};
for (const s of LINE_SOURCES) {
  const tile = s.strip
    ? await sharp(`${dir}/lines/${s.id}.png`).extract({ left: s.strip.x * K, top: s.strip.y * K, width: s.strip.w * K, height: s.strip.h * K }).png().toBuffer()
    : await sharp(`${dir}/raw/${s.id}.png`).resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  const { width: w, height: h } = await sharp(tile).metadata();
  await sharp(tile).webp({ quality: 80 }).toFile(`${out}${s.id}.webp`);
  // Thumbnail: a strip lies sideways across the middle of the square; a square tile is shown whole.
  const flat = s.strip ? await sharp(tile).rotate(90).resize({ height: 16 }).png().toBuffer() : await sharp(tile).resize(THUMB, THUMB).png().toBuffer();
  const side = s.strip ? await sharp(flat).extract({ left: 0, top: 0, width: Math.min(THUMB, (await sharp(flat).metadata()).width), height: 16 }).png().toBuffer() : flat;
  await sharp({ create: { width: THUMB, height: THUMB, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: side, left: 0, top: s.strip ? (THUMB - 16) >> 1 : 0 }]).webp({ quality: 75 }).toFile(`${out}thumbs/${s.id}.webp`);
  const { channels } = await sharp(tile).stats();
  const r = channels[0].mean, g = channels[1]?.mean ?? r, b = channels[2]?.mean ?? r;
  info[s.id] = { w, h, color: `#${hex(r)}${hex(g)}${hex(b)}` };
}
writeFileSync(`${out}lines.json`, JSON.stringify(info, null, 2) + '\n');
console.log(`${LINE_SOURCES.length} line tiles written to ${out}`);
