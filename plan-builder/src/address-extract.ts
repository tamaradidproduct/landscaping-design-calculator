// Pure helpers: pull a street address out of PDF text and pick a plan name. No DOM/Firebase imports.
import { cleanAddress } from './plan-model';

export const UNTITLED = 'Untitled plan';

const SUFFIX = 'St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Way|Blvd|Cir|Circle|Pl|Place|Pkwy|Parkway|Ter|Terrace|Trl|Trail';
// House number, optional directional, 1-4 words, street suffix.
const STREET = new RegExp(`(?<![\\w.-])\\d{1,6}\\s+(?:(?:[NSEW]|NE|NW|SE|SW)\\.?\\s+)?(?:[A-Za-z0-9.'-]+\\s+){1,4}?(?:${SUFFIX})\\b\\.?`, 'i');
const CITY_TAIL = /^[A-Za-z][A-Za-z .'-]*,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?\b/;
const SAME_LINE_TAIL = /^,\s*[A-Za-z][A-Za-z .'-]*,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?\b/;
const LABEL_WORDS = /address|site|property|lot/i;

export function extractAddress(text: string): string | null {
  const lines = text.split(/\r?\n/);
  let first: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const m = STREET.exec(lines[i]);
    if (!m) continue;
    let found = m[0];
    const rest = lines[i].slice(m.index + m[0].length);
    const tail = SAME_LINE_TAIL.exec(rest);
    if (tail) found += tail[0];
    else {
      const next = CITY_TAIL.exec((lines[i + 1] ?? '').trim());
      if (next) found += ' ' + next[0];
    }
    const labelled = LABEL_WORDS.test(lines[i]) || (i > 0 && LABEL_WORDS.test(lines[i - 1]));
    if (labelled) return cleanAddress(found);
    first ??= found;
  }
  return first === null ? null : cleanAddress(first);
}

export function fileNameToTitle(fileName: string): string {
  return fileName.replace(/\.[^.]*$/, '').replace(/[-_\s]+/g, ' ').trim();
}

export function suggestName(parts: { typed: string; extracted: string | null; fileName: string }): string {
  return cleanAddress(parts.typed) ?? cleanAddress(parts.extracted ?? '') ?? (cleanAddress(fileNameToTitle(parts.fileName)) ?? UNTITLED);
}
