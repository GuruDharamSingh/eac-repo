// Undo / redo over JSON snapshots, with coalescing (a run of edits to the
// same key within `windowMs` is one step: dragging a size, typing a colour),
// and dirty tracking against the last saved snapshot.

export class History<D> {
  private past: string[] = [];
  private future: string[] = [];
  private lastKey: string | null = null;
  private lastAt = 0;
  private saved: string;

  constructor(
    private get: () => D,
    private set: (doc: D) => void,
    private opts: { limit?: number; windowMs?: number } = {},
  ) {
    this.saved = JSON.stringify(get());
  }

  /** Call BEFORE changing the document. Same `key` within the window coalesces. */
  remember(key?: string | null): void {
    const now = Date.now();
    if (key && key === this.lastKey && now - this.lastAt < (this.opts.windowMs ?? 800)) { this.lastAt = now; return; }
    this.past.push(JSON.stringify(this.get()));
    if (this.past.length > (this.opts.limit ?? 200)) this.past.shift();
    this.future.length = 0;
    this.lastKey = key || null;
    this.lastAt = now;
  }

  undo(): boolean {
    const prev = this.past.pop();
    if (prev === undefined) return false;
    this.future.push(JSON.stringify(this.get()));
    this.set(JSON.parse(prev));
    this.lastKey = null;
    return true;
  }

  redo(): boolean {
    const next = this.future.pop();
    if (next === undefined) return false;
    this.past.push(JSON.stringify(this.get()));
    this.set(JSON.parse(next));
    this.lastKey = null;
    return true;
  }

  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }

  /** Mark a snapshot (default: the current document) as saved. */
  markSaved(snapshot?: string): void { this.saved = snapshot ?? JSON.stringify(this.get()); }
  dirty(): boolean { return JSON.stringify(this.get()) !== this.saved; }
}
