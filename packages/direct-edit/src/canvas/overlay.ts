// ============================================================================
// Selection overlay: hover and selection boxes drawn over the rendered page,
// with a name tag, edge handles (resize) and grips (graft, move). Absolutely
// positioned inside a wrapper that also holds the page, so it scrolls with it.
// The overlay ignores the pointer except on handles and grips.
//
// The tag and the grips sit in one chip row OUTSIDE the box (above it, or
// below when the box touches the top of the page), so they never cover the
// selected text. The wrapper is not scaled: the page inside it may be (zoom),
// and boxes are measured in screen pixels, so handles stay the same size.
// ============================================================================

import { elFor, sameRef, type NodeRef } from "../model/nodes";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export interface OverlayOptions {
  /** Where node elements live. */
  scope: HTMLElement;
  /** The positioned wrapper both the page and the overlay sit in. */
  wrap: HTMLElement;
  /** The overlay element (pointer-events: none). */
  layer: HTMLElement;
  /** The tag text for a ref. */
  describe: (r: NodeRef) => string;
  /** Edge handles for the selection: any of "e", "s", "se". */
  handles?: (r: NodeRef) => string[];
  /** Grips on the selection: [id, label, title]. */
  grips?: (r: NodeRef) => Array<[string, string, string]>;
  /** Hide the selection chrome (while typing in the part). */
  quiet?: () => boolean;
  /** Pass 3: find a ref's element yourself (e.g. inside one instance of a repeated design). Default elFor(scope, r). */
  find?: (r: NodeRef, which: "sel" | "hover") => HTMLElement | null;
  /** Pass 3: other elements that follow the selection (the same node in every other instance): dashed outlines. */
  follow?: (r: NodeRef) => HTMLElement[];
  /** The boxes inside the selection, shown faintly so the next click's targets can be seen. */
  reveal?: (r: NodeRef, el: HTMLElement) => HTMLElement[];
}

export function rectIn(el: HTMLElement, wrap: HTMLElement) {
  const r = el.getBoundingClientRect(), w = wrap.getBoundingClientRect();
  return { left: r.left - w.left + "px", top: r.top - w.top + "px", width: r.width + "px", height: r.height + "px" };
}

/** Does the chip row fit above a box whose top edge is `top` px below the wrapper's top? */
const ROOM_ABOVE = 24;

export class Overlay {
  constructor(private o: OverlayOptions) {}

  private el(r: NodeRef | null, which: "sel" | "hover"): HTMLElement | null { return r ? (this.o.find ? this.o.find(r, which) : elFor(this.o.scope, r)) : null; }

  render(sel: NodeRef | null, hover: NodeRef | null): void {
    const { layer, wrap } = this.o;
    layer.innerHTML = "";
    if (sel && this.o.follow) {
      for (const f of this.o.follow(sel)) {
        const b = document.createElement("div");
        b.className = "de-box follow";
        Object.assign(b.style, rectIn(f, wrap));
        layer.appendChild(b);
      }
    }
    if (hover && !sameRef(sel, hover)) {
      const el = this.el(hover, "hover");
      if (el) {
        const b = document.createElement("div");
        b.className = "de-box hov";
        const rc = rectIn(el, wrap);
        Object.assign(b.style, rc);
        b.dataset.side = parseFloat(rc.top) >= ROOM_ABOVE ? "above" : "below";
        b.innerHTML = `<span class="de-chips"><span class="de-tag">${esc(this.o.describe(hover))}</span></span>`;
        layer.appendChild(b);
      }
    }
    const el = this.el(sel, "sel");
    if (!el || !sel) return;
    if (!this.o.quiet?.()) {
      for (const k of this.o.reveal?.(sel, el) ?? []) {
        const kb = document.createElement("div");
        kb.className = "de-box kid";
        Object.assign(kb.style, rectIn(k, wrap));
        layer.appendChild(kb);
      }
    }
    const b = document.createElement("div");
    b.className = "de-box";
    const rc = rectIn(el, wrap);
    Object.assign(b.style, rc);
    b.dataset.side = parseFloat(rc.top) >= ROOM_ABOVE ? "above" : "below";
    if (this.o.quiet?.()) { b.classList.add("quiet"); layer.appendChild(b); return; }
    const grips = (this.o.grips?.(sel) ?? []).map(([id, label, title]) => `<span class="de-grip" data-grip="${esc(id)}" title="${esc(title)}">${esc(label)}</span>`).join("");
    const handles = (this.o.handles?.(sel) ?? []).map((h) => `<span class="de-handle ${esc(h)}" data-h="${esc(h)}"></span>`).join("");
    b.innerHTML = `<span class="de-chips"><span class="de-tag">${esc(this.o.describe(sel))}</span><span class="de-grips">${grips}</span></span>${handles}` +
      '<span class="de-corner nw"></span><span class="de-corner ne"></span><span class="de-corner sw"></span>';
    layer.appendChild(b);
  }
}
