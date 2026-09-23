// ============================================================================
// Fonts — the choices, and the CSS they become. Client-safe (no database).
//
// A CLOSED list rather than a free text box: every choice here is a complete
// stack with sensible fallbacks, and the web fonts among them are known to
// load. A typed "Futura" would silently fall back to whatever the visitor's
// machine had.
//
// Each choice is a CSS variable the whole site reads:
//
//   --dm-font-body      running text, and the blocks' body text
//   --dm-font-heading   page titles, block headings, the diamond's name
//   --dm-font-nav       the sidebar menu
//   --dm-nav-weight / --dm-nav-size / --dm-nav-case / --dm-nav-tracking
//                       how the menu titles are set
//   --dm-font-caption   words under pictures, and subtitles under headings
//   --dm-caption-size / --dm-caption-style
//   --dm-font-reading   the blog's reading face
//
// The site sets them in /studio/theme; a page can override body and heading
// for itself in its Page settings in the editor.
// ============================================================================

export interface FontChoice {
  id: string;
  label: string;
  /** The full CSS font-family value. */
  stack: string;
  /** Google Fonts family spec, when it is a web font. */
  google?: string;
  kind: "sans" | "serif" | "display" | "mono";
}

export const FONTS: FontChoice[] = [
  {
    id: "helvetica",
    label: "Helvetica / system (the site's original)",
    stack: '"Helvetica Neue", "Segoe UI", Arial, -apple-system, BlinkMacSystemFont, sans-serif',
    kind: "sans",
  },
  { id: "lato", label: "Lato (as her Format site)", stack: '"Lato", "Helvetica Neue", Arial, sans-serif', google: "Lato:ital,wght@0,300;0,400;0,700;1,400", kind: "sans" },
  { id: "josefin", label: "Josefin Sans", stack: '"Josefin Sans", "Helvetica Neue", Arial, sans-serif', google: "Josefin+Sans:wght@300;400;600;700", kind: "sans" },
  { id: "montserrat", label: "Montserrat", stack: '"Montserrat", "Helvetica Neue", Arial, sans-serif', google: "Montserrat:wght@300;400;600;700", kind: "sans" },
  { id: "raleway", label: "Raleway", stack: '"Raleway", "Helvetica Neue", Arial, sans-serif', google: "Raleway:wght@300;400;600;700", kind: "sans" },
  { id: "cormorant", label: "Cormorant Garamond", stack: '"Cormorant Garamond", Garamond, Georgia, serif', google: "Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400", kind: "serif" },
  { id: "garamond", label: "EB Garamond", stack: '"EB Garamond", Garamond, Georgia, serif', google: "EB+Garamond:ital,wght@0,400;0,600;1,400", kind: "serif" },
  { id: "spectral", label: "Spectral", stack: '"Spectral", Georgia, serif', google: "Spectral:ital,wght@0,300;0,400;0,600;1,400", kind: "serif" },
  { id: "playfair", label: "Playfair Display", stack: '"Playfair Display", Georgia, serif', google: "Playfair+Display:ital,wght@0,400;0,600;0,700;1,400", kind: "display" },
  { id: "cinzel", label: "Cinzel (inscribed capitals)", stack: '"Cinzel", "Trajan Pro", Georgia, serif', google: "Cinzel:wght@400;600;700", kind: "display" },
  { id: "fell", label: "IM Fell English (old print)", stack: '"IM Fell English", Georgia, serif', google: "IM+Fell+English:ital@0;1", kind: "display" },
  { id: "georgia", label: "Georgia", stack: "Georgia, \"Times New Roman\", serif", kind: "serif" },
  { id: "mono", label: "Space Mono", stack: '"Space Mono", ui-monospace, Menlo, monospace', google: "Space+Mono:ital,wght@0,400;0,700;1,400", kind: "mono" },
];

const BY_ID = new Map(FONTS.map((f) => [f.id, f]));

export function font(id: unknown): FontChoice | null {
  return typeof id === "string" ? (BY_ID.get(id) ?? null) : null;
}

export interface SiteFonts {
  body?: string;
  heading?: string;
  nav?: string;
  caption?: string;
  reading?: string;
  /** 300–700. */
  navWeight?: number;
  /** rem. */
  navSize?: number;
  navCase?: "uppercase" | "none" | "capitalize";
  /** em. */
  navTracking?: number;
  /** rem. */
  captionSize?: number;
  captionStyle?: "normal" | "italic";
}

export const FONT_ROLES = ["body", "heading", "nav", "caption", "reading"] as const;

/** Her originals — what an unset choice means. site.css holds the same values. */
export const TYPE_DEFAULTS = {
  navWeight: 500,
  navSize: 0.72,
  navCase: "uppercase",
  navTracking: 0.06,
  captionSize: 0.875,
  captionStyle: "normal",
} as const;

export const NAV_SIZES = [
  { value: 0.66, label: "Small" },
  { value: 0.72, label: "Her original" },
  { value: 0.8, label: "Medium" },
  { value: 0.9, label: "Large" },
  { value: 1, label: "Larger" },
] as const;

export const NAV_CASES = [
  { value: "uppercase", label: "CAPITALS" },
  { value: "capitalize", label: "Title Case" },
  { value: "none", label: "As typed" },
] as const;

export const NAV_TRACKINGS = [
  { value: 0, label: "None" },
  { value: 0.03, label: "A little" },
  { value: 0.06, label: "Her original" },
  { value: 0.12, label: "Wide" },
  { value: 0.2, label: "Very wide" },
] as const;

export const CAPTION_SIZES = [
  { value: 0.75, label: "Small" },
  { value: 0.8, label: "Smaller" },
  { value: 0.875, label: "Her original" },
  { value: 0.95, label: "Near body size" },
  { value: 1, label: "Body size" },
] as const;

export const CAPTION_STYLES = [
  { value: "normal", label: "Upright" },
  { value: "italic", label: "Italic" },
] as const;

export const NAV_WEIGHTS = [
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semi-bold" },
  { value: 700, label: "Bold" },
] as const;

/** Only known ids and weights survive — the stored value is never trusted. */
export function cleanFonts(raw: unknown): SiteFonts {
  const out: SiteFonts = {};
  if (typeof raw !== "object" || raw === null) return out;
  const r = raw as Record<string, unknown>;
  for (const role of FONT_ROLES) {
    if (font(r[role])) out[role] = r[role] as string;
  }
  const w = Number(r.navWeight);
  if (NAV_WEIGHTS.some((x) => x.value === w)) out.navWeight = w;
  const ns = Number(r.navSize);
  if (NAV_SIZES.some((x) => x.value === ns)) out.navSize = ns;
  if (NAV_CASES.some((x) => x.value === r.navCase)) out.navCase = r.navCase as SiteFonts["navCase"];
  const nt = Number(r.navTracking);
  if (r.navTracking !== undefined && NAV_TRACKINGS.some((x) => x.value === nt)) out.navTracking = nt;
  const cs = Number(r.captionSize);
  if (CAPTION_SIZES.some((x) => x.value === cs)) out.captionSize = cs;
  if (CAPTION_STYLES.some((x) => x.value === r.captionStyle)) out.captionStyle = r.captionStyle as SiteFonts["captionStyle"];
  return out;
}

/** The CSS custom properties for a set of choices (unset roles are omitted). */
export function fontVars(f: SiteFonts): Record<string, string> {
  const vars: Record<string, string> = {};
  const body = font(f.body);
  const heading = font(f.heading);
  const nav = font(f.nav);
  const caption = font(f.caption);
  const reading = font(f.reading);
  if (body) vars["--dm-font-body"] = body.stack;
  if (heading) vars["--dm-font-heading"] = heading.stack;
  if (nav) vars["--dm-font-nav"] = nav.stack;
  if (caption) vars["--dm-font-caption"] = caption.stack;
  if (reading) vars["--dm-font-reading"] = reading.stack;
  if (f.navWeight) vars["--dm-nav-weight"] = String(f.navWeight);
  if (f.navSize) vars["--dm-nav-size"] = `${f.navSize}rem`;
  if (f.navCase) vars["--dm-nav-case"] = f.navCase;
  if (f.navTracking !== undefined) vars["--dm-nav-tracking"] = `${f.navTracking}em`;
  if (f.captionSize) vars["--dm-caption-size"] = `${f.captionSize}rem`;
  if (f.captionStyle) vars["--dm-caption-style"] = f.captionStyle;
  return vars;
}

/**
 * Every font variable at its effective value, derived ones included — for a
 * PREVIEW element rather than :root. Same reason as previewColourVars: a
 * variable that refers to another is resolved at :root, so a preview <div>
 * has to spell out `--dm-font-nav` even when the menu just follows the body.
 */
export function previewFontVars(f: SiteFonts): Record<string, string> {
  const original = FONTS[0]!.stack;
  const body = font(f.body)?.stack ?? original;
  const heading = font(f.heading)?.stack ?? body;
  return {
    "--dm-font-body": body,
    "--dm-font-heading": heading,
    "--dm-font-nav": font(f.nav)?.stack ?? body,
    "--dm-font-caption": font(f.caption)?.stack ?? body,
    "--dm-font-reading": font(f.reading)?.stack ?? '"EB Garamond", Garamond, Georgia, serif',
    "--dm-nav-weight": String(f.navWeight ?? TYPE_DEFAULTS.navWeight),
    "--dm-nav-size": `${f.navSize ?? TYPE_DEFAULTS.navSize}rem`,
    "--dm-nav-case": f.navCase ?? TYPE_DEFAULTS.navCase,
    "--dm-nav-tracking": `${f.navTracking ?? TYPE_DEFAULTS.navTracking}em`,
    // Caption size and style only when chosen: unset, each caption keeps its
    // own (a hero's subtitle is italic and larger; a figure caption is not).
    ...(f.captionSize ? { "--dm-caption-size": `${f.captionSize}rem` } : {}),
    ...(f.captionStyle ? { "--dm-caption-style": f.captionStyle } : {}),
    "--eac-block-font-body": body,
    "--eac-block-font-title": heading,
    "--font-sans": body,
    "--font-serif": heading,
  };
}

/** Every web font a set of choices needs. */
export function fontsHrefFor(f: SiteFonts): string | null {
  return googleFontsHref(FONT_ROLES.map((r) => f[r]));
}

export function fontCss(f: SiteFonts): string {
  const vars = fontVars(f);
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return body ? `:root {\n${body}\n}` : "";
}

/** One Google Fonts stylesheet for every web font in use, or null. */
export function googleFontsHref(ids: Array<string | undefined>): string | null {
  const families = [...new Set(ids.map((id) => font(id)?.google).filter((g): g is string => !!g))];
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f}`).join("&")}&display=swap`;
}

/**
 * A page's own fonts, as an inline style for the element wrapping the page.
 *
 * Redeclares the DERIVED tokens as well: a custom property that refers to
 * another (`--eac-block-font-title: var(--dm-font-heading)`) is resolved where
 * it is declared — :root — and inherited as that resolved value, so changing
 * only --dm-font-heading on a wrapper would leave every shared block on the
 * site's font.
 */
export function pageFontStyle(f: { body?: string; heading?: string }): Record<string, string> | null {
  const body = font(f.body);
  const heading = font(f.heading);
  if (!body && !heading) return null;
  const style: Record<string, string> = {};
  if (body) {
    style["--dm-font-body"] = body.stack;
    style["--eac-block-font-body"] = body.stack;
    style["--font-sans"] = body.stack;
  }
  // Only when chosen: a page that changes its body text keeps the site's
  // heading face, which is already resolved and inherited from :root.
  if (heading) {
    style["--dm-font-heading"] = heading.stack;
    style["--eac-block-font-title"] = heading.stack;
    style["--font-serif"] = heading.stack;
  }
  return style;
}
