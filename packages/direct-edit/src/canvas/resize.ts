// ============================================================================
// Smooth resize on a chosen grid (pass 3). Justin: "resizing the width of the
// box jumps to positions when it should be smooth; perhaps a natural grid to
// be used and to be chosen". So while the handle is held, the block follows the
// pointer pixel for pixel (it may overlap its neighbours; nothing reflows), a
// dashed "landing" ghost shows the grid cells it will occupy, and the sheet's
// grid is drawn. On release it snaps to that ghost. With snapping off (the
// Free level's Snap toggle, or Alt held) it keeps the exact size instead.
//
// Coordinates: the guides layer sits in the unscaled wrapper beside the
// (possibly zoomed) page, so everything here is screen pixels; sizes handed
// back to the host are page pixels (screen / zoom).
// ============================================================================

import { spanOfPx } from "../block/grid";

export interface GridGeometry {
  /** The sheet's content box inside the guides layer (screen px). */
  left: number; top: number; width: number; height: number;
  cols: number; colW: number; gap: number; rowH: number;
}

/** Measure a sheet laid out on a CSS grid of `cols` columns, `gap` gutter and `row` baseline (page px), drawn at `zoom`. */
export function sheetGeometry(sheet: HTMLElement, layer: HTMLElement, grid: { cols: number; gap: number; row: number }, zoom: number): GridGeometry {
  const r = sheet.getBoundingClientRect(), w = layer.getBoundingClientRect(), cs = getComputedStyle(sheet);
  const pl = parseFloat(cs.paddingLeft) * zoom, pr = parseFloat(cs.paddingRight) * zoom, pt = parseFloat(cs.paddingTop) * zoom, pb = parseFloat(cs.paddingBottom) * zoom;
  const gap = grid.gap * zoom, width = r.width - pl - pr;
  return { left: r.left - w.left + pl, top: r.top - w.top + pt, width, height: r.height - pt - pb, cols: grid.cols, gap, colW: (width - gap * (grid.cols - 1)) / grid.cols, rowH: grid.row * zoom };
}

/** Draw the grid (column bands, row bands) into a guides layer. */
export function drawGridGuides(layer: HTMLElement, g: GridGeometry, opts: { rows?: boolean } = {}): void {
  clearGridGuides(layer);
  const d = document.createElement("div");
  d.className = "de-gridlines";
  const colBand = `repeating-linear-gradient(to right, var(--de-grid-col, rgba(10, 126, 164, .09)) 0 ${g.colW}px, transparent ${g.colW}px ${g.colW + g.gap}px)`;
  const rowBand = `repeating-linear-gradient(to bottom, transparent 0 ${g.rowH}px, var(--de-grid-row, rgba(10, 126, 164, .16)) ${g.rowH}px ${g.rowH + g.gap}px)`;
  Object.assign(d.style, { left: g.left + "px", top: g.top + "px", width: g.width + "px", height: g.height + "px", backgroundImage: opts.rows === false ? colBand : `${colBand}, ${rowBand}` });
  d.dataset.cols = String(g.cols);
  layer.appendChild(d);
}
export function clearGridGuides(layer: HTMLElement): void { layer.querySelectorAll(".de-gridlines").forEach((e) => e.remove()); }

export interface ResizeState {
  /** The live size in page px. */
  wPx: number; hPx: number;
  /** The span it lands on (grid units). */
  span: [number, number];
  snapped: boolean;
  /** At its current place the landing span runs past the sheet's edge: it moves down a row on release. */
  wraps: boolean;
}
export interface ResizeResult {
  span: [number, number];
  /** Exact page-px size kept when snapping was off. */
  free?: { w?: number; h?: number };
}
export interface SmoothResizeOptions {
  /** The block being resized (inside the scaled page). */
  el: HTMLElement;
  handle: string; // "e" | "s" | "se"
  span: [number, number];
  geometry(): GridGeometry;
  zoom: number;
  maxRows: number;
  /** Snap to the grid for this move? (read live: Alt or a toggle) */
  snap(ev: PointerEvent | KeyboardEvent | null): boolean;
  /** Where the landing ghost and grid lines are drawn. */
  guides: HTMLElement;
  onMove(s: ResizeState): void;
  onEnd(r: ResizeResult | null): void;
}

const KEEP = ["width", "height", "justifySelf", "alignSelf", "zIndex", "position", "maxWidth", "minHeight", "overflow", "transition"] as const;

export function startSmoothResize(ev: PointerEvent, o: SmoothResizeOptions): void {
  const x0 = ev.clientX, y0 = ev.clientY;
  const r0 = o.el.getBoundingClientRect();
  const lay = o.guides.getBoundingClientRect();
  const saved: Record<string, string> = {};
  for (const k of KEEP) saved[k] = o.el.style[k];
  const pos = getComputedStyle(o.el).position;
  Object.assign(o.el.style, { justifySelf: "start", alignSelf: "start", zIndex: "6", maxWidth: "none", transition: "none", position: pos === "static" ? "relative" : o.el.style.position });
  o.el.classList.add("de-resizing-el");
  const ghost = document.createElement("div");
  ghost.className = "de-landing";
  o.guides.appendChild(ghost);
  document.body.classList.add("de-resizing", "de-resize-" + o.handle);
  let last: { w: number; h: number; snapped: boolean; span: [number, number] } | null = null;
  let lastEv: PointerEvent | KeyboardEvent | null = ev;
  const wide = o.handle !== "s", tall = o.handle !== "e";

  const update = (cx: number, cy: number, e: PointerEvent | KeyboardEvent | null) => {
    const g = o.geometry();
    const w = wide ? Math.max(24, r0.width + (cx - x0)) : r0.width;
    const h = tall ? Math.max(16, r0.height + (cy - y0)) : r0.height;
    if (wide) o.el.style.width = w / o.zoom + "px";
    if (tall) { o.el.style.height = h / o.zoom + "px"; o.el.style.minHeight = "0"; o.el.style.overflow = "hidden"; }
    const snapped = o.snap(e);
    const c = wide ? spanOfPx(w, g.colW + g.gap, g.gap, g.cols) : o.span[0];
    const r = tall ? spanOfPx(h, g.rowH + g.gap, g.gap, o.maxRows) : o.span[1];
    const gw = c * g.colW + (c - 1) * g.gap;
    const gh = tall ? r * g.rowH + (r - 1) * g.gap : r0.height;
    const left = r0.left - lay.left, top = r0.top - lay.top;
    const wraps = left + gw > g.left + g.width + 1;
    ghost.hidden = !snapped;
    Object.assign(ghost.style, { left: left + "px", top: top + "px", width: Math.min(gw, g.left + g.width - left) + "px", height: gh + "px" });
    ghost.classList.toggle("wraps", wraps);
    ghost.dataset.label = `${c} × ${r}${wraps ? " · moves down a row" : ""}`;
    last = { w, h, snapped, span: [c, r] };
    o.onMove({ wPx: w / o.zoom, hPx: h / o.zoom, span: [c, r], snapped, wraps });
  };
  let cur = { x: x0, y: y0 }, moved = false;
  const move = (e: PointerEvent) => { cur = { x: e.clientX, y: e.clientY }; if (Math.hypot(e.clientX - x0, e.clientY - y0) > 2) moved = true; lastEv = e; update(e.clientX, e.clientY, e); };
  // Alt toggles snapping live, without moving the pointer.
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(true); return; }
    if (e.key === "Alt") { e.preventDefault(); lastEv = e; update(cur.x, cur.y, e); }
  };
  const up = () => finish(false);
  function finish(cancel: boolean) {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("keydown", key, true);
    document.removeEventListener("keyup", key, true);
    document.body.classList.remove("de-resizing", "de-resize-" + o.handle);
    o.el.classList.remove("de-resizing-el");
    for (const k of KEEP) o.el.style[k] = saved[k]!;
    ghost.remove();
    const l = last as { w: number; h: number; snapped: boolean; span: [number, number] } | null;
    if (cancel || !l || !moved) { o.onEnd(null); return; }
    void lastEv;
    if (l.snapped) {
      o.onEnd(l.span[0] !== o.span[0] || l.span[1] !== o.span[1] ? { span: l.span } : null);
      return;
    }
    const g = o.geometry();
    const span: [number, number] = [
      wide ? spanOfPx(l.w, g.colW + g.gap, g.gap, g.cols, Math.ceil) : o.span[0],
      tall ? spanOfPx(l.h, g.rowH + g.gap, g.gap, o.maxRows, Math.ceil) : o.span[1],
    ];
    o.onEnd({ span, free: { ...(wide ? { w: Math.round(l.w / o.zoom) } : {}), ...(tall ? { h: Math.round(l.h / o.zoom) } : {}) } });
  }
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
  document.addEventListener("keydown", key, true);
  document.addEventListener("keyup", key, true);
  update(x0, y0, ev);
}
