// ============================================================================
// Fields lens, finding block content on a drawn page (contract C4). Client-safe: plain DOM, no React.
//
// `buildPuckConfig({ marks })` puts `<template data-blk-mark="<id>" data-blk-type="<type>">` before each block. From
// the marker, the block's root is the next element that is not itself a marker, style or link (the look's own marker
// and font links may sit between). A part is then found the way the look's stylesheet finds it (morph.ts `tailOf`):
//   root part   the root element, which must match the root selector
//   "> a b"     a path that starts at the root element
//   "a b"       inside the root
// ============================================================================

import type { BlockFieldMap } from "./blockmap";

export interface FoundField {
  el: HTMLElement;
  /** The id in the C4 grammar: `block:<page>:<block id>:<prop>`, or `record:<kind>:<id>:<field>` where a record fills it. */
  ref: string;
  /** "<page>:<block id>" (the id the server door takes). */
  block: string;
  type: string;
  part: string;
  prop: string;
  fromRecord: boolean;
  /** The block's own box, standing for its settings that no element draws (the field name is "*"). */
  root?: boolean;
}

const SKIP = new Set(["TEMPLATE", "STYLE", "LINK"]);

function rootOf(marker: Element): HTMLElement | null {
  for (let n = marker.nextElementSibling; n; n = n.nextElementSibling) if (!SKIP.has(n.tagName)) return n as HTMLElement;
  return null;
}

function partOf(root: HTMLElement, name: string, sel: string, rootSel: string): HTMLElement | null {
  try {
    if (name === "root") return root;
    if (!sel.startsWith(">")) return root.querySelector<HTMLElement>(sel);
    const tail = sel.replace(/^>\s*/, "");
    const parent = root.parentElement;
    if (!parent) return null;
    for (const c of Array.from(parent.querySelectorAll<HTMLElement>(`:scope > ${tail}`))) if (root.contains(c)) return c;
    return null;
  } catch {
    // A selector the browser refuses is a part that is not there.
    void rootSel;
    return null;
  }
}

function parseFrom(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    const out: Record<string, string> = {};
    if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, ref] of Object.entries(v)) if (typeof ref === "string" && ref.startsWith("record:")) out[k] = ref;
    return out;
  } catch {
    return {};
  }
}

/** Every element on the page that draws a typed setting of a block, or a field of a record. */
export function scanBlocks(scope: ParentNode, map: BlockFieldMap, slug: string): FoundField[] {
  const out: FoundField[] = [];
  const claimed = new Set<Element>();
  for (const marker of Array.from(scope.querySelectorAll("template[data-blk-mark]"))) {
    const id = marker.getAttribute("data-blk-mark");
    const type = marker.getAttribute("data-blk-type");
    const entry = type && Object.prototype.hasOwnProperty.call(map, type) ? map[type] : undefined;
    if (!id || !type || !entry) continue;
    const root = rootOf(marker);
    if (!root || !root.matches(entry.root)) continue;
    const from = parseFrom(marker.getAttribute("data-blk-from"));
    for (const [part, def] of Object.entries(entry.parts)) {
      const el = partOf(root, part, def.sel, entry.root);
      // One element, one field: a part that resolves to an element another part already holds is left out.
      if (!el || claimed.has(el)) continue;
      claimed.add(el);
      const rec = from[def.prop];
      out.push({ el, ref: rec ?? `block:${slug}:${id}:${def.prop}`, block: `${slug}:${id}`, type, part, prop: def.prop, fromRecord: !!rec });
    }
    // Settings no part draws (a choice, a switch, a size) are reached from the block's own box, unless a part holds it.
    if (Object.keys(entry.others).length && !claimed.has(root)) {
      claimed.add(root);
      out.push({ el: root, ref: `block:${slug}:${id}:*`, block: `${slug}:${id}`, type, part: "", prop: "*", fromRecord: false, root: true });
    }
  }
  return out;
}

/** The page's own name, from `<template data-blk-page="...">` (a host puts one on a page it marks), or null. */
export function pageSlugOf(scope: ParentNode): string | null {
  return scope.querySelector("template[data-blk-page]")?.getAttribute("data-blk-page") || null;
}
