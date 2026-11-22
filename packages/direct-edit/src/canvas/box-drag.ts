// ============================================================================
// Resizing and moving boxes on a real page (2026-11-02). Both only report; the
// host writes the edits, so the page's markup never changes.
//
// Resize: east, south and corner handles. An in-flow box is anchored at its
// top-left, so pulling a left or top edge could only ever grow it the other way
// (the canvas does this, developer's video, 2026-11-02); those handles are not
// offered. In a grid the width lands on whole columns.
//
// Move: among the box's neighbours, stored as CSS `order`. A box cannot leave
// its parent: that would change the page's structure, which this layer does not.
// ============================================================================

import { BOUNDS } from "../block/style";
import { isLayer } from "./layers";

const NEVER = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "LINK", "META"]);
const px = (v: string) => parseFloat(v) || 0;
const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.max(lo, Math.min(hi, n));

export interface ResizeChange { w?: number; h?: number; cspan?: number; label: string }

export interface ResizeOptions {
  ev: PointerEvent;
  el: HTMLElement;
  handle: string;
  /**
   * Top and left handles count (2026-11-11): `n` and `w` in a handle's name change the height and width too, pulled the
   * other way. Without it a handle named `ne` or `sw` changes width or height only, as before.
   */
  sides?: boolean;
  /** Snap a moving edge to its neighbours' and the parent's edges, and a size to a neighbour's, with a guide line. Alt or Ctrl pulls free. */
  snap?: boolean;
  /** Screen pixels per page pixel when the page is drawn scaled (CSS zoom): sizes handed back are page pixels. Default 1. */
  zoom?: number;
  onChange(c: ResizeChange): void;
  /** commit false: Esc was pressed; restore what was there. */
  onEnd(commit: boolean): void;
}

function gridInfo(el: HTMLElement): { cols: number; step: number } | null {
  const p = el.parentElement;
  if (!p) return null;
  const cs = getComputedStyle(p);
  if (!cs.display.includes("grid")) return null;
  const tracks = cs.gridTemplateColumns.split(" ").map(px);
  if (!tracks.length || !tracks[0]) return null;
  return { cols: tracks.length, step: tracks[0] + px(cs.columnGap) };
}

/** Within this many pixels a moving edge or a size snaps. */
const SNAP = 6;

export interface SnapTargets { xs: number[]; ys: number[]; ws: number[]; hs: number[]; top: number; bottom: number; left: number; right: number }

const contents = (e: Element) => getComputedStyle(e).display === "contents";
/** The boxes a parent lays out, through `display: contents` wrappers (the tree canvas wraps every node in one). */
function laidOut(p: Element): HTMLElement[] {
  return (Array.from(p.children) as HTMLElement[]).flatMap((k) => (NEVER.has(k.tagName.toUpperCase()) ? [] : contents(k) ? laidOut(k) : [k]));
}

/** Edges and sizes worth snapping to, read once at the start: the neighbours' and the parent's inner edges. */
export function snapTargets(el: HTMLElement): SnapTargets | null {
  let p = el.parentElement;
  while (p && contents(p)) p = p.parentElement;
  if (!p) return null;
  const pr = p.getBoundingClientRect(), cs = getComputedStyle(p);
  const inner = { left: pr.left + px(cs.paddingLeft) + px(cs.borderLeftWidth), right: pr.right - px(cs.paddingRight) - px(cs.borderRightWidth), top: pr.top + px(cs.paddingTop) + px(cs.borderTopWidth), bottom: pr.bottom - px(cs.paddingBottom) - px(cs.borderBottomWidth) };
  const t: SnapTargets = { xs: [inner.left, inner.right, (inner.left + inner.right) / 2], ys: [inner.top, inner.bottom], ws: [inner.right - inner.left], hs: [], ...inner };
  for (const k of laidOut(p)) {
    if (k === el || k.contains(el)) continue;
    const r = k.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    t.xs.push(r.left, r.right); t.ys.push(r.top, r.bottom); t.ws.push(r.width); t.hs.push(r.height);
  }
  return t;
}

/** The nearest candidate within SNAP of `v`, or null. */
export function nearest(v: number, list: number[]): number | null {
  let best: number | null = null;
  for (const c of list) if (Math.abs(c - v) <= SNAP && (best === null || Math.abs(c - v) < Math.abs(best - v))) best = c;
  return best;
}

export function startBoxResize(o: ResizeOptions): void {
  const { ev, el, handle } = o;
  const x0 = ev.clientX, y0 = ev.clientY;
  const r0 = el.getBoundingClientRect();
  // Which way each axis pulls: +1 from the right or bottom, -1 from the left or top (sides only), 0 not at all.
  const dx = handle.includes("e") ? 1 : o.sides && handle.includes("w") ? -1 : 0;
  const dy = handle.includes("s") ? 1 : o.sides && handle.includes("n") ? -1 : 0;
  const grid = dx ? gridInfo(el) : null;
  const gap = el.parentElement ? px(getComputedStyle(el.parentElement).columnGap) : 0;
  const z = o.zoom && o.zoom > 0 ? o.zoom : 1;
  const targets = o.snap ? snapTargets(el) : null;
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

  const move = (m: PointerEvent) => {
    moved = true;
    clearGuides();
    const free = !targets || m.altKey || m.ctrlKey || m.metaKey;
    const c: ResizeChange = { label: "" };
    const parts: string[] = [];
    let snapped = false;
    if (dx) {
      let w = r0.width + dx * (m.clientX - x0);
      if (!grid && !free) {
        // A right edge lands on a neighbour's or the parent's edge; any pull can match a neighbour's width.
        const edge = dx > 0 ? nearest(r0.left + w, targets!.xs) : null;
        const same = nearest(w, targets!.ws);
        if (edge !== null && (same === null || Math.abs(edge - (r0.left + w)) <= Math.abs(same - w))) {
          w = edge - r0.left; snapped = true;
          guide(true, edge, Math.min(targets!.top, r0.top), Math.max(targets!.bottom, r0.bottom));
        } else if (same !== null) {
          w = same; snapped = true;
          guide(false, r0.bottom + 6, r0.left, r0.left + w);
        }
      }
      if (grid) {
        c.cspan = Math.max(1, Math.min(grid.cols, Math.round((w / z + gap) / grid.step)));
        parts.push(`${c.cspan} of ${grid.cols} columns`);
      } else {
        c.w = Math.round(clamp(w / z, BOUNDS.w));
        parts.push(`${c.w}px wide`);
      }
    }
    if (dy) {
      let h = r0.height + dy * (m.clientY - y0);
      if (!free) {
        const edge = dy > 0 ? nearest(r0.top + h, targets!.ys) : null;
        const same = nearest(h, targets!.hs);
        if (edge !== null && (same === null || Math.abs(edge - (r0.top + h)) <= Math.abs(same - h))) {
          h = edge - r0.top; snapped = true;
          guide(false, edge, Math.min(targets!.left, r0.left), Math.max(targets!.right, r0.right));
        } else if (same !== null) {
          h = same; snapped = true;
          guide(true, r0.right + 6, r0.top, r0.top + h);
        }
      }
      c.h = Math.round(clamp(h / z, BOUNDS.h));
      parts.push(`${c.h}px tall`);
    }
    c.label = parts.join(" · ") + (snapped ? " · snapped" : "");
    o.onChange(c);
  };
  const stop = () => {
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

/** What actually moves: a box collapsed into a wrapper (layers.ts) moves with its wrapper. */
export function movableOf(el: HTMLElement, section: HTMLElement): HTMLElement | null {
  let e = el;
  while (e !== section && e.parentElement && e.parentElement !== section && !isLayer(e.parentElement)) e = e.parentElement;
  return e === section ? null : e;
}

/** The element children of a parent in the order they are drawn. */
export function drawnOrder(parent: Element): HTMLElement[] {
  const kids = Array.from(parent.children).filter((k) => !NEVER.has(k.tagName.toUpperCase())) as HTMLElement[];
  const order = new Map(kids.map((k) => [k, Number(getComputedStyle(k).order) || 0]));
  return kids.map((k, i) => ({ k, i })).sort((a, b) => order.get(a.k)! - order.get(b.k)! || a.i - b.i).map((x) => x.k);
}

type Axis = "row" | "column" | "grid";
function axisOf(parent: Element): Axis {
  const cs = getComputedStyle(parent);
  if (cs.display.includes("grid")) return "grid";
  return cs.display.includes("flex") && cs.flexDirection.startsWith("row") ? "row" : "column";
}

/** Where a drop at (x, y) lands among `others`: the index to insert before. */
export function dropIndex(others: DOMRect[], axis: Axis, x: number, y: number): number {
  for (let i = 0; i < others.length; i++) {
    const r = others[i]!;
    if (axis === "column" && y < r.top + r.height / 2) return i;
    if (axis === "row" && x < r.left + r.width / 2) return i;
    if (axis === "grid" && (y < r.top || (y <= r.bottom && x < r.left + r.width / 2))) return i;
  }
  return others.length;
}

export interface MoveOptions {
  ev: PointerEvent;
  el: HTMLElement;
  /** Shown beside the pointer. */
  name: string;
  /** The parent's children in their new order. */
  onDrop(sequence: HTMLElement[]): void;
  onEnd(): void;
  /** Where the line and the label go. Default: the document's body. */
  host?: HTMLElement;
  /** Only these children can change places. Default: all of them. */
  among?: HTMLElement[];
  /** The pointer moved. */
  onMove?(ev: PointerEvent): void;
}

export function startBoxMove(o: MoveOptions): void {
  const { el } = o;
  const parent = el.parentElement!;
  const axis = axisOf(parent);
  const all = drawnOrder(parent).filter((k) => !o.among || o.among.includes(k));
  const others = all.filter((k) => k !== el && k.getBoundingClientRect().width > 0);

  const line = document.createElement("div");
  line.className = "de-insert";
  line.dataset.deUi = "";
  const ghost = document.createElement("div");
  ghost.className = "de-ghost";
  ghost.dataset.deUi = "";
  ghost.textContent = o.name;
  (o.host ?? document.body).append(line, ghost);
  document.documentElement.classList.add("de-moving");
  let index = -1;

  const place = (m: PointerEvent) => {
    o.onMove?.(m);
    ghost.style.left = `${m.clientX + 12}px`;
    ghost.style.top = `${m.clientY + 12}px`;
    const rects = others.map((k) => k.getBoundingClientRect());
    index = dropIndex(rects, axis, m.clientX, m.clientY);
    const at = rects[index], prev = rects[index - 1];
    const box = parent.getBoundingClientRect();
    if (axis === "column") {
      const y = at ? at.top : prev ? prev.bottom : box.top;
      Object.assign(line.style, { left: `${box.left}px`, top: `${y - 1.5}px`, width: `${box.width}px`, height: "3px" });
    } else {
      const r = at ?? prev ?? box;
      const x = at ? at.left : r.right;
      Object.assign(line.style, { left: `${x - 1.5}px`, top: `${r.top}px`, width: "3px", height: `${r.height}px` });
    }
  };
  const finish = () => {
    document.removeEventListener("pointermove", place, true);
    document.removeEventListener("pointerup", up, true);
    document.removeEventListener("pointercancel", finish, true);
    document.removeEventListener("keydown", key, true);
    line.remove();
    ghost.remove();
    document.documentElement.classList.remove("de-moving");
    o.onEnd();
  };
  const up = () => {
    const seq = all.filter((k) => k !== el);
    if (index >= 0) {
      // `index` counts boxes with a size; hidden siblings stay where they are relative to them.
      const before = others[index];
      seq.splice(before ? seq.indexOf(before) : seq.length, 0, el);
      if (seq.some((k, i) => k !== all[i])) o.onDrop(seq);
    }
    finish();
  };
  const key = (k: KeyboardEvent) => {
    if (k.key !== "Escape") return;
    k.preventDefault(); k.stopPropagation();
    finish();
  };
  document.addEventListener("pointermove", place, true);
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", finish, true);
  document.addEventListener("keydown", key, true);
  place(o.ev);
}
