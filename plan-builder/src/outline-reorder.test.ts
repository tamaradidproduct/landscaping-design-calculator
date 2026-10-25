import { describe, expect, test } from 'vitest';
import { History } from './history';
import { OutlineTool } from './outline-ui';
import type { Outline } from './outline';

const o = (id: string, kind: Outline['kind']) => ({ id, kind, name: id, closed: true, pts: [] }) as unknown as Outline;
// moveLayerTo only touches outlines, record() and update(), so it runs on a stand-in (the tool itself needs a DOM).
function fake(ids: [string, Outline['kind']][]) {
  const history = new History<Record<string, Outline>>();
  const self = {
    outlines: Object.fromEntries(ids.map(([id, k]) => [id, o(id, k)])),
    record() { history.record(structuredClone(this.outlines)); },
    update() {},
  };
  return {
    self, history, order: () => Object.keys(self.outlines),
    move: (id: string, before: string | null) => OutlineTool.prototype.moveLayerTo.call(self as unknown as OutlineTool, id, before),
  };
}
const feats: [string, Outline['kind']][] = [['boundary', 'boundary'], ['f1', 'feature'], ['f2', 'feature'], ['f3', 'feature']];

describe('moveLayerTo', () => {
  test('drops a layer before another as one undo step', () => {
    const t = fake(feats);
    t.move('f3', 'f1');
    expect(t.order()).toEqual(['boundary', 'f3', 'f1', 'f2']);
    expect(t.history.undo(t.self.outlines)).not.toBeNull();
    expect(t.history.canUndo).toBe(false);
  });
  test('the boundary, an unchanged order and a cross-section drop add no undo step', () => {
    const t = fake([...feats, ['s1', 'surface']]);
    t.move('boundary', 'f1'); t.move('f2', 'f3'); t.move('f3', null); t.move('f1', 's1');
    expect(t.order()).toEqual(['boundary', 'f1', 'f2', 'f3', 's1']);
    expect(t.history.canUndo).toBe(false);
  });
});
