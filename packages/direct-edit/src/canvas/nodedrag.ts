// ============================================================================
// Dragging nodes between containers (pass 3), the canvas's feel: press on a
// part and pull it; an insertion line shows where it lands among the kids of
// the container under the pointer (a stack's direction and a grid's reading
// order are read from the page's own layout); the target container is
// outlined; near a container's edge the pointer belongs to the container
// around it, which is how a part is pulled OUT of a row. Escape cancels.
//
// The host decides what is a container, what it accepts (kind, depth, freedom
// level) and what a drop does; this file only measures and reports
// (container element, index among its kids without the dragged one).
// ============================================================================

export interface DropSpot {
  container: HTMLElement;
  /** Index among the container's kids, the dragged node excluded. */
  index: number;
  /** The insertion line, screen px; null when the whole container is outlined instead (empty). */
  line: { x: number; y: number; w: number; h: number } | null;
}

export interface DropRules {
  /** Elements that hold nodes (the block's root and its boxes). */
  containers: string;
  /** Only containers inside this element count. */
  scope: HTMLElement;
  /** The container around a container (null at the top). */
  parentOf(c: HTMLElement): HTMLElement | null;
  /** A container's node children, in order. */
  childrenOf(c: HTMLElement): HTMLElement[];
  /** May the dragged thing go in here? */
  accepts(c: HTMLElement): boolean;
  /** What is being moved: never a target, nor anything inside it. */
  source?: HTMLElement | null;
  /** Screen px near a container's edge that belong to its parent (pull-out). Default 8. */
  edge?: number;
}

const mid = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** Where a drop at (x, y) would land, or null. */
export function findDropSpot(x: number, y: number, o: DropRules): DropSpot | null {
  const under = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!under || !o.scope.contains(under)) return null;
  let c = under.closest(o.containers) as HTMLElement | null;
  if (c && !o.scope.contains(c)) c = null;
  const src = o.source ?? null;
  while (c && src && (c === src || src.contains(c))) c = o.parentOf(c);
  // Near an edge, the pointer belongs to the container around this one.
  const edge = o.edge ?? 8;
  while (c) {
    const p = o.parentOf(c);
    if (!p) break;
    const r = c.getBoundingClientRect();
    const e = Math.min(edge, r.width * 0.2, r.height * 0.2);
    if (x < r.left + e || x > r.right - e || y < r.top + e || y > r.bottom - e) c = p; else break;
  }
  while (c && !o.accepts(c)) c = o.parentOf(c);
  if (!c) return null;
  const kids = o.childrenOf(c).filter((k) => k !== src && !(src && src.contains(k)));
  const cs = getComputedStyle(c);
  const grid = cs.display.includes("grid");
  const row = !grid && cs.flexDirection.startsWith("row");
  const wraps = row && cs.flexWrap !== "nowrap";
  const rects = kids.map((k) => k.getBoundingClientRect());
  let index = rects.length;
  if (!row && !grid) index = rects.findIndex((r) => y < mid(r).y);
  else if (row && !wraps) index = rects.findIndex((r) => x < mid(r).x);
  else index = rects.findIndex((r) => y < r.top || (y <= r.bottom && x < mid(r).x));
  if (index < 0) index = rects.length;
  const cr = c.getBoundingClientRect();
  if (!rects.length) {
    const pl = parseFloat(cs.paddingLeft) || 0, pt = parseFloat(cs.paddingTop) || 0;
    return { container: c, index: 0, line: { x: cr.left + pl, y: cr.top + Math.max(2, pt) - 1, w: Math.max(12, cr.width - 2 * pl), h: 3 } };
  }
  const horizontal = !row && !grid; // a column: the line runs across
  const ref = rects[Math.min(index, rects.length - 1)]!;
  const after = index >= rects.length;
  const line = horizontal
    ? { x: ref.left, y: (after ? ref.bottom + 1 : ref.top - 2), w: ref.width, h: 3 }
    : { x: (after ? ref.right + 1 : ref.left - 3), y: ref.top, w: 3, h: ref.height };
  return { container: c, index, line };
}

export interface NodeDragOptions extends DropRules {
  /** Where the ghost and the line are drawn (position: fixed children). */
  host: HTMLElement;
  label: string;
  onDrop(container: HTMLElement, index: number): void;
  onEnd?(dropped: boolean): void;
}

/** A ghost the size of the source (or a chip) follows the pointer; the drop spot is shown live. */
export function startNodeDrag(ev: PointerEvent, o: NodeDragOptions): void {
  const src = o.source ?? null;
  const r0 = src?.getBoundingClientRect();
  const ox = r0 ? ev.clientX - r0.left : 0, oy = r0 ? ev.clientY - r0.top : 0;
  const box = document.createElement("div");
  box.className = "de-ghostbox";
  if (r0) Object.assign(box.style, { width: Math.min(420, r0.width) + "px", height: Math.min(260, r0.height) + "px" });
  else box.classList.add("chip");
  box.innerHTML = `<span class="de-ghost-label"></span>`;
  (box.firstElementChild as HTMLElement).textContent = o.label;
  o.host.appendChild(box);
  const line = document.createElement("div");
  line.className = "de-insert";
  line.hidden = true;
  o.host.appendChild(line);
  src?.classList.add("de-dragsource");
  document.body.classList.add("de-dragging");
  getSelection()?.removeAllRanges();
  let spot: DropSpot | null = null;
  const place = (x: number, y: number) => {
    Object.assign(box.style, { left: x - (r0 ? Math.min(ox, 420) : -12) + "px", top: y - (r0 ? Math.min(oy, 260) : -12) + "px" });
    const s = findDropSpot(x, y, o);
    if (spot?.container !== s?.container) { spot?.container.classList.remove("de-dropbox"); s?.container.classList.add("de-dropbox"); }
    spot = s;
    if (s?.line) { Object.assign(line.style, { left: s.line.x + "px", top: s.line.y + "px", width: s.line.w + "px", height: s.line.h + "px" }); line.hidden = false; }
    else line.hidden = true;
  };
  const move = (e: PointerEvent) => place(e.clientX, e.clientY);
  const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(true); } };
  const up = () => finish(false);
  // The browser took the pointer (a native drag, a gesture): there is no release to wait for.
  const lost = () => finish(true);
  function finish(cancel: boolean) {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    document.removeEventListener("pointercancel", lost);
    document.removeEventListener("keydown", key, true);
    box.remove(); line.remove();
    src?.classList.remove("de-dragsource");
    document.body.classList.remove("de-dragging");
    spot?.container.classList.remove("de-dropbox");
    const s = spot as DropSpot | null;
    if (!cancel && s) o.onDrop(s.container, s.index);
    o.onEnd?.(!cancel && !!s);
  }
  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
  document.addEventListener("pointercancel", lost);
  document.addEventListener("keydown", key, true);
  place(ev.clientX, ev.clientY);
}
