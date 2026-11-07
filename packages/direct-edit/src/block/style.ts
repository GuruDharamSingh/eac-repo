// ============================================================================
// The style vocabulary of a block node (pass 3, 2026-11-02; lifted out of the
// classifieds catalog so any host can use it): what a node may store, how it
// becomes CSS, and the server-side cleaner. Pure functions, no DOM: imported by
// server pages, the editor and React renderers alike.
//
// A node stores only the keys it changes; everything else comes from its style
// family and template (the host resolves that). Values outside these bounds are
// clamped by the cleaner; values outside a freedom level are flagged by the
// panel, never changed (model/schema.ts).
// ============================================================================

import { fontStack, isKnownFont } from "@elkdonis/fonts";

export type Quad = [number, number, number, number];
export type Decl = [string, string];

export type PartStyle = {
  // Family-level slots (2026-11-01 prototype).
  border?: string; padding?: number | Quad; tone?: string; variant?: string;
  font?: string; size?: number; weight?: number; case?: string; align?: string;
  italic?: boolean; leading?: number; color?: string; css?: string;
  // Text (Phase 2):
  tracking?: number;
  // Place inside the parent (align row, width Hug / Fixed / Fill, grow, position at Free):
  self?: string; push?: string; grow?: number; pos?: string; x?: number; y?: number;
  // Pass 2: fixed width / minimum height in px (Free), outer margin:
  w?: number; h?: number; margin?: number | Quad;
  // Layout of a container (the ad and its boxes):
  gap?: number; justify?: string;
  // Pass 3: containers. Stack (flex) or grid; direction, wrap, cross-axis alignment, grid columns.
  layout?: string; dir?: string; wrap?: boolean; items?: string; gcols?: number;
  // Pass 3: a child of a grid container spans this many of its columns.
  cspan?: number;
  // A place among its siblings, drawn without changing the markup (visual edits).
  order?: number;
  // Pass 3: pictures.
  ratio?: string; fit?: string;
  // Appearance:
  fill?: string; opacity?: number; radius?: number | Quad; bstyle?: string; bcolor?: string; bwidth?: number;
  // Effects:
  blur?: number; bblur?: number; tx?: number; ty?: number; rot?: number; sx?: number; sy?: number;
  // Hidden on the page (the layer eye):
  hide?: boolean;
};

/**
 * Hard limits for every numeric style key: what the server stores. The Free
 * level offers exactly these; Family and Borrow offer narrower ranges (the
 * host's slot schema). Values outside a level but inside these are kept and flagged.
 */
export const BOUNDS = {
  // Wide enough for whole pages (2026-11-02): a landing hero's type and a section's padding exceed an ad's.
  size: [6, 240], padding: [0, 320], leading: [0.8, 2.4], tracking: [-0.1, 0.5], grow: [0, 4],
  x: [-400, 1200], y: [-400, 1200], gap: [0, 160], w: [8, 2400], h: [8, 2400], margin: [0, 320], opacity: [0, 1], radius: [0, 200], bwidth: [0, 12],
  blur: [0, 20], bblur: [0, 30], tx: [-300, 300], ty: [-300, 300], rot: [-180, 180], sx: [0.2, 3], sy: [0.2, 3],
  gcols: [1, 12], cspan: [1, 12], order: [0, 999],
} as const satisfies Record<string, readonly [number, number]>;
export const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
export const SELF = ["start", "center", "end", "stretch"];
export const PUSH = ["start", "middle", "end"];
export const JUSTIFY = ["start", "center", "end", "space-between"];
export const BORDER_STYLES = ["none", "solid", "dashed", "dotted", "double"];
export const LAYOUTS = ["stack", "grid"];
export const DIRS = ["column", "row"];
export const ITEMS = ["start", "center", "end", "stretch", "baseline"];
export const RATIOS = ["auto", "16/9", "3/2", "4/3", "1/1", "3/4"];
export const FITS = ["cover", "contain"];

// Raw CSS (the Advanced section and the Code tab) covers type, decoration, overflow
// and layout (2026-11-02: a box's Code tab writes its stack or grid, as on the
// canvas), and never anything that loads a URL. `position` is limited below: a box
// fixed to the screen could cover the whole site.
const CSS_ALLOWED = new Set([
  "letter-spacing", "word-spacing", "text-transform", "text-decoration", "text-decoration-style", "text-decoration-color",
  "text-underline-offset", "text-shadow", "text-indent", "text-wrap", "white-space", "text-overflow", "word-break", "hyphens",
  "font-style", "font-weight", "font-variant", "font-variant-numeric", "font-feature-settings", "font-stretch", "line-height",
  "transform", "rotate", "opacity", "background-color", "border-radius", "border-color", "border-width", "border-style",
  "margin", "padding", "color", "text-align", "vertical-align", "filter", "backdrop-filter", "mix-blend-mode", "writing-mode",
  "box-shadow", "outline", "z-index", "overflow", "overflow-x", "overflow-y", "cursor", "pointer-events", "object-fit",
  "box-sizing", "aspect-ratio", "min-height", "max-width", "column-count", "column-gap", "container-type",
  "display", "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis", "gap", "row-gap", "order",
  "grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "grid-auto-flow", "align-items", "align-self", "align-content", "justify-content", "justify-self", "justify-items", "place-items",
  "width", "height", "min-width", "max-height", "position",
  "margin-top", "margin-right", "margin-bottom", "margin-left", "margin-inline", "margin-block", "padding-top", "padding-right", "padding-bottom", "padding-left", "padding-inline", "padding-block",
  "font-size", "font-family", "background", "border", "border-top", "border-right", "border-bottom", "border-left",
]);
/** A value past this is refused, not cut: a cut value can leave a bracket open. */
const MAX_CSS_VALUE = 160;
/** Brackets and quotes closed, in order. An unclosed one in a stylesheet swallows the rule after it. */
export function balancedCss(value: string): boolean {
  const open: string[] = [];
  let quote = "";
  for (const c of value) {
    if (quote) { if (c === quote) quote = ""; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[") open.push(c === "(" ? ")" : "]");
    else if ((c === ")" || c === "]") && open.pop() !== c) return false;
  }
  return !quote && !open.length;
}
export function safeDecls(css: string | undefined): Decl[] {
  if (!css) return [];
  const out: Decl[] = [];
  for (const piece of css.split(";")) {
    const i = piece.indexOf(":");
    if (i < 0) continue;
    const prop = piece.slice(0, i).trim().toLowerCase();
    const value = piece.slice(i + 1).trim();
    const custom = /^--[a-z][\w-]{0,40}$/i.test(prop);
    if ((!CSS_ALLOWED.has(prop) && !custom) || !value || /url\s*\(|expression|javascript:|image-set|@import|[<>{}\\]/i.test(value)) continue;
    // A comment marker, `!`, or an open bracket or quote would end or swallow the next rule of a stylesheet (patch.ts).
    if (value.length > MAX_CSS_VALUE || /\/\*|\*\/|!/.test(value) || !balancedCss(value)) continue;
    if (prop === "position" && !/^(relative|static)$/i.test(value)) continue;
    out.push([prop, value]);
  }
  return out;
}

export const HEX = /^#[0-9a-f]{3,8}$/i;
export const px = (v: number | Quad) => (Array.isArray(v) ? v.map((n) => `${n}px`).join(" ") : `${v}px`);
const SELF_CSS: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" };
const ITEMS_CSS: Record<string, string> = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch", baseline: "baseline" };

/** Container layout: stack (flex, direction, wrap) or grid (columns). The host's CSS makes containers flex columns by default. */
export function layoutDecls(s: PartStyle, d: Decl[]): void {
  if (s.layout === "grid") {
    d.push(["display", "grid"], ["grid-template-columns", `repeat(${s.gcols ?? 2}, minmax(0, 1fr))`]);
  } else {
    if (s.dir === "row") d.push(["flex-direction", "row"]);
    else if (s.dir === "column") d.push(["flex-direction", "column"]);
    if (s.wrap) d.push(["flex-wrap", "wrap"]);
  }
  if (s.items && ITEMS_CSS[s.items]) d.push(["align-items", ITEMS_CSS[s.items]!]);
}

/** Place, layout, appearance and effects: shared by every node and the block's root. */
export function boxDecls(s: PartStyle, d: Decl[], skipPadding = false): void {
  if (s.self && SELF_CSS[s.self]) d.push(["align-self", SELF_CSS[s.self]!]);
  if (s.grow !== undefined) d.push(["flex-grow", String(s.grow)]);
  if (s.cspan !== undefined) d.push(["grid-column", `span ${s.cspan}`]);
  if (s.order !== undefined) d.push(["order", String(s.order)]);
  if (s.pos === "absolute") d.push(["position", "absolute"], ["left", `${s.x ?? 0}px`], ["top", `${s.y ?? 0}px`], ["z-index", "1"]);
  if (s.pos === "relative") d.push(["position", "relative"], ["left", `${s.x ?? 0}px`], ["top", `${s.y ?? 0}px`]);
  if (s.pos === "sticky") d.push(["position", "sticky"], ["top", `${s.y ?? 0}px`], ["z-index", "1"]);
  if (s.w !== undefined) d.push(["width", `${s.w}px`], ["max-width", "100%"]);
  if (s.h !== undefined) d.push(["min-height", `${s.h}px`]);
  if (s.margin !== undefined) d.push(["margin", px(s.margin)]);
  if (s.push === "end") d.push(["margin-top", "auto"]);
  if (s.push === "middle") d.push(["margin-block", "auto"]);
  if (!skipPadding && s.padding !== undefined) d.push(["padding", px(s.padding)]);
  layoutDecls(s, d);
  if (s.gap !== undefined) d.push(["gap", `${s.gap}px`]);
  if (s.justify) d.push(["justify-content", s.justify === "start" ? "flex-start" : s.justify === "end" ? "flex-end" : s.justify]);
  if (s.fill && HEX.test(s.fill)) d.push(["background", s.fill]);
  if (s.opacity !== undefined) d.push(["opacity", String(s.opacity)]);
  if (s.radius !== undefined) d.push(["border-radius", px(s.radius)]);
  if (s.bstyle) {
    d.push(["border-style", s.bstyle]);
    if (s.bstyle !== "none") d.push(["border-width", `${s.bwidth ?? 1}px`], ["border-color", s.bcolor && HEX.test(s.bcolor) ? s.bcolor : "currentColor"]);
  } else {
    if (s.bwidth !== undefined) d.push(["border-width", `${s.bwidth}px`]);
    if (s.bcolor && HEX.test(s.bcolor)) d.push(["border-color", s.bcolor]);
  }
  if (s.blur) d.push(["filter", `blur(${s.blur}px)`]);
  if (s.bblur) d.push(["backdrop-filter", `blur(${s.bblur}px)`], ["-webkit-backdrop-filter", `blur(${s.bblur}px)`]);
  const t: string[] = [];
  if (s.tx || s.ty) t.push(`translate(${s.tx ?? 0}px, ${s.ty ?? 0}px)`);
  if (s.rot) t.push(`rotate(${s.rot}deg)`);
  if ((s.sx !== undefined && s.sx !== 1) || (s.sy !== undefined && s.sy !== 1)) t.push(`scale(${s.sx ?? 1}, ${s.sy ?? 1})`);
  if (t.length) d.push(["transform", t.join(" ")]);
}

/** Typography (text nodes). */
export function textDecls(s: PartStyle, d: Decl[]): void {
  if (s.font) d.push(["font-family", fontStack(s.font)]);
  if (s.size) d.push(["font-size", `${s.size}px`]);
  if (s.weight) d.push(["font-weight", String(s.weight)]);
  if (s.italic) d.push(["font-style", "italic"]);
  if (s.case === "upper") d.push(["text-transform", "uppercase"], ["letter-spacing", ".04em"]);
  if (s.case === "smallcaps") d.push(["font-variant", "small-caps"], ["letter-spacing", ".03em"]);
  if (s.tracking !== undefined) d.push(["letter-spacing", `${s.tracking}em`]);
  if (s.align) d.push(["text-align", s.align]);
  if (s.leading) d.push(["line-height", String(s.leading)]);
  if (s.color && HEX.test(s.color)) d.push(["color", s.color]);
}

/**
 * CSS declarations for one node, as [property, value] pairs. `editor` keeps a
 * hidden node visible (dimmed by the editor's CSS) and `noCss` omits the raw
 * CSS, so the Code tab can show "written" and "yours" apart.
 */
export function partDecls(s: PartStyle, opts: { editor?: boolean; noCss?: boolean } = {}): Decl[] {
  const d: Decl[] = [];
  textDecls(s, d);
  boxDecls(s, d);
  if (s.ratio && s.ratio !== "auto" && RATIOS.includes(s.ratio)) d.push(["aspect-ratio", s.ratio.replace("/", " / ")]);
  if (s.fit && FITS.includes(s.fit)) d.push(["object-fit", s.fit]);
  if (s.hide && !opts.editor) d.push(["display", "none"]);
  return opts.noCss ? d : d.concat(safeDecls(s.css));
}

/** A divider: the border keys draw its one rule (top edge), not a box around it. */
export function ruleDecls(s: PartStyle, opts: { editor?: boolean; noCss?: boolean } = {}): Decl[] {
  const d: Decl[] = [];
  const style = s.bstyle && s.bstyle !== "none" ? s.bstyle : s.bstyle === "none" ? "none" : "solid";
  d.push(["border-top", `${s.bwidth ?? 1}px ${style} ${s.bcolor && HEX.test(s.bcolor) ? s.bcolor : "currentColor"}`]);
  boxDecls({ ...s, bstyle: undefined, bwidth: undefined, bcolor: undefined }, d);
  if (s.hide && !opts.editor) d.push(["display", "none"]);
  return opts.noCss ? d : d.concat(safeDecls(s.css));
}

export const declsToString = (d: Decl[]) => d.map(([k, v]) => `${k}:${v}`).join(";");
/** React style object (custom properties keep their dashes; -webkit- becomes Webkit). */
export function declsToStyle(d: Decl[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of d) o[k.startsWith("--") ? k : k.replace(/^-webkit-/, "Webkit-").replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v;
  return o;
}

// ---------------------------------------------------------------------------
// Validation: what a save action accepts. Anything unexpected is dropped, not
// trusted, because editors are client components.
// ---------------------------------------------------------------------------
export const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
export const num = (v: unknown, lo: number, hi: number) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined);
export const bound = (k: keyof typeof BOUNDS, v: unknown) => num(v, BOUNDS[k][0], BOUNDS[k][1]);
export const oneOf = (list: readonly string[], v: unknown) => (typeof v === "string" && list.includes(v) ? v : undefined);
export const hex = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : undefined);
function numOrQuad(k: "padding" | "radius" | "margin", v: unknown): number | Quad | undefined {
  if (Array.isArray(v)) {
    if (v.length !== 4) return undefined;
    const q = v.map((x) => bound(k, x));
    return q.every((x) => x !== undefined) ? (q as Quad) : undefined;
  }
  return bound(k, v);
}
const int = (k: "gcols" | "cspan" | "order", v: unknown) => { const n = bound(k, v); return n === undefined ? undefined : Math.round(n); };

export function cleanStyle(v: unknown, headers: readonly string[] = []): PartStyle | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const s = v as Record<string, unknown>, out: PartStyle = {};
  const pick = <K extends keyof PartStyle>(k: K, val: PartStyle[K] | undefined) => { if (val !== undefined) out[k] = val; };
  pick("border", oneOf(["none", "hairline", "double", "heavy"], s.border));
  pick("tone", oneOf(["paper", "tinted", "reversed"], s.tone));
  pick("variant", oneOf(headers, s.variant));
  pick("font", isKnownFont(s.font) ? s.font : undefined);
  pick("padding", numOrQuad("padding", s.padding));
  pick("size", bound("size", s.size));
  pick("weight", typeof s.weight === "number" && WEIGHTS.includes(s.weight) ? s.weight : undefined);
  pick("case", oneOf(["none", "upper", "smallcaps"], s.case));
  pick("align", oneOf(["left", "center", "right", "justify"], s.align));
  pick("italic", typeof s.italic === "boolean" ? s.italic : undefined);
  pick("leading", bound("leading", s.leading));
  pick("color", hex(s.color));
  pick("tracking", bound("tracking", s.tracking));
  pick("self", oneOf(SELF, s.self));
  pick("push", oneOf(PUSH, s.push));
  pick("grow", bound("grow", s.grow));
  pick("pos", oneOf(["inline", "relative", "absolute", "sticky"], s.pos));
  pick("w", bound("w", s.w));
  pick("h", bound("h", s.h));
  pick("margin", numOrQuad("margin", s.margin));
  pick("x", bound("x", s.x));
  pick("y", bound("y", s.y));
  pick("gap", bound("gap", s.gap));
  pick("justify", oneOf(JUSTIFY, s.justify));
  pick("layout", oneOf(LAYOUTS, s.layout));
  pick("dir", oneOf(DIRS, s.dir));
  pick("wrap", typeof s.wrap === "boolean" ? s.wrap : undefined);
  pick("items", oneOf(ITEMS, s.items));
  pick("gcols", int("gcols", s.gcols));
  pick("cspan", int("cspan", s.cspan));
  pick("order", int("order", s.order));
  pick("ratio", oneOf(RATIOS, s.ratio));
  pick("fit", oneOf(FITS, s.fit));
  pick("fill", hex(s.fill));
  pick("opacity", bound("opacity", s.opacity));
  pick("radius", numOrQuad("radius", s.radius));
  pick("bstyle", oneOf(BORDER_STYLES, s.bstyle));
  pick("bcolor", hex(s.bcolor));
  pick("bwidth", bound("bwidth", s.bwidth));
  for (const k of ["blur", "bblur", "tx", "ty", "rot", "sx", "sy"] as const) pick(k, bound(k, s[k]));
  pick("hide", s.hide === true ? true : undefined);
  pick("css", s.css ? declsToString(safeDecls(str(s.css, 2400))) || undefined : undefined);
  return Object.keys(out).length ? out : undefined;
}
