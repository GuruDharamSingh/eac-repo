// ============================================================================
// Rendered HTML into boxes (2026-11-02): the canvas's "Detach instance". Whatever
// drew a piece of the page, a React section or a Puck block, its elements become
// nodes that can be moved, restyled and retyped, keeping each element's tag, class
// and inline style, so the site's stylesheet still draws it, on every screen size.
//
// It copies what is there, so words and pictures stop following their source.
// A host marks what must stay live (a sign-in link, a feed, a form) as a part.
// ============================================================================

import { safeLink, safeSrc } from "../block/bind";
import { ANCHOR_RE, BOX_TAGS, CLASS_RE, PART_TYPE, WORD_TAGS, type PuckNode } from "../block/puck-tree";
import { declsToString, safeDecls, type PartStyle } from "../block/style";
import { domToRich } from "./interact";

const SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "LINK", "META"]);
const PHRASING = new Set(["B", "I", "U", "EM", "STRONG", "SMALL", "SUB", "SUP", "MARK", "ABBR", "CODE", "KBD", "S", "SPAN", "FONT", "TIME", "CITE", "Q", "BR", "A", "DEL", "INS", "STRIKE"]);
/** These cannot be copied as boxes: they do something. A host marks them as parts, or they are reported. */
const UNSUPPORTED = new Set(["SVG", "VIDEO", "AUDIO", "CANVAS", "IFRAME", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "FORM", "OBJECT", "EMBED"]);

export interface AdoptOptions {
  newId(prefix: string): string;
  /** A live part this element stands for: its name and how to label it. */
  part?(el: HTMLElement): { part: string; label?: string } | null;
  /** A node already in the document (a block's slot contents), kept as it is. */
  existing?(el: HTMLElement): PuckNode | null;
  /** A change to the class list, e.g. dropping one that hides an element until a script runs. */
  classes?(list: string[]): string[];
  /** Edits already saved on this element, merged in. */
  edits?(el: HTMLElement): { style?: PartStyle; image?: string; imageFit?: string } | null;
  /** Elements that could not be copied; filled in. */
  skipped?: string[];
}

const hasSpecial = (el: Element, o: AdoptOptions): boolean => Array.from(el.children).some((k) => {
  const t = k.tagName.toUpperCase();
  return !PHRASING.has(t) || !!o.part?.(k as HTMLElement) || !!o.existing?.(k as HTMLElement) || hasSpecial(k, o);
});

/** Nothing but one link with a class of its own: a button. As rich text it would lose the class, and the page's stylesheet with it. */
const holdsOnlyAButton = (el: Element) => {
  const k = el.children[0];
  return el.children.length === 1 && k!.tagName.toUpperCase() === "A" && k!.classList.length > 0 && (el.textContent ?? "").trim() === (k!.textContent ?? "").trim();
};

/** Only words and inline marks inside, with something to read. */
const isWordy = (el: Element, o: AdoptOptions) => !hasSpecial(el, o) && !holdsOnlyAButton(el) && !!(el.textContent ?? "").trim();

function shared(el: HTMLElement, o: AdoptOptions, prefix: string): PuckNode["props"] {
  const props: PuckNode["props"] = { id: o.newId(prefix) };
  let list = Array.from(el.classList).filter((c) => !c.startsWith("de-"));
  if (o.classes) list = o.classes(list);
  const cls = list.join(" ");
  if (cls && CLASS_RE.test(cls)) props.cls = cls;
  const look: PartStyle = {};
  const css = declsToString(safeDecls(el.getAttribute("style") ?? undefined));
  if (css) look.css = css;
  const saved = o.edits?.(el);
  if (saved?.style) Object.assign(look, saved.style);
  if (Object.keys(look).length) props.look = look;
  if (saved?.image) { props.image = saved.image; if (saved.imageFit === "contain") props.imageFit = "contain"; }
  if (el.id && ANCHOR_RE.test(el.id)) props.anchor = el.id;
  const label = el.getAttribute("aria-label") ?? el.dataset.editName;
  if (label) props.label = label.slice(0, 120);
  return props;
}

/**
 * A line break in the source of ordinary text draws as a space, and rich text would keep it as a break. Kept only where
 * the element draws it. A page parsed from HTML has no styles to ask, so there the class says (`whitespace-pre-*`).
 */
function spacedAsDrawn(el: HTMLElement): HTMLElement {
  const win = el.ownerDocument.defaultView;
  if (/\bwhitespace-pre/.test(el.className) || (win && /pre/.test(win.getComputedStyle(el).whiteSpace))) return el;
  const copy = el.cloneNode(true) as HTMLElement;
  const walk = el.ownerDocument.createTreeWalker(copy, 4);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) n.nodeValue = (n.nodeValue ?? "").replace(/\s*\n\s*/g, " ");
  return copy;
}

export function adoptElement(el: HTMLElement, o: AdoptOptions): PuckNode | null {
  if (el.dataset.deUi !== undefined) return null;
  const kept = o.existing?.(el);
  if (kept) return kept;
  const part = o.part?.(el);
  if (part) return { type: PART_TYPE, props: { id: o.newId("part"), part: part.part, ...(part.label ? { label: part.label } : {}) } };
  const tag = el.tagName.toUpperCase();
  if (SKIP.has(tag)) return null;

  if (tag === "PICTURE") {
    const img = el.querySelector("img");
    return img ? adoptElement(img as HTMLElement, o) : null;
  }
  if (tag === "IMG") {
    const props = shared(el, o, "picture");
    const src = safeSrc(el.getAttribute("src"));
    if (src) props.src = src;
    props.alt = el.getAttribute("alt") ?? "";
    return { type: "picture", props };
  }
  if (tag === "HR") return { type: "words", props: { ...shared(el, o, "rule"), tag: "hr", html: "" } };
  if (UNSUPPORTED.has(tag)) { o.skipped?.push(tag.toLowerCase()); return null; }

  const lower = tag.toLowerCase();
  const href = tag === "A" ? safeLink(el.getAttribute("href")) : null;
  if (isWordy(el, o)) {
    const props = shared(el, o, "words");
    props.tag = tag === "A" ? "span" : WORD_TAGS.includes(lower) ? lower : "div";
    props.html = domToRich(spacedAsDrawn(el));
    if (href) props.href = href;
    return { type: "words", props };
  }
  const props = shared(el, o, "box");
  props.tag = BOX_TAGS.includes(lower) ? lower : "div";
  if (href) props.href = href;
  props.items = adoptChildren(el, o);
  return { type: "box", props };
}

export function adoptChildren(el: Element, o: AdoptOptions): PuckNode[] {
  const out: PuckNode[] = [];
  for (const n of Array.from(el.childNodes)) {
    if (n.nodeType === 3) {
      const text = (n.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text) out.push({ type: "words", props: { id: o.newId("words"), tag: "span", html: text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") } });
    } else if (n.nodeType === 1) {
      const node = adoptElement(n as HTMLElement, o);
      if (node) out.push(node);
    }
  }
  return out;
}
