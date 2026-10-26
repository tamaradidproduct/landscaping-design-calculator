// One searchable list over the surfaces (MATERIALS), plant/object/marker symbols (SYMBOLS) and line items (LINE_ITEMS), the tags
// that narrow it, and the Recent picks kept in localStorage. Pure apart from loadRecent / saveRecent.
import { MATERIALS } from './materials';
import { SYMBOLS } from './symbols';
import { LINE_ITEMS } from './line-items';

export type Category = 'surfaces' | 'symbols' | 'lines';
export interface SearchEntry {
  id: string; category: Category; name: string; family: string;
  /** URL of the small picture (material thumb, symbol thumb, line thumb). */
  thumb: string;
}

const CATEGORY_TAGS: { tag: string; category: Category }[] = [
  { tag: 'Surfaces', category: 'surfaces' }, { tag: 'Plants & objects', category: 'symbols' }, { tag: 'Edges & walls', category: 'lines' },
];
const RECENT_KEY = 'recent-picks';

let cache: SearchEntry[] | null = null;
export function searchEntries(): SearchEntry[] {
  return cache ??= [
    ...MATERIALS.map(m => ({ id: m.id, category: 'surfaces' as const, name: m.name, family: m.family, thumb: m.thumb })),
    ...SYMBOLS.map(s => ({ id: s.id, category: 'symbols' as const, name: s.name, family: s.family, thumb: s.thumb })),
    ...LINE_ITEMS.map(i => ({ id: i.id, category: 'lines' as const, name: i.name, family: i.family, thumb: i.thumb })),
  ];
}

export function tagsFor(category: Category | 'all'): string[] {
  if (category === 'all') return ['All', 'Recent', ...CATEGORY_TAGS.map(t => t.tag)];
  // Lines have one family, so their tags are the line items themselves.
  const tags: string[] = [];
  for (const e of searchEntries()) {
    const t = category === 'lines' ? e.name : e.family;
    if (e.category === category && !tags.includes(t)) tags.push(t);
  }
  return ['All', 'Recent', CATEGORY_TAGS.find(t => t.category === category)!.tag, ...tags];
}

export function search(query: string, tag: string, entries: SearchEntry[], recent: string[]): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (q) {
    const byName = entries.filter(e => e.name.toLowerCase().includes(q));
    const byFamily = entries.filter(e => !e.name.toLowerCase().includes(q) && e.family.toLowerCase().includes(q));
    return [...byName, ...byFamily];
  }
  if (tag === 'All') return [...entries];
  if (tag === 'Recent') return cleanRecent(recent).flatMap(id => entries.find(e => e.id === id) ?? []);
  const cat = CATEGORY_TAGS.find(t => t.tag === tag);
  return cat ? entries.filter(e => e.category === cat.category) : entries.filter(e => e.family === tag || (e.category === 'lines' && e.name === tag));
}

const cleanRecent = (r: string[], limit = 8): string[] => [...new Set(r)].slice(0, limit);

export function pushRecent(recent: string[], id: string, limit = 8): string[] {
  return [id, ...recent.filter(x => x !== id)].slice(0, limit);
}

export function loadRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? cleanRecent(v.filter((x): x is string => typeof x === 'string')) : [];
  } catch { return []; }
}

export function saveRecent(r: string[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(r)); } catch { /* storage unavailable: Recent just isn't kept */ }
}
