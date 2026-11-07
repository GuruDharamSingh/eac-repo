// ============================================================================
// Click-through over declared sections of any page (2026-11-02). While mounted:
// hover outlines the box a click would select; clicking it shows the boxes
// inside; Esc goes back out; Enter goes to the first box inside; Alt+click goes
// straight to the deepest box under the pointer; right-click lists every box
// under the pointer. Links and buttons inside a section do not fire.
//
// It only reports: the host decides what a selection may edit. The overlay is a
// fixed sheet over the page, so it needs no wrapper around the page's markup.
// ============================================================================

import { childLayers, elementAt, layerChain, layerName, nextLayer, parentLayer, sectionOf, addressOf } from "./layers";
import { openMenu, type MenuHandle, type MenuItem } from "./menu";
import { rectIn } from "./overlay";
import { Listeners } from "./interact";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const holds = (a: HTMLElement, b: HTMLElement) => a.contains(b);
const isUi = (t: Element | null) => !!t?.closest?.("[data-de-menu],[data-de-ui],[contenteditable='true']");

/**
 * A stretched link or button lying over a card (`.eac-face-hit`) has nothing of its own to show, and a click on the card
 * means what is under it. The card's other children set `pointer-events: none` so that the cover takes the click, which is
 * why this asks by rectangle: otherwise the card's title and summary cannot be reached from the page.
 */
function coveredBy(t: Element | null, x: number, y: number): Element | null {
  if (!(t instanceof HTMLElement) || !/^(A|BUTTON)$/.test(t.tagName)) return t;
  if (t.textContent?.trim() || t.childElementCount || getComputedStyle(t).position !== "absolute") return t;
  const holder = t.parentElement;
  if (!holder) return t;
  const under = elementAt(holder, x, y);
  return under && under !== t ? under : holder;
}

/** Where boxes come from. Default: read off the page's declared sections (layers.ts). */
export interface LayerSource {
  /** The boxes around a target, outermost first. */
  chain(target: Element | null): HTMLElement[];
  kids(el: HTMLElement): HTMLElement[];
  parent(el: HTMLElement): HTMLElement | null;
  name(el: HTMLElement): string;
}

const VISUAL: LayerSource = {
  chain(t) { const s = sectionOf(t); return s ? layerChain(t, s) : []; },
  kids: childLayers,
  parent(el) { const s = sectionOf(el); return s ? parentLayer(el, s) : null; },
  name: layerName,
};

export interface ClickThroughOptions {
  /** Where the selection boxes are drawn. Default: a sheet over the whole window. */
  host?: HTMLElement;
  /** Where the right-click menu goes. Default: the document's body. */
  menuHost?: HTMLElement;
  layers?: LayerSource;
  /** A click on no box: what to select instead (the page itself). Default: nothing. */
  emptyTarget?(target: Element): HTMLElement | null;
  /** Double click, or Enter on a box with nothing inside. */
  onDouble?(el: HTMLElement): void;
  /** Called whenever the selection changes; `address` is stable while the page's structure is. */
  onSelect?(el: HTMLElement | null, address: string | null): void;
  /** Find targets by rectangle, for pages that set pointer-events: none inside their components (Puck). */
  rectHit?: () => HTMLElement[] | null;
  /** Show the boxes inside the selection. Default true. */
  reveal?: boolean;
  /** After every draw: the host's own chrome can follow the selection. */
  onDraw?(el: HTMLElement | null): void;
  /** Handles on the selection: any of "e", "s", "se". */
  handles?(el: HTMLElement): string[];
  /** The tools of the right-click menu, for the selected box. Layers are added as an expandable row. */
  menu?(el: HTMLElement): MenuItem[];
  onMenu?(id: string, el: HTMLElement): void;
  /** Passed to the menu: scrolling in this target leaves it open. */
  menuKeepsOnScroll?(target: Node): boolean;
  /** A handle was pressed. */
  onHandle?(ev: PointerEvent, handle: string, el: HTMLElement): void;
  /** The selection was pressed and pulled more than a few px. */
  onPull?(ev: PointerEvent, el: HTMLElement): void;
}

export interface ClickThroughHandle {
  selected(): HTMLElement | null;
  select(el: HTMLElement | null): void;
  /** Outline a box from elsewhere (a layer row); null clears it. */
  hover(el: HTMLElement | null): void;
  /** Draw again after the page changed underneath. */
  refresh(): void;
  /** The selection's element was redrawn, or is gone: follow it without reporting a change. */
  adopt(el: HTMLElement | null): void;
  /** Open the right-click menu for the selection at a point (the bar's More). */
  menuAt(x: number, y: number): void;
  /** Hold hover and clicks while the host runs a drag; `label` replaces the selection's tag. */
  hold(on: boolean, label?: string): void;
  dispose(): void;
}

/** Mounts holding `de-editing` on <html>: the popup's own mount closing must not strip it from the page's. */
let editingMounts = 0;

export function mountClickThrough(o: ClickThroughOptions = {}): ClickThroughHandle {
  const L = new Listeners();
  const layer = document.createElement("div");
  layer.className = "de-layer-sheet";
  layer.dataset.deUi = "";
  (o.host ?? document.body).appendChild(layer);
  editingMounts++;
  document.documentElement.classList.add("de-editing");

  const src = o.layers ?? VISUAL;
  let sel: HTMLElement | null = null;
  let hover: HTMLElement | null = null;
  let menu: MenuHandle | null = null;
  let held = false;
  let heldLabel: string | undefined;
  /** The click that ends a drag must not select anything. */
  let swallowClick = false;

  const box = (el: HTMLElement, cls: string, label?: string) => {
    const b = document.createElement("div");
    b.className = `de-box ${cls}`.trim();
    const rc = rectIn(el, layer);
    Object.assign(b.style, rc);
    b.dataset.side = parseFloat(rc.top) >= 24 ? "above" : "below";
    if (label) b.innerHTML = `<span class="de-chips"><span class="de-tag">${esc(label)}</span></span>`;
    layer.appendChild(b);
  };

  function draw() {
    layer.innerHTML = "";
    if (sel && !sel.isConnected) sel = null;
    if (hover && !hover.isConnected) hover = null;
    if (sel && o.reveal !== false) for (const k of src.kids(sel)) if (k !== hover) box(k, "kid");
    if (sel) {
      box(sel, "", heldLabel ?? src.name(sel));
      const b = layer.lastElementChild as HTMLElement;
      // The name only shows while it says something a drag changes, as on the canvas; the panel names the box.
      if (heldLabel) b.dataset.showTag = "";
      const hs = o.handles?.(sel) ?? [];
      for (const h of hs) {
        const s = document.createElement("span");
        s.className = `de-handle ${h}`;
        s.dataset.h = h;
        b.appendChild(s);
      }
      // A box that can be resized wears all four corners; the top left one does nothing, because a box grows from there.
      if (hs.includes("se")) { const c = document.createElement("span"); c.className = "de-corner nw"; b.appendChild(c); }
    }
    if (hover && hover !== sel) box(hover, "hov", src.name(hover));
    o.onDraw?.(sel);
  }

  function select(el: HTMLElement | null) {
    if (el === sel) return;
    sel = el;
    hover = null;
    draw();
    const section = el && !o.layers ? sectionOf(el) : null;
    o.onSelect?.(el, el && section ? addressOf(el, section) : null);
  }

  function targetAt(ev: MouseEvent): Element | null {
    const t = coveredBy(ev.target as Element | null, ev.clientX, ev.clientY);
    const roots = o.rectHit?.();
    if (!roots) return t;
    for (const r of roots) {
      const hit = elementAt(r, ev.clientX, ev.clientY);
      if (hit) return hit;
    }
    return null;
  }

  const chainFor = (ev: MouseEvent): HTMLElement[] => src.chain(targetAt(ev));

  L.on(document, "mousemove", (ev: MouseEvent) => {
    if (held || menu || isUi(ev.target as Element)) return;
    const next = nextLayer(chainFor(ev), sel, holds);
    if (next !== hover) { hover = next; draw(); }
  }, true);

  // The click that ends a drag comes right after the button is released, even when
  // Esc ended the drag earlier. A release off the box brings no click, so the flag
  // must not outlive it and eat the next real one.
  L.on(document, "pointerup", () => { if (swallowClick) setTimeout(() => { swallowClick = false; }, 0); }, true);

  L.on(layer, "pointerdown", (ev: PointerEvent) => {
    const h = (ev.target as HTMLElement).dataset?.h;
    if (!h || !sel || ev.button !== 0) return;
    ev.preventDefault();
    swallowClick = true;
    o.onHandle?.(ev, h, sel);
  });

  L.on(document, "pointerdown", (ev: PointerEvent) => {
    if (ev.button !== 0 || held || !sel || !o.onPull || isUi(ev.target as Element) || !chainFor(ev).includes(sel)) return;
    const pressed = sel, x0 = ev.clientX, y0 = ev.clientY;
    const stop = () => { document.removeEventListener("pointermove", move, true); document.removeEventListener("pointerup", stop, true); };
    const move = (m: PointerEvent) => {
      if (Math.hypot(m.clientX - x0, m.clientY - y0) < 5) return;
      stop();
      swallowClick = true;
      o.onPull!(m, pressed);
    };
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", stop, true);
  }, true);

  L.on(document, "click", (ev: MouseEvent) => {
    if (swallowClick) {
      swallowClick = false;
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    if (isUi(ev.target as Element)) return;
    // Held (a preview, a tool): the page stays inert and the selection stays put.
    if (held) { ev.preventDefault(); ev.stopPropagation(); return; }
    const chain = chainFor(ev);
    if (!chain.length) { select(o.emptyTarget?.(ev.target as Element) ?? null); return; }
    ev.preventDefault();
    ev.stopPropagation();
    select(ev.altKey ? chain[chain.length - 1]! : nextLayer(chain, sel, holds));
  }, true);

  // A press can start a page's own behaviour (a link drag, a component's handler).
  // A picture's native drag would also cancel the pointer, so ours would never see the release.
  L.on(document, "dragstart", (ev: DragEvent) => { if (!isUi(ev.target as Element) && src.chain(ev.target as Element).length) ev.preventDefault(); }, true);

  if (o.onDouble) {
    L.on(document, "dblclick", (ev: MouseEvent) => {
      if (held || isUi(ev.target as Element)) return;
      const chain = chainFor(ev);
      const last = chain[chain.length - 1];
      if (!last) return;
      ev.preventDefault();
      if (last !== sel) select(last);
      o.onDouble!(last);
    }, true);
  }

  function showMenu(x: number, y: number, chain: HTMLElement[]) {
    menu?.close();
    const target = sel;
    if (!target) return;
    const tools = o.menu?.(target) ?? [];
    const layers: MenuItem = {
      id: "layers", label: "Layers", sep: tools.length > 0,
      kids: chain.map((el, i) => ({ id: `layer:${i}`, label: `${"· ".repeat(i)}${src.name(el)}`, hint: el === target ? "✓" : undefined })),
    };
    menu = openMenu({
      x, y, title: src.name(target),
      host: o.menuHost,
      items: chain.length ? [...tools, layers] : tools,
      onPick(id) {
        if (id.startsWith("layer:")) select(chain[Number(id.slice(6))] ?? null);
        else o.onMenu?.(id, target);
      },
      onActive(id) {
        const next = id?.startsWith("layer:") ? chain[Number(id.slice(6))] ?? null : null;
        if (next !== hover) { hover = next; draw(); }
      },
      onClose: () => { menu = null; hover = null; draw(); },
      keepOnScroll: o.menuKeepsOnScroll,
    });
  }

  L.on(document, "contextmenu", (ev: MouseEvent) => {
    if (held || isUi(ev.target as Element)) return;
    const chain = chainFor(ev);
    if (!chain.length) return;
    ev.preventDefault();
    ev.stopPropagation();
    // A press beside the selection acts on what a click there would select.
    if (!sel || !chain.includes(sel)) select(nextLayer(chain, sel, holds));
    showMenu(ev.clientX, ev.clientY, chain);
  }, true);

  L.on(document, "keydown", (ev: KeyboardEvent) => {
    if (held || menu || !sel || isUi(ev.target as Element)) return;
    if (ev.key === "Escape") {
      ev.preventDefault();
      select(src.parent(sel));
    } else if (ev.key === "Enter") {
      const first = src.kids(sel)[0];
      if (first) { ev.preventDefault(); select(first); }
      else if (o.onDouble) { ev.preventDefault(); o.onDouble(sel); }
    }
  }, true);

  L.on(document, "mouseleave", () => { if (hover) { hover = null; draw(); } });
  // Boxes are measured in the viewport, so they are drawn again on every scroll and resize.
  let raf = 0;
  const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
  L.on(window, "scroll", later, true);
  L.on(window, "resize", later);

  return {
    selected: () => sel,
    select,
    hover(el) { if (el !== hover) { hover = el; draw(); } },
    refresh: draw,
    menuAt(x, y) { if (sel) showMenu(x, y, src.chain(sel)); },
    adopt(el) { sel = el; if (hover && !hover.isConnected) hover = null; draw(); },
    hold(on, label) {
      held = on;
      heldLabel = on ? label : undefined;
      if (on) hover = null;
      draw();
    },
    dispose() {
      if (raf) cancelAnimationFrame(raf);
      menu?.close();
      L.dispose();
      layer.remove();
      if (--editingMounts <= 0) { editingMounts = 0; document.documentElement.classList.remove("de-editing"); }
    },
  };
}
