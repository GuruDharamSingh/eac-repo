// ============================================================================
// Layers over the page (2026-11-14, "inception"): the block popup, Puck's one-block
// settings (page-builder `openBlockSettings`) and the popup opened from inside that
// can be open over each other, in any order. Neither package imports the other, so
// the order lives in ONE registry per window under `Symbol.for("eac.layer-stack.v1")`;
// page-builder keeps a copy of this file (src/layer-stack.ts) that reads and writes
// the same registry. Keep both alike.
//
// A layer opened alone keeps the z-index its stylesheet gives it, so a page with one
// layer open is drawn exactly as before. Only a layer opened over another is lifted:
// to the floor below, or one above the highest layer open. The newest is on top, and
// keys (Esc) belong to it alone. Drift check: packages/direct-edit/harness/stack-drift.cjs.
// ============================================================================

export const LAYER_ATTR = "data-eac-layer";
/** The floor of a lifted layer: page-builder's settings sheet sits here, above every editor bar and menu. */
const FLOOR = 2147483600;
const CEILING = 2147483647;
/** One registry per window, shared by direct-edit and page-builder (and any copy of either) through this key. */
const KEY = Symbol.for("eac.layer-stack.v1");

/** The open layers, oldest first. Layers taken out of the page without unstacking are dropped here. */
function registry(): HTMLElement[] {
  const g = globalThis as unknown as Record<symbol, HTMLElement[] | undefined>;
  const list = (g[KEY] ??= []);
  for (let i = list.length - 1; i >= 0; i--) if (!list[i]!.isConnected) list.splice(i, 1);
  return list;
}

/**
 * Registers `el` (already in the page) as the top layer, lifted above any layer open before it. Returns the call that
 * takes it off the stack; call it when the layer closes.
 */
export function stackLayer(el: HTMLElement): () => void {
  const list = registry();
  const below = list.filter((e) => e !== el);
  el.setAttribute(LAYER_ATTR, "");
  if (!list.includes(el)) list.push(el);
  if (below.length) {
    const highest = Math.max(FLOOR - 1, ...below.map((e) => Number(getComputedStyle(e).zIndex) || 0));
    el.style.zIndex = String(Math.min(CEILING, highest + 1));
  }
  return () => {
    const now = registry();
    const i = now.indexOf(el);
    if (i >= 0) now.splice(i, 1);
    el.removeAttribute(LAYER_ATTR);
  };
}

/** Whether `el` is the layer on top: keys and the dim belong to it alone. True when no layer is open. */
export function isTopLayer(el: HTMLElement): boolean {
  const list = registry();
  return list.length === 0 || list[list.length - 1] === el;
}

/** How many layers are open. */
export const layerCount = (): number => registry().length;
