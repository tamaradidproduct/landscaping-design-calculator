// The Layers panel's sections as one component: for each section a header (chevron, title, count, ↑ ↓ and an eye) and its body with the
// list the section renders into. The panel's blocks are reordered by main.ts (applySectionOrder); this only builds them.
import { GROUP_NAMES, GROUPS, moveLabel, type Group } from './sections';
import { esc, eyeButton } from './ui';

const CHEVRON = '<svg class="line-icon chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>';

const moveButton = (g: Group, dir: -1 | 1) =>
  `<button type="button" class="icon move" data-move-group="${g}" data-dir="${dir}" aria-label="${esc(moveLabel(g, dir))}" title="${esc(moveLabel(g, dir))}">${dir < 0 ? '↑' : '↓'}</button>`;

/** One section: its header line and its body (`id="group-<g>"`, holding the list `id="<g>"`). */
const section = (g: Group) =>
  `<div class="group-line"><button type="button" class="group-head" data-group="${g}" aria-expanded="true" aria-controls="group-${g}">${CHEVRON}`
  + `<span class="group-title">${esc(GROUP_NAMES[g])}</span><span class="group-count" hidden></span></button>`
  + `${moveButton(g, -1)}${moveButton(g, 1)}${eyeButton(false, `all ${GROUP_NAMES[g].toLowerCase()}`, { 'eye-group': g })}</div>`
  + `<div class="group-body" id="group-${g}"><div class="layer-list" id="${g}"></div></div>`;

/** All the sections, in the library's section order (the panel orders them by the plan's `sectionOrder`). */
export const layersSectionsHtml = (): string => GROUPS.map(section).join('');
