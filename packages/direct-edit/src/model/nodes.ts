// ============================================================================
// Node registry over rendered blocks. A block's root carries `data-node="<id>"`
// and each editable part inside it `data-part="<name>"` (the direct-edit
// sibling of @elkdonis/blocks' `data-edit-item`). The root itself is the part
// named ROOT. A selection is a path: node, then part.
// ============================================================================

import { nextLayer } from "../canvas/layers";

export const ROOT = "frame";

export interface NodeRef {
  node: string;
  part: string;
}

export const refKey = (r: NodeRef | null | undefined): string => (r ? `${r.node}:${r.part}` : "");
export function parseRef(v: string | null | undefined): NodeRef | null {
  if (!v) return null;
  const i = v.indexOf(":");
  return i < 0 ? { node: v, part: ROOT } : { node: v.slice(0, i), part: v.slice(i + 1) || ROOT };
}
export const sameRef = (a: NodeRef | null, b: NodeRef | null) => refKey(a) === refKey(b);

const attr = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** Marker attributes for HTML strings: the block root (no part) or one part. */
export function nodeAttrs(node: string, part?: string): string {
  return part && part !== ROOT ? `data-part="${attr(part)}"` : `data-node="${attr(node)}"`;
}

/** The node and part under an event target, or null when outside every node. */
export function hitTest(target: EventTarget | null): { node: string; part: string; nodeEl: HTMLElement; partEl: HTMLElement | null } | null {
  const t = target as HTMLElement | null;
  const nodeEl = t?.closest?.("[data-node]") as HTMLElement | null;
  if (!nodeEl) return null;
  const partEl = t!.closest("[data-part]") as HTMLElement | null;
  const inside = partEl && nodeEl.contains(partEl) ? partEl : null;
  return { node: nodeEl.dataset.node!, part: inside ? inside.dataset.part! : ROOT, nodeEl, partEl: inside };
}

/** The element drawn for a ref inside `scope`. */
export function elFor(scope: ParentNode, r: NodeRef | null): HTMLElement | null {
  if (!r) return null;
  const nodeEl = scope.querySelector(`[data-node="${CSS.escape(r.node)}"]`) as HTMLElement | null;
  if (!nodeEl || r.part === ROOT) return nodeEl;
  return nodeEl.querySelector(`[data-part="${CSS.escape(r.part)}"]`) as HTMLElement | null;
}

/** Click-deeper: the first click on a node selects its root, the next goes into the part. */
export function deeper(current: NodeRef | null, hit: { node: string; part: string }): NodeRef {
  if (!current || current.node !== hit.node) return { node: hit.node, part: ROOT };
  return { node: hit.node, part: hit.part };
}

/** Escape goes up: part → root → nothing. */
export const up = (r: NodeRef | null): NodeRef | null => (!r ? null : r.part !== ROOT ? { node: r.node, part: ROOT } : null);

// ---------------------------------------------------------------------------
// Nested parts (pass 3): a part may sit inside a box inside the block.
// ---------------------------------------------------------------------------

/** The block under a target and every part around the target inside it, outermost first. */
export function hitChain(target: EventTarget | null): { node: string; nodeEl: HTMLElement; chain: string[]; els: HTMLElement[] } | null {
  const t = target as HTMLElement | null;
  const nodeEl = t?.closest?.("[data-node]") as HTMLElement | null;
  if (!nodeEl) return null;
  const els: HTMLElement[] = [];
  let e = t!.closest("[data-part]") as HTMLElement | null;
  while (e && nodeEl.contains(e) && e !== nodeEl) { els.unshift(e); e = e.parentElement?.closest("[data-part]") as HTMLElement | null; }
  return { node: nodeEl.dataset.node!, nodeEl, chain: els.map((x) => x.dataset.part!), els };
}

/**
 * Click-through (developer's rule, 2026-11-02): the first click selects the
 * block, each next click goes one level further in; a click beside the selection
 * selects the box one level inside whatever holds them both, so a neighbour is
 * reached before its insides. `holds(outer, inner)` says one part contains another.
 */
export function deeperIn(current: NodeRef | null, node: string, chain: string[], holds: (outer: string, inner: string) => boolean): NodeRef {
  if (!current || current.node !== node || !chain.length) return { node, part: ROOT };
  if (current.part === ROOT) return { node, part: chain[0]! };
  return { node, part: nextLayer(chain, current.part, holds)! };
}
