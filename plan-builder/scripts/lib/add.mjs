// Shared by the check scripts: the Layers panel's tool row (Add, Surface, Edge, Plant; ready once the scale is set).
import { SURFACE_SOURCES } from '../surface-sources.mjs';
import { SYMBOL_SOURCES } from '../symbol-sources.mjs';
import { LINE_SOURCES } from '../line-sources.mjs';

const ALIASES = { add: 'add', surface: 'surfaces', surfaces: 'surfaces', edge: 'lines', lines: 'lines', plant: 'symbols', symbols: 'symbols' };
const BY_ID = new Map([...SURFACE_SOURCES, ...SYMBOL_SOURCES, ...LINE_SOURCES].map(e => [e.id, e.name]));

/** Opens a tool ('add' | 'surfaces' | 'lines' | 'symbols', or Surface / Edge / Plant) without picking. Surface starts drawing. */
export async function openTool(page, tool) {
  const id = ALIASES[String(tool).toLowerCase()];
  if (!id) throw new Error(`unknown tool ${tool}`);
  const btn = `#add .tool[data-tool=${id}]`;
  if ((await page.getAttribute(btn, 'aria-pressed')) !== 'true') await page.click(btn);
  await page.waitForSelector('#tool-search');
}

/** Taps the tool, types the entry's name in #tool-search and taps its cell. `name` is a display name or an entry id
 * (premium-sod, hot-tub, dry-river …); with an id its name is typed and that exact cell tapped. */
export async function addVia(page, tool, name) {
  await openTool(page, tool);
  const id = BY_ID.has(name) ? name : null;
  await page.fill('#tool-search', id ? BY_ID.get(id) : name);
  await page.waitForTimeout(100);
  if (id) { await page.click(`#add .tool-popover [data-pick="${id}"]`); return; }
  const cells = await page.$$('#add .tool-popover [data-pick]');
  for (const c of cells) {
    if ((await c.$eval('span', s => s.textContent)).trim().toLowerCase() === name.toLowerCase()) { await c.click(); return; } // the name span, not the category label
  }
  if (!cells.length) throw new Error(`no match for "${name}"`);
  await cells[0].click();
}

/** Runs `read(page)` with the Layers panel in Preview (the Sheet view) (the plan's contents as the customer sheet shows them), then back on Edit. */
export async function onSheet(page, read) {
  await page.click('[data-view=preview]');
  try { return await read(page); } finally { await page.click('[data-view=edit]'); }
}
