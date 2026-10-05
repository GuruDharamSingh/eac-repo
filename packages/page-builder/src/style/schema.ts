// ============================================================================
// "Style" — one setting every block carries, on every site that edits pages.
//
// Puck lets an author change only what a block declared a field for, so a
// border, a tint or a margin needed a developer each time. This is the generic
// layer: spacing, size, background, text colour, border, radius, shadow,
// opacity, visibility, hover, an anchor, a class and a fenced box of CSS,
// stored under one prop (`blkStyle`) in the block's own props, so it travels
// with the block and needs no block to know of it.
//
// Pure data and functions, no React and no DOM: the editor's control, the
// published wrapper and the tests all read this one file. The stored value is
// NEVER trusted. A page row is JSON anyone with editor access can write by
// hand, and it is drawn on public pages, so `cleanStyle` keeps only known keys
// with known value shapes, and the custom-CSS box is parsed against an
// allowlist (`cleanCustomCss`) rather than passed through.
//
// Colours are the site's own: a token name resolves to a `--blk-*` variable
// (blocks.css, imported app-wide by every editing site), so a styled block
// follows the site's palette and its light or dark mode. A literal hex is also
// accepted.
// ============================================================================

export const STYLE_PROP = "blkStyle";

export interface ColorToken {
  value: string;
  label: string;
  css: string;
}

export const COLOR_TOKENS: readonly ColorToken[] = [
  { value: "ground", label: "Page ground", css: "var(--blk-bg)" },
  { value: "soft", label: "Soft tint", css: "var(--blk-bg-soft)" },
  { value: "ink", label: "Text", css: "var(--blk-fg)" },
  { value: "muted", label: "Muted text", css: "var(--blk-muted)" },
  { value: "line", label: "Line", css: "var(--blk-line)" },
  { value: "accent", label: "Accent", css: "var(--blk-accent)" },
  { value: "accent-ink", label: "Accent as text", css: "var(--blk-accent-ink)" },
  { value: "on-accent", label: "Text on accent", css: "var(--blk-on-accent)" },
  { value: "band", label: "Band (header colour)", css: "var(--blk-band)" },
  { value: "band-ink", label: "Text on band", css: "var(--blk-band-fg)" },
  { value: "none", label: "Transparent", css: "transparent" },
];

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** The CSS for a stored colour: a token's variable or a hex; undefined when it is neither. */
export function colorCss(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const token = COLOR_TOKENS.find((t) => t.value === value);
  if (token) return token.css;
  return HEX.test(value) ? value : undefined;
}

export const BORDER_STYLES = ["solid", "dashed", "dotted", "double"] as const;
export const BORDER_SIDES = ["all", "top", "bottom", "left", "right", "x", "y"] as const;
export const SHADOWS = ["soft", "medium", "strong", "glow"] as const;
export const ALIGNS = ["start", "center", "end"] as const;
export const HIDE_ON = ["mobile", "desktop"] as const;
export const HOVERS = ["lift", "glow", "brighten"] as const;
export const RADIUS_STEPS = [0, 4, 8, 12, 16, 24, 32, 999] as const;

export interface StyleSettings {
  padX?: number;
  padY?: number;
  marginTop?: number;
  marginBottom?: number;
  maxWidth?: number;
  align?: (typeof ALIGNS)[number];
  minHeight?: number;
  bg?: string;
  /** 0–99; omitted = fully opaque. */
  bgOpacity?: number;
  color?: string;
  borderWidth?: number;
  borderStyle?: (typeof BORDER_STYLES)[number];
  borderColor?: string;
  borderSides?: (typeof BORDER_SIDES)[number];
  /** px, or "theme" for the site's own corner radius. */
  radius?: number | "theme";
  shadow?: (typeof SHADOWS)[number];
  /** 5–99; omitted = fully opaque. */
  opacity?: number;
  hideOn?: (typeof HIDE_ON)[number];
  hover?: (typeof HOVERS)[number];
  anchor?: string;
  className?: string;
  custom?: string;
}

const num = (v: unknown, min: number, max: number): number | undefined => {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const n = Math.round(v);
  return n >= min && n <= max && n !== 0 ? n : undefined;
};
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;

/** Tokens of letters, digits, hyphen and underscore; at most four, each at most 40 long. */
function cleanClassName(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const tokens = v
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => /^[a-z_][a-z0-9_-]{0,39}$/i.test(t))
    .slice(0, 4);
  return tokens.length ? tokens.join(" ") : undefined;
}

/** An HTML id for in-page links: starts with a letter, no spaces. */
function cleanAnchor(v: unknown): string | undefined {
  return typeof v === "string" && /^[a-z][a-z0-9_-]{0,59}$/i.test(v.trim()) ? v.trim() : undefined;
}

/** Keep only what is known and in range. Null when nothing is set. */
export function cleanStyle(raw: unknown): StyleSettings | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: StyleSettings = {};

  const set = <K extends keyof StyleSettings>(key: K, value: StyleSettings[K] | undefined) => {
    if (value !== undefined) out[key] = value;
  };

  set("padX", num(r.padX, 1, 240));
  set("padY", num(r.padY, 1, 240));
  set("marginTop", num(r.marginTop, 1, 320));
  set("marginBottom", num(r.marginBottom, 1, 320));
  set("maxWidth", num(r.maxWidth, 120, 2400));
  set("align", oneOf(ALIGNS, r.align));
  set("minHeight", num(r.minHeight, 1, 1600));
  set("bg", colorCss(r.bg) ? (r.bg as string) : undefined);
  set("bgOpacity", num(r.bgOpacity, 1, 99));
  set("color", colorCss(r.color) ? (r.color as string) : undefined);
  set("borderWidth", num(r.borderWidth, 1, 16));
  set("borderStyle", oneOf(BORDER_STYLES, r.borderStyle));
  set("borderColor", colorCss(r.borderColor) ? (r.borderColor as string) : undefined);
  set("borderSides", oneOf(BORDER_SIDES, r.borderSides));
  set("radius", r.radius === "theme" ? "theme" : num(r.radius, 1, 999));
  set("shadow", oneOf(SHADOWS, r.shadow));
  set("opacity", num(r.opacity, 5, 99));
  set("hideOn", oneOf(HIDE_ON, r.hideOn));
  set("hover", oneOf(HOVERS, r.hover));
  set("anchor", cleanAnchor(r.anchor));
  set("className", cleanClassName(r.className));
  // The box's text is kept as typed so it can be edited; it is only ever
  // USED through cleanCustomCss.
  if (typeof r.custom === "string" && r.custom.trim()) out.custom = r.custom.slice(0, 1500);

  return Object.keys(out).length ? out : null;
}

// ── custom CSS, fenced ──────────────────────────────────────────────────────

/**
 * Properties the box may set. Deliberately no `position`, `z-index`, `inset`,
 * `top/left/…`, `content`, `pointer-events`, `cursor` or `display`: those turn
 * a styled block into an overlay or a click trap on a public page.
 */
const ALLOWED_PROPS = new Set([
  "color", "background", "background-color", "background-image", "background-size", "background-position",
  "background-repeat", "background-blend-mode", "opacity", "mix-blend-mode",
  "border", "border-top", "border-right", "border-bottom", "border-left", "border-width", "border-style",
  "border-color", "border-radius", "border-top-left-radius", "border-top-right-radius",
  "border-bottom-left-radius", "border-bottom-right-radius", "outline", "outline-offset",
  "box-shadow", "text-shadow", "filter", "backdrop-filter", "transform", "transform-origin",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "width", "min-width", "max-width", "height", "min-height", "max-height", "aspect-ratio", "overflow",
  "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-transform",
  "text-decoration", "text-decoration-color", "text-underline-offset", "word-spacing", "clip-path",
]);

const ALLOWED_FUNCTIONS = new Set([
  "calc", "min", "max", "clamp", "rgb", "rgba", "hsl", "hsla", "color-mix", "var",
  "linear-gradient", "radial-gradient", "conic-gradient", "repeating-linear-gradient",
  "repeating-radial-gradient", "translate", "translatex", "translatey", "scale", "scalex", "scaley",
  "rotate", "skew", "skewx", "skewy", "blur", "brightness", "contrast", "saturate", "grayscale",
  "hue-rotate", "sepia", "invert", "drop-shadow", "polygon", "inset", "circle", "ellipse",
]);

const FORBIDDEN_VALUE = /url\s*\(|image-set|expression|javascript:|@|\\|[{}<>]|\/\*|\*\/|attr\s*\(|env\s*\(|!/i;

export interface CustomCssResult {
  /** [property, value] pairs that passed, in the order typed. */
  kept: Array<[string, string]>;
  /** Lines that did not, each with why, for the editor to show. */
  rejected: Array<{ line: string; reason: string }>;
}

/** Parse the box: `name: value;` declarations, one or many per line. */
export function cleanCustomCss(text: unknown): CustomCssResult {
  const kept: Array<[string, string]> = [];
  const rejected: Array<{ line: string; reason: string }> = [];
  if (typeof text !== "string") return { kept, rejected };

  for (const piece of text.split(/;|\n/)) {
    const line = piece.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 1) {
      rejected.push({ line, reason: "Not a `property: value` pair." });
      continue;
    }
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!ALLOWED_PROPS.has(name)) {
      rejected.push({ line, reason: `“${name}” is not allowed here.` });
      continue;
    }
    if (!value || value.length > 200 || FORBIDDEN_VALUE.test(value)) {
      rejected.push({ line, reason: "That value is not allowed (no links, scripts or !important)." });
      continue;
    }
    const badFunction = [...value.matchAll(/([a-z][a-z0-9-]*)\s*\(/gi)].find(
      (m) => !ALLOWED_FUNCTIONS.has(m[1].toLowerCase())
    );
    if (badFunction) {
      rejected.push({ line, reason: `“${badFunction[1]}()” is not allowed here.` });
      continue;
    }
    // A variable must be one of the site's own tokens.
    const badVar = [...value.matchAll(/var\([^)]*\)/gi)].find((m) => !/^var\(--(?:blk|eac)-[a-z0-9-]+\)$/i.test(m[0]));
    if (badVar) {
      rejected.push({ line, reason: "Only the site's --blk-* and --eac-* variables can be used." });
      continue;
    }
    // Brackets balance, or the declaration would swallow what follows it.
    let depth = 0;
    for (const ch of value) depth += ch === "(" ? 1 : ch === ")" ? -1 : 0;
    if (depth !== 0) {
      rejected.push({ line, reason: "Unbalanced brackets." });
      continue;
    }
    kept.push([name, value]);
  }
  return { kept, rejected };
}

// ── to CSS ──────────────────────────────────────────────────────────────────

const SHADOW_CSS: Record<(typeof SHADOWS)[number], string> = {
  soft: "0 2px 10px rgba(0,0,0,.18)",
  medium: "0 8px 24px rgba(0,0,0,.28)",
  strong: "0 18px 48px rgba(0,0,0,.4)",
  glow: "0 0 0 1px var(--blk-accent), 0 0 28px color-mix(in srgb, var(--blk-accent) 45%, transparent)",
};

const camel = (prop: string) => prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

export interface StyleOutput {
  style: Record<string, string | number>;
  attrs: Record<string, string>;
  id?: string;
  className?: string;
}

/** The wrapper's inline style, data attributes, id and class for a cleaned value. */
export function styleToCss(s: StyleSettings): StyleOutput {
  const style: Record<string, string | number> = {};
  const attrs: Record<string, string> = {};
  const px = (n: number) => `${n}px`;

  if (s.padY) {
    style.paddingTop = px(s.padY);
    style.paddingBottom = px(s.padY);
  }
  if (s.padX) {
    style.paddingLeft = px(s.padX);
    style.paddingRight = px(s.padX);
  }
  if (s.marginTop) style.marginTop = px(s.marginTop);
  if (s.marginBottom) style.marginBottom = px(s.marginBottom);
  if (s.maxWidth) {
    style.maxWidth = px(s.maxWidth);
    style.width = "100%";
  }
  if (s.align) {
    style.marginLeft = s.align === "start" ? "0" : "auto";
    style.marginRight = s.align === "end" ? "0" : "auto";
  }
  if (s.minHeight) style.minHeight = px(s.minHeight);

  const bg = colorCss(s.bg);
  if (bg) {
    style.backgroundColor = s.bgOpacity ? `color-mix(in srgb, ${bg} ${s.bgOpacity}%, transparent)` : bg;
  }
  const color = colorCss(s.color);
  if (color) {
    style.color = color;
    // Every shared block sets its own ink from --blk-fg (blocks.css `.blk`), so
    // `color` alone changes nothing inside one: a "Spotlight" card on a dark
    // ground kept dark text. Repointing the variables lets the block's own
    // text, muted text and rules follow the colour chosen.
    style["--blk-fg"] = color;
    style["--blk-muted"] = `color-mix(in srgb, ${color} 72%, transparent)`;
    style["--blk-line"] = `color-mix(in srgb, ${color} 28%, transparent)`;
  }

  if (s.borderWidth) {
    const w = px(s.borderWidth);
    const kind = s.borderStyle ?? "solid";
    const c = colorCss(s.borderColor) ?? "var(--blk-line)";
    const sides = s.borderSides ?? "all";
    const sideProps =
      sides === "all"
        ? ["border"]
        : sides === "x"
          ? ["borderLeft", "borderRight"]
          : sides === "y"
            ? ["borderTop", "borderBottom"]
            : [`border${sides[0].toUpperCase()}${sides.slice(1)}`];
    for (const p of sideProps) style[p] = `${w} ${kind} ${c}`;
  }
  if (s.radius) style.borderRadius = s.radius === "theme" ? "var(--blk-radius, 0)" : px(s.radius);
  if (s.shadow) style.boxShadow = SHADOW_CSS[s.shadow];
  if (s.opacity) style.opacity = s.opacity / 100;

  if (s.hideOn) attrs["data-hide"] = s.hideOn;
  if (s.hover) attrs["data-hover"] = s.hover;

  // The box last, so it wins over the controls above it.
  if (s.custom) {
    for (const [name, value] of cleanCustomCss(s.custom).kept) style[camel(name)] = value;
  }

  return { style, attrs, id: s.anchor, className: s.className };
}

/**
 * The small stylesheet the wrapper needs for what inline style cannot say:
 * hiding by screen size, and hover. Rendered with the first styled block on a
 * page (React 19 hoists a <style href precedence> once), so a page with no
 * styled blocks carries none of it.
 */
export const STYLE_SHEET = `
.blk-st{box-sizing:border-box}
@media (max-width:40rem){.blk-st[data-hide="mobile"]{display:none!important}}
@media (min-width:40.01rem){.blk-st[data-hide="desktop"]{display:none!important}}
.blk-st[data-hover]{transition:transform .25s ease,box-shadow .25s ease,filter .25s ease}
.blk-st[data-hover="lift"]:hover{transform:translateY(-4px);box-shadow:0 14px 34px rgba(0,0,0,.3)}
.blk-st[data-hover="glow"]:hover{box-shadow:0 0 0 1px var(--blk-accent),0 0 28px color-mix(in srgb,var(--blk-accent) 45%,transparent)}
.blk-st[data-hover="brighten"]:hover{filter:brightness(1.12)}
@media (prefers-reduced-motion:reduce){.blk-st[data-hover]{transition:none}.blk-st[data-hover]:hover{transform:none}}
.blk-st[data-hide][data-editing]{display:block!important;opacity:.4;outline:1px dashed currentColor;outline-offset:-1px}
`.trim();

// ── presets ─────────────────────────────────────────────────────────────────

export interface StylePreset {
  id: string;
  label: string;
  style: StyleSettings;
}

/** One click, several settings. Each follows the site's palette and corner radius. */
export const STYLE_PRESETS: readonly StylePreset[] = [
  { id: "card", label: "Card", style: { bg: "soft", padX: 24, padY: 24, borderWidth: 1, borderColor: "line", radius: "theme" } },
  { id: "outlined", label: "Outlined", style: { padX: 20, padY: 20, borderWidth: 1, borderColor: "accent", radius: "theme" } },
  { id: "filled", label: "Filled accent", style: { bg: "accent", color: "on-accent", padX: 24, padY: 24, radius: "theme" } },
  { id: "edge", label: "Edge", style: { borderWidth: 3, borderSides: "left", borderColor: "accent", padX: 20, padY: 4 } },
  { id: "lifted", label: "Lifted", style: { bg: "soft", padX: 24, padY: 24, radius: "theme", shadow: "medium", hover: "lift" } },
  { id: "band", label: "Band", style: { bg: "band", color: "band-ink", padX: 32, padY: 48 } },
  { id: "airy", label: "Airy", style: { padY: 48, marginTop: 24, marginBottom: 24 } },
  // The card kit (2026-10-04): looks for cards, labels and callouts.
  { id: "gallery-label", label: "Gallery label", style: { bg: "ground", padX: 28, padY: 24, borderWidth: 1, borderColor: "ink" } },
  { id: "ticket", label: "Ticket", style: { padX: 24, padY: 24, borderWidth: 2, borderStyle: "dashed", borderColor: "accent", radius: 12 } },
  { id: "spotlight", label: "Spotlight", style: { bg: "band", color: "band-ink", padX: 28, padY: 28, shadow: "strong", radius: 4 } },
  { id: "ribbon", label: "Ribbon", style: { bg: "soft", padX: 24, padY: 20, borderWidth: 6, borderSides: "left", borderColor: "accent" } },
  { id: "glass", label: "Glass", style: { bg: "soft", bgOpacity: 55, padX: 24, padY: 24, borderWidth: 1, borderColor: "line", radius: 16, shadow: "soft" } },
  { id: "glow", label: "Glow", style: { bg: "ground", padX: 24, padY: 24, radius: 12, shadow: "glow", hover: "glow" } },
  { id: "underline", label: "Underline", style: { padY: 12, borderWidth: 2, borderSides: "bottom", borderColor: "accent" } },
  { id: "pill", label: "Pill", style: { bg: "accent", color: "on-accent", padX: 20, padY: 8, radius: 999 } },
];

// ── contrast ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  if (!HEX.test(hex)) return null;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast of two literal hex colours; null when either is a token (unknown here). */
export function contrastRatio(a: string | undefined, b: string | undefined): number | null {
  const ra = a ? hexToRgb(a) : null;
  const rb = b ? hexToRgb(b) : null;
  if (!ra || !rb) return null;
  const la = luminance(ra);
  const lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
