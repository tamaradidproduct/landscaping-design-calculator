// The Layers panel's Sheet view: what the plan contains, read-only, as the customer sheet will show it. Fed by plantList(),
// the one source of quantity for the panel counts, this sheet and export. Tapping a card selects that item on the plan.
import { plantList, type PlantList } from './plant-list';
import { lengthText } from './lines-ui';
import { formatArea } from './outline';
import { caption, esc, hint, swatch } from './ui';
import type { OutlineTool } from './outline-ui';
import type { LibrarySymbol } from './symbols';
import { containersFor, sizeLabel, type PlantSizeView } from './plant-size';

/** `size` is the size label of the selected plant: with it, only that size's row shows as selected (without it, every row of the species). */
export interface SheetSelection { symbol?: string; size?: string; line?: string; material?: string }

const card = (s: LibrarySymbol, quantity: number, selected: boolean, size?: string) =>
  `<button type="button" class="plant-card${selected ? ' selected' : ''}" data-sheet-symbol="${esc(s.id)}"${size ? ` data-sheet-size="${esc(size)}"` : ''}${selected ? ' aria-pressed="true"' : ''}><img class="plant-art" src="${esc(s.art)}" alt="">`
  + `<span class="plant-text"><span class="plant-name">${esc(s.name)}</span>${size ? `<span class="plant-size">${esc(size)}</span>` : ''}${s.category ? `<span class="plant-category">${esc(s.category)}</span>` : ''}</span>`
  + `<span class="plant-qty" title="Quantity" aria-label="Quantity ${quantity}"><span class="plant-count">${quantity}</span></span>`
  + `${s.photo ? `<img class="plant-photo" src="${esc(s.photo)}" alt="">` : ''}</button>`;

const lineRow = (l: PlantList['lines'][number], selected: boolean) =>
  `<button type="button" class="plant-surface${selected ? ' selected' : ''}" data-sheet-line="${esc(l.item.id)}"${selected ? ' aria-pressed="true"' : ''}>${swatch({ symbol: l.item.thumb })}<span class="plant-text"><span class="plant-name">${esc(l.item.name)}</span>`
  + `<span class="plant-measure">${lengthText(l.feet)} · ${l.runs} ${l.runs === 1 ? 'run' : 'runs'}</span></span></button>`;

/** The whole sheet as HTML: Plants, Objects, Utility markers, Edges & walls, Surfaces; a quiet note when empty. Pure.
 *  The plants' footnote (which view the sizes show) appears only when a row's species has containers, as the toggle does. */
export function sheetHtml(l: PlantList, sel: SheetSelection, view: PlantSizeView = 'mature'): string {
  if (!l.surfaces.length && !l.lines.length && !l.plants.length && !l.objects.length && !l.markers.length) return hint('Nothing on the plan yet.');
  const cards = (title: string, list: { symbol: LibrarySymbol; quantity: number; size?: string }[], note = '') =>
    list.length ? `${caption(title)}${list.map(e => card(e.symbol, e.quantity, sel.symbol === e.symbol.id && (sel.size === undefined || e.size === undefined || sel.size === e.size), e.size)).join('')}${note}` : '';
  return [
    cards('Plants', l.plants, !l.plants.some(e => containersFor(e.symbol.id).length) ? '' : hint(view === 'install' ? 'Sizes shown at install. Switch to Mature to see grown sizes.' : 'Sizes shown at mature. Switch to Install to see nursery sizes.')), cards('Objects', l.objects), cards('Utility markers', l.markers),
    l.lines.length ? `${caption('Edges &amp; walls')}${l.lines.map(x => lineRow(x, sel.line === x.item.id)).join('')}` : '',
    l.surfaces.length ? `${caption('Surfaces')}${l.surfaces.map(r => `<button type="button" class="plant-surface${sel.material === r.material.id ? ' selected' : ''}" data-sheet-material="${esc(r.material.id)}">${swatch({ material: r.material.id })}<span class="plant-text"><span class="plant-name">${esc(r.material.name)}</span>${r.sqft !== null ? `<span class="plant-measure">${formatArea(r.sqft)}</span>` : ''}</span></button>`).join('')}` : '',
  ].join('');
}

/** Draws the sheet into `el` and wires the cards: a tap selects the first placed item of that kind on the plan. */
export function renderSheet(el: HTMLElement, tool: OutlineTool) {
  const picked = tool.selectedSymbol ? tool.symbols.placed[tool.selectedSymbol] : undefined;
  const sizeOf = (p: { symbol: string; container?: string; customInstall?: number }) => sizeLabel(p.symbol, p, tool.plantView);
  const sel: SheetSelection = {
    symbol: picked?.symbol,
    size: picked ? sizeOf(picked) || undefined : undefined,
    line: tool.selectedLine ? tool.lines.placed[tool.selectedLine]?.item : undefined,
    material: tool.selected ? tool.outlines[tool.selected]?.material : undefined,
  };
  el.innerHTML = sheetHtml(plantList(tool.symbols.placed, tool.outlines, tool.lines.placed, tool.cal?.ftPerPt ?? null, tool.surfaceAreasSqft(), tool.plantView), sel, tool.plantView);
  el.querySelectorAll<HTMLElement>('[data-sheet-symbol]').forEach(b => {
    b.onclick = () => {
      const ids = tool.symbols.groups().find(g => g.symbol === b.dataset.sheetSymbol)?.ids ?? [];
      const size = b.dataset.sheetSize;
      const id = (size === undefined ? undefined : ids.find(i => sizeOf(tool.symbols.placed[i]) === size)) ?? ids[0];
      if (id) tool.selectSymbol(id);
    };
  });
  el.querySelectorAll<HTMLElement>('[data-sheet-line]').forEach(b => {
    b.onclick = () => {
      const id = tool.lines.groups().find(g => g.item === b.dataset.sheetLine)?.ids[0];
      if (id) tool.selectLine(id);
    };
  });
  el.querySelectorAll<HTMLElement>('[data-sheet-material]').forEach(b => {
    b.onclick = () => {
      const z = Object.values(tool.outlines).find(o => o.kind === 'surface' && o.material === b.dataset.sheetMaterial);
      if (z) tool.selectOutline(z.id);
    };
  });
}
