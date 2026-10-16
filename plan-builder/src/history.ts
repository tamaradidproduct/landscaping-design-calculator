/** Undo/redo of whole-state snapshots. Call record(before) right before every change. */
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(private limit = 200) {}

  record(before: T) {
    this.past.push(before);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  /** The state to go back to, given the current one; null if nothing to undo. */
  undo(current: T): T | null {
    const prev = this.past.pop();
    if (prev === undefined) return null;
    this.future.push(current);
    return prev;
  }
  redo(current: T): T | null {
    const next = this.future.pop();
    if (next === undefined) return null;
    this.past.push(current);
    return next;
  }
  clear() { this.past = []; this.future = []; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}
