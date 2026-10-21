// Pure helpers: pull a street address out of PDF text and pick a plan name. No DOM/Firebase imports.
import { cleanAddress } from './plan-model';

export const UNTITLED = 'Untitled plan';

const SUFFIX = 'St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Way|Blvd|Cir|Circle|Pl|Place|Pkwy|Parkway|Ter|Terrace|Trl|Trail';
// House number (not a lot/block/sheet/unit/suite/no./#, or dimension number), optional directional, 1-4 letter-only words, street suffix.
const NOT_NAME = 'ft|feet|foot|in|inch|inches|x|by|of|the|and|at|to|setback|line|scale';
const WORD = `(?!(?:${NOT_NAME})\\b)(?:[A-Za-z][A-Za-z'-]*|\\d+(?:st|nd|rd|th))`;
const STREET = new RegExp(
  `(?<![\\w.-])(?<!(?:\\b(?:lot|block|sheet|unit|suite|no)\\.?|\\bx|[#=])\\s*)\\d{1,6}\\s+(?:(?:[NSEW]|NE|NW|SE|SW)\\.?\\s+)?(?:${WORD}\\s+){1,4}?(?:${SUFFIX})\\b\\.?`, 'i');
const CITY_TAIL = /^[A-Za-z][A-Za-z .'-]*,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?\b/;
const SAME_LINE_TAIL = /^(,?)\s*([A-Za-z][A-Za-z .'-]*,\s*[A-Z]{2}(?:\s+\d{5}(?:-\d{4})?)?\b)/;
const LABEL_WORDS = /\b(?:site|property|project)\s+address\b|^\s*address\b|\baddress\s*:/i;

export function extractAddress(text: string): string | null {
  const lines = text.split(/\r?\n/);
  let first: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const m = STREET.exec(lines[i]);
    if (!m) continue;
    let found = m[0];
    const rest = lines[i].slice(m.index + m[0].length);
    const tail = SAME_LINE_TAIL.exec(rest);
    if (tail) found += `${tail[1] ? ',' : ''} ${tail[2]}`;
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

const SEQ_SUFFIX = /\s+\((\d+)\)$/;
/** Splits off a name's trailing " (n)" sequence number: "Smith residence (2)" -> base "Smith residence", n 2; unnumbered -> n 1. */
function splitSequence(name: string): { base: string; n: number } {
  const m = SEQ_SUFFIX.exec(name);
  return m ? { base: name.slice(0, m.index), n: Number(m[1]) } : { base: name, n: 1 };
}

/**
 * When `name` exactly matches (trim + case-insensitive) one of `existing`, returns it with the next sequence number
 * appended — past any of `existing` already numbered with the same base — and `duplicate: true`. Otherwise returns
 * `name` unchanged and `duplicate: false`.
 */
export function dedupeName(name: string, existing: string[]): { name: string; duplicate: boolean } {
  const norm = (s: string) => s.trim().toLowerCase();
  if (!existing.some(e => norm(e) === norm(name))) return { name, duplicate: false };
  const base = splitSequence(name).base, baseNorm = norm(base);
  const max = existing.reduce((m, e) => norm(splitSequence(e).base) === baseNorm ? Math.max(m, splitSequence(e).n) : m, 1);
  return { name: `${base} (${max + 1})`, duplicate: true };
}
