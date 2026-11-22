// ============================================================================
// Free move (2026-11-20, free placement): drag a box anywhere in x and y without
// changing the layout it sits in. Only reports; the host writes `fx`/`fy` on the
// node's look (block/style.ts), drawn as CSS `translate`, so removing them puts
// the box back where the flow had it.
//
// While dragging: the box snaps to its neighbours' and its parent's edges and
// centres, with a guide line, else to a light grid (offsets in whole GRID steps).
// Alt or Ctrl pulls free; Shift keeps to one axis; Esc puts it back.
// ============================================================================

import { BOUNDS } from "../block/style";
import { nearest, snapTargets } from "./box-drag";

/** The light grid, in the page's own pixels. */
export const FREE_GRID = 8;
const clampTo = (n: number) => Math.max(BOUNDS.fx[0], Math.min(BOUNDS.fx[1], n));
const round = (n: number) => Math.round(n * 100) / 100;

export interface FreeMoveOptions {
  /** Where the press began, screen px. */
  start: { x: number; y: number };
  el: HTMLElement;
  /** The stage's scale (a transform in the popup, CSS zoom on a page): screen px per page px. */
  zoom: number;
  /** The offset the box has now. */
  base: { fx: number; fy: number };
  onChange(c: { fx: number; fy: number; label: string }): void;
  /** commit false: Esc was pressed; restore what was there. */
  onEnd(commit: boolean): void;
}

export function startFreeMove(o: FreeMoveOptions): void {
  const { el } = o;
  const z = o.zoom > 0 ? o.zoom : 1;
  const r0 = el.getBoundingClientRect();
  const targets = snapTargets(el);
  const guides: HTMLElement[] = [];
  const guide = (vertical: boolean, at: number, from: number, to: number) => {
    const g = document.createElement("div");
    g.className = "de-snap";
    g.dataset.deUi = "";
    Object.assign(g.style, vertical
      ? { left: `${at - 0.5}px`, top: `${from}px`, width: "1px", height: `${Math.max(0, to - from)}px` }
      : { left: `${from}px`, top: `${at - 0.5}px`, width: `${Math.max(0, to - from)}px`, height: "1px" });
    document.body.append(g);
    guides.push(g);
  };
  const clearGuides = () => { for (const g of guides.splice(0)) g.remove(); };
  let moved = false;

  /** The shift (screen px) that lands one of `edges` on a target, or null. */
  const pull = (edges: number[], list: number[]): number | null => {
    let best: number | null = null;
    for (const e of edges) {
      const t = nearest(e, list);
      if (t !== null && (best === null || Math.abs(t - e) < Math.abs(best))) best = t - e;
    }
    return best;
  };

  const move = (m: PointerEvent) => {
    moved = true;
    clearGuides();
    const free = m.altKey || m.ctrlKey || m.metaKey;
    let dx = m.clientX - o.start.x, dy = m.clientY - o.start.y;
    if (m.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
    let sx: number | null = null, sy: number | null = null;
    if (!free && targets) {
      const l = r0.left + dx, r = r0.right + dx, t = r0.top + dy, b = r0.bottom + dy;
      if (!m.shiftKey || dx) sx = pull([l, (l + r) / 2, r], targets.xs);
      if (!m.shiftKey || dy) sy = pull([t, (t + b) / 2, b], targets.ys);
      if (sx !== null) dx += sx;
      if (sy !== null) dy += sy;
    }
    let fx = o.base.fx + dx / z, fy = o.base.fy + dy / z;
    // No neighbour close: the light grid.
    if (!free) {
      if (sx === null) fx = Math.round(fx / FREE_GRID) * FREE_GRID;
      if (sy === null) fy = Math.round(fy / FREE_GRID) * FREE_GRID;
    }
    fx = round(clampTo(fx)); fy = round(clampTo(fy));
    if (targets) {
      // Guides sit where the snapped edge is now: measured after the host redraws, so draw them in the next frame.
      const sxFinal = sx, syFinal = sy;
      requestAnimationFrame(() => {
        if (!live) return;
        const r = el.getBoundingClientRect();
        if (sxFinal !== null) for (const e of [r.left, (r.left + r.right) / 2, r.right]) if (targets.xs.some((t) => Math.abs(t - e) < 0.75)) guide(true, e, Math.min(r.top, targets.top) - 8, Math.max(r.bottom, targets.bottom) + 8);
        if (syFinal !== null) for (const e of [r.top, (r.top + r.bottom) / 2, r.bottom]) if (targets.ys.some((t) => Math.abs(t - e) < 0.75)) guide(false, e, Math.min(r.left, targets.left) - 8, Math.max(r.right, targets.right) + 8);
      });
    }
    o.onChange({ fx, fy, label: `x ${fx}   y ${fy}` });
  };
  let live = true;
  const stop = () => {
    live = false;
    clearGuides();
    document.removeEventListener("pointermove", move, true);
    document.removeEventListener("pointerup", up, true);
    document.removeEventListener("pointercancel", lost, true);
    document.removeEventListener("keydown", key, true);
  };
  const up = () => { stop(); o.onEnd(moved); };
  const lost = () => { stop(); o.onEnd(false); };
  const key = (k: KeyboardEvent) => {
    if (k.key !== "Escape") return;
    k.preventDefault(); k.stopPropagation();
    stop();
    o.onEnd(false);
  };
  document.addEventListener("pointermove", move, true);
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", lost, true);
  document.addEventListener("keydown", key, true);
}
