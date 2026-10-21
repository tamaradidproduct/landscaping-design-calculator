// Pure logic behind the New-plan and Rename duplicate-name handling (see address-extract.test.ts for dedupeName itself),
// plus a light smoke test of the drag-and-drop helper (no DOM test harness exists in this codebase yet, so drag events
// themselves aren't driven through jsdom).
import { describe, expect, test } from 'vitest';
import { activePlanNames, droppedFile } from './plans-ui';
import { dedupeName } from './address-extract';
import type { PlanMeta } from './plan-model';

const plan = (over: Partial<PlanMeta>): PlanMeta =>
  ({ id: 'x', address: 'x', createdAt: 0, updatedAt: 0, pdf: { name: 'a.pdf', size: 1, rev: 1, uploaded: true }, pending: false, archived: false, ...over });

describe('activePlanNames', () => {
  test('leaves out archived plans', () => {
    const plans = [plan({ id: 'a', address: 'Smith residence' }), plan({ id: 'b', address: 'Jones residence', archived: true })];
    expect(activePlanNames(plans)).toEqual(['Smith residence']);
  });
  test('excludeId leaves out the plan being renamed', () => {
    const plans = [plan({ id: 'a', address: 'Smith residence' }), plan({ id: 'b', address: 'Jones residence' })];
    expect(activePlanNames(plans, 'a')).toEqual(['Jones residence']);
  });
});

/** Mirrors how create()/saveRename() dedupe a candidate name against the plans already in the list. */
const finalName = (plans: PlanMeta[], candidate: string, excludeId?: string) => dedupeName(candidate, activePlanNames(plans, excludeId)).name;

describe('create: duplicate names end up distinct', () => {
  test('a new plan matching an existing active plan is numbered', () => {
    const plans = [plan({ id: 'a', address: 'Smith residence' })];
    const name = finalName(plans, 'Smith residence');
    expect(name).toBe('Smith residence (2)');
    expect(dedupeName('Smith residence', activePlanNames(plans)).duplicate).toBe(true);
    // The list, after this plan is added under the deduped name, has no two active plans sharing a name.
    const after = [...plans, plan({ id: 'b', address: name })];
    const names = activePlanNames(after);
    expect(new Set(names).size).toBe(names.length);
  });

  test('a second duplicate skips past the first and stays distinct', () => {
    let plans = [plan({ id: 'a', address: 'Smith residence' })];
    plans = [...plans, plan({ id: 'b', address: finalName(plans, 'Smith residence') })]; // -> "Smith residence (2)"
    const third = finalName(plans, 'Smith residence');
    expect(third).toBe('Smith residence (3)');
    plans = [...plans, plan({ id: 'c', address: third })];
    const names = activePlanNames(plans);
    expect(names).toEqual(['Smith residence', 'Smith residence (2)', 'Smith residence (3)']);
    expect(new Set(names).size).toBe(3);
  });

  test('an unmatched name is created as typed', () => {
    const plans = [plan({ id: 'a', address: 'Smith residence' })];
    expect(finalName(plans, '12 Oak Ln')).toBe('12 Oak Ln');
  });
});

describe('rename: duplicate names end up distinct, self excluded', () => {
  test('renaming to match another active plan is numbered', () => {
    const plans = [plan({ id: 'a', address: 'Smith residence' }), plan({ id: 'b', address: '12 Oak Ln' })];
    expect(finalName(plans, 'Smith residence', 'b')).toBe('Smith residence (2)');
  });
  test('renaming a plan to the name it already has is not flagged against itself', () => {
    const plans = [plan({ id: 'a', address: 'Smith residence' })];
    expect(finalName(plans, 'Smith residence', 'a')).toBe('Smith residence');
    expect(dedupeName('Smith residence', activePlanNames(plans, 'a')).duplicate).toBe(false);
  });
});

describe('archived plans never block a name', () => {
  test('create: a matching archived plan is ignored', () => {
    const plans = [plan({ id: 'a', address: 'Smith residence', archived: true })];
    expect(finalName(plans, 'Smith residence')).toBe('Smith residence');
  });
  test('rename: a matching archived plan is ignored', () => {
    const plans = [plan({ id: 'a', address: 'Smith residence', archived: true }), plan({ id: 'b', address: '12 Oak Ln' })];
    expect(finalName(plans, 'Smith residence', 'b')).toBe('Smith residence');
  });
});

describe('droppedFile', () => {
  const dataTransfer = (files: File[]) => ({ files } as unknown as DataTransfer);

  test('reads the first dropped file', () => {
    const file = new File(['%PDF-1.4'], 'plot.pdf', { type: 'application/pdf' });
    expect(droppedFile(dataTransfer([file]))).toBe(file);
  });
  test('null when nothing was dropped', () => {
    expect(droppedFile(dataTransfer([]))).toBeNull();
    expect(droppedFile(null)).toBeNull();
  });
});
