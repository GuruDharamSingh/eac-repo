import { createElement, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { cleanStyle, declsToStyle, type PartStyle } from "../block/style";
import { safeLink, safeSrc } from "../block/bind";
import { BOX_TAGS, WORD_TAGS, ANCHOR_RE, CLASS_RE } from "../block/puck-tree";
import { imageDecls, lookDecls } from "../block/patch";
import { sanitizeRich } from "../model/richtext";

// ============================================================================
// Three ordinary Puck blocks: a box that holds other nodes, words and a picture,
// plus the page root (2026-11-02). They are what make a page a tree of boxes
// while staying Puck's data: the published renderer draws them like any block.
//
// Their look is stored in one prop, `look`, in the same style vocabulary as the
// visual layer, and cleaned on every render. Server-safe: no hooks, no DOM.
// A hosting app opts in with `blocks: [...SHARED_BLOCKS, ...BOX_BLOCKS], root: BOX_ROOT`.
// ============================================================================

type SlotAs = string | ComponentType<Record<string, unknown>>;
type SlotComponent = ComponentType<{ as?: SlotAs; className?: string; style?: CSSProperties }>;
interface PuckContext { boxEditing?: boolean; isEditing?: boolean }
type Attrs = Record<string, string>;

function lookStyle(look: unknown, editing: boolean, extra?: { image?: unknown; imageFit?: unknown }): CSSProperties {
  const s: PartStyle = cleanStyle(look) ?? {};
  const d = lookDecls(s, editing);
  const src = typeof extra?.image === "string" ? safeSrc(extra.image) : null;
  if (src) d.push(...imageDecls(src, extra?.imageFit === "contain" ? "contain" : "cover"));
  return declsToStyle(d) as CSSProperties;
}

/** The attributes a person can set on any box: a name, an anchor, a link. */
function attrsOf(p: { label?: unknown; anchor?: unknown; href?: unknown }): Attrs {
  const a: Attrs = {};
  if (typeof p.label === "string" && p.label.trim()) a["aria-label"] = p.label.trim().slice(0, 120);
  if (typeof p.anchor === "string" && ANCHOR_RE.test(p.anchor)) a.id = p.anchor;
  const href = typeof p.href === "string" ? safeLink(p.href) : null;
  if (href) {
    a.href = href;
    if (/^https?:/i.test(href)) a.rel = "noopener noreferrer";
  }
  return a;
}

/**
 * A slot draws one element from `as`, passing only class, style and ref, so an
 * element with attributes has to be a component. Cached by content: a new
 * component each render would remount the box and everything in it.
 */
const withAttrs = new Map<string, ComponentType<Record<string, unknown>>>();
function tagWith(tag: string, attrs: Attrs): SlotAs {
  if (!Object.keys(attrs).length) return tag;
  const key = JSON.stringify([tag, attrs]);
  let T = withAttrs.get(key);
  if (!T) {
    if (withAttrs.size > 2000) withAttrs.clear();
    T = function TagWithAttrs({ children, ...rest }: Record<string, unknown>) {
      return createElement(tag, { ...attrs, ...rest }, children as ReactNode);
    };
    withAttrs.set(key, T);
  }
  return T;
}

const classOf = (cls: unknown) => (typeof cls === "string" && CLASS_RE.test(cls) ? cls : undefined);

function Box({ items, tag, look, image, imageFit, label, anchor, href, cls, puck }: { items?: unknown; tag?: string; look?: unknown; image?: unknown; imageFit?: unknown; label?: unknown; anchor?: unknown; href?: unknown; cls?: unknown; puck?: PuckContext }): ReactNode {
  const attrs = attrsOf({ label, anchor, href });
  const className = classOf(cls);
  const el = attrs.href ? "a" : tag && BOX_TAGS.includes(tag) ? tag : "div";
  const style = lookStyle(look, !!puck?.boxEditing, { image, imageFit });
  // Under our canvas or Puck's renderer a slot is a component that draws one element; `as` makes that element the box itself.
  if (typeof items === "function") {
    // Puck's own editor draws its drop zone without these styles, so there the box is an element around the zone, which keeps the layout.
    if (puck?.isEditing) {
      const { display, flexDirection, flexWrap, gap, gridTemplateColumns, alignItems, justifyContent } = style;
      return createElement(el, { ...attrs, className, style }, createElement(items as SlotComponent, { style: { display, flexDirection, flexWrap, gap, gridTemplateColumns, alignItems, justifyContent, width: "100%" } }));
    }
    return createElement(items as SlotComponent, { as: tagWith(el, attrs), className, style });
  }
  return createElement(el, { ...attrs, className, style }, items as ReactNode);
}

const attrText = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function Words({ html, tag, look, label, anchor, href, cls, puck }: { html?: unknown; tag?: string; look?: unknown; label?: unknown; anchor?: unknown; href?: unknown; cls?: unknown; puck?: PuckContext }): ReactNode {
  const className = classOf(cls);
  if (tag === "hr") return createElement("hr", { ...attrsOf({ label, anchor }), className, style: lookStyle(look, !!puck?.boxEditing) });
  // sanitizeRich is the allow-list (b, i, u, a, ul, li, br) and escapes everything else, so this HTML is ours.
  const clean = sanitizeRich(typeof html === "string" ? html : "", { list: true });
  const editing = !!puck?.boxEditing;
  if (!clean && !editing) return null;
  const attrs = attrsOf({ label, anchor, href });
  const kind = tag && WORD_TAGS.includes(tag) ? tag : "p";
  const style = lookStyle(look, editing);
  if (attrs.href && kind === "span") return createElement("a", { ...attrs, className, style, dangerouslySetInnerHTML: { __html: clean.replace(/<\/?a\b[^>]*>/g, "") } });
  const { href: link, rel, ...own } = attrs;
  // A linked heading stays a heading, with the link inside it. The inner anchor is written here because a nested one would be invalid.
  const body = link ? `<a href="${attrText(link)}"${rel ? ` rel="${rel}"` : ""} style="color:inherit">${clean.replace(/<\/?a\b[^>]*>/g, "")}</a>` : clean;
  return createElement(kind, { ...own, className, style, dangerouslySetInnerHTML: { __html: body } });
}

function Picture({ src, alt, look, label, anchor, cls, puck }: { src?: unknown; alt?: unknown; look?: unknown; label?: unknown; anchor?: unknown; cls?: unknown; puck?: PuckContext }): ReactNode {
  const className = classOf(cls);
  const url = typeof src === "string" ? safeSrc(src) : null;
  const editing = !!puck?.boxEditing;
  const style = lookStyle(look, editing);
  const attrs = attrsOf({ label, anchor });
  if (!url) {
    if (!editing) return null;
    return createElement("div", { ...attrs, className, style: { minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "#ececea", color: "#55554f", font: "13px system-ui, sans-serif", ...style } }, "Picture");
  }
  return createElement("img", { ...attrs, className, src: url, alt: typeof alt === "string" ? alt : "", loading: "lazy", draggable: false, style: { display: "block", maxWidth: "100%", ...style } });
}

/**
 * A live piece of a code-built page (a sign-in link, a feed, a form), which stays
 * React while everything around it is boxes. The page passes its parts in metadata:
 * elements when published, or the HTML they drew when an editor is showing them.
 */
function Part({ part, puck }: { part?: unknown; puck?: PuckContext & { metadata?: { parts?: Record<string, ReactNode> } } }): ReactNode {
  const v = typeof part === "string" ? puck?.metadata?.parts?.[part] : null;
  if (typeof v === "string") return createElement("div", { style: { display: "contents" }, dangerouslySetInnerHTML: { __html: v } });
  return v ?? null;
}

/** The page itself: what is around everything, with a background and a width of its own. */
function PageRoot({ settings, children }: { settings: Record<string, unknown>; children?: ReactNode }): ReactNode {
  const puck = settings.puck as PuckContext | undefined;
  const style = lookStyle(settings.look, !!puck?.boxEditing, { image: settings.image, imageFit: settings.imageFit });
  if (style.width) style.marginInline = "auto";
  return createElement("div", { "data-page-root": "", style }, children);
}

const def = (id: string, category: string, label: string, description: string, props: unknown[]) => ({ id, category, label, description, memberSafe: true, styling: "tokens", props });
const options = (list: readonly string[], names: Record<string, string>) => list.map((value) => ({ value, label: names[value] ?? value }));

export const BOX_NAMES: Record<string, string> = { div: "Box", section: "Section", header: "Header", footer: "Footer", nav: "Navigation", aside: "Aside", article: "Article", main: "Main", figure: "Figure", ul: "List", ol: "Numbered list", li: "Item", blockquote: "Quote", figcaption: "Caption" };
export const WORD_NAMES: Record<string, string> = { p: "Paragraph", h1: "Heading 1", h2: "Heading 2", h3: "Heading 3", h4: "Heading 4", h5: "Heading 5", h6: "Heading 6", div: "Text", span: "Label", li: "Item", blockquote: "Quote", figcaption: "Caption", hr: "Divider" };

/** Hosts add these to their catalogue. Typed loosely: a host casts them as it does its own blocks. */
export const BOX_BLOCKS = [
  {
    def: def("box", "layout", "Box", "A box that holds other blocks, laid out as a stack or a grid.", [
      { name: "items", kind: "slot", label: "Inside" },
      { name: "tag", kind: "select", label: "Kind", default: "div", options: options(BOX_TAGS, BOX_NAMES) },
    ]),
    Component: Box,
  },
  {
    def: def("words", "content", "Words", "Words you type on the page.", [
      { name: "html", kind: "text", label: "Words", default: "" },
      { name: "tag", kind: "select", label: "Kind", default: "p", options: options(WORD_TAGS, WORD_NAMES) },
    ]),
    Component: Words,
  },
  {
    def: def("picture", "content", "Picture", "One picture.", [
      { name: "src", kind: "image", label: "Picture", default: "" },
      { name: "alt", kind: "string", label: "Description", default: "" },
    ]),
    Component: Picture,
  },
  {
    // Not member-safe, so it cannot be placed by hand: a part only exists where a page drew one.
    def: { ...def("part", "content", "Live part", "A live piece of this page.", [{ name: "part", kind: "string", label: "Part", default: "" }]), memberSafe: false },
    Component: Part,
  },
];

/** For buildPuckConfig's `root`. */
export const BOX_ROOT = { props: [], wrap: PageRoot };
