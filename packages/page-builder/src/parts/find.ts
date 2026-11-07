// ============================================================================
// Finding a block's declared parts in Puck's canvas (2026-11-06). Plain DOM, no
// React. The selectors come from the block's declaration (the contract), never
// from the document, and are read by the grammar `morphCss` compiles
// (`packages/direct-edit/src/block/morph.ts`): a selector starting with ">" is
// the element right after the marker (the block's root) and a path from it;
// any other selector is inside the root.
//
// Elements are found at event time, so a block's own state change cannot leave
// a stale mark. An element inside a block nested in one of this block's slots
// belongs to that block, not to this one.
// ============================================================================

import type { PartsContract } from "./types";

/** The stored name of a block's outermost part (`ROOT_PART` in direct-edit). */
export const ROOT_PART = "root";
/** A block that declares no root: the element right after the marker (`GENERIC_ROOT_SEL`). */
const GENERIC_ROOT_SEL = "> :not(template)";
const NOT_A_BOX = new Set(["STYLE", "SCRIPT", "LINK", "TEMPLATE", "NOSCRIPT"]);

const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export function partsOf(contract: PartsContract, type: string) {
  const entry = own(contract, type) ? contract[type] : undefined;
  return entry?.parts;
}

export function blockWrapper(doc: Document, id: string): HTMLElement | null {
  const esc = doc.defaultView?.CSS?.escape ?? ((s: string) => s.replace(/["\\]/g, "\\$&"));
  return doc.querySelector<HTMLElement>(`[data-puck-component="${esc(id)}"]`);
}

/** The element belongs to the block of this wrapper, not to a block nested in one of its slots. */
export const ownedBy = (el: Element, wrapper: Element) => el.closest("[data-puck-component]") === wrapper;

/** First drawn child, through wrappers that draw nothing (`display: contents`) and page-builder's Style wrapper. */
function firstBox(el: Element): HTMLElement | null {
  const first = (e: Element) => Array.from(e.children).find((c) => !NOT_A_BOX.has(c.tagName)) as HTMLElement | undefined;
  let k = first(el);
  while (k) {
    const view = k.ownerDocument.defaultView;
    const contents = view ? view.getComputedStyle(k).display === "contents" : false;
    if (!contents && !k.classList.contains("blk-st")) break;
    const next = first(k);
    if (!next) break;
    k = next;
  }
  return k ?? null;
}

/**
 * The block's root: the element right after its morph marker when it has one
 * (exactly what the stylesheet reaches), else the declared root selector's
 * first match, else the first element the block draws.
 */
export function rootOf(wrapper: HTMLElement, rootSel: string | undefined): HTMLElement | null {
  const marker = Array.from(wrapper.querySelectorAll("template[data-morph]")).find((t) => ownedBy(t, wrapper));
  const after = marker?.nextElementSibling as HTMLElement | null | undefined;
  if (after) return after;
  if (rootSel && !/[,{};<]/.test(rootSel)) {
    const tail = rootSel.replace(/^>\s*/, "");
    try {
      const hit = Array.from(wrapper.querySelectorAll<HTMLElement>(tail)).find((e) => ownedBy(e, wrapper));
      if (hit) return hit;
    } catch {
      /* a selector this browser refuses: fall back to the first box */
    }
  }
  return firstBox(wrapper);
}

export interface DrawnPart {
  part: string;
  label: string;
  els: HTMLElement[];
}

/** Each declared part this block draws right now, root first, then in declaration order. */
export function drawnParts(doc: Document, id: string, type: string, contract: PartsContract, rootLabel = "Whole block"): DrawnPart[] {
  const wrapper = blockWrapper(doc, id);
  if (!wrapper) return [];
  const parts = partsOf(contract, type) ?? {};
  const root = rootOf(wrapper, own(parts, ROOT_PART) ? parts[ROOT_PART]?.sel : undefined);
  if (!root) return [];
  const out: DrawnPart[] = [{ part: ROOT_PART, label: (own(parts, ROOT_PART) && parts[ROOT_PART]?.label) || rootLabel, els: [root] }];
  for (const name of Object.keys(parts)) {
    const p = parts[name];
    if (name === ROOT_PART || !p || typeof p.sel !== "string" || /[,{};<]/.test(p.sel)) continue;
    let els: HTMLElement[] = [];
    try {
      els = p.sel.startsWith(">")
        ? root.parentElement
          ? Array.from(root.parentElement.querySelectorAll<HTMLElement>(`:scope ${p.sel}`)).filter((e) => e === root || root.contains(e))
          : []
        : Array.from(root.querySelectorAll<HTMLElement>(p.sel));
    } catch {
      /* a selector this browser refuses selects nothing */
    }
    els = els.filter((e) => ownedBy(e, wrapper));
    if (els.length) out.push({ part: name, label: p.label || name, els });
  }
  return out;
}

const inRect = (r: DOMRect, x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom && r.width > 0 && r.height > 0;

// ── Click-through inside a block (the canvas's rule, canvas/clickthrough.ts) ──
// A click on the selected block selects the outermost part under the pointer;
// each further click goes one part deeper; a click on a cousin goes to the part
// inside the nearest part both share. Escape goes out one part, Enter in one.

/** Every non-root part element of the block, with its part. Two parts selecting one element: the first declared wins. */
function owners(parts: DrawnPart[]): Map<HTMLElement, string> {
  const out = new Map<HTMLElement, string>();
  const root = parts.find((p) => p.part === ROOT_PART)?.els[0];
  for (const p of parts) {
    if (p.part === ROOT_PART) continue;
    for (const el of p.els) if (el !== root && !out.has(el)) out.set(el, p.part);
  }
  return out;
}

/**
 * The parts under the point, outermost first: the smallest part element there
 * and the part elements around it. A part laid over another without holding it
 * (a background picture under the words) is not in the chain; it is reached
 * where nothing smaller covers it, or from the layer tree.
 */
export function partsUnder(parts: DrawnPart[], x: number, y: number): Array<{ part: string; el: HTMLElement }> {
  const hits: Array<{ part: string; el: HTMLElement; area: number }> = [];
  for (const [el, part] of owners(parts)) {
    const r = el.getBoundingClientRect();
    if (inRect(r, x, y)) hits.push({ part, el, area: r.width * r.height });
  }
  if (!hits.length) return [];
  // The target: the smallest; at equal size the one inside the other.
  const target = hits.reduce((best, h) => (h.area < best.area || (h.area === best.area && best.el.contains(h.el)) ? h : best));
  return hits
    .filter((h) => h.el.contains(target.el))
    .sort((a, b) => (a.el.contains(b.el) ? -1 : b.el.contains(a.el) ? 1 : 0))
    .map(({ part, el }) => ({ part, el }));
}

/** The part directly around this one, or null when only the block is. */
export function partAround(parts: DrawnPart[], name: string): string | null {
  const map = owners(parts);
  const root = parts.find((p) => p.part === ROOT_PART)?.els[0];
  const el = parts.find((p) => p.part === name)?.els[0];
  for (let e = el?.parentElement ?? null; e && e !== root; e = e.parentElement) {
    const hit = map.get(e);
    if (hit && hit !== name) return hit;
  }
  return null;
}

/** The parts directly inside this one (null: inside the block), in page order. */
export function partsIn(parts: DrawnPart[], name: string | null): string[] {
  const firsts = parts.filter((p) => p.part !== ROOT_PART && partAround(parts, p.part) === name);
  return firsts
    .sort((a, b) => (a.els[0]!.compareDocumentPosition(b.els[0]!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((p) => p.part);
}

/** Where a click goes, given the part selected now (null or the root: the block). */
export function nextPart(parts: DrawnPart[], current: string | null, x: number, y: number, deepest: boolean): string | null {
  const chain = partsUnder(parts, x, y);
  if (!chain.length) return null;
  if (deepest) return chain[chain.length - 1]!.part;
  if (!current || current === ROOT_PART) return chain[0]!.part;
  const at = chain.findIndex((c) => c.part === current);
  if (at >= 0) return (chain[at + 1] ?? chain[at]!).part;
  const mine = parts.find((p) => p.part === current)?.els ?? [];
  let shared = 0;
  while (shared < chain.length && mine.some((el) => chain[shared]!.el.contains(el))) shared++;
  return (chain[shared] ?? chain[chain.length - 1]!).part;
}
