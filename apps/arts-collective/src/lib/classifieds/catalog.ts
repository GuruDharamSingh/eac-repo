// ============================================================================
// An org's classifieds page (2026-11-01, experiment; pass 3 2026-11-02).
//
// Ads are blocks: each stores { template, overrides, link } and everything
// else is derived from a style family and a template, so the public page and
// the editor render the same thing from the same data. The editor is the
// direct-editing panel (@elkdonis/direct-edit; plan docs/open/
// DIRECT_EDITING_PANEL_PLAN_2026-11-01.md).
//
// Pass 3: an ad is a node tree (@elkdonis/direct-edit/block): a root
// container holding text parts, pictures, dividers and boxes (stacks or grids)
// that hold more nodes. Parts can be dragged, reordered, nested and moved
// between ads. The tree is an override like any other: an ad that never
// changed its structure stores none and follows its template (whose tree
// defaults to the five original parts, so every saved ad reads as before).
// Styles and words stay keyed by node id, and the five original parts keep
// their names as ids, so `o.parts.title` and `o.copy.body` mean what they did.
// The sheet chooses its grid (columns, gutter, row height); an absent grid is
// the original 6-column sheet. The same blocks drive feed cards
// (lib/cards/catalog.ts): one design drawn for every item of a live feed, its
// words naming the item's fields as {{tokens}}.
//
// Pure data and functions only: imported by server pages and by the client
// editor alike. Stored per org in site_config under CLASSIFIEDS_KEY.
// ============================================================================

import { fontStack as libraryStack, googleFontsHref } from "@elkdonis/fonts";
import { richPlain, sanitizeRich } from "@elkdonis/direct-edit/richtext";
import {
  BOUNDS, BORDER_STYLES, GRID_DEFAULT, HEX, JUSTIFY, PUSH, SELF, WEIGHTS,
  boxDecls, cleanGrid, cleanSrc, cleanStyle as cleanStyleWith, cleanTree, declsToString, declsToStyle, fillTokens, gridDecls, gridOf,
  maxRows, num, partDecls as nodeDecls, px, ruleDecls, safeDecls, safeSrc, sameGrid, sameTree, scaleSpan, str, treeIds, walk,
  type Decl, type GridSpec, type Item, type PartStyle, type Quad, type TreeNode, type TreeRules,
} from "@elkdonis/direct-edit/block";

export { BOUNDS, BORDER_STYLES, JUSTIFY, PUSH, SELF, WEIGHTS, declsToString, declsToStyle, safeDecls, type Decl, type GridSpec, type Item, type PartStyle, type Quad, type TreeNode };

/** A part's words without the rich-text markup (labels, layer names, aria text). */
export const plainCopy = richPlain;

export const CLASSIFIEDS_KEY = "classifieds:page";
/** The original sheet's column count (templates are written on it; GRID_DEFAULT). */
export const COLS = GRID_DEFAULT.cols;
/** The sheet's paper (classifieds.css --paper). */
export const PAPER = "#ece5d3";

// ---------------------------------------------------------------------------
// Kinds of node. The five text kinds are the original parts; their names are
// also the ids of the default tree's nodes ("title" is always a title).
// ---------------------------------------------------------------------------
export type TextKind = "header" | "title" | "body" | "price" | "contact";
export type Kind = "frame" | TextKind | "box" | "rule" | "image";
/** The original part names (the default tree's ids, plus the ad itself). */
export type PartName = "frame" | TextKind;
export const TEXT_KINDS: TextKind[] = ["header", "title", "body", "price", "contact"];
export const TEXT_PARTS = TEXT_KINDS;
export const PARTS: PartName[] = ["frame", ...TEXT_KINDS];
export const NODE_KINDS: Exclude<Kind, "frame">[] = [...TEXT_KINDS, "box", "rule", "image"];
export const KIND_LABEL: Record<Kind, string> = { frame: "Ad", header: "Header", title: "Title", body: "Body", price: "Price", contact: "Contact", box: "Box", rule: "Divider", image: "Picture" };
export const PART_LABEL = KIND_LABEL;
export const isTextKind = (k: string | undefined): k is TextKind => !!k && (TEXT_KINDS as string[]).includes(k);
export const HEADERS = ["rule", "reversed", "boxed", "ornament", "tab", "plain", "none"];
/** The style families' own fonts (any library family may be stored; see cleanStyle). */
export const ALL_FONTS = ["Old Standard TT", "Bodoni Moda", "UnifrakturMaguntia", "Abril Fatface", "Oswald", "Libre Franklin", "Archivo Narrow", "Courier Prime", "IBM Plex Mono", "Georgia", "Fraunces", "Inter"];
/** One stylesheet for every family font (the editor; pages use classifiedsFontsHref). */
export const FONTS_HREF = googleFontsHref(ALL_FONTS) as string;

/** Text kinds whose words may carry the small rich-text markup (richtext.ts); headers stay plain text. */
export const RICH: Partial<Record<TextKind, { list?: boolean }>> = { title: {}, body: { list: true }, price: {}, contact: {} };

/** The structure rules every stored tree is cleaned against. */
const CHILD_KINDS = [...NODE_KINDS];
export const TREE_RULES: TreeRules = {
  kinds: {
    frame: { container: true, accepts: CHILD_KINDS }, box: { container: true, accepts: CHILD_KINDS },
    header: {}, title: {}, body: {}, price: {}, contact: {}, rule: {}, image: {},
  },
  root: "frame", maxDepth: 4, maxNodes: 40,
  idRe: /^(?:n[1-9]\d{0,5}|header|title|body|price|contact)$/,
  fixed: { header: "header", title: "title", body: "body", price: "price", contact: "contact" },
};
/** What every ad had before pass 3: the five parts in a column. */
export const DEFAULT_TREE: TreeNode[] = TEXT_KINDS.map((k) => ({ id: k, kind: k }));

/** Defaults of the kinds no style family describes. A new box is a row. */
export const KIND_BASE: Record<"box" | "rule" | "image", PartStyle> = {
  box: { dir: "row", gap: 8, items: "baseline", wrap: true },
  rule: { bstyle: "solid", bwidth: 1 },
  image: { ratio: "4/3", fit: "cover" },
};

/**
 * The sheet's shared variables (the Tweaks tab, pass 2). A doc-level override
 * of what the style families draw with: one change recolours / re-fonts every
 * ad that uses it. Later wired to the org's site_themes row.
 */
export interface Theme { paper?: string; ink?: string; spot?: string; title?: string; body?: string }
export const THEME_KEYS = ["paper", "ink", "spot", "title", "body"] as const;

export interface Family {
  label: string; ink: string; spot: string;
  display: string[]; body: string[]; headers: string[];
  sizes: Record<TextKind, [number, number]>;
  defaults: Record<PartName, PartStyle>;
}

export const FAMILIES: Record<string, Family> = {
  broadsheet: {
    label: "1920s broadsheet", ink: "#1d1a16", spot: "#7a2e1f",
    display: ["Old Standard TT", "Bodoni Moda", "UnifrakturMaguntia"], body: ["Old Standard TT", "Bodoni Moda"],
    headers: ["rule", "ornament", "boxed", "none"],
    sizes: { header: [8, 12], title: [13, 26], body: [9, 13], price: [9, 16], contact: [8, 11] },
    defaults: {
      frame: { border: "hairline", padding: 8, tone: "paper" },
      header: { variant: "rule", font: "Old Standard TT", size: 10 },
      title: { font: "Bodoni Moda", size: 18, weight: 700, case: "none", align: "center", italic: false },
      body: { font: "Old Standard TT", size: 11, leading: 1.3, align: "justify" },
      price: { font: "Old Standard TT", size: 12, weight: 700, italic: false },
      contact: { font: "Old Standard TT", size: 9, case: "upper" },
    },
  },
  altweekly: {
    label: "1970s alt-weekly", ink: "#141414", spot: "#cf3a1e",
    display: ["Abril Fatface", "Oswald"], body: ["Libre Franklin", "Archivo Narrow"],
    headers: ["reversed", "tab", "boxed", "none"],
    sizes: { header: [9, 13], title: [15, 30], body: [10, 13], price: [11, 20], contact: [8, 11] },
    defaults: {
      frame: { border: "heavy", padding: 10, tone: "paper" },
      header: { variant: "reversed", font: "Oswald", size: 11 },
      title: { font: "Abril Fatface", size: 22, weight: 400, case: "none", align: "left", italic: false },
      body: { font: "Libre Franklin", size: 11, leading: 1.35, align: "left" },
      price: { font: "Oswald", size: 15, weight: 600, italic: false },
      contact: { font: "Archivo Narrow", size: 10, case: "upper" },
    },
  },
  swiss: {
    label: "Swiss modern", ink: "#111111", spot: "#2a50a0",
    display: ["Archivo Narrow", "Libre Franklin"], body: ["Libre Franklin"],
    headers: ["tab", "rule", "none"],
    sizes: { header: [8, 11], title: [13, 24], body: [9, 12], price: [10, 15], contact: [8, 10] },
    defaults: {
      frame: { border: "none", padding: 6, tone: "tinted" },
      header: { variant: "tab", font: "Archivo Narrow", size: 9 },
      title: { font: "Archivo Narrow", size: 17, weight: 700, case: "none", align: "left", italic: false },
      body: { font: "Libre Franklin", size: 10, leading: 1.4, align: "left" },
      price: { font: "Libre Franklin", size: 12, weight: 700, italic: false },
      contact: { font: "Libre Franklin", size: 9, case: "none" },
    },
  },
  typed: {
    label: "Personals, typed", ink: "#22201d", spot: "#5c4a2e",
    display: ["Courier Prime", "IBM Plex Mono"], body: ["Courier Prime"],
    headers: ["none", "rule", "boxed"],
    sizes: { header: [8, 11], title: [11, 18], body: [9, 12], price: [9, 13], contact: [8, 10] },
    defaults: {
      frame: { border: "hairline", padding: 8, tone: "paper" },
      header: { variant: "boxed", font: "Courier Prime", size: 9 },
      title: { font: "Courier Prime", size: 14, weight: 700, case: "upper", align: "left", italic: false },
      body: { font: "Courier Prime", size: 10, leading: 1.35, align: "left" },
      price: { font: "Courier Prime", size: 11, weight: 700, italic: false },
      contact: { font: "Courier Prime", size: 9, case: "none" },
    },
  },
  // Pass 3: a quiet family for cards on an org's own site (feed cards).
  plain: {
    label: "Plain site", ink: "#1b1e1c", spot: "#0a7ea4",
    display: ["Fraunces", "Inter", "Libre Franklin"], body: ["Inter", "Libre Franklin"],
    headers: ["plain", "tab", "rule", "none"],
    sizes: { header: [9, 13], title: [15, 34], body: [12, 17], price: [11, 18], contact: [10, 13] },
    defaults: {
      frame: { border: "none", padding: 16, tone: "paper", fill: "#ffffff", radius: 10, bstyle: "solid", bwidth: 1, bcolor: "#e2e2dc", gap: 6 },
      header: { variant: "plain", font: "Inter", size: 10, weight: 600, case: "upper", tracking: 0.12, align: "left", self: "stretch" },
      title: { font: "Fraunces", size: 22, weight: 600, case: "none", align: "left", italic: false, leading: 1.15 },
      body: { font: "Inter", size: 14, leading: 1.5, align: "left" },
      price: { font: "Inter", size: 13, weight: 600, italic: false },
      contact: { font: "Inter", size: 12, case: "none", color: "#5f6762" },
    },
  },
};

export interface Template {
  label: string; family: string;
  /** Size on the original 6-column sheet (GRID_DEFAULT); scaled to the sheet's own grid on read. */
  span: [number, number];
  parts?: Record<string, PartStyle>; copy: Record<string, string>;
  /** Pass 3: the template's structure (default: the five parts). */
  tree?: TreeNode[];
  /** A classifieds sheet template, or a feed card design (lib/cards). */
  scope?: "sheet" | "card";
}

export const BASE_TEMPLATES: Record<string, Template> = {
  "t-notice": { label: "Notice", family: "broadsheet", span: [2, 4], parts: { header: { variant: "rule" } },
    copy: { header: "Notice", title: "Your headline here", body: "A few lines about what you are offering, seeking or announcing. Double-click any text to change it.", price: "", contact: "Box 1" } },
  "t-forsale": { label: "For sale, large", family: "altweekly", span: [3, 4], parts: {},
    copy: { header: "For sale", title: "Something worth having", body: "Describe it plainly: condition, where it is, how to get it home.", price: "$0 or trade", contact: "Ask within" } },
  "t-wanted": { label: "Wanted", family: "swiss", span: [2, 3], parts: {},
    copy: { header: "Wanted", title: "Looking for someone who", body: "Say what you need and what you offer in return.", price: "", contact: "Write c/o the collective" } },
  "t-lessons": { label: "Lessons", family: "broadsheet", span: [2, 3], parts: { header: { variant: "ornament" } },
    copy: { header: "Lessons", title: "Evenings, all welcome", body: "When, where, what to bring.", price: "", contact: "" } },
  "t-personal": { label: "Personal, typed", family: "typed", span: [2, 3], parts: { header: { variant: "none" } },
    copy: { header: "Personals", title: "Gentle reader seeks same", body: "For long walks, longer letters.", price: "", contact: "Box 9" } },
  "t-event": { label: "Event", family: "altweekly", span: [2, 3], parts: { header: { variant: "tab" } },
    copy: { header: "Tonight", title: "An evening of something", body: "Doors at seven. Bring a friend.", price: "Free", contact: "" } },
  "t-lost": { label: "Lost and found", family: "typed", span: [2, 3], parts: { header: { variant: "boxed" } },
    copy: { header: "Lost", title: "Last seen on Thursday", body: "Describe it, and where it was.", price: "Reward", contact: "" } },
  // Pass 3: feed card designs (lib/cards/catalog.ts). Words name the item's fields.
  "c-editorial": {
    label: "Editorial card", family: "plain", span: [2, 1], scope: "card",
    tree: [{ id: "header", kind: "header" }, { id: "title", kind: "title" }, { id: "contact", kind: "contact" }, { id: "body", kind: "body" }, { id: "n1", kind: "box", kids: [{ id: "price", kind: "price" }] }],
    parts: { n1: { justify: "start", gap: 10, push: "end" } },
    copy: { header: "{{kind}}", title: "{{title}}", contact: "{{when}} · {{place}}", body: "{{excerpt}}", price: "{{price}}" },
  },
  "c-picture": {
    label: "Picture card", family: "plain", span: [2, 1], scope: "card",
    tree: [{ id: "n1", kind: "image" }, { id: "header", kind: "header" }, { id: "title", kind: "title" }, { id: "contact", kind: "contact" }],
    parts: { frame: { padding: 0, gap: 8, radius: 10 }, n1: { ratio: "16/9", radius: [10, 10, 0, 0] }, header: { margin: [4, 16, 0, 16] }, title: { margin: [0, 16, 0, 16], size: 20 }, contact: { margin: [0, 16, 14, 16] } },
    copy: { n1: "{{cover}}", header: "{{kind}}", title: "{{title}}", contact: "{{when}} · {{place}}" },
  },
  "c-index": {
    label: "Index row", family: "plain", span: [6, 1], scope: "card",
    tree: [{ id: "n1", kind: "box", kids: [{ id: "contact", kind: "contact" }, { id: "n2", kind: "box", kids: [{ id: "title", kind: "title" }, { id: "body", kind: "body" }] }] }],
    parts: { frame: { padding: [12, 0, 12, 0], radius: 0, bstyle: "none", fill: "#ffffff" }, n1: { items: "start", gap: 18, wrap: false }, contact: { w: 150, weight: 600 }, n2: { dir: "column", gap: 2, items: "stretch", grow: 1 }, title: { size: 18 } },
    copy: { contact: "{{when}}", title: "{{title}}", body: "{{excerpt}}" },
  },
  "c-stop": {
    label: "Tour stop", family: "plain", span: [3, 1], scope: "card",
    tree: [{ id: "n1", kind: "image" }, { id: "n2", kind: "box", kids: [{ id: "header", kind: "header" }, { id: "contact", kind: "contact" }] }, { id: "title", kind: "title" }, { id: "body", kind: "body" }],
    parts: { n1: { ratio: "3/2", radius: 6 }, n2: { justify: "space-between", items: "baseline" }, header: { variant: "tab" } },
    copy: { n1: "{{image}}", header: "Stop {{n}}", contact: "{{duration}}", title: "{{title}}", body: "{{text}}" },
  },
};
export const isCardTemplate = (id: string) => BASE_TEMPLATES[id]?.scope === "card";

/** What an ad points at: one of this org's threads, any web address, or (a feed card) the item it draws. */
export type AdLink =
  | { kind: "thread"; threadId: string }
  | { kind: "url"; url: string; label?: string }
  | { kind: "item" }
  | { kind: "none" };

export interface AdOverrides {
  family?: string;
  /** Size on the sheet's grid (its own column units). */
  span?: [number, number];
  /** Pass 3: the ad's own structure (absent: the template's). */
  tree?: TreeNode[];
  /** Style overrides by node id ("frame" is the ad itself). */
  parts?: Record<string, PartStyle>;
  /** Words (or a picture's source) by node id. */
  copy?: Record<string, string>;
}
export interface Ad {
  id: string;
  template: string;
  o: AdOverrides;
  link?: AdLink;
}
export interface ClassifiedsDoc {
  title?: string;
  /** Shared variables: paper, ink, spot, title and body font. */
  theme?: Theme;
  /** Pass 3: the sheet's grid (absent: 6 columns, 10px gutter, 34px rows). */
  grid?: GridSpec;
  ads: Ad[];
  userTemplates: Record<string, Template>;
  next: number;
  /** Feed cards only (lib/cards): how many items are drawn. cleanDoc drops it. */
  limit?: number;
}

export function starterDoc(orgName: string): ClassifiedsDoc {
  const order = ["t-forsale", "t-notice", "t-wanted", "t-event"];
  return { title: `${orgName} Classifieds`, ads: order.map((t, i) => ({ id: "ad" + (i + 1), template: t, o: {}, link: { kind: "none" } })), userTemplates: {}, next: order.length + 1 };
}

export const templateOf = (doc: ClassifiedsDoc, id: string): Template => doc.userTemplates[id] || BASE_TEMPLATES[id] || BASE_TEMPLATES["t-notice"]!;
export const gridOfDoc = (doc: ClassifiedsDoc): GridSpec => gridOf(doc.grid);
/** The structure an ad draws: its own, else its template's, else the five parts. */
export const treeOf = (doc: ClassifiedsDoc, ad: Ad): TreeNode[] => ad.o.tree ?? templateOf(doc, ad.template).tree ?? DEFAULT_TREE;
export const templateTree = (t: Template): TreeNode[] => t.tree ?? DEFAULT_TREE;

export interface Effective {
  famId: string; fam: Family;
  tree: TreeNode[];
  /** Kind by node id ("frame" for the ad). */
  kinds: Record<string, Kind>;
  /** Style by node id ("frame" for the ad). */
  parts: Record<string, PartStyle>;
  span: [number, number];
  copy: Record<string, string | undefined>;
}

const isDisplay = (k: Kind) => k !== "body" && k !== "contact";

/** A theme colour the page may carry: exactly #rrggbb (cleanDoc enforces it; the renderers check again). */
const themeHex = (v: unknown): string | undefined => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : undefined);
/** The family with the sheet's shared ink and spot applied (what the ad's --ink / --spot are). */
export function familyOf(doc: ClassifiedsDoc, famId: string): Family {
  const f = FAMILIES[famId] || FAMILIES.broadsheet!;
  const t = doc.theme || {};
  return { ...f, ink: themeHex(t.ink) || f.ink, spot: themeHex(t.spot) || f.spot };
}
/** The paper the sheet is printed on. */
export const paperOf = (doc: ClassifiedsDoc) => themeHex(doc.theme?.paper) || PAPER;
/** Custom properties and grid for the sheet element (only what differs from the stylesheet's defaults). */
export function sheetDecls(doc: ClassifiedsDoc): Decl[] {
  const p = themeHex(doc.theme?.paper);
  const d: Decl[] = p ? [["--paper", p]] : [];
  if (doc.grid) d.push(...gridDecls(gridOfDoc(doc)));
  return d;
}

/** The kind a node of an ad's tree has. */
export function kindsOf(tree: TreeNode[]): Record<string, Kind> {
  const k: Record<string, Kind> = { frame: "frame" };
  walk(tree, (n) => { k[n.id] = n.kind as Kind; });
  return k;
}

/** The base style of a node of `kind` in a family, before any template or override. */
export function kindBase(fam: Family, kind: Kind): PartStyle {
  if (kind === "box" || kind === "rule" || kind === "image") return { ...KIND_BASE[kind] };
  return { ...fam.defaults[kind as PartName] };
}

/** One ad's template values per node: family / kind defaults, then the shared fonts, then the template (unless the family was swapped). */
export function baseParts(doc: ClassifiedsDoc, ad: Ad): { famId: string; fam: Family; tree: TreeNode[]; kinds: Record<string, Kind>; base: Record<string, PartStyle> } {
  const t = templateOf(doc, ad.template);
  const famId = ad.o.family && FAMILIES[ad.o.family] ? ad.o.family : FAMILIES[t.family] ? t.family : "broadsheet";
  const fam = familyOf(doc, famId);
  const tree = treeOf(doc, ad);
  const kinds = kindsOf(tree);
  const swapped = !!ad.o.family && ad.o.family !== t.family;
  const base: Record<string, PartStyle> = {};
  for (const [id, kind] of Object.entries(kinds)) {
    const shared = isTextKind(kind) ? (isDisplay(kind) ? doc.theme?.title : doc.theme?.body) : undefined;
    const fromTemplate = swapped ? {} : (t.parts && t.parts[id]) || {};
    base[id] = { ...kindBase(fam, kind), ...(shared ? { font: shared } : {}), ...fromTemplate };
  }
  return { famId, fam, tree, kinds, base };
}

/** The ad's span on the sheet's grid: its own, else the template's scaled from the original sheet. */
export function spanOf(doc: ClassifiedsDoc, ad: Ad): [number, number] {
  if (ad.o.span) return ad.o.span;
  const t = templateOf(doc, ad.template);
  const g = gridOfDoc(doc);
  return sameGrid(g, GRID_DEFAULT) ? [...t.span] as [number, number] : scaleSpan(t.span, GRID_DEFAULT, g);
}

/** The rendered ad: family defaults, the sheet's shared variables, the template, then this ad's overrides. */
export function effective(doc: ClassifiedsDoc, ad: Ad): Effective {
  const t = templateOf(doc, ad.template);
  const { famId, fam, tree, kinds, base } = baseParts(doc, ad);
  const parts: Record<string, PartStyle> = {};
  for (const id of Object.keys(kinds)) parts[id] = { ...base[id], ...((ad.o.parts && ad.o.parts[id]) || {}) };
  const copy: Record<string, string | undefined> = {};
  for (const id of Object.keys(kinds)) if (id !== "frame") copy[id] = ad.o.copy?.[id] ?? t.copy[id];
  return { famId, fam, tree, kinds, parts, span: spanOf(doc, ad), copy };
}

/** CSS font-family for a family name, from the shared library (@elkdonis/fonts). */
export function fontStack(f: string): string {
  return libraryStack(f);
}

/** Every font the page draws with (effective, so family defaults count too). */
export function fontsUsed(doc: ClassifiedsDoc): string[] {
  const out = new Set<string>();
  for (const ad of doc.ads) {
    const e = effective(doc, ad);
    for (const [id, k] of Object.entries(e.kinds)) if (isTextKind(k)) { const f = e.parts[id]?.font; if (f) out.add(f); }
  }
  return [...out];
}

/** The page's stylesheet: only the web fonts it uses ship to visitors. */
export function classifiedsFontsHref(doc: ClassifiedsDoc): string | null {
  return googleFontsHref(fontsUsed(doc));
}

/** CSS for a node (text, box, picture) or a divider. */
export function partDecls(s: PartStyle, opts: { editor?: boolean; noCss?: boolean; kind?: Kind } = {}): Decl[] {
  return opts.kind === "rule" ? ruleDecls(s, opts) : nodeDecls(s, opts);
}
export function frameDecls(e: Effective, opts: { noCss?: boolean; editor?: boolean; cols?: number } = {}): Decl[] {
  const f = e.parts.frame!;
  const d: Decl[] = [
    ["grid-column", `span ${Math.min(e.span[0], opts.cols ?? 24)}`],
    ["grid-row", `span ${e.span[1]}`],
    ["--ink", f.color && HEX.test(f.color) ? f.color : e.fam.ink],
    ["--spot", e.fam.spot],
    ["padding", px(f.padding ?? 8)],
  ];
  // An exact size (Free, resized with snapping off): the ad keeps it inside the cells it spans.
  if (f.w !== undefined) d.push(["width", `${f.w}px`], ["max-width", "100%"], ["justify-self", "start"]);
  if (f.h !== undefined) d.push(["min-height", `${f.h}px`]);
  boxDecls({ ...f, self: undefined, push: undefined, grow: undefined, pos: undefined, w: undefined, h: undefined, cspan: undefined }, d, true);
  if (f.hide && !opts.editor) d.push(["display", "none"]);
  return opts.noCss ? d : d.concat(safeDecls(f.css));
}

// ---------------------------------------------------------------------------
// The render plan: what a block draws, as plain data. The editor turns it into
// an HTML string (with markers), the public page into React elements
// (components/classifieds/BlockView.tsx), so both draw the same thing.
// ---------------------------------------------------------------------------
export interface PlanNode {
  id: string; kind: Kind;
  tag: "div" | "h3" | "img";
  cls: string; decls: Decl[];
  /** Words, already filled from the item and sanitised when rich. */
  text?: string;
  rich?: { list?: boolean } | false;
  /** A picture's source (safe: http(s) or a same-site path). */
  src?: string;
  kids?: PlanNode[];
  /** Editor only: nothing to show publicly (empty words, no picture, empty box), drawn dimmed with a label. */
  placeholder?: string;
  hidden?: boolean;
}
export interface PlanBlock { cls: string; decls: Decl[]; kids: PlanNode[]; hidden: boolean }

export interface PlanOptions {
  /** Keep everything (dimmed placeholders for what the page would omit). */
  editor?: boolean;
  /** The data row a feed card draws (tokens are filled from it). */
  item?: Item | null;
  /** Kind labels for placeholders (feed cards name kinds differently). */
  labels?: Partial<Record<Kind, string>>;
  /** The sheet's column count (spans never exceed it). */
  cols?: number;
}

const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function planAd(doc: ClassifiedsDoc, ad: Ad, opts: PlanOptions = {}): PlanBlock {
  const e = effective(doc, ad);
  const f = e.parts.frame!;
  const label = (k: Kind) => opts.labels?.[k] ?? KIND_LABEL[k];
  const go = (nodes: TreeNode[]): PlanNode[] => {
    const out: PlanNode[] = [];
    for (const n of nodes) {
      const kind = n.kind as Kind, st = e.parts[n.id] ?? {};
      const hidden = !!st.hide;
      if (hidden && !opts.editor) continue;
      const decls = partDecls(st, { editor: opts.editor, kind });
      if (kind === "box") {
        const kids = go(n.kids ?? []);
        const decorated = !!(st.fill || (st.bstyle && st.bstyle !== "none"));
        if (!opts.editor && !kids.length && !decorated) continue;
        out.push({ id: n.id, kind, tag: "div", cls: "cl-part cl-box", decls, kids, hidden, placeholder: !kids.length && opts.editor ? "Empty box: drag parts in" : undefined });
      } else if (kind === "rule") {
        out.push({ id: n.id, kind, tag: "div", cls: "cl-part cl-rule", decls, hidden });
      } else if (kind === "image") {
        const raw = e.copy[n.id] ?? "";
        const src = safeSrc(opts.item ? fillTokens(raw, opts.item).text : raw);
        if (!src && !opts.editor) continue;
        out.push(src
          ? { id: n.id, kind, tag: "img", cls: "cl-part cl-image", decls, src, hidden }
          : { id: n.id, kind, tag: "div", cls: "cl-part cl-image cl-noimage", decls, hidden, placeholder: label("image") });
      } else if (isTextKind(kind)) {
        const raw = e.copy[n.id] ?? "";
        const rich = RICH[kind] ?? false;
        let text = raw;
        let empty = !raw;
        if (opts.item) {
          const fl = fillTokens(raw, opts.item, { rich: !!rich });
          text = fl.text;
          empty = !text || (fl.bound && !fl.any);
        }
        if (empty && !opts.editor) continue;
        const cls = `cl-part cl-${kind}${kind === "header" ? ` cl-h-${st.variant ?? "rule"}` : ""}`;
        const t = rich ? sanitizeRich(text, rich) : text;
        out.push({ id: n.id, kind, tag: kind === "title" ? "h3" : "div", cls, decls, text: empty ? undefined : t, rich, hidden, placeholder: empty ? label(kind) : undefined });
      }
    }
    return out;
  };
  return { cls: `cl-ad b-${f.border ?? "none"} t-${f.tone ?? "paper"}`, decls: frameDecls(e, { editor: opts.editor, cols: opts.cols ?? gridOfDoc(doc).cols }), kids: go(e.tree), hidden: !!f.hide };
}

/**
 * A plan as an HTML string (the editor's canvas, Copy as HTML). `markers` adds
 * the data-part attributes the canvas needs. Rich words were sanitised by the
 * plan; plain words and labels are escaped here; picture sources passed safeSrc.
 */
export function planHTML(nodes: PlanNode[], markers: boolean): string {
  let h = "";
  for (const n of nodes) {
    const mark = markers ? ` data-part="${escAttr(n.id)}" data-kind="${n.kind}"` : "";
    const dim = n.placeholder || n.hidden ? ";opacity:.35" : "";
    const style = ` style="${escAttr(declsToString(n.decls) + (markers ? dim : ""))}"`;
    const cls = `${n.cls}${markers && n.hidden ? " cle-hidden" : ""}${markers && n.placeholder ? " cle-empty" : ""}`;
    if (n.tag === "img") { h += `<img class="${cls}"${mark}${style} src="${escAttr(n.src!)}" alt="" loading="lazy" draggable="false">`; continue; }
    const body = n.kids ? planHTML(n.kids, markers) + (n.placeholder && markers ? `<span class="cle-ph">${escAttr(n.placeholder)}</span>` : "")
      : n.text !== undefined ? (n.rich ? n.text : escAttr(n.text)) : escAttr(n.placeholder ?? "");
    h += `<${n.tag} class="${cls}"${mark}${n.kind === "rule" ? ' role="separator"' : ""}${style}>${body}</${n.tag}>`;
  }
  return h;
}

// ---------------------------------------------------------------------------
// Validation: what the save action accepts. Anything unexpected is dropped,
// not trusted, because the editor is a client component.
// ---------------------------------------------------------------------------
export function cleanStyle(v: unknown): PartStyle | undefined {
  return cleanStyleWith(v, HEADERS);
}
function cleanParts(v: unknown, ids: string[]): Record<string, PartStyle> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, PartStyle> = {};
  for (const id of ids) {
    if (!Object.prototype.hasOwnProperty.call(v, id)) continue;
    const s = cleanStyle((v as Record<string, unknown>)[id]);
    if (s) out[id] = s;
  }
  return Object.keys(out).length ? out : undefined;
}
/**
 * One node's words as stored. A rich text kind keeps the allow-listed markup
 * of @elkdonis/direct-edit/richtext (b, i, u, a[http(s)], ul/li, br) in
 * canonical form, so cleaning a saved value again changes nothing; headers are
 * plain text; a picture stores one {{token}} or a safe URL; other kinds none.
 */
export function cleanCopyText(kind: Kind | string, v: unknown): string | undefined {
  if (kind === "image") return cleanSrc(v);
  if (typeof v !== "string" || !isTextKind(kind)) return undefined;
  const cap = kind === "body" ? 1200 : 200;
  const rich = RICH[kind];
  if (!rich) return v.slice(0, cap);
  const max = cap * 3;
  let s = sanitizeRich(v.slice(0, max), rich);
  while (s.length > max) s = sanitizeRich(s.slice(0, max), rich);
  return s;
}
function cleanCopy(v: unknown, kinds: Record<string, Kind>): Record<string, string> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [id, kind] of Object.entries(kinds)) {
    if (id === "frame" || !Object.prototype.hasOwnProperty.call(v, id)) continue;
    const s = cleanCopyText(kind, (v as Record<string, unknown>)[id]);
    if (s !== undefined) out[id] = s;
  }
  return Object.keys(out).length ? out : undefined;
}
/** The sheet's shared variables: hex colours and library fonts only. */
export function cleanTheme(v: unknown): Theme | undefined {
  if (!v || typeof v !== "object") return undefined;
  const t = v as Record<string, unknown>, out: Theme = {};
  for (const k of ["paper", "ink", "spot"] as const) { const h = typeof t[k] === "string" && /^#[0-9a-f]{6}$/i.test(t[k] as string) ? (t[k] as string).toLowerCase() : undefined; if (h) out[k] = h; }
  for (const k of ["title", "body"] as const) if (typeof t[k] === "string" && cleanStyle({ font: t[k] })?.font) out[k] = t[k] as string;
  return Object.keys(out).length ? out : undefined;
}
function cleanSpan(v: unknown, g: GridSpec): [number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 2) return undefined;
  const c = num(v[0], 1, g.cols), r = num(v[1], 1, maxRows(g));
  return c && r ? [Math.round(c), Math.round(r)] : undefined;
}
export function cleanLink(v: unknown, allowItem = false): AdLink {
  const l = (v || {}) as Record<string, unknown>;
  if (l.kind === "thread" && typeof l.threadId === "string" && /^[\w-]{1,64}$/.test(l.threadId)) return { kind: "thread", threadId: l.threadId };
  if (l.kind === "item" && allowItem) return { kind: "item" };
  if (l.kind === "url" && typeof l.url === "string") {
    try {
      const u = new URL(l.url);
      if (u.protocol === "https:" || u.protocol === "http:") return { kind: "url", url: u.href.slice(0, 500), label: str(l.label, 80) };
    } catch { /* not a URL */ }
  }
  return { kind: "none" };
}
/** A cleaned tree, or undefined when it says nothing new (equal to the template's). */
function cleanAdTree(v: unknown, t: Template): TreeNode[] | undefined {
  const tree = cleanTree(v, TREE_RULES);
  return !tree || sameTree(tree, templateTree(t)) ? undefined : tree;
}
const idNum = (id: string) => { const m = /^(?:ad|n|t-user-)(\d{1,6})$/.exec(id); return m ? Number(m[1]) : 0; };

export interface CleanOptions {
  /** Which templates ads may use: classifieds sheets (default) or feed cards. */
  scope?: "sheet" | "card";
  /** Feed cards: a card may link to the item it draws. */
  allowItemLink?: boolean;
}

export function cleanDoc(v: unknown, opts: CleanOptions = {}): ClassifiedsDoc | null {
  if (!v || typeof v !== "object") return null;
  const d = v as Record<string, unknown>;
  const scope = opts.scope ?? "sheet";
  const grid = cleanGrid(d.grid);
  const g = grid ?? GRID_DEFAULT;
  let maxId = 0;
  const userTemplates: Record<string, Template> = {};
  if (scope === "sheet" && d.userTemplates && typeof d.userTemplates === "object") {
    for (const [id, t] of Object.entries(d.userTemplates as Record<string, unknown>).slice(0, 50)) {
      const tt = t as Record<string, unknown>;
      if (!/^t-user-\d{1,6}$/.test(id) || !tt || !FAMILIES[tt.family as string]) continue;
      const tree = cleanTree(tt.tree, TREE_RULES);
      const own = tree && !sameTree(tree, DEFAULT_TREE) ? tree : undefined;
      const kinds = kindsOf(own ?? DEFAULT_TREE);
      userTemplates[id] = {
        label: str(tt.label, 80) || "Your template", family: tt.family as string, span: cleanSpan(tt.span, GRID_DEFAULT) || [2, 3],
        parts: cleanParts(tt.parts, Object.keys(kinds)) || {}, copy: cleanCopy(tt.copy, kinds) || {}, ...(own ? { tree: own } : {}),
      };
      maxId = Math.max(maxId, idNum(id));
    }
  }
  const ads: Ad[] = [];
  const seen = new Set<string>();
  const okTemplate = (id: string) => (scope === "card" ? isCardTemplate(id) : !!userTemplates[id] || (!!BASE_TEMPLATES[id] && !isCardTemplate(id)));
  for (const a of (Array.isArray(d.ads) ? d.ads : []).slice(0, 200)) {
    const ad = a as Record<string, unknown>;
    const id = typeof ad.id === "string" && /^ad\d{1,6}$/.test(ad.id) ? ad.id : null;
    const template = typeof ad.template === "string" && okTemplate(ad.template) ? ad.template : null;
    if (!id || !template || seen.has(id)) continue;
    seen.add(id);
    const t = userTemplates[template] || BASE_TEMPLATES[template]!;
    const o = (ad.o || {}) as Record<string, unknown>;
    const clean: AdOverrides = {};
    if (typeof o.family === "string" && FAMILIES[o.family]) clean.family = o.family;
    const span = cleanSpan(o.span, g); if (span) clean.span = span;
    const tree = cleanAdTree(o.tree, t); if (tree) clean.tree = tree;
    const effTree = tree ?? templateTree(t);
    const kinds = kindsOf(effTree);
    const parts = cleanParts(o.parts, Object.keys(kinds)); if (parts) clean.parts = parts;
    const copy = cleanCopy(o.copy, kinds); if (copy) clean.copy = copy;
    ads.push({ id, template, o: clean, link: cleanLink(ad.link, opts.allowItemLink) });
    maxId = Math.max(maxId, idNum(id));
    for (const nid of treeIds(effTree)) maxId = Math.max(maxId, idNum(nid));
  }
  const theme = cleanTheme(d.theme);
  return {
    title: str(d.title, 120), ...(theme ? { theme } : {}), ...(grid && !sameGrid(grid, GRID_DEFAULT) ? { grid } : {}),
    ads, userTemplates, next: Math.max(num(d.next, 1, 1e6) || 1, ads.length + 1, maxId + 1),
  };
}
