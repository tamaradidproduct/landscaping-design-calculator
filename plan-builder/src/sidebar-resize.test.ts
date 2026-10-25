import { describe, expect, test } from 'vitest';
import { clampSidebarWidth, maxSidebarWidth, parseStoredWidth, SIDEBAR } from './sidebar-resize';

describe('sidebar width', () => {
  test('the widest is 480 px or 40% of the window, whichever is less, and never below the default', () => {
    expect(maxSidebarWidth(1600, 280)).toBe(480);
    expect(maxSidebarWidth(1180, 280)).toBe(472);
    expect(maxSidebarWidth(820, 280)).toBe(328);
    expect(maxSidebarWidth(500, 280)).toBe(280);
  });
  test('clamps between the default and the widest, rounding to whole pixels', () => {
    expect(clampSidebarWidth(100, 1180, 280)).toBe(280);
    expect(clampSidebarWidth(350.6, 1180, 280)).toBe(351);
    expect(clampSidebarWidth(900, 1180, 280)).toBe(472);
    expect(clampSidebarWidth(400, 820, 280)).toBe(328);
    expect(clampSidebarWidth(Number.NaN, 1180, 280)).toBe(280);
  });
  test('a keyboard step is 16 px', () => expect(SIDEBAR.step).toBe(16));
  test('a stored width reads back as a number, anything else as none', () => {
    expect(parseStoredWidth('360')).toBe(360);
    expect(parseStoredWidth(null)).toBeNull();
    expect(parseStoredWidth('wide')).toBeNull();
    expect(parseStoredWidth('-5')).toBeNull();
  });
});
