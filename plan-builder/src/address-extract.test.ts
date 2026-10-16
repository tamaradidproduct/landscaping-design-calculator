import { describe, expect, test } from 'vitest';
import { extractAddress, fileNameToTitle, suggestName, UNTITLED } from './address-extract';

describe('extractAddress', () => {
  test('full one-line address', () => {
    expect(extractAddress('1234 Elm Street, Denver, CO 80202')).toBe('1234 Elm Street, Denver, CO 80202');
  });
  test('strips label and joins the city line', () => {
    expect(extractAddress('SITE ADDRESS: 5678 W Maple Ave\nBoulder, CO 80301')).toBe('5678 W Maple Ave Boulder, CO 80301');
  });
  test('street only', () => {
    expect(extractAddress('12 Oak Ln')).toBe('12 Oak Ln');
  });
  test('prefers a labelled title-block match', () => {
    expect(extractAddress('Surveyor: 99 Office Park Dr\nScale 1"=20\'\nSite address: 12 Oak Ln')).toBe('12 Oak Ln');
  });
  test('first match wins with no label', () => {
    expect(extractAddress('99 Office Park Dr\n12 Oak Ln')).toBe('99 Office Park Dr');
  });
  test.each(['Phone 303-555-1212', "120.5' x 80'", '02/24/2025', '', 'Lot 39 Block 2'])('no address in %j', t => {
    expect(extractAddress(t)).toBeNull();
  });
  test('capped at 200 chars', () => {
    const r = extractAddress(`12 Oak Ln, ${'A'.repeat(300)}, CO 80202`)!;
    expect(r.startsWith('12 Oak Ln')).toBe(true);
    expect(r.length).toBe(200);
  });
  test.each([
    '3 of 5 Drive', '1 inch = 20 ft Way', 'Property line 25 ft setback Rd', '24 x 36 Plan Way', 'Drawn 2024 by John Court',
  ])('measurement or note text is not an address: %j', t => {
    expect(extractAddress(t)).toBeNull();
  });
  test('lot number is not the house number', () => {
    expect(extractAddress('Lot 5 12 Oak Ln')).toBe('12 Oak Ln');
  });
  test('keeps city tail when no comma after street', () => {
    expect(extractAddress('12 Oak Ln Denver, CO 80202')).toBe('12 Oak Ln Denver, CO 80202');
    expect(extractAddress('12 Oak St. Denver, CO 80202')).toBe('12 Oak St. Denver, CO 80202');
  });
  test('other real forms still match', () => {
    expect(extractAddress('12 oak lane')).toBe('12 oak lane');
    expect(extractAddress('5678 W Maple Ave')).toBe('5678 W Maple Ave');
    expect(extractAddress('9 N. Main St.')).toBe('9 N. Main St.');
  });
  test('label on the preceding line', () => {
    expect(extractAddress('Surveyor: 99 Office Park Dr\nSite Address:\n12 Oak Ln')).toBe('12 Oak Ln');
  });
  test('"Property line" is not a label', () => {
    expect(extractAddress('1 Aa St\nProperty line\n34 Elm St')).toBe('1 Aa St');
  });
});

describe('fileNameToTitle', () => {
  test('cleans separators and extension', () => {
    expect(fileNameToTitle('riesberg-plot-plan.pdf')).toBe('riesberg plot plan');
    expect(fileNameToTitle('My_Plan  v2.PDF')).toBe('My Plan v2');
    expect(fileNameToTitle('.pdf')).toBe('');
  });
});

describe('suggestName', () => {
  test('typed wins, trimmed', () => {
    expect(suggestName({ typed: '  14 Elm St ', extracted: '12 Oak Ln', fileName: 'a.pdf' })).toBe('14 Elm St');
  });
  test('extracted when nothing typed', () => {
    expect(suggestName({ typed: '', extracted: '12 Oak Ln', fileName: 'a.pdf' })).toBe('12 Oak Ln');
  });
  test('file name fallback', () => {
    expect(suggestName({ typed: '   ', extracted: null, fileName: 'a-b.pdf' })).toBe('a b');
  });
  test('untitled last resort', () => {
    expect(suggestName({ typed: '', extracted: null, fileName: '.pdf' })).toBe('Untitled plan');
    expect(UNTITLED).toBe('Untitled plan');
  });
});
