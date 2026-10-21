// No DOM test harness exists in this codebase yet, so this stays a light smoke test of the pure
// drop-file helper rather than driving real drag events through jsdom.
import { describe, expect, test } from 'vitest';
import { droppedFile } from './plans-ui';

const dataTransfer = (files: File[]) => ({ files } as unknown as DataTransfer);

describe('droppedFile', () => {
  test('reads the first dropped file', () => {
    const file = new File(['%PDF-1.4'], 'plot.pdf', { type: 'application/pdf' });
    expect(droppedFile(dataTransfer([file]))).toBe(file);
  });
  test('null when nothing was dropped', () => {
    expect(droppedFile(dataTransfer([]))).toBeNull();
    expect(droppedFile(null)).toBeNull();
  });
});
