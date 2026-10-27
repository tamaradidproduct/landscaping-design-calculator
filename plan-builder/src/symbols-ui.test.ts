import { describe, expect, test } from 'vitest';
import { symbolCard } from './symbols-ui';
import { containersFor } from './plant-size';
import type { OutlineTool } from './outline-ui';
import type { PlacedSymbol } from './plan-model';

function tool(placed: PlacedSymbol[], view: 'install' | 'mature'): OutlineTool {
  const map = Object.fromEntries(placed.map(p => [p.id, p]));
  const groups: { symbol: string; ids: string[] }[] = [];
  for (const p of placed) { const g = groups.find(x => x.symbol === p.symbol); if (g) g.ids.push(p.id); else groups.push({ symbol: p.symbol, ids: [p.id] }); }
  return { plantView: view, symbols: { placed: map, groups: () => groups } } as unknown as OutlineTool;
}
const spruce = (id: string, extra: Partial<PlacedSymbol> = {}): PlacedSymbol => ({ id, symbol: 'blue-diamond-spruce', x: 0, y: 0, ...extra });
const three = [spruce('y1'), spruce('y2'), spruce('y3')];

describe('plant card', () => {
  test('Install view: one chip per container plus Custom, the default pressed, Apply, trash', () => {
    const h = symbolCard(tool(three, 'install'), 'y1');
    const n = containersFor('blue-diamond-spruce').length;
    expect(h.match(/<button[^>]*class="chip"/g)).toHaveLength(n + 1);
    expect(h).toContain('>Custom</button>');
    expect(h.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(h).toMatch(/aria-pressed="true"[^>]*>6 ft B&amp;B|aria-pressed="true"[^>]*>6 ft B&B/);
    expect(h).toContain('Apply to all Blue Diamond Spruce (3)');
    expect(h).not.toContain('Spruces');
    expect(h).toContain('data-act="delete-symbol"');
    expect(h).toContain('Install 4.5 ft across · mature 10 ft');
    expect(h).toContain('Drag the handle on the plan to set a custom size.');
    expect(h).not.toContain('disabled');
    expect(h).toMatch(/<button[^>]*data-act="custom-size"[^>]*>Custom</);
  });
  test('a custom size presses Custom and shows in the sub-line', () => {
    const h = symbolCard(tool([spruce('y1', { customInstall: 6 })], 'install'), 'y1');
    expect(h).toMatch(/aria-pressed="true"[^>]*>Custom</);
    expect(h).toContain('Custom 6 ft across · mature 10 ft');
    expect(h).not.toContain('Apply to all');
  });
  test('Mature view disables the chips and says how to change', () => {
    const h = symbolCard(tool(three, 'mature'), 'y1');
    expect(h.match(/<button[^>]*class="chip"[^>]*disabled/g)).toHaveLength(containersFor('blue-diamond-spruce').length + 1);
    expect(h).toContain('Switch to Install to change the container');
    expect(h).not.toContain('Drag the handle');
  });
  test('corn has no chip row and no Apply button, and shows the mature size', () => {
    const h = symbolCard(tool([{ id: 'y1', symbol: 'corn', x: 0, y: 0 }, { id: 'y2', symbol: 'corn', x: 0, y: 0 }], 'install'), 'y1');
    expect(h).not.toContain('class="chip"'); expect(h).not.toContain('Apply to all'); expect(h).not.toContain('across');
    expect(h).toContain('data-act="delete-symbol"');
  });
  test('chips and buttons use plain button markup, so the 44 px control rule applies', () => {
    const h = symbolCard(tool(three, 'install'), 'y1');
    expect(h).not.toMatch(/class="[^"]*\b(compact|small)\b/);
  });
  test('an object keeps its current card', () => {
    const h = symbolCard(tool([{ id: 'y1', symbol: 'hot-tub', x: 0, y: 0 }], 'install'), 'y1');
    expect(h).toContain('symbol-rotation'); expect(h).not.toContain('class="chip"');
  });
});
