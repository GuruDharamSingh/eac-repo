// ============================================================================
// Structure edits on a stored page (2026-11-02). The document is Puck's own
// JSON, `{ root, content }`, with slots stored as arrays of nodes in a parent's
// props. So a page keeps one format: the published renderer and the old editor
// read what this file writes, and a box tree is ordinary Puck data.
//
// A block holds other nodes only through its declared slots (`SlotMap`), so a
// block's other array props (a gallery's rows) are never mistaken for nodes.
//
// Pure, no DOM. Editing functions mutate the document they are given; the caller
// owns history. Stored documents go through cleanBoxDoc on the server.
// ============================================================================

import { hasOwn } from "./contract";
import { cleanMorph } from "./morph";
import { cleanStyle } from "./style";
import { safeLink, safeSrc } from "./bind";
import { sanitizeRich } from "../model/richtext";

export interface PuckNode { type: string; props: Record<string, unknown> & { id: string } }
export interface PuckDoc { root?: unknown; content: PuckNode[]; zones?: unknown }

export const BOX_TYPE = "box";
export const WORDS_TYPE = "words";
export const PICTURE_TYPE = "picture";
/** The types this layer draws itself: their look is stored in `look`. Anything else is a sealed block. */
export const OWN_TYPES = new Set([BOX_TYPE, WORDS_TYPE, PICTURE_TYPE]);
/** A live piece of a code-built page: named here, drawn by the page. */
export const PART_TYPE = "part";
/** Class names kept from a converted element, so the site's stylesheet still draws it. */
// Square brackets, brackets, % # , ! are Tailwind's arbitrary values (`tracking-[0.18em]`); without them a whole list was dropped.
export const CLASS_RE = /^[\w:./\[\]()%#,!-]{1,60}(?: [\w:./\[\]()%#,!-]{1,60}){0,24}$/;

/** An element id a person can link to. */
export const ANCHOR_RE = /^[A-Za-z][\w-]{0,63}$/;
export const BOX_TAGS = ["div", "section", "header", "footer", "nav", "aside", "article", "main", "figure", "ul", "ol", "li", "blockquote", "figcaption", "span"];
export const WORD_TAGS = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "div", "span", "li", "blockquote", "figcaption", "hr"];

/** The page's own region: a node id that is not a node. */
export const ROOT_ID = "root";
export const ROOT_SLOT = "content";
export const MAX_DEPTH = 12;
export const MAX_NODES = 2000;

export interface SlotRule { name: string; allow?: readonly string[] }
/** Block type → its slots, from the catalogue. */
export type SlotMap = Record<string, readonly SlotRule[]>;
/** A block's slots. Every lookup by a stored type goes through this: a stored type called `constructor` has none, and `slots.constructor` is a function. */
export const slotRulesOf = (slots: SlotMap, type: string): readonly SlotRule[] => (hasOwn(slots, type) ? slots[type] ?? [] : []);

export interface Spot { parent: string; slot: string }
export interface FoundNode extends Spot { node: PuckNode; list: PuckNode[]; index: number; depth: number }

const kidsAt = (node: PuckNode, slot: string): PuckNode[] => {
  const v = node.props[slot];
  return Array.isArray(v) ? (v as PuckNode[]) : [];
};

/** Visit every node, parents first. */
export function walkDoc(doc: PuckDoc, slots: SlotMap, fn: (f: FoundNode) => void): void {
  const go = (list: PuckNode[], parent: string, slot: string, depth: number) => {
    list.forEach((node, index) => {
      if (!node || typeof node !== "object" || !node.props) return;
      fn({ node, list, parent, slot, index, depth });
      for (const s of slotRulesOf(slots, node.type)) go(kidsAt(node, s.name), node.props.id, s.name, depth + 1);
    });
  };
  go(doc.content ?? [], ROOT_ID, ROOT_SLOT, 1);
}

export function findPuckNode(doc: PuckDoc, slots: SlotMap, id: string): FoundNode | null {
  let out: FoundNode | null = null;
  walkDoc(doc, slots, (f) => { if (!out && f.node.props.id === id) out = f; });
  return out;
}

/** The array a slot holds, created if the block has never had anything in it. */
export function slotList(doc: PuckDoc, slots: SlotMap, spot: Spot): PuckNode[] | null {
  if (spot.parent === ROOT_ID) return doc.content;
  const f = findPuckNode(doc, slots, spot.parent);
  if (!f || !slotRulesOf(slots, f.node.type).some((s) => s.name === spot.slot)) return null;
  if (!Array.isArray(f.node.props[spot.slot])) f.node.props[spot.slot] = [];
  return f.node.props[spot.slot] as PuckNode[];
}

/** Levels at and below a node. */
export function nodeLevels(node: PuckNode, slots: SlotMap): number {
  let most = 0;
  for (const s of slotRulesOf(slots, node.type)) for (const k of kidsAt(node, s.name)) most = Math.max(most, nodeLevels(k, slots));
  return 1 + most;
}

/** Is `id` the node `ancestor`, or anywhere inside it? */
export function isWithin(doc: PuckDoc, slots: SlotMap, ancestor: string, id: string): boolean {
  if (ancestor === id) return true;
  const a = findPuckNode(doc, slots, ancestor);
  if (!a) return false;
  let found = false;
  walkDoc({ content: [a.node] }, slots, (f) => { if (f.node.props.id === id) found = true; });
  return found;
}

/** May a node of this type (its subtree `levels` deep) go into this slot? */
export function mayPlace(doc: PuckDoc, slots: SlotMap, type: string, levels: number, spot: Spot): boolean {
  if (spot.parent === ROOT_ID) return levels <= MAX_DEPTH;
  const f = findPuckNode(doc, slots, spot.parent);
  if (!f) return false;
  const rule = slotRulesOf(slots, f.node.type).find((s) => s.name === spot.slot);
  if (!rule) return false;
  if (rule.allow && !rule.allow.includes(type)) return false;
  return f.depth + levels <= MAX_DEPTH;
}

/**
 * Move a node into a slot at `index`, where `index` counts the slot's nodes
 * WITHOUT the moved one (what an insertion line shows). Refuses a move into
 * itself or its own subtree, and anything the target slot does not accept.
 */
export function movePuckNode(doc: PuckDoc, slots: SlotMap, id: string, to: Spot, index: number): boolean {
  const f = findPuckNode(doc, slots, id);
  if (!f) return false;
  if (to.parent !== ROOT_ID && isWithin(doc, slots, id, to.parent)) return false;
  if (!mayPlace(doc, slots, f.node.type, nodeLevels(f.node, slots), to)) return false;
  const target = slotList(doc, slots, to);
  if (!target) return false;
  f.list.splice(f.index, 1);
  target.splice(Math.max(0, Math.min(target.length, index)), 0, f.node);
  return true;
}

export function insertPuckNode(doc: PuckDoc, slots: SlotMap, node: PuckNode, to: Spot, index: number): boolean {
  if (!mayPlace(doc, slots, node.type, nodeLevels(node, slots), to)) return false;
  const target = slotList(doc, slots, to);
  if (!target) return false;
  target.splice(Math.max(0, Math.min(target.length, index)), 0, node);
  return true;
}

export function removePuckNode(doc: PuckDoc, slots: SlotMap, id: string): PuckNode | null {
  const f = findPuckNode(doc, slots, id);
  if (!f) return null;
  f.list.splice(f.index, 1);
  return f.node;
}

/** Put a node inside a new box, where it was. */
export function wrapPuckNode(doc: PuckDoc, slots: SlotMap, id: string, box: PuckNode, slot = "items"): boolean {
  const f = findPuckNode(doc, slots, id);
  if (!f) return false;
  box.props[slot] = [f.node];
  if (f.depth + nodeLevels(box, slots) - 1 > MAX_DEPTH) { delete box.props[slot]; return false; }
  f.list.splice(f.index, 1, box);
  return true;
}

/** Replace a box by what it holds, where it was. Only boxes: a block's regions belong to the block. */
export function unwrapPuckNode(doc: PuckDoc, slots: SlotMap, id: string): boolean {
  const f = findPuckNode(doc, slots, id);
  if (!f || f.node.type !== BOX_TYPE) return false;
  f.list.splice(f.index, 1, ...kidsAt(f.node, "items"));
  return true;
}

/** A deep copy with new ids, placed after the original. Returns the copy's id. */
export function duplicatePuckNode(doc: PuckDoc, slots: SlotMap, id: string, newId: () => string): string | null {
  const f = findPuckNode(doc, slots, id);
  if (!f) return null;
  const copy = JSON.parse(JSON.stringify(f.node)) as PuckNode;
  walkDoc({ content: [copy] }, slots, (c) => { c.node.props.id = newId(); });
  f.list.splice(f.index + 1, 0, copy);
  return copy.props.id;
}

const oneOf = (list: readonly string[], v: unknown) => (typeof v === "string" && list.includes(v) ? v : undefined);

/** Browsers ignore tabs, newlines and leading spaces in a scheme, so they are removed before the test. */
const scriptAddress = (s: string) => /^(?:javascript:|vbscript:|data:text\/html)/i.test(s.replace(/[\u0000- ]/g, ""));
/** A media path with a Private segment is not served to visitors (canvas/edit-shell.ts `isPrivatePicture`). An address only: a heading may say "Private/". */
function privateAddress(s: string): boolean {
  if (!/^\s*(?:\/|https?:\/\/)/i.test(s)) return false;
  let path = s;
  try { path = decodeURIComponent(s); } catch { /* keep the raw text */ }
  return /\/Private(?:\/|$)/.test(path.split("?")[0] ?? "");
}
const unsafeAddress = (v: unknown) => typeof v === "string" && (scriptAddress(v) || privateAddress(v));
/** Every string in stored props, at any depth: this layer does not know which prop of a sealed block is a link or a picture. */
function dropUnsafeAddresses(v: unknown): void {
  if (Array.isArray(v)) {
    for (let i = v.length - 1; i >= 0; i--) { if (unsafeAddress(v[i])) v.splice(i, 1); else dropUnsafeAddresses(v[i]); }
  } else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) { if (unsafeAddress(x)) delete (v as Record<string, unknown>)[k]; else dropUnsafeAddresses(x); }
  }
}

/**
 * Server-side validation of this layer's own nodes: a known style vocabulary,
 * known tags, cleaned words, safe pictures, and a cap on depth and size. Other
 * blocks' props pass through; they have their own rules (validatePage,
 * sanitizeRichValues), except `morph`, which this layer owns: it is cleaned here
 * as MorphMark cleans it at render, and removed when nothing of it is valid, and
 * a `javascript:` link or a `Private/` path, which no block's rules refuse at save.
 * Nodes too deep or past the cap are dropped.
 */
export function cleanBoxDoc<T>(input: T): T {
  if (!input || typeof input !== "object") return input;
  const doc = JSON.parse(JSON.stringify(input)) as PuckDoc;
  if (!Array.isArray(doc.content)) return input;
  let count = 0;
  const seen = new Set<string>();
  const cleanList = (list: unknown, depth: number): PuckNode[] => {
    if (!Array.isArray(list) || depth > MAX_DEPTH) return [];
    const out: PuckNode[] = [];
    for (const raw of list as PuckNode[]) {
      if (count >= MAX_NODES) break;
      if (!raw || typeof raw !== "object" || !raw.props || typeof raw.props !== "object") { out.push(raw); continue; }
      count++;
      if (OWN_TYPES.has(raw.type)) {
        const id = typeof raw.props.id === "string" && !seen.has(raw.props.id) ? raw.props.id : null;
        if (!id) continue;
        seen.add(id);
        out.push(cleanOwn(raw, depth));
      } else {
        // A sealed block may hold boxes in its slots, or any array of nodes.
        for (const [k, v] of Object.entries(raw.props)) {
          if (Array.isArray(v) && v.some((x) => x && typeof x === "object" && "type" in x && "props" in x)) raw.props[k] = cleanList(v, depth + 1);
        }
        if ("morph" in raw.props) {
          const morph = cleanMorph(raw.props.morph);
          if (morph) raw.props.morph = morph; else delete raw.props.morph;
        }
        out.push(raw);
      }
    }
    return out;
  };
  const cleanOwn = (raw: PuckNode, depth: number): PuckNode => {
    const p = raw.props;
    const props: PuckNode["props"] = { id: p.id };
    const look = cleanStyle(p.look);
    if (look) props.look = look;
    if (typeof p.cls === "string" && CLASS_RE.test(p.cls)) props.cls = p.cls;
    if (typeof p.comment === "string" && p.comment.trim()) props.comment = p.comment.trim().slice(0, 2000);
    if (typeof p.label === "string" && p.label.trim()) props.label = p.label.trim().slice(0, 120);
    if (typeof p.anchor === "string" && ANCHOR_RE.test(p.anchor)) props.anchor = p.anchor;
    // Puck's editor offers its generic Style on these blocks too. The adapter cleans it at render (page-builder `BlockStyleWrap`).
    if (p.blkStyle && typeof p.blkStyle === "object" && !Array.isArray(p.blkStyle)) props.blkStyle = p.blkStyle;
    const href = raw.type !== PICTURE_TYPE && typeof p.href === "string" ? safeLink(p.href) : null;
    if (href) props.href = href;
    if (raw.type === BOX_TYPE) {
      props.tag = oneOf(BOX_TAGS, p.tag) ?? "div";
      props.items = cleanList(p.items, depth + 1);
      const image = typeof p.image === "string" ? safeSrc(p.image) : null;
      if (image) { props.image = image; if (p.imageFit === "contain") props.imageFit = "contain"; }
    } else if (raw.type === WORDS_TYPE) {
      props.tag = oneOf(WORD_TAGS, p.tag) ?? "p";
      props.html = sanitizeRich(typeof p.html === "string" ? p.html : "", { list: true });
    } else {
      const src = typeof p.src === "string" ? safeSrc(p.src) : null;
      if (src) props.src = src;
      props.alt = typeof p.alt === "string" ? p.alt.slice(0, 300) : "";
    }
    return { type: raw.type, props };
  };
  doc.content = cleanList(doc.content, 1);
  const root = doc.root as { props?: Record<string, unknown> } | undefined;
  if (root?.props) {
    const look = cleanStyle(root.props.look);
    if (look) root.props.look = look; else delete root.props.look;
    const image = typeof root.props.image === "string" ? safeSrc(root.props.image) : null;
    if (image) root.props.image = image; else { delete root.props.image; delete root.props.imageFit; }
  }
  dropUnsafeAddresses(doc.content);
  dropUnsafeAddresses(doc.root);
  dropUnsafeAddresses(doc.zones);
  return doc as unknown as T;
}
