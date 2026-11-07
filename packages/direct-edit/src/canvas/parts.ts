// ============================================================================
// A sealed block's parts on the canvas (2026-11-04, stone 2). Nothing is stamped on
// them: they are found at event time from the block's declaration, so a client
// block's own state change cannot leave a stale mark.
// ============================================================================

import { hasOwn, ROOT_PART, type BlockContract, type ContractPart } from "../block/contract";

/**
 * The elements a declared selector picks in this node: the ones its rule in block/morph.ts reaches.
 * A ">" selector starts from the node's own element, the rest from inside it; a part of a nested node is not this
 * node's. A selector the browser refuses selects nothing.
 */
export function partEls(nodeEl: HTMLElement, sel: string): HTMLElement[] {
  const from = sel.startsWith(">") ? nodeEl.parentElement : nodeEl;
  if (!from) return [];
  try {
    return Array.from(from.querySelectorAll<HTMLElement>(`:scope ${sel}`)).filter((e) => e.closest("[data-tree-node]") === nodeEl);
  } catch {
    return [];
  }
}

export interface DrawnPart { name: string; part: ContractPart; els: HTMLElement[] }

/** The parts this node draws right now, in declaration order. The root part is the node itself, so it is not listed. */
export function drawnParts(nodeEl: HTMLElement, def: BlockContract | undefined): DrawnPart[] {
  const out: DrawnPart[] = [];
  const parts = def?.parts;
  if (!parts) return out;
  for (const name of Object.keys(parts)) {
    if (name === ROOT_PART || !hasOwn(parts, name)) continue;
    const els = partEls(nodeEl, parts[name]!.sel);
    if (els.length) out.push({ name, part: parts[name]!, els });
  }
  return out;
}

/** Which part an element is: `i` its place among the `count` elements the part selects. */
export interface PartHit { name: string; part: ContractPart; i: number; count: number }

/** Every part element of this node. Two parts selecting one element: the first declared wins. The node's own element is its root part, so it is not here. */
export function partOwners(nodeEl: HTMLElement, def: BlockContract | undefined): Map<HTMLElement, PartHit> {
  const out = new Map<HTMLElement, PartHit>();
  for (const d of drawnParts(nodeEl, def)) {
    d.els.forEach((el, i) => { if (el !== nodeEl && !out.has(el)) out.set(el, { name: d.name, part: d.part, i, count: d.els.length }); });
  }
  return out;
}

/** The part directly around this element; null when only its node is. */
export function partAbove(nodeEl: HTMLElement, el: HTMLElement, owners: Map<HTMLElement, PartHit>): HTMLElement | null {
  for (let e = el.parentElement; e && e !== nodeEl; e = e.parentElement) if (owners.has(e)) return e;
  return null;
}

/** The parts directly inside `holder` (the node's own element, or a part), in the order the page draws them. */
export function partsInside(nodeEl: HTMLElement, holder: HTMLElement, owners: Map<HTMLElement, PartHit>): HTMLElement[] {
  const want = holder === nodeEl ? null : holder;
  return [...owners.keys()].filter((el) => partAbove(nodeEl, el, owners) === want).sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}

const MEDIA = new Set(["IMG", "PICTURE", "VIDEO", "SVG", "CANVAS", "IFRAME", "AUDIO"]);

/** A part with words: something to read, with only inline elements around it. A frame holds other boxes, or nothing to read. */
export function partKind(el: HTMLElement): "text" | "image" | "frame" {
  if (MEDIA.has(el.tagName.toUpperCase())) return "image";
  if (!el.textContent?.trim()) return "frame";
  return Array.from(el.children).every((k) => getComputedStyle(k).display.startsWith("inline")) ? "text" : "frame";
}
