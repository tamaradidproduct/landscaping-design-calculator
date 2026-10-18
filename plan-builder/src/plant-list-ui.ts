// The Plant list panel: what the plan contains, live: the surfaces used, then each plant (symbol, name, category, quantity, photo) and
// each object (symbol, name, quantity).
import { plantList } from './plant-list';
import { caption, esc, hint, swatch } from './ui';
import type { OutlineTool } from './outline-ui';
import type { LibrarySymbol } from './symbols';

const card = (s: LibrarySymbol, quantity: number) =>
  `<div class="plant-card"><img class="plant-art" src="${esc(s.art)}" alt="">`
  + `<div class="plant-text"><span class="plant-name">${esc(s.name)}</span>${s.category ? `<span class="plant-category">${esc(s.category)}</span>` : ''}</div>`
  + `<div class="plant-qty" title="Quantity" aria-label="Quantity ${quantity}"><span class="plant-count">${quantity}</span></div>`
  + `${s.photo ? `<img class="plant-photo" src="${esc(s.photo)}" alt="">` : ''}</div>`;

export function renderPlantList(el: HTMLElement, tool: OutlineTool) {
  const l = plantList(tool.symbols.placed, tool.outlines);
  if (!l.surfaces.length && !l.plants.length && !l.objects.length) { el.innerHTML = hint('Placed plants and objects, and the surfaces you add, appear here.'); return; }
  el.innerHTML = [
    l.surfaces.length ? `${caption('Surfaces')}${l.surfaces.map(m => `<div class="plant-surface">${swatch({ material: m.id })}<span class="plant-name">${esc(m.name)}</span></div>`).join('')}` : '',
    l.plants.length ? `${caption('Plants')}${l.plants.map(p => card(p.symbol, p.quantity)).join('')}` : '',
    l.objects.length ? `${caption('Objects')}${l.objects.map(o => card(o.symbol, o.quantity)).join('')}` : '',
  ].join('');
}
