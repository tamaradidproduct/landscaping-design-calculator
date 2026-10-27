/** True when the primary input is a mouse or trackpad, so a physical keyboard types lengths and the on-screen keypad is hidden.
 * Touch-primary devices (iPad) keep the readonly field + numericKeypad (#28). */
export const hasKeyboardInput = (win: { matchMedia?: (q: string) => { matches: boolean } } = window): boolean =>
  !!win.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

/** Keeps only what the keypad can type (digits, ′ ″ . and the slash/space of `116' 5 1/2"`), so typed input stays numbers-only. */
export const filterLengthChars = (s: string): string =>
  s.replace(/[′’]/g, "'").replace(/[″”]/g, '"').replace(/[^0-9'". /]/g, '');

export const filteredLengthCursor = (s: string, cursor: number): number =>
  filterLengthChars(s.slice(0, cursor)).length;
