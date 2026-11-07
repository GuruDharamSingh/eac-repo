// ============================================================================
// Site style (2026-11-06): one place where an owner sets how their whole site
// looks, as data, cleaned on every save and on every read.
//
// Two layers:
//   theme   Values for the site's own CSS variables (colours, corners, fonts).
//           Which variables exist, and what kind each is, is declared by the
//           site in code (SiteStyleSchema.vars); an owner only fills in values.
//           Stored in `site_themes` (page_key ''), the table IFAC and
//           arts-collective already use.
//   chrome  A look per part of the site's header and footer, in the same
//           PartStyle vocabulary as a block's parts (morph). The parts are
//           declared by the site as `data-part` names inside an element marked
//           `data-chrome="<region>"`; selectors are built from those names, never
//           stored. Stored in site_config `site-style:chrome`.
//
// Pure and server-safe: no DOM, no React. The same `siteStyleCss` draws the
// published page (server) and the editor's live preview (browser).
// ============================================================================

import { googleFontsHref, isKnownFont } from "@elkdonis/fonts";
import { cleanStyle, partDecls, type Decl, type PartStyle } from "../block/style";
import { partSafeDecls, sheetSafe } from "../block/morph";
import { PART_NAME } from "../block/contract";

// ── What a site declares (code) ─────────────────────────────────────────────

export type SiteVarKind =
  /** A bare HSL triplet ("40 50% 57%"), the shadcn convention: the stylesheet wraps it in hsl(). */
  | "hsl"
  /** Any colour the editor offers: #rrggbb. */
  | "color"
  /** A length with a unit: 0, 4px, 0.5rem. */
  | "length"
  /** One of the site's declared fonts. */
  | "font"
  /** A background: a colour or a linear-gradient of colours. */
  | "background"
  /**
   * One of `options` (a site's named preset, e.g. a shop's card look). Written as
   * the variable like any other; a site that needs it as markup reads the stored
   * value server-side (the variable alone cannot switch selectors).
   */
  | "choice";

export interface SiteFont {
  /** What the owner sees. */
  label: string;
  /** The CSS font stack written. Local faces must already be loaded by the site's stylesheet. */
  stack: string;
  /** A family in @elkdonis/fonts, loaded from Google when chosen. Absent for local faces. */
  google?: string;
}

export interface SiteVar {
  name: string; // "--background"
  label: string;
  group: string; // "Colours", "Type", "Shape"
  kind: SiteVarKind;
  /** What the site's stylesheet sets today, in the same format. Shown as the starting value. */
  default: string;
  hint?: string;
  /**
   * Elements that should take this variable directly, when the owner sets it. The site's own CSS may
   * use a literal (body's gradient, h1–h4's font-family), so changing the variable alone would change
   * nothing there. Selectors are code. Written only when the variable is set, so an untouched site
   * keeps its own rules (a gradient, say).
   */
  applies?: { sel: string; prop: "font-family" | "background" | "color" | "border-color" };
  /** For colours: the variable this one is read against, for a contrast warning ("--background"). */
  on?: string;
  /** For "choice": the values it may take. Values are plain words (letters, digits, -). */
  options?: readonly { value: string; label: string }[];
}

export interface ChromePart { label: string }
export interface ChromeRegion { label: string; parts: Readonly<Record<string, ChromePart>> }

export interface SiteStyleSchema {
  vars: readonly SiteVar[];
  /** The fonts a "font" variable may take. */
  fonts?: readonly SiteFont[];
  /** "header", "footer": each matches `[data-chrome="<name>"]` in the site's markup. */
  chrome: Readonly<Record<string, ChromeRegion>>;
}

// ── What is stored (data) ───────────────────────────────────────────────────

export interface SiteStyle {
  v: 1;
  theme?: Record<string, string>;
  chrome?: Record<string, Record<string, PartStyle>>;
}

/** The keys a chrome part may set. No position, size or transform: the header must stay where the site put it. */
const CHROME_KEYS: readonly (keyof PartStyle)[] = [
  "fill", "color", "size", "weight", "case", "tracking", "italic", "align", "leading",
  "padding", "margin", "gap", "radius", "bstyle", "bcolor", "bwidth", "opacity", "hide", "css",
];
const REGION_NAME = /^[a-z][a-z0-9-]{0,31}$/;
const MAX_CSS = 600;

const HSL_RE = /^\d{1,3}(?:\.\d+)? \d{1,3}(?:\.\d+)?% \d{1,3}(?:\.\d+)?%$/;
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const LENGTH_RE = /^(?:0|\d{1,3}(?:\.\d{1,3})?(?:px|rem|em))$/;
const GRADIENT_RE = /^linear-gradient\(\d{1,3}deg(?:, #[0-9a-f]{6} \d{1,3}%){2,4}\)$/i;

function cleanVar(v: SiteVar, raw: unknown, fonts: readonly SiteFont[]): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  let ok = false;
  switch (v.kind) {
    case "hsl": ok = HSL_RE.test(value); break;
    case "color": ok = HEX_RE.test(value); break;
    case "length": ok = LENGTH_RE.test(value); break;
    case "background": ok = HEX_RE.test(value) || GRADIENT_RE.test(value); break;
    case "font": ok = fonts.some((f) => f.stack === value); break;
    case "choice": ok = /^[a-z0-9-]{1,40}$/.test(value) && (v.options ?? []).some((o) => o.value === value); break;
  }
  // The variable lands in a <style>: one more guard against anything that could leave the declaration.
  return ok && sheetSafe(value) && !/[;{}<>\\]/.test(value) ? value : undefined;
}

function cleanPart(raw: unknown): PartStyle | undefined {
  const full = cleanStyle(raw);
  if (!full) return undefined;
  const out: PartStyle = {};
  for (const k of CHROME_KEYS) if (full[k] !== undefined) (out as Record<string, unknown>)[k] = full[k];
  if (typeof out.css === "string") {
    // Keep only what the stylesheet would draw, written back as text, so what is stored is what is shown.
    const kept = partSafeDecls(out.css).filter(([k]) => !/^(position|inset|top|left|right|bottom|z-index|transform|translate|scale|rotate|display)$/.test(k));
    const text = kept.map(([k, val]) => `${k}: ${val};`).join(" ").slice(0, MAX_CSS);
    if (text) out.css = text; else delete out.css;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Everything a stored or submitted style may hold, against the site's declaration. Returns null when nothing is set. */
export function cleanSiteStyle(raw: unknown, schema: SiteStyleSchema): SiteStyle | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as { theme?: unknown; chrome?: unknown };
  const out: SiteStyle = { v: 1 };
  if (r.theme && typeof r.theme === "object" && !Array.isArray(r.theme)) {
    const theme: Record<string, string> = {};
    for (const v of schema.vars) {
      const value = cleanVar(v, (r.theme as Record<string, unknown>)[v.name], schema.fonts ?? []);
      if (value !== undefined) theme[v.name] = value;
    }
    if (Object.keys(theme).length) out.theme = theme;
  }
  if (r.chrome && typeof r.chrome === "object" && !Array.isArray(r.chrome)) {
    const chrome: Record<string, Record<string, PartStyle>> = {};
    for (const [region, decl] of Object.entries(schema.chrome)) {
      const parts = (r.chrome as Record<string, unknown>)[region];
      if (!REGION_NAME.test(region) || !parts || typeof parts !== "object" || Array.isArray(parts)) continue;
      const kept: Record<string, PartStyle> = {};
      for (const name of ["root", ...Object.keys(decl.parts).filter((n) => n !== "root")]) {
        if (!PART_NAME.test(name) && name !== "root") continue;
        const look = cleanPart((parts as Record<string, unknown>)[name]);
        if (look) kept[name] = look;
      }
      if (Object.keys(kept).length) chrome[region] = kept;
    }
    if (Object.keys(chrome).length) out.chrome = chrome;
  }
  return out.theme || out.chrome ? out : null;
}

// ── Drawing ─────────────────────────────────────────────────────────────────

const important = (d: Decl[]) => d.map(([k, v]) => `${k}:${v.replace(/\s*!important\s*$/i, "")} !important`).join(";");
const esc = (s: string) => s.replace(/["\\]/g, "");

/**
 * The stylesheet for a site's style, or "" when nothing is set. Runs on stored data, so it cleans again.
 * `editor` keeps a hidden part visible and faint, so it can still be picked.
 *
 * Theme values go on `html:root` (one element more specific than the site's own `:root` and `.dark`
 * rules), so they win wherever the site's stylesheet happens to load.
 */
export function siteStyleCss(raw: unknown, schema: SiteStyleSchema, opts: { editor?: boolean } = {}): string {
  const s = cleanSiteStyle(raw, schema);
  if (!s) return "";
  const rules: string[] = [];
  if (s.theme) {
    rules.push(`html:root{${Object.entries(s.theme).map(([k, v]) => `${k}:${v}`).join(";")}}`);
    for (const v of schema.vars) {
      if (!v.applies || !s.theme[v.name] || /[{}<;]/.test(v.applies.sel)) continue;
      const value = v.kind === "hsl" ? `hsl(var(${v.name}))` : `var(${v.name})`;
      rules.push(`${v.applies.sel}{${v.applies.prop}:${value} !important}`);
    }
  }
  for (const [region, parts] of Object.entries(s.chrome ?? {})) {
    for (const [name, look] of Object.entries(parts)) {
      const d = partDecls(look, { editor: opts.editor });
      if (look.hide && opts.editor) d.push(["opacity", ".3"]);
      if (!d.length) continue;
      const root = `[data-chrome="${esc(region)}"]`;
      rules.push(`${name === "root" ? root : `${root} [data-part="${esc(name)}"]`}{${important(d)}}`);
    }
  }
  // A closing tag cannot occur in a cleaned value; this keeps it so if a rule ever widens.
  return rules.join("\n").replace(/<\/(style)/gi, "<\\/$1");
}

/** The Google stylesheet for the fonts a style uses, or null. Local faces need none. */
export function siteStyleFontsHref(raw: unknown, schema: SiteStyleSchema): string | null {
  const s = cleanSiteStyle(raw, schema);
  if (!s?.theme) return null;
  const used = (schema.fonts ?? []).filter((f) => f.google && Object.values(s.theme!).includes(f.stack)).map((f) => f.google!);
  return used.length ? googleFontsHref(used.filter((f) => isKnownFont(f))) : null;
}

// ── For the editor ──────────────────────────────────────────────────────────

/** "40 50% 57%" → "#c9a25c"; anything else that is already hex passes through. */
export function hslToHex(v: string): string | null {
  if (HEX_RE.test(v)) return v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`.toLowerCase() : v.toLowerCase();
  if (!HSL_RE.test(v)) return null;
  const [h, s, l] = v.replace(/%/g, "").split(" ").map(Number) as [number, number, number];
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => { const k = (n + h / 30) % 12; const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255).toString(16).padStart(2, "0"); };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** "#c9a25c" → "40 50% 57%" (rounded as the shadcn files write them). */
export function hexToHsl(hex: string): string | null {
  const h6 = hslToHex(hex);
  if (!h6) return null;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h6.slice(i, i + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let hue = 0, sat = 0;
  if (d) {
    sat = d / (1 - Math.abs(2 * l - 1));
    hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue = Math.round(hue * 60); if (hue < 0) hue += 360;
  }
  return `${hue} ${Math.round(sat * 100)}% ${Math.round(l * 100)}%`;
}

/** A colour variable as hex, whatever its kind; null for gradients and non-colours. */
export function varHex(v: SiteVar, value: string | undefined): string | null {
  const x = value ?? v.default;
  return v.kind === "hsl" ? hslToHex(x) : v.kind === "color" || (v.kind === "background" && HEX_RE.test(x)) ? hslToHex(x) : null;
}


