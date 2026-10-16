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
    const long = `12 Oak Ln, ${'Averyveryverylongcity '.repeat(20)}, CO 80202`;
    expect(extractAddress(long)!.length).toBeLessThanOrEqual(200);
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
