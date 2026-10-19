// Builds the symbol assets from Figma exports: src/assets/symbols/<id>.webp (plan art, transparent), photos/<id>.webp (plants) and
// thumbs/<id>.webp, plus symbols.json (each art's aspect ratio). Input folders (see the Figma MCP):
//   <dir>/art/<id>.png    download_assets of the card's plan-art node at scale 4 (a render on white, shadow included)
//   <dir>/photo/<id>.png  get_screenshot of the card's Image frame
// The white behind the art is removed by flood fill from the border (so white petals inside stay); the soft grey shadow next to
// it becomes translucent black. Neutral grey art (stones, metal) skips the shadow step (NO_SHADOW) so its rim isn't turned clear.
// Usage: node scripts/build-symbols.mjs <dir>
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { SYMBOL_SOURCES } from './symbol-sources.mjs';

const ART_PX = 512, THUMB_PX = 64, PHOTO_PX = 184;
const WHITE_MATTE = new Set(['japanese-maple', 'korean-lilac-tree', 'lilac-tree', 'lilacs']); // art on a pure-white square inside the cream export
const ALL_BACKDROP = new Set(['monkey-bars', 'swing-set']); // art with a frame that encloses backdrop
const NO_SHADOW = new Set(['colorado-buff-boulder', 'bubbling-boulder', 'hot-tub', 'seating-wall', 'monkey-bars', 'outdoor-grill', 'spigot', 'planter-box', 'water-feature', 'porcelain-pavers', 'concrete-pavers', 'flagstone-pavers', 'colorado-buff-stone']);
const TRIM = new Set(['porcelain-pavers', 'concrete-pavers', 'flagstone-pavers', 'colorado-buff-stone', 'gas-line', 'electric-line', 'drainage-line']); // exported with a margin: cut to the art so its aspect is the Figma size's
const RECT = new Set(['porcelain-pavers', 'concrete-pavers', 'colorado-buff-stone']); // rectangular art exported as its exact box (no backdrop to cut away; white pavers on a white backdrop would be eaten)
const [dir] = process.argv.slice(2);
if (!dir) { console.error('Usage: node scripts/build-symbols.mjs <dir>'); process.exit(1); }
const out = new URL('../src/assets/symbols/', import.meta.url).pathname;
for (const sub of ['', 'photos/', 'thumbs/']) mkdirSync(out + sub, { recursive: true });

const sat = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
/** Transparent-background RGBA for an export on white. */
async function cutOut(file, keepShadow, allBackdrop, whiteMatte) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info, n = w * h, state = new Uint8Array(n); // 0 untouched, 1 background, 2 shadow
  const at = i => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  // The export's own backdrop (white, or the page's pale cream): the commonest colour along its border.
  const counts = new Map();
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const c = at(y * w + x), k = c.map(v => v >> 3).join(','); counts.set(k, [(counts.get(k)?.[0] ?? 0) + 1, c]); }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const c = at(y * w + x), k = c.map(v => v >> 3).join(','); counts.set(k, [(counts.get(k)?.[0] ?? 0) + 1, c]); }
  const bg = [...counts.values()].sort((a, b) => b[0] - a[0])[0][1];
  const bgMin = Math.min(...bg);
  const isBg = i => { const c = at(i); return Math.max(...c.map((v, k) => Math.abs(v - bg[k]))) <= 20 || (whiteMatte && Math.min(...c) >= 246 && sat(...c) <= 8); };
  const isShadow = i => { const [r, g, b] = at(i), m = Math.min(r, g, b); return sat(r, g, b) <= 40 && m >= 90 && m < bgMin - 20; };
  const flood = (seeds, ok, mark, limit = Infinity) => {
    const q = seeds.slice(), dist = new Map(seeds.map(s => [s, 0]));
    while (q.length) {
      const i = q.shift(), d = dist.get(i), x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; if (state[j] || d + 1 > limit || !ok(j)) continue;
        state[j] = mark; dist.set(j, d + 1); q.push(j);
      }
    }
  };
  const EDGE = 4; // the card's dotted divider is drawn at the export's very edge
  for (let i = 0; i < n; i++) { const x = i % w, y = (i / w) | 0; if (x < EDGE || y < EDGE || x >= w - EDGE || y >= h - EDGE) { data[i * 4] = bg[0]; data[i * 4 + 1] = bg[1]; data[i * 4 + 2] = bg[2]; } }
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const seeds = [...new Set(border)].filter(isBg); seeds.forEach(i => { state[i] = 1; });
  flood(seeds, isBg, 1);
  if (allBackdrop) for (let i = 0; i < n; i++) if (!state[i] && isBg(i)) state[i] = 1; // enclosed backdrop (a frame's inside) goes too
  if (keepShadow) {
    const front = []; for (let i = 0; i < n; i++) if (state[i] === 1) front.push(i);
    flood(front, isShadow, 2, 40);
  }
  for (let i = 0; i < n; i++) {
    if (state[i] === 1) { data[i * 4 + 3] = 0; continue; }
    if (state[i] === 2) { const m = Math.min(...at(i)); data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = 0; data[i * 4 + 3] = Math.round(255 * (1 - m / 255)); continue; }
    // soften the art's own edge: a pixel next to the background and still light is partly clear
    const x = i % w, y = (i / w) | 0;
    const nearBg = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < h && state[ny * w + nx] === 1; });
    if (nearBg) { const m = Math.min(...at(i)); if (m > bgMin - 55) data[i * 4 + 3] = Math.round(255 * Math.max(0, 1 - (m - (bgMin - 55)) / 55)); }
  }
  // Drop what is left of the card's guide lines and any stray specks: components of the art that are hairlines or tiny.
  const seen = new Uint8Array(n);
  for (let s0 = 0; s0 < n; s0++) {
    if (seen[s0] || data[s0 * 4 + 3] === 0) continue;
    const comp = [s0]; seen[s0] = 1; let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (let k = 0; k < comp.length; k++) {
      const i = comp[k], x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const j = ny * w + nx; if (!seen[j] && data[j * 4 + 3] > 0) { seen[j] = 1; comp.push(j); } }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if ((Math.min(bw, bh) <= 7 && Math.max(bw, bh) >= 40) || comp.length < 12) for (const i of comp) data[i * 4 + 3] = 0;
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } });
}

const aspects = existsSync(`${out}symbols.json`) ? JSON.parse(readFileSync(`${out}symbols.json`, 'utf8')) : {}; // kept for symbols whose art isn't in <dir> this run
for (const s of SYMBOL_SOURCES) {
  const art = `${dir}/art/${s.id}.png`; if (!existsSync(art)) { if (!aspects[s.id]) { console.error('missing', art); process.exitCode = 1; } continue; }
  const img = (RECT.has(s.id) ? sharp(art).ensureAlpha() : await cutOut(art, !NO_SHADOW.has(s.id), ALL_BACKDROP.has(s.id), WHITE_MATTE.has(s.id))).resize({ width: ART_PX, height: ART_PX, fit: 'inside', withoutEnlargement: true });
  const sized = await img.png().toBuffer();
  const buf = TRIM.has(s.id) ? await sharp(sized).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 }).png().toBuffer() : sized, meta = await sharp(buf).metadata();
  aspects[s.id] = { w: meta.width, h: meta.height };
  await sharp(buf).webp({ quality: 80, alphaQuality: 90 }).toFile(`${out}${s.id}.webp`);
  await sharp(buf).resize({ width: THUMB_PX, height: THUMB_PX, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 75 }).toFile(`${out}thumbs/${s.id}.webp`);
  if (s.kind === 'plant') await sharp(`${dir}/photo/${s.id}.png`).resize(PHOTO_PX, PHOTO_PX).webp({ quality: 78 }).toFile(`${out}photos/${s.id}.webp`);
}
writeFileSync(`${out}symbols.json`, JSON.stringify(aspects, null, 2) + '\n');
console.log(`${SYMBOL_SOURCES.length} symbols written to ${out}`);
