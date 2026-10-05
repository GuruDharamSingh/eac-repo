import type { CSSProperties, ReactNode } from "react";
import { FONTS, font, googleFontsHref } from "@/lib/fonts";

// ============================================================================
// "Text style" — one setting every block carries, in the editor's right
// column below the block's own fields (page-builder `blockStyle`).
//
// It restyles the words INSIDE one block: typeface, weight, capitals, letter
// spacing, slant and colour. Unset parts leave the block as designed. The
// choices name the site's own roles ("Menu lettering", "Heading font") as
// well as the typefaces in lib/fonts.ts; a role follows /studio/theme, so a
// block set to "Menu lettering" changes when the menu does.
//
// Stored in the block's props as a small object, cleaned here before use —
// the stored value is never trusted. Server-safe: the published page and the
// editor canvas both render TextStyleWrap. The control is
// components/studio/text-style-field.tsx; the CSS is in app/theme-hooks.css.
//
// Size is not here: blocks size their words in rem, each differently, and no
// wrapper can scale them all without compounding. Blocks that have a size
// setting (picture-wall captions, headings) keep it.
// ============================================================================

export interface TextStyle {
  font?: string;
  weight?: string;
  case?: string;
  tracking?: string;
  italic?: boolean;
  color?: string;
}

/** The site's own type roles — each follows the Theme. */
export const ROLE_FONTS = [
  { value: "menu", label: "Menu lettering", stack: "var(--dm-font-nav)" },
  { value: "heading", label: "The site's heading font", stack: "var(--dm-font-heading)" },
  { value: "body", label: "The site's body font", stack: "var(--dm-font-body)" },
  { value: "caption", label: "The site's caption font", stack: "var(--dm-font-caption, var(--dm-font-body))" },
] as const;

export const WEIGHTS = [
  { value: "", label: "As designed" },
  { value: "menu", label: "Like the menu" },
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi-bold" },
  { value: "700", label: "Bold" },
] as const;

export const CASES = [
  { value: "", label: "As designed" },
  { value: "menu", label: "Like the menu" },
  { value: "uppercase", label: "CAPITALS" },
  { value: "capitalize", label: "Title Case" },
  { value: "none", label: "As typed" },
] as const;

export const TRACKINGS = [
  { value: "", label: "As designed" },
  { value: "menu", label: "Like the menu" },
  { value: "0", label: "None" },
  { value: "0.03", label: "A little" },
  { value: "0.06", label: "Some" },
  { value: "0.12", label: "Wide" },
  { value: "0.2", label: "Very wide" },
] as const;

/** One click, several settings. "Menu lettering" is what the menu is, whatever the Theme makes it. */
export const PRESETS: Array<{ id: string; label: string; style: TextStyle }> = [
  { id: "menu", label: "Menu lettering", style: { font: "menu", weight: "menu", case: "menu", tracking: "menu" } },
  { id: "heading", label: "Heading face", style: { font: "heading" } },
  { id: "inscribed", label: "Inscribed capitals", style: { font: "cinzel", case: "uppercase", tracking: "0.12" } },
  { id: "quiet", label: "Quiet italic", style: { font: "cormorant", italic: true } },
  { id: "plain", label: "Plain sans", style: { font: "lato", weight: "400", case: "none", tracking: "0" } },
];

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const pick = <T extends { value: string }>(list: readonly T[], v: unknown) =>
  typeof v === "string" && v !== "" && list.some((o) => o.value === v) ? v : undefined;

/** Only known values survive. Returns null when nothing is set. */
export function cleanTextStyle(raw: unknown): TextStyle | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: TextStyle = {};
  if (typeof r.font === "string" && (ROLE_FONTS.some((f) => f.value === r.font) || font(r.font))) out.font = r.font;
  const weight = pick(WEIGHTS, r.weight);
  if (weight) out.weight = weight;
  const kase = pick(CASES, r.case);
  if (kase) out.case = kase;
  const tracking = pick(TRACKINGS, r.tracking);
  if (tracking) out.tracking = tracking;
  if (r.italic === true) out.italic = true;
  if (typeof r.color === "string" && HEX.test(r.color)) out.color = r.color;
  return Object.keys(out).length ? out : null;
}

/** The CSS font-family for a stored choice. */
export function fontStack(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return ROLE_FONTS.find((f) => f.value === id)?.stack ?? font(id)?.stack;
}

/**
 * The wrapper's attributes: a data flag per part that is set (theme-hooks.css
 * keys on these) and the values as `--ts-*` variables.
 */
export function textStyleAttrs(ts: TextStyle): { style: Record<string, string>; data: Record<string, string> } {
  const style: Record<string, string> = {};
  const data: Record<string, string> = {};
  const stack = fontStack(ts.font);
  if (stack) {
    style["--ts-font"] = stack;
    data["data-ts-font"] = "";
  }
  if (ts.weight) {
    style["--ts-weight"] = ts.weight === "menu" ? "var(--dm-nav-weight, 500)" : ts.weight;
    data["data-ts-weight"] = "";
  }
  if (ts.case) {
    style["--ts-case"] = ts.case === "menu" ? "var(--dm-nav-case, uppercase)" : ts.case;
    data["data-ts-case"] = "";
  }
  if (ts.tracking) {
    style["--ts-tracking"] = ts.tracking === "menu" ? "var(--dm-nav-tracking, 0.06em)" : `${ts.tracking}em`;
    data["data-ts-tracking"] = "";
  }
  if (ts.italic) data["data-ts-italic"] = "";
  if (ts.color) {
    style["--ts-color"] = ts.color;
    data["data-ts-color"] = "";
  }
  return { style, data };
}

/** The web-font stylesheet a chosen typeface needs, or null (roles are loaded by the site). */
export function textStyleFontHref(ts: TextStyle): string | null {
  return ts.font && !ROLE_FONTS.some((f) => f.value === ts.font) ? googleFontsHref([ts.font]) : null;
}

/** Every typeface's stylesheet — for the editor's font list, drawn in each face. */
export const ALL_FONTS_HREF = googleFontsHref(FONTS.map((f) => f.id));

/** Wraps one block in its text style. `display: contents`, so layout is untouched. */
export function TextStyleWrap({ settings, children }: { settings: unknown; children?: ReactNode }) {
  const ts = cleanTextStyle(settings);
  if (!ts) return <>{children}</>;
  const { style, data } = textStyleAttrs(ts);
  const href = textStyleFontHref(ts);
  return (
    <div className="dm-ts" style={style as CSSProperties} {...data}>
      {/* React 19 hoists a stylesheet <link> with `precedence` into <head>. */}
      {href ? <link rel="stylesheet" href={href} precedence="default" /> : null}
      {children}
    </div>
  );
}
