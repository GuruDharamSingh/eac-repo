// ============================================================================
// Rich text inside a part: a tiny allow-listed markup (pass 2, 2026-11-01).
//
// A part's words may carry  <b> <i> <u> <a href="http(s)://…"> <ul><li> <br>
// and nothing else. The same function cleans it on the server (the host's
// cleanDoc), in the editor (before it touches innerHTML) and for the public
// page, which never uses innerHTML at all: it parses to a tree (parseRich) and
// builds React elements from that. Pure string code, no DOM, so it runs
// anywhere.
//
// sanitizeRich is canonical and idempotent: sanitizeRich(sanitizeRich(x)) ===
// sanitizeRich(x), so a saved document is unchanged by a second clean.
// ============================================================================

export type RTag = "b" | "i" | "u" | "a" | "ul" | "li" | "br";
export type RNode = { t: "text"; v: string } | { t: "el"; tag: RTag; href?: string; kids: RNode[] };
export interface RichOpts {
  /** Lists (ul / li) allowed. Otherwise list items become line breaks. */
  list?: boolean;
}

const ALIAS: Record<string, RTag> = { b: "b", strong: "b", i: "i", em: "i", u: "u", ins: "u", a: "a", ul: "ul", li: "li", br: "br" };
const SKIP_CONTENT = new Set(["script", "style", "iframe", "object", "noscript", "template", "textarea", "title"]);
const MAX_DEPTH = 6;
const MAX_NODES = 400;
const MAX_HREF = 500;

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(n) || n < 32 || n > 0x10ffff || (n >= 0xd800 && n < 0xe000)) return "";
      try { return String.fromCodePoint(n); } catch { return ""; }
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}
const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => escText(s).replace(/"/g, "&quot;");

/** A link target the page may carry: http or https only. */
export function safeHref(v: string | undefined | null): string | null {
  if (!v) return null;
  const s = decode(v).trim();
  if (!s || s.length > MAX_HREF * 2) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href.slice(0, MAX_HREF) : null;
  } catch { return null; }
}

function attrOf(attrs: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|[\\s"'])${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(attrs);
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined;
}

type Frame = { tag: RTag; node: RNode & { t: "el" } };

/** Parse markup into the allow-listed tree. Anything else is dropped; its text stays. */
export function parseRich(src: string, o: RichOpts = {}): RNode[] {
  const root: RNode[] = [];
  const stack: Frame[] = [];
  let count = 0, ignoredA = 0;
  const kids = () => (stack.length ? stack[stack.length - 1]!.node.kids : root);
  const top = () => (stack.length ? stack[stack.length - 1]!.tag : null);
  const inStack = (t: RTag) => stack.some((f) => f.tag === t);
  const lineBreak = () => {
    const k = kids();
    if (top() === "ul" || !k.length || (k[k.length - 1] as RNode).t === "el" && (k[k.length - 1] as { tag: string }).tag === "br") return;
    k.push({ t: "el", tag: "br", kids: [] });
  };
  const text = (raw: string) => {
    if (!raw || count > MAX_NODES || top() === "ul") return;
    const parts = decode(raw).replace(/\r/g, "").split("\n");
    parts.forEach((p, i) => {
      if (i > 0) { kids().push({ t: "el", tag: "br", kids: [] }); count++; }
      if (!p) return;
      const k = kids(), last = k[k.length - 1];
      if (last && last.t === "text") last.v += p; else { k.push({ t: "text", v: p }); count++; }
    });
  };
  const open = (name: string, attrs: string) => {
    const tag = ALIAS[name];
    if (!tag || count > MAX_NODES) { if (name === "li" || name === "p" || name === "div") lineBreak(); return; }
    if (tag === "br") { if (top() !== "ul") { kids().push({ t: "el", tag: "br", kids: [] }); count++; } return; }
    if (tag === "ul") {
      if (!o.list || stack.length > 0) { lineBreak(); return; }
      const node: RNode & { t: "el" } = { t: "el", tag: "ul", kids: [] };
      root.push(node); stack.push({ tag: "ul", node }); count++; return;
    }
    if (tag === "li") {
      while (stack.length && top() !== "ul" && inStack("li")) stack.pop();
      if (top() !== "ul") { lineBreak(); return; }
      const node: RNode & { t: "el" } = { t: "el", tag: "li", kids: [] };
      kids().push(node); stack.push({ tag: "li", node }); count++; return;
    }
    if (top() === "ul" || stack.length >= MAX_DEPTH) { if (tag === "a") ignoredA++; return; }
    if (tag === "a") {
      const href = safeHref(attrOf(attrs, "href"));
      if (!href || inStack("a")) { ignoredA++; return; }
      const node: RNode & { t: "el" } = { t: "el", tag: "a", href, kids: [] };
      kids().push(node); stack.push({ tag: "a", node }); count++; return;
    }
    const node: RNode & { t: "el" } = { t: "el", tag, kids: [] };
    kids().push(node); stack.push({ tag, node }); count++;
  };
  const close = (name: string) => {
    const tag = ALIAS[name];
    if (!tag) { if (name === "li" || name === "p" || name === "div") lineBreak(); return; }
    if (tag === "br") return;
    if (tag === "a" && ignoredA > 0) { ignoredA--; return; }
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i]!.tag === tag) { stack.length = i; return; }
    }
  };

  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let at = 0, m: RegExpExecArray | null;
  const s = src.slice(0, 60000);
  while ((m = re.exec(s))) {
    text(s.slice(at, m.index));
    at = m.index + m[0].length;
    if (!m[1]) continue; // a comment
    const name = m[1].toLowerCase();
    if (m[0][1] === "/") { close(name); continue; }
    if (SKIP_CONTENT.has(name)) {
      const end = s.toLowerCase().indexOf("</" + name, at);
      at = end < 0 ? s.length : end;
      re.lastIndex = at;
      continue;
    }
    open(name, m[2] ?? "");
  }
  text(s.slice(at));
  return tidy(root);
}

/** Remove empty elements, trailing breaks and lists without items. */
function tidy(nodes: RNode[]): RNode[] {
  const out: RNode[] = [];
  for (const n of nodes) {
    if (n.t === "text") { const last = out[out.length - 1]; if (last && last.t === "text") last.v += n.v; else if (n.v) out.push({ ...n }); continue; }
    if (n.tag === "br") { out.push(n); continue; }
    const kids = tidy(n.kids);
    if (n.tag === "li") { while (kids.length && kids[kids.length - 1]!.t === "el" && (kids[kids.length - 1] as { tag: string }).tag === "br") kids.pop(); }
    if (!kids.length) continue;
    out.push({ ...n, kids });
  }
  while (out.length && out[out.length - 1]!.t === "el" && (out[out.length - 1] as { tag: string }).tag === "br") out.pop();
  while (out.length && out[0]!.t === "el" && (out[0] as { tag: string }).tag === "br") out.shift();
  return out;
}

/** The canonical markup for a tree. */
export function serializeRich(nodes: RNode[]): string {
  return nodes.map((n) => {
    if (n.t === "text") return escText(n.v);
    if (n.tag === "br") return "<br>";
    const inner = serializeRich(n.kids);
    return n.tag === "a" ? `<a href="${escAttr(n.href ?? "")}">${inner}</a>` : `<${n.tag}>${inner}</${n.tag}>`;
  }).join("");
}

/** Clean markup: the one function the server, the editor and the page agree on. */
export function sanitizeRich(src: string | undefined | null, o: RichOpts = {}): string {
  return src ? serializeRich(parseRich(src, o)) : "";
}

/** Escape plain text as markup (a line break becomes <br>). */
export function textToRich(text: string): string {
  return escText(text.replace(/\r/g, "")).replace(/\n/g, "<br>");
}

/** The words without the markup, for labels and layer names. */
export function richPlain(src: string | undefined | null): string {
  if (!src) return "";
  if (!/[<&]/.test(src)) return src;
  const walk = (nodes: RNode[]): string => nodes.map((n) => (n.t === "text" ? n.v : n.tag === "br" ? " " : n.tag === "li" ? walk(n.kids) + " " : walk(n.kids))).join("");
  return walk(parseRich(src, { list: true })).replace(/\s+/g, " ").trim();
}

/** Does the markup contain any formatting at all? */
export const hasMarkup = (src: string | undefined | null) => !!src && /<[a-z]/i.test(src);

/** Which tags wrap the whole of `src`, for the toolbar state when nothing is being edited. */
export function wholeHas(src: string | undefined | null, tag: "b" | "i" | "u" | "a" | "ul", o: RichOpts = {}): boolean {
  const nodes = parseRich(src ?? "", { list: true, ...o });
  if (tag === "ul") return nodes.length === 1 && nodes[0]!.t === "el" && nodes[0]!.tag === "ul";
  const inner = nodes.length === 1 && nodes[0]!.t === "el" && nodes[0]!.tag === "ul" ? (nodes[0]!.kids as RNode[]).map((li) => (li as { kids: RNode[] }).kids) : [nodes];
  return inner.length > 0 && inner.every((ns) => ns.length === 1 && ns[0]!.t === "el" && ns[0]!.tag === tag);
}

/** Wrap (or unwrap) the whole text in one tag; inside a list, each item. */
export function toggleWhole(src: string | undefined | null, tag: "b" | "i" | "u" | "a", o: RichOpts = {}, href?: string): string {
  const nodes = parseRich(src ?? "", { list: true, ...o });
  const apply = (ns: RNode[]): RNode[] => {
    if (ns.length === 1 && ns[0]!.t === "el" && ns[0]!.tag === tag) return ns[0]!.kids;
    if (!ns.length) return ns;
    const h = tag === "a" ? safeHref(href) : undefined;
    if (tag === "a" && !h) return ns;
    return [{ t: "el", tag, ...(h ? { href: h } : {}), kids: stripTag(ns, tag) }];
  };
  const out = nodes.length === 1 && nodes[0]!.t === "el" && nodes[0]!.tag === "ul"
    ? [{ ...nodes[0]!, kids: (nodes[0] as { kids: RNode[] }).kids.map((li) => ({ ...(li as object), kids: apply((li as { kids: RNode[] }).kids) }) as RNode) } as RNode]
    : apply(nodes);
  return serializeRich(tidy(out));
}
function stripTag(ns: RNode[], tag: RTag): RNode[] {
  return ns.flatMap((n) => (n.t === "el" && n.tag === tag ? stripTag(n.kids, tag) : n.t === "el" ? [{ ...n, kids: stripTag(n.kids, tag) } as RNode] : [n]));
}

/** Turn the whole text into a list (one item per line) or back into lines. */
export function toggleList(src: string | undefined | null): string {
  const nodes = parseRich(src ?? "", { list: true });
  if (nodes.length === 1 && nodes[0]!.t === "el" && nodes[0]!.tag === "ul") {
    const lines: RNode[] = [];
    (nodes[0]!.kids as RNode[]).forEach((li, i) => { if (i) lines.push({ t: "el", tag: "br", kids: [] }); lines.push(...(li as { kids: RNode[] }).kids); });
    return serializeRich(tidy(lines));
  }
  const items: RNode[][] = [[]];
  for (const n of nodes) { if (n.t === "el" && n.tag === "br") items.push([]); else items[items.length - 1]!.push(n); }
  const lis = items.filter((it) => it.length).map((kids) => ({ t: "el", tag: "li", kids }) as RNode);
  return lis.length ? serializeRich([{ t: "el", tag: "ul", kids: lis }]) : "";
}
