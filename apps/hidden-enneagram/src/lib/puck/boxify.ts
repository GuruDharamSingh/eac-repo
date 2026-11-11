import { sanitizeRich } from "@elkdonis/direct-edit/richtext";

// ============================================================================
// Word blocks into boxes (2026-11-11, canvas first).
//
// The canvas editor is the page editor: a page is a tree of boxes, words and
// pictures that can be moved, grouped and restyled one by one, with the live
// blocks (the figure, shelves, services, posts, people, the forum, the course,
// the contact form) sealed inside it. Four of this site's blocks are only words
// and layout fixed in code: Welcome, Opening, Passage and Glow. Opened in the
// canvas, each becomes the boxes it draws, with the same tags and classes, so
// the site's stylesheet draws them as before. Nothing changes for visitors until
// the page is saved from the canvas.
//
// What the blocks keyed on data attributes is a class here (a box carries no
// data attributes): he-links-<aside|below|none>, he-width-<reading|wide>,
// he-drop, he-side-<yes|no>, he-size-<small|medium|large>. site.css reads both.
// The Opening's lit phrase is <i> inside the title (rich text keeps b, i, u,
// links and lists only); site.css draws an <i> in a title as the lit phrase.
//
// Left sealed: a block with a look set on its parts (`morph`), which boxes cannot
// carry over yet; he-type (the popup reads the row's data attributes) and every
// block that draws a record. Pure and DOM-free: runs in the editor and in tests.
// ============================================================================

type Props = Record<string, unknown> & { id: string };
export type BoxNode = { type: string; props: Props };
type Doc = { root?: unknown; content?: unknown; zones?: unknown };

/** The blocks a canvas opens as boxes. */
export const BOXED_TYPES = new Set(["he-welcome", "he-hero", "he-passage", "he-orb"]);

const str = (v: unknown) => (typeof v === "string" ? v : "");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Ids made from the block's own id, never one already in the document (a repeated id is dropped on save). */
function idMaker(base: string, used: Set<string>) {
  return (part: string) => {
    let id = `${base}-${part}`;
    for (let i = 2; used.has(id); i++) id = `${base}-${part}-${i}`;
    used.add(id);
    return id;
  };
}
type Ids = ReturnType<typeof idMaker>;

const box = (id: string, tag: string, cls: string, items: BoxNode[], extra: Record<string, unknown> = {}): BoxNode => ({
  type: "box",
  props: { id, tag, ...(cls ? { cls } : {}), items, ...extra },
});
const words = (id: string, tag: string, cls: string, html: string, extra: Record<string, unknown> = {}): BoxNode => ({
  type: "words",
  props: { id, tag, html, ...(cls ? { cls } : {}), ...extra },
});

// ── rich text: one words node per paragraph, heading, quote; a list as a box of items ──

const BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "ul", "ol", "div"]);

/** The top-level elements of trusted, already-sanitised HTML, with stray text between them as paragraphs. */
function topLevel(html: string, only?: Set<string>): Array<{ tag: string | null; inner: string }> {
  const out: Array<{ tag: string | null; inner: string }> = [];
  const accept = only ?? BLOCK_TAGS;
  const open = /<([a-z][a-z0-9]*)\b[^>]*>/gi;
  let i = 0;
  let text = "";
  const flush = () => {
    if (text.replace(/<[^>]*>/g, "").trim()) out.push({ tag: null, inner: text.trim() });
    text = "";
  };
  while (i < html.length) {
    open.lastIndex = i;
    const m = open.exec(html);
    if (!m) { text += html.slice(i); break; }
    const tag = m[1]!.toLowerCase();
    if (!accept.has(tag)) {
      text += html.slice(i, m.index + m[0].length);
      i = m.index + m[0].length;
      continue;
    }
    text += html.slice(i, m.index);
    flush();
    const start = m.index + m[0].length;
    const pair = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, "gi");
    pair.lastIndex = start;
    let depth = 1;
    let end = html.length;
    let inner = html.slice(start);
    for (let n = pair.exec(html); n; n = pair.exec(html)) {
      if (n[0][1] === "/") {
        if (--depth === 0) { inner = html.slice(start, n.index); end = n.index + n[0].length; break; }
      } else depth++;
    }
    out.push({ tag, inner });
    i = end;
  }
  flush();
  return out;
}

/** A rich-text prop as the nodes it draws. Plain text (no markup): paragraphs at blank lines, a single newline a line break, as <Paragraphs> draws it. */
export function richNodes(body: unknown, ids: Ids, part: string): BoxNode[] {
  const src = str(body);
  if (!src.trim()) return [];
  if (!/<[a-z]/i.test(src)) {
    return src
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => words(ids(part), "p", "", esc(p).replace(/\r?\n/g, "<br>")));
  }
  const nodes: BoxNode[] = [];
  for (const { tag, inner } of topLevel(src)) {
    if (tag === "ul" || tag === "ol") {
      const items = topLevel(inner, new Set(["li"]))
        .filter((li) => li.tag === "li")
        .map((li) => words(ids(`${part}-item`), "li", "", sanitizeRich(li.inner, { list: true })))
        .filter((w) => str(w.props.html).trim());
      if (items.length) nodes.push(box(ids(`${part}-list`), tag, "", items));
      continue;
    }
    const html = sanitizeRich(inner, { list: true });
    if (!html.trim()) continue;
    const kind = tag && tag !== "div" ? tag : "p";
    nodes.push(words(ids(part), kind, "", html));
  }
  return nodes;
}

// ── the four blocks ─────────────────────────────────────────────────────────

function welcome(p: Props, ids: Ids): BoxNode[] {
  const link = str(p.linkLabel).trim() && str(p.linkHref).trim();
  const left: BoxNode[] = [];
  if (str(p.heading)) left.push(words(ids("greeting"), "h1", "he-welcome-heading", esc(str(p.heading))));
  left.push(box(ids("rule"), "span", "he-welcome-rule", []));
  if (str(p.subline)) left.push(words(ids("subline"), "p", "he-welcome-subline", esc(str(p.subline))));
  const right: BoxNode[] = [box(ids("letter"), "div", "he-welcome-body", richNodes(p.body, ids, "letter-p"))];
  if (str(p.signature)) right.push(words(ids("signed"), "p", "he-welcome-sign", `— ${esc(str(p.signature))}`));
  if (link) right.push(words(ids("link"), "span", "he-welcome-link", `${esc(str(p.linkLabel))} →`, { href: str(p.linkHref) }));
  return [
    box(ids("in"), "div", "he-welcome-in", [
      box(ids("left"), "div", "he-welcome-left", left),
      box(ids("right"), "div", "he-welcome-right", right),
    ]),
  ];
}

function litTitle(title: string, accent: string): string {
  const at = accent ? title.indexOf(accent) : -1;
  if (at < 0) return esc(title);
  return `${esc(title.slice(0, at))}<i>${esc(accent)}</i>${esc(title.slice(at + accent.length))}`;
}

function hero(p: Props, ids: Ids): { cls: string; look?: Record<string, unknown>; items: BoxNode[] } {
  const figure = str(p.figure) || "sigil";
  const image = str(p.image).trim();
  const hasImage = figure === "image" && image !== "";
  const side = figure === "sigil" || figure === "orb" || hasImage;
  const links = [
    { label: p.primaryLabel, href: p.primaryHref, primary: true },
    { label: p.secondLabel, href: p.secondHref, primary: false },
    { label: p.thirdLabel, href: p.thirdHref, primary: false },
  ].filter((l) => str(l.label).trim() && str(l.href).trim());

  const copy: BoxNode[] = [];
  if (str(p.eyebrow)) copy.push(words(ids("eyebrow"), "p", "he-eyebrow he-hero-eyebrow", esc(str(p.eyebrow))));
  copy.push(words(ids("title"), "h1", "he-hero-title", litTitle(str(p.title), str(p.accent))));
  if (str(p.lede).trim()) copy.push(words(ids("lede"), "p", "he-lede he-hero-lede", esc(str(p.lede))));
  if (links.length) {
    copy.push(
      box(
        ids("links"),
        "div",
        "he-hero-actions",
        links.map((l) => words(ids("link"), "span", l.primary ? "he-btn he-primary" : "he-btn", esc(str(l.label)), { href: str(l.href) })),
      ),
    );
  }
  const grid: BoxNode[] = [box(ids("copy"), "div", "he-hero-copy", copy)];
  if (figure === "sigil") grid.push(box(ids("figure"), "div", "he-hero-figure", [{ type: "he-sigil", props: { id: ids("sigil") } }]));
  else if (figure === "orb") grid.push(box(ids("figure"), "div", "he-hero-figure he-hero-orb", [box(ids("orb"), "div", "he-orb", [])]));
  else if (hasImage) grid.push(box(ids("figure"), "figure", "he-hero-figure he-hero-picture", [{ type: "picture", props: { id: ids("picture"), src: image, alt: str(p.imageAlt) } }]));

  const size = typeof p.titleSize === "number" ? p.titleSize : 64;
  return {
    cls: `he-hero he-side-${side ? "yes" : "no"}`,
    ...(size !== 64 ? { look: { css: `--he-hero-title-size: ${size}px` } } : {}),
    items: [box(ids("grid"), "div", "he-hero-grid", grid)],
  };
}

function passage(p: Props, ids: Ids): { cls: string; items: BoxNode[] } {
  const rows = (Array.isArray(p.links) ? (p.links as Array<Record<string, unknown>>) : []).filter((l) => str(l?.label).trim() && str(l?.href).trim());
  const linksAt = rows.length ? (str(p.linksAt) === "below" ? "below" : "aside") : "none";
  const width = str(p.width) === "wide" ? "wide" : "reading";
  const main: BoxNode[] = [];
  if (str(p.eyebrow)) main.push(words(ids("eyebrow"), "p", "he-eyebrow", esc(str(p.eyebrow))));
  if (str(p.heading)) main.push(words(ids("heading"), "h2", "he-passage-title", esc(str(p.heading))));
  main.push(box(ids("text"), "div", "he-passage-body", richNodes(p.body, ids, "text-p")));
  const grid: BoxNode[] = [box(ids("main"), "div", "he-passage-main", main)];
  if (rows.length) {
    const heading = str(p.heading);
    grid.push(
      box(
        ids("links"),
        "nav",
        "he-passage-links",
        rows.map((l) => {
          const kids = [words(ids("link-label"), "span", "he-passage-link", esc(str(l.label)))];
          if (str(l.note)) kids.push(words(ids("link-note"), "span", "he-passage-note", esc(str(l.note))));
          return box(ids("link"), "div", "", kids, { href: str(l.href) });
        }),
        { label: heading ? `${heading}: chapters` : "Chapters" },
      ),
    );
  }
  return {
    cls: `he-passage he-links-${linksAt} he-width-${width}${p.dropCap === true ? " he-drop" : ""}`,
    items: [box(ids("grid"), "div", "he-passage-grid", grid)],
  };
}

function orb(p: Props, ids: Ids): BoxNode[] {
  const size = ["small", "medium", "large"].includes(str(p.size)) ? str(p.size) : "medium";
  return [box(ids("orb"), "div", `he-orb he-size-${size}`, [])];
}

/** One block as the boxes it draws; null to leave it sealed. */
export function boxifyNode(node: BoxNode, used: Set<string>): BoxNode | null {
  if (!BOXED_TYPES.has(node.type) || !node.props || typeof node.props.id !== "string") return null;
  const morph = node.props.morph as { parts?: Record<string, unknown> } | undefined;
  if (morph && typeof morph === "object" && Object.keys(morph).length) return null;
  const p = node.props;
  const ids = idMaker(p.id, used);
  // The generic Style (blkStyle: spacing, background, anchor...) wraps a box as it wrapped the block.
  const keep = p.blkStyle && typeof p.blkStyle === "object" ? { blkStyle: p.blkStyle } : {};
  switch (node.type) {
    case "he-welcome":
      return box(ids("band"), "section", "blk he-welcome", welcome(p, ids), keep);
    case "he-hero": {
      const h = hero(p, ids);
      return box(ids("band"), "section", `blk ${h.cls}`, h.items, { ...keep, ...(h.look ? { look: h.look } : {}) });
    }
    case "he-passage": {
      const s = passage(p, ids);
      return box(ids("band"), "section", `blk ${s.cls}`, s.items, keep);
    }
    case "he-orb":
      return box(ids("band"), "div", "blk he-orb-band", orb(p, ids), keep);
    default:
      return null;
  }
}

function collectIds(v: unknown, into: Set<string>): void {
  if (Array.isArray(v)) for (const x of v) collectIds(x, into);
  else if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const props = o.props as Record<string, unknown> | undefined;
    if (typeof o.type === "string" && props && typeof props.id === "string") into.add(props.id);
    for (const x of Object.values(props ?? o)) if (x && typeof x === "object") collectIds(x, into);
  }
}

function walk(list: unknown, used: Set<string>): { list: unknown; changed: number } {
  if (!Array.isArray(list)) return { list, changed: 0 };
  let changed = 0;
  const out = list.map((raw) => {
    const n = raw as BoxNode;
    if (!n || typeof n !== "object" || !n.props) return raw;
    const boxed = boxifyNode(n, used);
    if (boxed) { changed++; return boxed; }
    // Slots and node arrays inside any block (a Sticky side's columns, a box's items).
    let props = n.props;
    for (const [k, v] of Object.entries(n.props)) {
      if (Array.isArray(v) && v.some((x) => x && typeof x === "object" && "type" in x && "props" in x)) {
        const r = walk(v, used);
        if (r.changed) { props = { ...props, [k]: r.list }; changed += r.changed; }
      }
    }
    return props === n.props ? raw : { ...n, props };
  });
  return { list: out, changed };
}

/** A page with its word blocks as boxes, slots included. `changed` counts the blocks converted. */
export function boxifyDoc<T extends Doc>(doc: T): { doc: T; changed: number } {
  const used = new Set<string>();
  collectIds(doc.content, used);
  collectIds(doc.zones, used);
  const r = walk(doc.content, used);
  return { doc: r.changed ? ({ ...doc, content: r.list } as T) : doc, changed: r.changed };
}
