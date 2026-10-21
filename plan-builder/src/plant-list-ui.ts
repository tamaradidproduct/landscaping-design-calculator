// The Plant list panel: what the plan contains, live: the surfaces used, each kind of line (length and runs), then each plant (symbol,
// name, category, quantity, photo), each object (stepping stones too) and each utility marker (symbol, name, quantity).
import { plantList, type PlantList } from './plant-list';
import { formatArea, formatLengthFt } from './outline';
import { caption, esc, hint, swatch } from './ui';
import type { OutlineTool } from './outline-ui';
import type { LibrarySymbol } from './symbols';

const lineRow = (l: PlantList['lines'][number]) =>
  `<div class="plant-surface">${swatch({ symbol: l.item.thumb })}<span class="plant-text"><span class="plant-name">${esc(l.item.name)}</span>`
  + `<span class="plant-measure">${formatLengthFt(l.feet)} · ${l.runs} ${l.runs === 1 ? 'run' : 'runs'}</span></span></div>`;

const card = (s: LibrarySymbol, quantity: number) =>
  `<div class="plant-card"><img class="plant-art" src="${esc(s.art)}" alt="">`
  + `<div class="plant-text"><span class="plant-name">${esc(s.name)}</span>${s.category ? `<span class="plant-category">${esc(s.category)}</span>` : ''}</div>`
  + `<div class="plant-qty" title="Quantity" aria-label="Quantity ${quantity}"><span class="plant-count">${quantity}</span></div>`
  + `${s.photo ? `<img class="plant-photo" src="${esc(s.photo)}" alt="">` : ''}</div>`;

export function renderPlantList(el: HTMLElement, tool: OutlineTool) {
  const l = plantList(tool.symbols.placed, tool.outlines, tool.lines.placed, tool.cal?.ftPerPt ?? null, tool.surfaceAreasSqft());
  if (!l.surfaces.length && !l.lines.length && !l.plants.length && !l.objects.length && !l.markers.length) { el.innerHTML = hint('Placed plants and objects, lines, and the surfaces you add, appear here.'); return; }
  el.innerHTML = [
    l.surfaces.length ? `${caption('Surfaces')}${l.surfaces.map(r => `<div class="plant-surface">${swatch({ material: r.material.id })}<span class="plant-text"><span class="plant-name">${esc(r.material.name)}</span>${r.sqft !== null ? `<span class="plant-measure">${formatArea(r.sqft)}</span>` : ''}</span></div>`).join('')}` : '',
    l.lines.length ? `${caption('Lines')}${l.lines.map(lineRow).join('')}` : '',
    l.plants.length ? `${caption('Plants')}${l.plants.map(p => card(p.symbol, p.quantity)).join('')}` : '',
    l.objects.length ? `${caption('Objects')}${l.objects.map(o => card(o.symbol, o.quantity)).join('')}` : '',
    l.markers.length ? `${caption('Utility markers')}${l.markers.map(m => card(m.symbol, m.quantity)).join('')}` : '',
  ].join('');
}
