// ============================================================================
// What each kind of node in a classified ad (or feed card) lets a member
// change, per freedom level: the slot schema the direct-edit panel reads.
// Data first; the functions only look up the ad's style family, the font in
// use, and (pass 3) the container a node sits in.
//
// Pass 3 rule (Justin): every node is a box. A heading, paragraph, price,
// picture or row each get the full box sections (align, size, padding,
// margin, fill, opacity, radius, border; effects and raw CSS at Free); text
// nodes add the Text section on top.
//
//   Family  the family's fonts, sizes, header styles, its palette (tints and
//           shades), modest box ranges; stacks only, one level of boxes;
//           the sheet on 6 or 12 columns. Any colour may still be picked:
//           outside the family palette it is kept and flagged amber.
//   Borrow  any family's fonts, a wide curated palette, wider ranges;
//           grid boxes, two levels; 4 to 12 columns
//   Free    the whole font library, any colour, effects, raw CSS, exact
//           (unsnapped) sizes; exactly the server's limits (BOUNDS / cleanStyle)
// ============================================================================

import type { Allowed, Freedom, PartSchema, SlotSpec } from "@elkdonis/direct-edit";
import { GRID_BOUNDS, GRID_COLS } from "@elkdonis/direct-edit/block";
import { FONT_LIBRARY, fontEntry } from "@elkdonis/fonts";
import {
  BOUNDS, BORDER_STYLES, FAMILIES, HEADERS, PAPER, RICH, WEIGHTS,
  type Family, type Kind, type PartStyle, type TextKind,
} from "./catalog";

export interface Env {
  fam: Family; part: Kind; st: PartStyle;
  /** The container the node sits in (pass 3): its layout and grid columns. */
  parent?: { kind: Kind; layout?: string; cols?: number; dir?: string };
  /** The sheet's grid (the ad's span fields): columns and the most rows a span may have. */
  grid?: { cols: number; maxRows: number };
  /** The paper the node is drawn on (palettes include it). */
  paper?: string;
}

export const EVERY_FAMILY_FONT = [...new Set(Object.values(FAMILIES).flatMap((f) => [...f.display, ...f.body]))];
const LIBRARY = FONT_LIBRARY.map((f) => f.family);
const roleOf = (p: Kind) => (p === "body" || p === "contact" ? "body" : "display");

const range = (k: keyof typeof BOUNDS, step?: number): Allowed => ({ range: BOUNDS[k], step });
const r = (lo: number, hi: number, step?: number): Allowed => ({ range: [lo, hi], step });
const list = (...l: Array<string | number | boolean>): Allowed => ({ list: l });
const bounds = (k: keyof typeof BOUNDS) => [...BOUNDS[k]] as [number, number];

/** Theme colours at Borrow: this family's inks, the paper, white, then every family's. */
export function themeColours(fam: Family): string[] {
  const all = [fam.ink, fam.spot, PAPER, "#ffffff", ...Object.values(FAMILIES).flatMap((f) => [f.ink, f.spot])];
  return [...new Set(all.map((c) => c.toLowerCase()))];
}

// ---------------------------------------------------------------------------
// Colour (pass 3, Justin: colour choice was too limited). Every level picks
// from real palettes; the level only decides what counts as inside:
//   Family  the family's inks, paper, white, and tints / shades of the inks
//   Borrow  that, plus every family's inks and a curated wider set
//   Free    any colour
// Anything else can still be chosen (Custom, eyedropper, colours on the page)
// and is kept, flagged amber with "Snap to family".
// ---------------------------------------------------------------------------
const hx = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
/** Mix two #rrggbb colours (t = share of b). */
export function mixColour(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => hx(v + (y[i]! - v) * t)).join("");
}
const uniq = (l: string[]) => [...new Set(l.map((c) => c.toLowerCase()))];
/** Curated extras offered from Borrow (and shown, flagged, at Family): neutrals, earths, inks, brights. */
export const EXTRA_COLOURS = [
  "#000000", "#2b2a33", "#4a4a48", "#76746e", "#a8a59c", "#d6d3ca", "#f4f1ea",
  "#1f3a2e", "#2f6b3a", "#6b8f3a", "#0b3d5c", "#0a7ea4", "#4f7fbf", "#5b3f8c",
  "#8c2f39", "#b8236f", "#c8553d", "#e07a1f", "#d9a400", "#f2d16b", "#7a5230",
  "#b08968", "#e9c46a", "#f4a6a6", "#a8dadc", "#cdeac0", "#fde2e4", "#e2ece9",
];
export function tintsOf(fam: Family): string[] {
  return uniq([fam.ink, fam.spot].flatMap((c) => [0.2, 0.4, 0.6, 0.8].map((t) => mixColour(c, "#ffffff", t))).concat([0.3, 0.55].map((t) => mixColour(fam.spot, "#000000", t))));
}
/** Inside Family: the family's inks, the paper, white, and tints / shades of the inks. */
export function familyPalette(fam: Family, paper = PAPER): string[] {
  return uniq([fam.ink, fam.spot, paper, "#ffffff", ...tintsOf(fam)]);
}
/** Inside Borrow: the family palette, every family's inks, the curated extras. */
export function widePalette(fam: Family, paper = PAPER): string[] {
  return uniq([...familyPalette(fam, paper), ...themeColours(fam), ...EXTRA_COLOURS]);
}
/** The colour popover's groups, in order (the panel adds "On this page" and "Recent"). */
export function paletteGroups(fam: Family, paper = PAPER): Array<{ label: string; colors: string[] }> {
  const own = uniq([fam.ink, fam.spot, paper, "#ffffff"]);
  const others = themeColours(fam).filter((c) => !own.includes(c));
  return [
    { label: fam.label, colors: own },
    { label: "Tints and shades", colors: tintsOf(fam) },
    { label: "Other families", colors: others },
    { label: "More colours", colors: EXTRA_COLOURS },
  ];
}
const famColours = (e: Env): Allowed => ({ list: familyPalette(e.fam, e.paper) });
const wideColours = (e: Env): Allowed => ({ list: widePalette(e.fam, e.paper) });
/** A colour slot: the family palette at Family, the wide one at Borrow, anything at Free. */
const colourSlot = (key: string, section: SlotSpec["section"], label: string, extra: Partial<SlotSpec<Env>> = {}): SlotSpec<Env> =>
  ({ key, section, label, control: "color", family: famColours, borrow: wideColours, free: {}, ...extra });

const ALIGN_ICONS = { left: "ta-left", center: "ta-center", right: "ta-right", justify: "ta-justify" };
const SELF_ICONS = { start: "al-left", center: "al-center", end: "al-right" };
const PUSH_ICONS = { start: "al-top", middle: "al-middle", end: "al-bottom" };
const JUSTIFY_ICONS = { start: "al-top", center: "al-middle", end: "al-bottom", "space-between": "al-spread" };
const BORDER_ICONS = { none: "b-none", solid: "b-solid", dashed: "b-dashed", dotted: "b-dotted", double: "b-double" };
const DIR_ICONS = { column: "dir-col", row: "dir-row" };
const ITEMS_ICONS = { start: "al-top", center: "al-middle", end: "al-bottom", stretch: "al-stretch", baseline: "ta-left" };

/** Pass 3: the structure each level may build (the drop rules read these). */
export const STRUCTURE: Record<Freedom, { maxDepth: number; layouts: string[]; label: string }> = {
  0: { maxDepth: 2, layouts: ["stack"], label: "rows and columns one level deep" },
  1: { maxDepth: 3, layouts: ["stack", "grid"], label: "rows, columns and grids two levels deep" },
  2: { maxDepth: 4, layouts: ["stack", "grid"], label: "boxes three levels deep" },
};

/** A child of a grid container: how many of its columns it spans. */
const cspanSlot: SlotSpec<Env> = {
  key: "cspan", section: "size", label: "Column span", control: "number", bounds: bounds("cspan"),
  family: (e) => (e.parent?.layout === "grid" ? r(1, e.parent.cols ?? 2) : null),
};

/** Appearance, effects and advanced: the same for the ad and its nodes. */
function boxSlots(isFrame: boolean): SlotSpec<Env>[] {
  return [
    colourSlot("fill", "appearance", "Fill"),
    { key: "opacity", section: "appearance", label: "Opacity", control: "number", family: r(0.3, 1, 0.05), borrow: r(0.1, 1, 0.05), free: range("opacity", 0.05), bounds: bounds("opacity") },
    { key: "radius", section: "appearance", label: "Radius", control: "corners", unit: "px", family: r(0, 8), borrow: r(0, 24), free: range("radius"), bounds: bounds("radius") },
    { key: "bstyle", section: "appearance", label: "Border", control: "icons", icons: BORDER_ICONS, labels: { none: "No border", solid: "Solid", dashed: "Dashed", dotted: "Dotted", double: "Double" }, family: list("none", "solid", "dashed", "dotted"), borrow: list(...BORDER_STYLES) },
    colourSlot("bcolor", "appearance", "Border colour", { optional: true }),
    { key: "bwidth", section: "appearance", label: "Border width", control: "number", optional: true, unit: "px", family: r(0, 2, 0.5), borrow: r(0, 6, 0.5), free: range("bwidth", 0.5), bounds: bounds("bwidth") },
    { key: "blur", section: "effects", label: "Layer blur", control: "number", unit: "px", family: null, borrow: null, free: range("blur", 0.5), bounds: bounds("blur") },
    { key: "bblur", section: "effects", label: "Background blur", control: "number", unit: "px", family: null, borrow: null, free: range("bblur"), bounds: bounds("bblur") },
    { key: "tx", section: "effects", label: "Move X", control: "number", unit: "px", family: null, borrow: null, free: range("tx"), bounds: bounds("tx") },
    { key: "ty", section: "effects", label: "Move Y", control: "number", unit: "px", family: null, borrow: null, free: range("ty"), bounds: bounds("ty") },
    { key: "rot", section: "effects", label: "Rotate", control: "number", unit: "°", family: null, borrow: null, free: range("rot"), bounds: bounds("rot") },
    { key: "sx", section: "effects", label: "Scale X", control: "number", family: null, borrow: null, free: range("sx", 0.05), bounds: bounds("sx") },
    { key: "sy", section: "effects", label: "Scale Y", control: "number", family: null, borrow: null, free: range("sy", 0.05), bounds: bounds("sy") },
    cssProp("box-shadow", "Shadow", "appearance", undefined, "none"),
    ...advanced(isFrame),
  ];
}

/** One property inside the part's raw `css` override (Free only). In Advanced, or optional in another section. */
function cssProp(prop: string, label: string, section: SlotSpec["section"], values?: string[], placeholder?: string): SlotSpec<Env> {
  return { key: "css", id: "css-" + prop, prop, section, label, control: "css-prop", optional: section !== "advanced", family: null, borrow: null, free: values ? list(...values) : {}, placeholder };
}

function advanced(isFrame: boolean): SlotSpec<Env>[] {
  const p = (prop: string, label: string, values?: string[], placeholder?: string) => cssProp(prop, label, "advanced", values, placeholder);
  return [
    p("z-index", "Z-index", undefined, "auto"),
    p("overflow", "Overflow", ["visible", "hidden", "clip", "auto"], "visible"),
    p("white-space", "White space", ["normal", "nowrap", "pre-wrap", "pre-line"], "normal"),
    p("text-overflow", "Text overflow", ["clip", "ellipsis"], "clip"),
    p("word-break", "Word break", ["normal", "break-word", "break-all", "keep-all"], "normal"),
    p("hyphens", "Hyphens", ["none", "manual", "auto"], isFrame ? "manual" : "auto"),
    p("mix-blend-mode", "Blend", ["normal", "multiply", "screen", "overlay", "darken", "lighten", "difference"], "normal"),
    p("text-shadow", "Text shadow", undefined, "none"),
    p("cursor", "Cursor", ["default", "pointer", "text", "help"], "auto"),
  ];
}

/** Place and size inside the parent: shared by every node kind. */
function placeSlots(): SlotSpec<Env>[] {
  return [
    { key: "self", id: "self", section: "align", label: "Align in parent", control: "icons", icons: SELF_ICONS, labels: { start: "Left", center: "Centre", end: "Right" }, family: list("start", "center", "end") },
    { key: "push", section: "align", label: "Vertical place", control: "icons", icons: PUSH_ICONS, labels: { start: "Top", middle: "Middle", end: "Bottom" }, family: list("start", "middle", "end") },
    {
      key: "wmode", id: "width", numKey: "wpx", section: "size", label: "Width", control: "dim", labels: { hug: "Hug", fixed: "Fixed", fill: "Fill" }, bounds: bounds("w"),
      family: list("hug", "fill"), free: list("hug", "fixed", "fill"),
      covers: { self: (v) => (v === "stretch" ? "fill" : v === "start" ? "hug" : null), w: () => "fixed" },
    },
    {
      key: "hmode", id: "height", numKey: "hpx", section: "size", label: "Height", control: "dim", labels: { hug: "Hug", fixed: "Fixed", fill: "Fill" }, bounds: bounds("h"),
      family: list("hug", "fill"), free: list("hug", "fixed", "fill"),
      covers: { grow: (v) => (typeof v === "number" && v > 0 ? "fill" : null), h: () => "fixed" },
    },
    cspanSlot,
    { key: "pos", section: "size", label: "Position", control: "select", labels: { inline: "Inline", relative: "Relative", absolute: "Absolute", sticky: "Sticky" }, family: null, borrow: null, free: list("inline", "relative", "absolute", "sticky") },
    { key: "grow", section: "size", label: "Grow", control: "number", optional: true, family: null, borrow: null, free: range("grow", 1), bounds: bounds("grow") },
    { key: "x", section: "size", label: "Offset X", control: "number", optional: true, unit: "px", family: null, borrow: null, free: range("x"), bounds: bounds("x") },
    { key: "y", section: "size", label: "Offset Y", control: "number", optional: true, unit: "px", family: null, borrow: null, free: range("y"), bounds: bounds("y") },
  ];
}

/** Layout of a container (the ad and its boxes): stack or grid, direction, wrap, alignment, gap, grid columns. */
function layoutSlots(isFrame: boolean): SlotSpec<Env>[] {
  const stackOnly = (a: Allowed) => (e: Env) => (e.st.layout === "grid" ? null : a);
  const gridOnly = (a: Allowed) => (e: Env) => (e.st.layout === "grid" ? a : null);
  return [
    { key: "layout", section: "layout", label: "Layout", control: "chips", labels: { stack: "Stack", grid: "Grid" }, family: list("stack"), borrow: list("stack", "grid") },
    { key: "dir", section: "layout", label: "Direction", control: "icons", icons: DIR_ICONS, labels: { column: "Column (top to bottom)", row: "Row (left to right)" }, family: stackOnly(list("column", "row")) },
    { key: "gcols", section: "layout", label: "Columns", control: "number", bounds: bounds("gcols"), family: gridOnly(r(1, 6)), borrow: gridOnly(r(1, 8)), free: gridOnly(range("gcols")) },
    { key: "items", section: "layout", label: "Align items", control: "icons", icons: ITEMS_ICONS, labels: { start: "Start", center: "Centre", end: "End", stretch: "Stretch", baseline: "Baseline" }, family: list("start", "center", "end", "stretch", "baseline") },
    { key: "wrap", section: "layout", label: "Wrap", control: "chips", optional: true, labels: { false: "One line", true: "Wrap" }, family: stackOnly(list(false, true)) },
    { key: "gap", section: "layout", label: "Gap", control: "number", unit: "px", family: isFrame ? null : r(0, 16), borrow: r(0, 24), free: range("gap"), bounds: bounds("gap") },
    { key: "justify", section: "layout", label: "Distribute", control: "icons", optional: !isFrame ? false : true, icons: JUSTIFY_ICONS, labels: { start: "Start", center: "Middle", end: "End", "space-between": "Spread" }, family: isFrame ? null : list("start", "center", "end", "space-between"), borrow: list("start", "center", "end", "space-between") },
  ];
}

/** Padding and margin: every node has both. */
function spacingSlots(): SlotSpec<Env>[] {
  return [
    { key: "padding", section: "layout", label: "Padding", control: "sides", unit: "px", family: r(0, 12), borrow: r(0, 24), free: range("padding"), bounds: bounds("padding") },
    { key: "margin", section: "layout", label: "Margin", control: "sides", unit: "px", family: r(0, 12), borrow: r(0, 24), free: range("margin"), bounds: bounds("margin") },
  ];
}

function textSlots(part: TextKind): SlotSpec<Env>[] {
  const famTwo = part === "title" || part === "contact" || part === "header";
  const italicAtFamily = part === "title" || part === "price";
  return [
    ...placeSlots(),
    ...spacingSlots(),
    // Text.
    { key: "textStyle", section: "text", label: "Text style", control: "textstyle" },
    {
      key: "font", section: "text", label: "Font", control: "font",
      family: (e) => list(...e.fam[roleOf(e.part)]), borrow: { list: EVERY_FAMILY_FONT }, free: { list: LIBRARY },
    },
    {
      key: "weight", section: "text", label: "Weight", control: "select",
      labels: { 100: "Thin", 200: "Extra light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra bold", 900: "Black" },
      family: list(400, 700),
      borrow: (e) => list(...(fontEntry(e.st.font)?.weights ?? [400, 700])),
      free: list(...WEIGHTS),
    },
    {
      key: "size", section: "text", label: "Size", control: "number", unit: "px", bounds: bounds("size"),
      family: (e) => ({ range: e.fam.sizes[e.part as TextKind] }),
      borrow: (e) => { const [a, b] = e.fam.sizes[e.part as TextKind]; return r(Math.floor(a * 0.75), Math.ceil(b * 1.4)); },
      free: range("size"),
    },
    { key: "leading", section: "text", label: "Line height", control: "number", bounds: bounds("leading"), family: part === "body" ? r(1.1, 1.6, 0.05) : null, borrow: r(1, 1.8, 0.05), free: range("leading", 0.05) },
    { key: "tracking", section: "text", label: "Letter spacing", control: "number", unit: "em", bounds: bounds("tracking"), family: null, borrow: r(-0.02, 0.2, 0.01), free: range("tracking", 0.01) },
    { key: "case", section: "text", label: "Case", control: "chips", optional: true, labels: { none: "As typed", upper: "CAPS", smallcaps: "Small caps" }, family: famTwo ? list("none", "upper", "smallcaps") : null, borrow: list("none", "upper", "smallcaps") },
    { key: "italic", section: "text", label: "Style", control: "chips", optional: true, labels: { false: "Upright", true: "Italic" }, family: italicAtFamily ? list(false, true) : null, borrow: list(false, true) },
    cssProp("text-decoration", "Decoration", "text", ["none", "underline", "line-through", "overline"], "none"),
    cssProp("text-indent", "Indent", "text", undefined, "0"),
    colourSlot("color", "text", "Colour"),
    {
      key: "align", section: "text", label: "Align", control: "icons", icons: ALIGN_ICONS, labels: { left: "Left", center: "Centre", right: "Right", justify: "Justify" },
      family: part === "body" ? list("left", "center", "justify") : list("left", "center"),
      borrow: part === "body" ? list("left", "center", "right", "justify") : list("left", "center", "right"),
      free: list("left", "center", "right", "justify"),
    },
    ...(part === "header"
      ? [{ key: "variant", section: "appearance", label: "Header style", control: "chips", family: (e: Env) => list(...e.fam.headers), borrow: list(...HEADERS) } as SlotSpec<Env>]
      : []),
    ...boxSlots(false),
    // The layer eye (Layers section): stored as `hide`; no row, listed so it is not "unexplained".
    { key: "hide", section: "layers", label: "Hidden", control: "chips", family: list(true) },
  ];
}

/** Pass 3: a box (container) inside the ad. */
const BOX: SlotSpec<Env>[] = [
  ...placeSlots(),
  ...layoutSlots(false),
  ...spacingSlots(),
  colourSlot("color", "appearance", "Ink"),
  ...boxSlots(false),
  { key: "hide", section: "layers", label: "Hidden", control: "chips", family: list(true) },
];

/** Pass 3: a divider. Its border keys draw the one rule. */
const RULE: SlotSpec<Env>[] = [
  ...placeSlots(),
  ...spacingSlots(),
  { key: "bstyle", section: "appearance", label: "Line", control: "icons", icons: BORDER_ICONS, labels: { none: "No line", solid: "Solid", dashed: "Dashed", dotted: "Dotted", double: "Double" }, family: list("solid", "dashed", "dotted", "double") },
  { key: "bwidth", section: "appearance", label: "Thickness", control: "number", unit: "px", bounds: bounds("bwidth"), family: r(1, 3, 0.5), borrow: r(0.5, 6, 0.5), free: range("bwidth", 0.5) },
  colourSlot("bcolor", "appearance", "Colour"),
  { key: "opacity", section: "appearance", label: "Opacity", control: "number", family: r(0.3, 1, 0.05), borrow: r(0.1, 1, 0.05), free: range("opacity", 0.05), bounds: bounds("opacity") },
  { key: "blur", section: "effects", label: "Layer blur", control: "number", unit: "px", family: null, borrow: null, free: range("blur", 0.5), bounds: bounds("blur") },
  { key: "rot", section: "effects", label: "Rotate", control: "number", unit: "°", family: null, borrow: null, free: range("rot"), bounds: bounds("rot") },
  { key: "hide", section: "layers", label: "Hidden", control: "chips", family: list(true) },
];

/** Pass 3: a picture (feed cards: its source is a field of the item). */
const IMAGE: SlotSpec<Env>[] = [
  ...placeSlots(),
  { key: "ratio", section: "appearance", label: "Shape", control: "chips", labels: { auto: "Natural", "16/9": "16:9", "3/2": "3:2", "4/3": "4:3", "1/1": "Square", "3/4": "Portrait" }, family: list("16/9", "3/2", "4/3", "1/1", "3/4"), borrow: list("auto", "16/9", "3/2", "4/3", "1/1", "3/4") },
  { key: "fit", section: "appearance", label: "Fit", control: "chips", labels: { cover: "Fill the shape", contain: "Show it all" }, family: list("cover", "contain") },
  ...spacingSlots(),
  ...boxSlots(false),
  { key: "hide", section: "layers", label: "Hidden", control: "chips", family: list(true) },
];

const FRAME: SlotSpec<Env>[] = [
  { key: "wmode", id: "width", numKey: "wpx", section: "size", label: "Width", control: "dim", labels: { hug: "Hug", fill: "Fill", fixed: "Fixed" }, bounds: [40, 1200], family: list("hug", "fill", "fixed") },
  { key: "colSpan", section: "size", label: "Column span", control: "number", family: (e) => r(1, e.grid?.cols ?? 6), bounds: [1, 24] },
  { key: "hmode", id: "height", numKey: "hpx", section: "size", label: "Height", control: "dim", labels: { hug: "Hug", fixed: "Fixed" }, bounds: [20, 900], family: list("hug", "fixed") },
  { key: "rowSpan", section: "size", label: "Row span", control: "number", family: (e) => r(1, e.grid?.maxRows ?? 20), bounds: [1, 112] },
  // Pass 3: an exact size kept inside the cells (Free; set by resizing with snapping off).
  { key: "w", section: "size", label: "Exact width", control: "number", optional: true, unit: "px", family: null, borrow: null, free: range("w"), bounds: bounds("w") },
  { key: "h", section: "size", label: "Exact height", control: "number", optional: true, unit: "px", family: null, borrow: null, free: range("h"), bounds: bounds("h") },
  ...layoutSlots(true),
  { key: "padding", section: "layout", label: "Padding", control: "sides", unit: "px", family: r(4, 16), borrow: r(0, 24), free: range("padding"), bounds: bounds("padding") },
  { key: "margin", section: "layout", label: "Margin", control: "sides", optional: true, unit: "px", family: r(0, 12), borrow: r(0, 24), free: range("margin"), bounds: bounds("margin") },
  { key: "family", section: "appearance", label: "Family", control: "select", labels: Object.fromEntries(Object.entries(FAMILIES).map(([k, f]) => [k, f.label])), family: list(...Object.keys(FAMILIES)) },
  { key: "border", section: "appearance", label: "Rule", control: "chips", labels: { none: "None", hairline: "Hairline", double: "Double", heavy: "Heavy" }, family: list("none", "hairline", "double", "heavy") },
  { key: "tone", section: "appearance", label: "Tone", control: "chips", labels: { paper: "Paper", tinted: "Tinted", reversed: "Reversed" }, family: list("paper", "tinted", "reversed") },
  colourSlot("color", "appearance", "Ink"),
  ...boxSlots(true),
  { key: "hide", section: "layers", label: "Hidden", control: "chips", family: list(true) },
];

export const PART_SCHEMA: Record<Kind, PartSchema<Env>> = {
  frame: { label: "Ad", slots: FRAME },
  header: { label: "Header", slots: textSlots("header"), insertable: true },
  title: { label: "Title", slots: textSlots("title"), rich: RICH.title, insertable: true },
  body: { label: "Body", slots: textSlots("body"), rich: RICH.body, insertable: true },
  price: { label: "Price", slots: textSlots("price"), rich: RICH.price, insertable: true },
  contact: { label: "Contact", slots: textSlots("contact"), rich: RICH.contact, insertable: true },
  box: { label: "Box", slots: BOX },
  rule: { label: "Divider", slots: RULE, insertable: true },
  image: { label: "Picture", slots: IMAGE, insertable: true },
};

// ---------------------------------------------------------------------------
// Pass 3: the page itself (nothing selected): the grid the sheet is laid out
// on. Each sheet chooses its columns, gutter and baseline row height.
// ---------------------------------------------------------------------------
export const PAGE_SCHEMA: PartSchema<null> = {
  label: "Page",
  slots: [
    { key: "grid.cols", section: "layout", label: "Columns", control: "chips", family: list(6, 12), borrow: list(4, 6, 8, 12), free: list(...GRID_COLS) },
    { key: "grid.gap", section: "layout", label: "Gutter", control: "number", unit: "px", bounds: [...GRID_BOUNDS.gap], family: r(6, 16), borrow: r(0, 24), free: { range: GRID_BOUNDS.gap } },
    { key: "grid.row", section: "layout", label: "Row height", control: "number", unit: "px", bounds: [...GRID_BOUNDS.row], family: r(24, 40), borrow: r(12, 48), free: { range: GRID_BOUNDS.row } },
  ],
};
/** Feed cards also choose how many items are drawn. */
export const LIST_SLOTS: SlotSpec<null>[] = [
  { key: "list.limit", section: "layout", label: "Items shown", control: "number", bounds: [1, 24], family: r(1, 24) },
];

// ---------------------------------------------------------------------------
// The Tweaks tab: the sheet's shared variables (catalog.ts Theme). Colours come
// from a short palette at Family and Borrow, any hex at Free; fonts from the
// families' own at Family and Borrow, the whole library at Free.
// ---------------------------------------------------------------------------
/** The Tweaks colour popover's groups. */
export function tweakGroups(): Array<{ label: string; colors: string[] }> {
  return [{ label: "Papers", colors: TWEAK_PAPERS }, { label: "Inks", colors: TWEAK_INKS }, { label: "Spots", colors: TWEAK_SPOTS }, { label: "More colours", colors: EXTRA_COLOURS }];
}
export const TWEAK_PAPERS = [PAPER, "#ffffff", "#f6f1e4", "#e4dcc4", "#f1ece0", "#dfe6dc", "#e9e4f0"];
const TWEAK_INKS = [...new Set([...Object.values(FAMILIES).map((f) => f.ink), "#000000", "#2b2a33", "#1f3a2e"])];
const TWEAK_SPOTS = [...new Set([...Object.values(FAMILIES).map((f) => f.spot), "#0a7ea4", "#b8236f", "#2f6b3a"])];
const tw = (key: string, label: string, control: "color" | "font", choices: Allowed, free: Allowed, borrow: Allowed = choices): SlotSpec<null> =>
  ({ key: "tw." + key, section: "appearance", label, control, family: choices, borrow, free });
const WIDE_TWEAK = (l: string[]): Allowed => ({ list: uniq([...l, ...EXTRA_COLOURS]) });
export const TWEAK_SCHEMA: PartSchema<null> = {
  label: "Sheet",
  slots: [
    tw("paper", "Paper", "color", list(...TWEAK_PAPERS), {}, WIDE_TWEAK(TWEAK_PAPERS)),
    tw("ink", "Ink", "color", list(...TWEAK_INKS), {}, WIDE_TWEAK(TWEAK_INKS)),
    tw("spot", "Spot", "color", list(...TWEAK_SPOTS), {}, WIDE_TWEAK(TWEAK_SPOTS)),
    tw("title", "Title font", "font", { list: EVERY_FAMILY_FONT }, { list: LIBRARY }),
    tw("body", "Body font", "font", { list: EVERY_FAMILY_FONT }, { list: LIBRARY }),
  ],
};
