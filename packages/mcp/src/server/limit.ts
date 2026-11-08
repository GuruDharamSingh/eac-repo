/**
 * Sliding-window limits per grant (PLAN.md §2.7), in memory in this process,
 * as actionRoutes does: one container serves the endpoint, and a restart
 * clears the windows (accepted).
 */
export interface Window {
  /** Calls allowed in the window. */
  max: number;
  ms: number;
}

/** Every request to the endpoint, per grant. */
export const REQUEST_LIMIT: Window = { max: 120, ms: 60_000 };
/** Tool calls, per grant. */
export const CALL_LIMIT: Window = { max: 60, ms: 60_000 };
/** Tools that run Channel's loader (~15 reads each), per grant. */
export const HEAVY_LIMIT: Window = { max: 10, ms: 60_000 };

export class Limiter {
  private hits = new Map<string, number[]>();

  /** Records a hit and answers null, or the seconds until the next one is allowed. */
  take(key: string, w: Window, now = Date.now()): number | null {
    const from = now - w.ms;
    const list = (this.hits.get(key) ?? []).filter((t) => t > from);
    if (list.length >= w.max) {
      this.hits.set(key, list);
      return Math.max(1, Math.ceil((list[0] + w.ms - now) / 1000));
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.sweep(now);
    return null;
  }

  private sweep(now: number) {
    for (const [k, v] of this.hits) if (!v.length || v[v.length - 1] < now - 3600_000) this.hits.delete(k);
  }
}
