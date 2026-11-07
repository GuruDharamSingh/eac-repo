// ============================================================================
// What the right-hand panel shows for a box on a real page (2026-11-02). The
// sections depend on the box and its parent, as on the canvas: a child of a grid
// gets Column span, a child of a flex row gets Grow, a picture gets no Layout.
// Field values come from the page itself (getComputedStyle), so none is blank.
//
// Slots here are data for panel/panel.ts; no freedom levels apply on sites.
// ============================================================================

import { BOUNDS, WEIGHTS, type PartStyle } from "../block/style";
import { isKnownFont } from "@elkdonis/fonts";
import type { Allowed, Control, ResolvedSlot, SectionId } from "../model/schema";
import { childLayers, layerRole } from "./layers";

const ICONS = {
  align: { left: "ta-left", center: "ta-center", right: "ta-right", justify: "ta-justify" },
  self: { start: "al-left", center: "al-center", end: "al-right" },
  justify: { start: "al-top", center: "al-middle", end: "al-bottom", "space-between": "al-spread" },
  items: { start: "al-top", center: "al-middle", end: "al-bottom", stretch: "al-stretch", baseline: "ta-left" },
  dir: { column: "dir-col", row: "dir-row" },
  border: { none: "b-none", solid: "b-solid", dashed: "b-dashed", dotted: "b-dotted", double: "b-double" },
};
const WEIGHT_LABELS: Record<string, string> = { 100: "Thin", 200: "Extra light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra bold", 900: "Black" };

const list = (...l: Array<string | number | boolean>): Allowed => ({ list: l });
type BKey = keyof typeof BOUNDS;

function slot(key: string, section: SectionId, label: string, control: Control, allowed: Allowed, more: Partial<ResolvedSlot> = {}): ResolvedSlot {
  return { key, id: more.id ?? key, section, label, control, allowed, ...more };
}
const num = (k: BKey, section: SectionId, label: string, unit?: string, step?: number, more: Partial<ResolvedSlot> = {}) =>
  slot(k, section, label, "number", { range: BOUNDS[k], step }, { unit, bounds: [...BOUNDS[k]] as [number, number], ...more });
const quad = (k: "padding" | "margin" | "radius", section: SectionId, label: string, control: Control) =>
  slot(k, section, label, control, { range: BOUNDS[k] }, { unit: "px", bounds: [...BOUNDS[k]] as [number, number] });

const isFlex = (d: string) => d.includes("flex");
const isGrid = (d: string) => d.includes("grid");
const MEDIA = new Set(["IMG", "PICTURE", "VIDEO", "SVG", "CANVAS", "IFRAME", "AUDIO"]);

/** The sections and fields for one box, given its stored style. */
export function boxSlots(el: Element, stored: PartStyle): ResolvedSlot[] {
  const parent = el.parentElement ? getComputedStyle(el.parentElement).display : "block";
  const media = MEDIA.has(el.tagName.toUpperCase());
  const treeType = (el as HTMLElement).dataset?.treeType;
  const holdsWords = !media && (treeType === "words" || Array.from(el.childNodes).some((n) => n.nodeType === 3 && !!n.textContent?.trim()));
  const container = !media && (treeType === "box" || (treeType !== "words" && (childLayers(el).length > 0 || !holdsWords)));
  const own = getComputedStyle(el).display;
  const shape = stored.layout ?? (isGrid(own) ? "grid" : isFlex(own) ? "stack" : "block");
  const out: ResolvedSlot[] = [];
  const inLine = isFlex(parent) || isGrid(parent);

  if (inLine) out.push(slot("self", "align", "Align in parent", "icons", list("start", "center", "end"), { icons: ICONS.self, labels: { start: "Start", center: "Centre", end: "End" } }));

  // Size. Hug and Fill need a flex or grid parent; in plain flow a box is as wide as its parent.
  const wModes = inLine ? list("hug", "fixed", "fill") : list("fill", "fixed");
  out.push(slot("wmode", "size", "Width", "dim", wModes, { id: "width", numKey: "wpx", labels: { hug: "Hug", fixed: "Fixed", fill: inLine ? "Fill" : "Auto" }, bounds: [...BOUNDS.w] as [number, number] }));
  out.push(slot("hmode", "size", "Height", "dim", isFlex(parent) ? list("hug", "fixed", "fill") : list("hug", "fixed"), { id: "height", numKey: "hpx", labels: { hug: "Hug", fixed: "Fixed", fill: "Fill" }, bounds: [...BOUNDS.h] as [number, number] }));
  if (isGrid(parent)) out.push(num("cspan", "size", "Column span", undefined, 1));
  if (isFlex(parent)) out.push(num("grow", "size", "Grow", undefined, 1, { optional: true }));
  if (stored.order !== undefined) out.push(num("order", "size", "Order", undefined, 1));

  // Layout.
  if (container) {
    out.push(slot("layout", "layout", "Layout", "select", list("block", "stack", "grid"), { labels: { block: "Block", stack: "Stack", grid: "Grid" } }));
    if (shape === "stack") {
      out.push(slot("dir", "layout", "Direction", "icons", list("column", "row"), { icons: ICONS.dir, labels: { column: "Column", row: "Row" } }));
      out.push(slot("wrap", "layout", "Wrap", "chips", list(false, true), { labels: { false: "One line", true: "Wrap" }, optional: true }));
      out.push(slot("justify", "layout", "Distribute", "icons", list("start", "center", "end", "space-between"), { icons: ICONS.justify, labels: { start: "Start", center: "Middle", end: "End", "space-between": "Spread" } }));
    }
    if (shape === "grid") out.push(num("gcols", "layout", "Columns", undefined, 1));
    if (shape !== "block") {
      out.push(slot("items", "layout", "Align items", "icons", list("start", "center", "end", "stretch", "baseline"), { icons: ICONS.items, labels: { start: "Start", center: "Centre", end: "End", stretch: "Stretch", baseline: "Baseline" } }));
      out.push(num("gap", "layout", "Gap", "px"));
    }
  }
  out.push(quad("padding", "layout", "Padding", "sides"));
  out.push(quad("margin", "layout", "Margin", "sides"));

  // Text. On a box that holds other boxes it sets what they inherit, so it stays behind the "+".
  if (!media) {
    const opt = { optional: !holdsWords };
    out.push(slot("font", "text", "Font", "font", {}, opt));
    out.push(slot("weight", "text", "Weight", "select", list(...WEIGHTS), { labels: WEIGHT_LABELS, ...opt }));
    out.push(num("size", "text", "Size", "px", 1, opt));
    out.push(num("leading", "text", "Line height", undefined, 0.05, { ...opt, placeholder: "normal" }));
    out.push(num("tracking", "text", "Letter spacing", "em", 0.01, opt));
    out.push(slot("color", "text", "Colour", "color", {}, opt));
    out.push(slot("align", "text", "Align", "icons", list("left", "center", "right", "justify"), { icons: ICONS.align, labels: { left: "Left", center: "Centre", right: "Right", justify: "Justify" }, ...opt }));
    out.push(slot("case", "text", "Case", "chips", list("none", "upper", "smallcaps"), { labels: { none: "As typed", upper: "CAPS", smallcaps: "Small caps" }, optional: true }));
    out.push(slot("italic", "text", "Style", "chips", list(false, true), { labels: { false: "Upright", true: "Italic" }, optional: true }));
  }

  // Appearance.
  if (!media) out.push(slot("fill", "appearance", "Fill", "color", {}));
  out.push(num("opacity", "appearance", "Opacity", undefined, 0.05));
  out.push(quad("radius", "appearance", "Radius", "corners"));
  out.push(slot("bstyle", "appearance", "Border", "icons", list("none", "solid", "dashed", "dotted", "double"), { icons: ICONS.border, labels: { none: "No border", solid: "Solid", dashed: "Dashed", dotted: "Dotted", double: "Double" } }));
  if (stored.bstyle && stored.bstyle !== "none") {
    out.push(slot("bcolor", "appearance", "Border colour", "color", {}));
    out.push(num("bwidth", "appearance", "Border width", "px", 0.5));
  }

  // Effects.
  out.push(num("blur", "effects", "Layer blur", "px", 0.5));
  out.push(num("bblur", "effects", "Background blur", "px"));
  out.push(num("tx", "effects", "Move X", "px"));
  out.push(num("ty", "effects", "Move Y", "px"));
  out.push(num("rot", "effects", "Rotate", "°"));
  out.push(num("sx", "effects", "Scale X", undefined, 0.05));
  out.push(num("sy", "effects", "Scale Y", undefined, 0.05));
  return out;
}

export const rgbHex = (v: string): string | undefined => {
  const m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+%?))?\s*\)/.exec(v);
  if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) return undefined;
  return "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
};
const px = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined; };
const sides = (a: string, b: string, c: string, d: string): number | number[] => {
  const q = [px(a) ?? 0, px(b) ?? 0, px(c) ?? 0, px(d) ?? 0];
  return q.every((n) => n === q[0]) ? q[0]! : q;
};
const SELF_BACK: Record<string, string> = { "flex-start": "start", start: "start", center: "center", "flex-end": "end", end: "end", stretch: "stretch" };
const ITEMS_BACK: Record<string, string> = { "flex-start": "start", start: "start", center: "center", "flex-end": "end", end: "end", stretch: "stretch", normal: "stretch", baseline: "baseline" };
const JUSTIFY_BACK: Record<string, string> = { "flex-start": "start", start: "start", normal: "start", center: "center", "flex-end": "end", end: "end", "space-between": "space-between" };

/** What the page draws right now, in the panel's keys. */
export function readBox(el: HTMLElement): Record<string, unknown> {
  const cs = getComputedStyle(el), parent = el.parentElement ? getComputedStyle(el.parentElement) : null;
  const size = px(cs.fontSize) ?? 16, lh = px(cs.lineHeight);
  const first = cs.fontFamily.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  const r = el.getBoundingClientRect();
  const parentInner = el.parentElement ? el.parentElement.clientWidth - (px(parent!.paddingLeft) ?? 0) - (px(parent!.paddingRight) ?? 0) : r.width;
  return {
    self: SELF_BACK[cs.alignSelf],
    wmode: r.width >= parentInner - 2 || !parent?.display.includes("flex") ? "fill" : "hug", // A grid child or a block fills its cell or its parent.
    hmode: "hug",
    wpx: Math.round(el.offsetWidth || r.width), hpx: Math.round(el.offsetHeight || r.height),
    cspan: Number(/span (\d+)/.exec(`${cs.gridColumnStart} ${cs.gridColumnEnd}`)?.[1] ?? 1),
    grow: px(cs.flexGrow) ?? 0,
    order: Number(cs.order) || 0,
    layout: cs.display.includes("grid") ? "grid" : cs.display.includes("flex") ? "stack" : "block",
    dir: cs.flexDirection.startsWith("column") ? "column" : "row",
    wrap: cs.flexWrap === "wrap",
    justify: JUSTIFY_BACK[cs.justifyContent],
    items: ITEMS_BACK[cs.alignItems],
    gcols: cs.display.includes("grid") ? cs.gridTemplateColumns.split(" ").length : 2,
    gap: px(cs.rowGap) ?? 0,
    padding: sides(cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft),
    margin: sides(cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft),
    font: first && isKnownFont(first) ? first : undefined,
    weight: Number(cs.fontWeight) || 400,
    size,
    leading: lh ? Math.round((lh / size) * 100) / 100 : undefined,
    tracking: Math.round(((px(cs.letterSpacing) ?? 0) / size) * 1000) / 1000,
    color: rgbHex(cs.color),
    align: cs.textAlign === "start" ? "left" : cs.textAlign === "end" ? "right" : cs.textAlign,
    case: cs.textTransform === "uppercase" ? "upper" : cs.fontVariantCaps === "small-caps" ? "smallcaps" : "none",
    italic: cs.fontStyle === "italic",
    fill: rgbHex(cs.backgroundColor),
    opacity: px(cs.opacity) ?? 1,
    radius: sides(cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius),
    bstyle: cs.borderTopStyle === "none" ? "none" : cs.borderTopStyle,
    bcolor: rgbHex(cs.borderTopColor),
    bwidth: px(cs.borderTopWidth) ?? 0,
    blur: 0, bblur: 0, tx: 0, ty: 0, rot: 0, sx: 1, sy: 1,
  };
}

/** The stored style as the panel's keys, the two mode menus included. */
export function styleValues(s: PartStyle): Record<string, unknown> {
  return {
    ...s,
    wmode: s.w !== undefined ? "fixed" : s.self === "stretch" ? "fill" : s.self === "start" ? "hug" : undefined,
    wpx: s.w,
    hmode: s.h !== undefined ? "fixed" : s.grow ? "fill" : undefined,
    hpx: s.h,
  };
}

/** Which keys carry a reset arrow. */
export function styleOverridden(s: PartStyle): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const k of Object.keys(s)) out[k] = true;
  if (s.w !== undefined || s.self === "stretch" || s.self === "start") out.wmode = true;
  if (s.h !== undefined || s.grow) out.hmode = true;
  return out;
}

/** One panel change on a stored style. The two mode menus and their numbers write real style keys. */
export function applyKey(s: PartStyle, key: string, value: unknown, el: HTMLElement): void {
  const o = s as Record<string, unknown>;
  switch (key) {
    case "wpx": o.w = value; return;
    case "hpx": o.h = value; return;
    case "wmode":
      delete o.w;
      if (value === "fixed") o.w = Math.round(el.offsetWidth);
      else if (value === "fill") o.self = "stretch";
      else o.self = "start";
      return;
    case "hmode":
      delete o.h; delete o.grow;
      if (value === "fixed") o.h = Math.round(el.offsetHeight);
      else if (value === "fill") o.grow = 1;
      return;
    case "layout":
      if (value === "block") delete o.layout; else o.layout = value;
      return;
    default:
      if (value === undefined || value === null || value === "") delete o[key]; else o[key] = value;
  }
}

/** Reset one field. */
export function resetKey(s: PartStyle, key: string): void {
  const o = s as Record<string, unknown>;
  if (key === "wmode") { delete o.w; delete o.self; }
  else if (key === "hmode") { delete o.h; delete o.grow; }
  else delete o[key];
}

/** The nearest background that hides what is behind it, for the contrast check. */
export function backgroundOf(el: Element | null): string | undefined {
  for (let e = el; e; e = e.parentElement) {
    const cs = getComputedStyle(e);
    const m = /rgba?\([^)]*\)/.exec(cs.backgroundColor)?.[0];
    if (!m) continue;
    const alpha = /rgba\(\s*\d+[ ,]+\d+[ ,]+\d+[ ,/]+([\d.]+)/.exec(m)?.[1];
    if (alpha === undefined || parseFloat(alpha) >= 0.95) return rgbHex(m);
  }
  return "#ffffff";
}

/** Values this box takes from the boxes around it, for the Code tab. */
export function inheritedFrom(el: Element): Array<{ from: string; prop: string; value: string; source: Element }> {
  const props = ["font-family", "color", "font-size", "letter-spacing", "text-transform", "line-height"];
  const own = getComputedStyle(el);
  const out: Array<{ from: string; prop: string; value: string; source: Element }> = [];
  for (const prop of props) {
    const v = own.getPropertyValue(prop);
    let source: Element | null = null;
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (getComputedStyle(p).getPropertyValue(prop) !== v) break;
      source = p;
    }
    if (source && source !== document.body && source !== document.documentElement) out.push({ from: layerRole(source), prop, value: v, source });
  }
  return out;
}

/** Colours already on the page, for the colour popover. */
export function usedColoursIn(root: ParentNode): string[] {
  const seen = new Map<string, number>();
  root.querySelectorAll<HTMLElement>("[data-edit-section], [data-tree-node], h1, h2, h3, p").forEach((e) => {
    const cs = getComputedStyle(e);
    for (const c of [rgbHex(cs.backgroundColor), rgbHex(cs.color)]) if (c) seen.set(c, (seen.get(c) ?? 0) + 1);
  });
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 24);
}
