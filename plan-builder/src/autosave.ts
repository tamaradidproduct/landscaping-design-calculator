// Debounced autosave. On save failure pending is cleared (no retry loop):
// flush() rethrows; the timer path and the plan-switch flush in changed() log
// with console.error and never throw.
export class Autosave {
  private planId: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly save: (planId: string) => void,
    private readonly delayMs = 1000,
  ) {}

  get pending(): boolean {
    return this.planId !== null;
  }

  changed(planId: string): void {
    if (this.planId !== null && this.planId !== planId) {
      try {
        this.flush();
      } catch (e) {
        console.error('autosave failed', e);
      }
    }
    this.planId = planId;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        this.flush();
      } catch (e) {
        console.error('autosave failed', e);
      }
    }, this.delayMs);
  }

  flush(): void {
    this.clearTimer();
    const id = this.planId;
    if (id === null) return;
    this.planId = null;
    this.save(id);
  }

  cancel(): void {
    this.clearTimer();
    this.planId = null;
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
