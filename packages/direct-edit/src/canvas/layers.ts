// ============================================================================
// The visual layer: boxes read off any rendered page (2026-11-02). It needs no
// block data and need not match the DOM one to one: wrappers that draw nothing
// of their own collapse into their content, phrasing (b, em, span) stays inside
// its text, and a declared atom (a gallery, a live component, a picture) is one
// box however much DOM it holds.
//
// Click-through runs on these boxes: outermost first, each click reveals the
// boxes inside the one just selected.
//
// Page contract, all optional except the section:
//   data-edit-section="<id>"  a region that may be edited
//   data-edit-name="<words>"  name this box (never collapsed)
//   data-edit-atom            one box; its insides are not layers
//   data-edit-skip            not a layer; its children still can be
// ============================================================================

const ATOM_TAGS = new Set(["IMG", "PICTURE", "SVG", "VIDEO", "AUDIO", "CANVAS", "IFRAME", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);
const NEVER = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "LINK", "META", "BR", "HR"]);
const PHRASING = new Set(["B", "I", "U", "EM", "STRONG", "SMALL", "SUB", "SUP", "MARK", "ABBR", "CODE", "KBD", "S", "SPAN", "FONT", "TIME", "CITE", "Q"]);
/** Same box when every edge is within this many px. */
const SAME_PX = 2;
const MIN_PX = 3;

const isDeclared = (el: Element) => el.hasAttribute("data-edit-section") || el.hasAttribute("data-edit-name") || el.hasAttribute("data-edit-atom") || el.hasAttribute("data-node") || el.hasAttribute("data-part");
const tagOf = (el: Element) => el.tagName.toUpperCase();
const hasOwnText = (el: Element) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && !!n.textContent?.trim());

function drawn(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < MIN_PX || r.height < MIN_PX) return false;
  const cs = getComputedStyle(el);
  return cs.display !== "none" && cs.display !== "contents" && cs.visibility !== "hidden";
}

const sameBox = (a: DOMRect, b: DOMRect) =>
  Math.abs(a.left - b.left) <= SAME_PX && Math.abs(a.top - b.top) <= SAME_PX && Math.abs(a.right - b.right) <= SAME_PX && Math.abs(a.bottom - b.bottom) <= SAME_PX;

const inlinePhrasing = (el: Element) => PHRASING.has(tagOf(el)) && getComputedStyle(el).display.startsWith("inline") && getComputedStyle(el).position === "static";

/** A wrapper around one child the same size, with no words of its own: the child stands for it. */
function isWrapper(el: Element): boolean {
  if (isDeclared(el) || hasOwnText(el)) return false;
  const kids = Array.from(el.children).filter((k) => !NEVER.has(tagOf(k)) && drawn(k));
  return kids.length === 1 && sameBox(el.getBoundingClientRect(), kids[0]!.getBoundingClientRect());
}

/** Is this element a box of the visual layer? */
export function isLayer(el: Element): boolean {
  if (NEVER.has(tagOf(el)) || el.hasAttribute("data-edit-skip") || !drawn(el)) return false;
  if (isDeclared(el)) return true;
  return !inlinePhrasing(el) && !isWrapper(el);
}

const isAtom = (el: Element) => el.hasAttribute("data-edit-atom") || ATOM_TAGS.has(tagOf(el));

/** The section around a target, or null outside every declared section. */
export function sectionOf(target: Element | null): HTMLElement | null {
  return (target?.closest?.("[data-edit-section]") as HTMLElement | null) ?? null;
}

/** The boxes around a target inside `root`, outermost first; stops at the first atom. */
export function layerChain(target: Element | null, root: Element): HTMLElement[] {
  if (!target || !root.contains(target)) return [];
  const up: HTMLElement[] = [];
  for (let e: Element | null = target; e; e = e.parentElement) {
    if (isLayer(e)) up.push(e as HTMLElement);
    if (e === root) break;
  }
  const out = up.reverse();
  const stop = out.findIndex(isAtom);
  return stop >= 0 ? out.slice(0, stop + 1) : out;
}

/** The nearest boxes inside a box. An atom has none. */
export function childLayers(el: Element): HTMLElement[] {
  if (isAtom(el)) return [];
  const out: HTMLElement[] = [];
  const go = (p: Element) => {
    for (const k of Array.from(p.children)) {
      if (NEVER.has(tagOf(k))) continue;
      if (isLayer(k)) out.push(k as HTMLElement);
      else go(k);
    }
  };
  go(el);
  return out;
}

/** The box around a box, inside `root`. */
export function parentLayer(el: Element, root: Element): HTMLElement | null {
  if (el === root) return null;
  for (let e = el.parentElement; e; e = e.parentElement) {
    if (isLayer(e)) return e;
    if (e === root) return null;
  }
  return null;
}

/**
 * What a click selects, and so what hover outlines. Nothing selected: the
 * outermost box. Pointer inside the selection: the next box in. Pointer beside
 * it: the box one level inside whatever holds them both, so moving across goes
 * to the neighbour and never jumps into its insides.
 */
export function nextLayer<T>(chain: readonly T[], current: T | null, holds: (outer: T, inner: T) => boolean): T | null {
  if (!chain.length) return null;
  if (current === null) return chain[0]!;
  const at = chain.indexOf(current);
  const last = chain.length - 1;
  if (at >= 0) return chain[Math.min(at + 1, last)]!;
  for (let i = last; i >= 0; i--) if (holds(chain[i]!, current)) return chain[Math.min(i + 1, last)]!;
  return chain[0]!;
}

/** Rectangle hit test that ignores pointer-events (Puck sets none inside its components): the last-painted deepest element at a point. */
export function elementAt(root: Element, x: number, y: number): Element | null {
  const r = root.getBoundingClientRect();
  if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
  const kids = Array.from(root.children);
  for (let i = kids.length - 1; i >= 0; i--) {
    const k = kids[i]!;
    if (NEVER.has(tagOf(k)) || !drawn(k)) continue;
    const hit = elementAt(k, x, y);
    if (hit) return hit;
  }
  return root;
}

const words = (s: string | null | undefined, n = 26) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

const TAG_ROLE: Record<string, string> = {
  HEADER: "Header", FOOTER: "Footer", NAV: "Navigation", SECTION: "Section", ARTICLE: "Article", ASIDE: "Aside", MAIN: "Main", FIGURE: "Figure", FIGCAPTION: "Caption", FORM: "Form",
  P: "Paragraph", BLOCKQUOTE: "Quote", UL: "List", OL: "List", LI: "Item", A: "Link", BUTTON: "Button", IMG: "Picture", PICTURE: "Picture", VIDEO: "Video", AUDIO: "Audio", SVG: "Graphic", CANVAS: "Graphic", IFRAME: "Embed",
  INPUT: "Field", SELECT: "Field", TEXTAREA: "Field", TABLE: "Table", HR: "Divider",
};

/** A plain name for a box, read from its tag and layout, as the canvas names its layers. */
export function layerRole(el: Element): string {
  const declared = el.getAttribute("data-edit-name");
  if (declared) return declared;
  const tag = tagOf(el);
  if (/^H[1-6]$/.test(tag)) return "Heading";
  if (TAG_ROLE[tag]) return TAG_ROLE[tag]!;
  const cs = getComputedStyle(el);
  if (cs.display.includes("grid")) return "Grid";
  if (cs.display.includes("flex")) return cs.flexDirection.startsWith("column") ? "Column" : "Row";
  return hasOwnText(el) ? "Text" : "Box";
}

/**
 * The words as written. innerText has the line breaks between boxes but also the
 * page's uppercase; textContent has the author's case but runs boxes together. So
 * take the spacing from one and the letters from the other.
 */
function wordsAsWritten(el: Element): string {
  const shown = (el as HTMLElement).innerText ?? "", written = el.textContent ?? "";
  if (!shown) return written;
  let out = "", at = 0;
  for (const c of shown) {
    if (/\s/.test(c)) { out += " "; continue; }
    while (at < written.length && /\s/.test(written[at]!)) at++;
    if (written[at]?.toLowerCase() !== c.toLowerCase()) return shown;
    out += written[at++];
  }
  return out;
}

/** Role plus a hint: first words, label or picture description. */
export function layerName(el: Element): string {
  const role = layerRole(el);
  const hint = el.getAttribute("aria-label") || el.getAttribute("alt") || wordsAsWritten(el);
  const w = words(hint);
  return w && !el.hasAttribute("data-edit-name") ? `${role} “${w}”` : role;
}

export interface LayerNode { el: HTMLElement; role: string; name: string; address: string; kids: LayerNode[] }

/** The whole box tree of a section. `address` is the section id plus child positions: stable while the page's structure is. */
export function readLayers(section: HTMLElement): LayerNode {
  const build = (el: HTMLElement, address: string): LayerNode => ({
    el, role: layerRole(el), name: layerName(el), address,
    kids: childLayers(el).map((k, i) => build(k, `${address}/${i}`)),
  });
  return build(section, section.getAttribute("data-edit-section") || "section");
}

/** A box's address inside its section. */
export function addressOf(el: HTMLElement, section: HTMLElement): string | null {
  const steps: number[] = [];
  for (let e: HTMLElement | null = el; e && e !== section; e = parentLayer(e, section)) {
    const p = parentLayer(e, section);
    if (!p) return null;
    steps.unshift(childLayers(p).indexOf(e));
  }
  return [section.getAttribute("data-edit-section") || "section", ...steps].join("/");
}

/** A structural CSS selector for a box inside its section: what a stored edit is keyed by (block/patch.ts). */
export function selectorFor(el: Element, section: Element): string {
  const steps: string[] = [];
  for (let e = el; e !== section && e.parentElement; e = e.parentElement) {
    steps.unshift(`${e.tagName.toLowerCase()}:nth-child(${Array.prototype.indexOf.call(e.parentElement.children, e) + 1})`);
  }
  return [`[data-edit-section="${section.getAttribute("data-edit-section") ?? ""}"]`, ...steps].join(" > ");
}

/** The box at an address, or null when the page's structure has changed. */
export function atAddress(address: string, scope: ParentNode = document): HTMLElement | null {
  const [id, ...steps] = address.split("/");
  let el = scope.querySelector(`[data-edit-section="${CSS.escape(id ?? "")}"]`) as HTMLElement | null;
  for (const s of steps) {
    if (!el) return null;
    el = childLayers(el)[Number(s)] ?? null;
  }
  return el;
}
