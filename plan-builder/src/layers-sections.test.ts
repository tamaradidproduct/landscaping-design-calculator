import { describe, expect, test } from 'vitest';
import { layersSectionsHtml } from './layers-sections';
import { GROUPS } from './sections';

describe('layersSectionsHtml', () => {
  const html = layersSectionsHtml();
  test('one header and one body per section, each with its list', () => {
    for (const g of GROUPS) {
      expect(html, g).toContain(`data-group="${g}"`); expect(html, g).toContain(`id="group-${g}"`); expect(html, g).toContain(`<div class="layer-list" id="${g}">`);
    }
    expect(html.match(/class="group-line"/g)).toHaveLength(4); expect(html.match(/class="group-body"/g)).toHaveLength(4);
  });
  test('titles, and an eye and two move buttons per header, labelled', () => {
    for (const t of ['Plants &amp; objects', 'Outlines', 'Lines', 'Surfaces']) expect(html).toContain(`<span class="group-title">${t}</span>`);
    for (const g of GROUPS) {
      expect(html).toContain(`data-eye-group="${g}"`);
      expect(html).toContain(`data-move-group="${g}" data-dir="-1"`); expect(html).toContain(`data-move-group="${g}" data-dir="1"`);
    }
    expect(html).toContain('aria-label="Move Plants &amp; objects up"'); expect(html).toContain('aria-label="Hide all surfaces"');
  });
  test('every header starts open with a hidden count', () => {
    expect(html.match(/aria-expanded="true"/g)).toHaveLength(4); expect(html.match(/class="group-count" hidden/g)).toHaveLength(4);
  });
});
