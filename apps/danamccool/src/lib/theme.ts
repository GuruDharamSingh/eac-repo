// ============================================================================
// The site's palette — the DATA half, and nothing that touches a database.
//
// Split from ./theme-store because the palette editor is a client component
// and imports the roles from here. When this file also held `loadPalette`, the
// import chain ran editor → theme → @elkdonis/db → postgres → `fs`, and the
// page died with "Module not found: Can't resolve 'fs'".
//
// WHAT CHANGED (2026-09-18). The first version of this file wrote only the
// Tailwind kit variables (`--color-white`, `--color-indigo-600`…). Her site
// reads none of them: the ground, the sidebar, the menu and the links are
// drawn from site.css's own `--violet / --ink / --cyan / --orange`. So every
// saved colour changed a few harvested sections and nothing she could see.
//
// Each role now writes HER variable first, then the kit names that should
// follow it, so one choice moves the whole site. Roles that belong to a single
// component (the menu, captions) FOLLOW a site role until they are given a
// value of their own — site.css declares them as `var(--ink)` etc. at :root,
// so an unset one tracks the colour it follows.
//
// The theme is written as an unlayered `:root {}` in a <style> (see
// paletteCss): site.css lives in `@layer base`, so this beats it with no
// specificity trick, and Puck's canvas mirrors <style> elements, so the editor
// shows the same colours.
// ============================================================================

export type RoleGroup = "site" | "menu" | "captions";

export interface PaletteRole {
  key: string;
  label: string;
  hint: string;
  group: RoleGroup;
  /** The CSS variables this role writes — her own first. */
  vars: string[];
  /** Her original value. */
  fallback: string;
  /** Unset, this role takes that role's colour (site.css says so too). */
  follows?: string;
}

export const PALETTE_ROLES: PaletteRole[] = [
  // --- the whole site -------------------------------------------------------
  {
    key: "ground",
    label: "Page ground",
    hint: "The colour every page sits on.",
    group: "site",
    vars: ["--violet", "--color-background", "--color-base-100"],
    fallback: "#795ff0",
  },
  {
    key: "panel",
    label: "Panel",
    hint: "The phone menu drawer and soft panels.",
    group: "site",
    vars: ["--violet-panel"],
    fallback: "#6f54e8",
  },
  {
    key: "ink",
    label: "Text",
    hint: "Headings and running text.",
    group: "site",
    vars: ["--ink", "--color-foreground", "--color-muted-foreground", "--color-base-content"],
    fallback: "#060606",
  },
  {
    key: "link",
    label: "Links & highlight",
    hint: "Links in text, and fills like the Open-editor button.",
    group: "site",
    vars: ["--cyan", "--color-primary", "--color-accent"],
    fallback: "#48d0ed",
  },
  {
    key: "mark",
    label: "Marks",
    hint: "The rule under a heading, the contact mark, “sold”.",
    group: "site",
    vars: ["--orange", "--color-secondary"],
    fallback: "#ef4926",
  },
  // --- the menu -------------------------------------------------------------
  {
    key: "sidebar",
    label: "Menu ground",
    hint: "Behind the logo and the menu.",
    group: "menu",
    vars: ["--dm-sidebar-bg"],
    fallback: "#795ff0",
    follows: "ground",
  },
  {
    key: "navInk",
    label: "Menu links",
    hint: "The menu titles.",
    group: "menu",
    vars: ["--dm-nav-ink"],
    fallback: "#060606",
    follows: "ink",
  },
  {
    key: "navActive",
    label: "Current page",
    hint: "The title of the page you are on.",
    group: "menu",
    vars: ["--dm-nav-active"],
    fallback: "#48d0ed",
    follows: "link",
  },
  {
    key: "navHover",
    label: "Menu, pointed at",
    hint: "A title under the mouse.",
    group: "menu",
    vars: ["--dm-nav-hover"],
    fallback: "#48d0ed",
    follows: "link",
  },
  // --- captions & subtitles -------------------------------------------------
  {
    key: "captionInk",
    label: "Captions & subtitles",
    hint: "Words under a picture, and the line under a heading.",
    group: "captions",
    vars: ["--dm-caption-ink"],
    fallback: "#060606",
    follows: "ink",
  },
];

const BY_KEY = new Map(PALETTE_ROLES.map((r) => [r.key, r]));

export type Palette = Record<string, string>;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Only the declared roles, only real hex. Anything else is dropped. */
export function cleanPalette(raw: unknown): Palette {
  const out: Palette = {};
  if (typeof raw !== "object" || raw === null) return out;
  for (const role of PALETTE_ROLES) {
    const value = (raw as Record<string, unknown>)[role.key];
    if (typeof value === "string" && HEX.test(value)) out[role.key] = value.toLowerCase();
  }
  return out;
}

/** The colour a role actually shows: its own, else the one it follows, else hers. */
export function effectiveColour(palette: Palette, key: string, seen = new Set<string>()): string {
  const own = palette[key];
  if (own && HEX.test(own)) return own;
  const role = BY_KEY.get(key);
  if (!role) return "#000000";
  if (role.follows && !seen.has(key)) {
    seen.add(key);
    return effectiveColour(palette, role.follows, seen);
  }
  return role.fallback;
}

/**
 * Every variable, at its effective value — for a PREVIEW element, not :root.
 *
 * A variable that refers to another (`--dm-nav-ink: var(--ink)`,
 * `--eac-block-fg: var(--ink)`) is resolved where it is declared, which is
 * :root. Setting only `--ink` on a preview <div> would therefore leave the
 * menu and every shared block on the saved colours. So the preview gets the
 * derived ones spelled out too.
 */
export function previewColourVars(palette: Palette): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const role of PALETTE_ROLES) {
    const value = effectiveColour(palette, role.key);
    for (const name of role.vars) vars[name] = value;
  }
  const ground = effectiveColour(palette, "ground");
  const panel = effectiveColour(palette, "panel");
  const ink = effectiveColour(palette, "ink");
  const link = effectiveColour(palette, "link");
  Object.assign(vars, {
    "--eac-block-bg": ground,
    "--eac-block-bg-soft": panel,
    "--eac-block-fg": ink,
    "--eac-block-muted": ink,
    "--eac-block-faint": `color-mix(in srgb, ${ink} 55%, ${ground})`,
    "--eac-block-line": `color-mix(in srgb, ${ink} 28%, ${ground})`,
    "--eac-block-accent": link,
    "--eac-block-on-accent": ink,
    "--eac-block-accent-ink": ink,
    "--eac-block-band": ink,
    "--eac-block-field-fg": ink,
  });
  return vars;
}

/**
 * The palette as CSS, for a <style> element in the document head.
 *
 * Only roles given a value are written; the rest keep site.css's defaults
 * (her colours, or `var(--the-role-it-follows)`).
 */
export function paletteCss(palette: Palette): string {
  const lines: string[] = [];
  for (const role of PALETTE_ROLES) {
    const value = palette[role.key];
    if (!value) continue;
    for (const name of role.vars) lines.push(`${name}:${value}`);
  }
  return lines.length ? `:root{${lines.join(";")}}` : "";
}

// ---------------------------------------------------------------------------
// Contrast — WCAG's formula, not an opinion.
// ---------------------------------------------------------------------------

function channel(v: number) {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function luminance(hex: string) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi! + 0.05) / (lo! + 0.05)) * 100) / 100;
}

/** The pairs her site actually puts together, grouped by where they appear. */
export const CONTRAST_CHECKS: { group: RoleGroup; label: string; fg: string; bg: string; min: number; note?: string }[] = [
  { group: "site", label: "Text on the page", fg: "ink", bg: "ground", min: 4.5 },
  { group: "site", label: "Text on a panel", fg: "ink", bg: "panel", min: 4.5 },
  { group: "site", label: "A link in text", fg: "link", bg: "ground", min: 4.5 },
  { group: "site", label: "Text on a highlight fill", fg: "ink", bg: "link", min: 4.5 },
  { group: "site", label: "Marks on the page", fg: "mark", bg: "ground", min: 3, note: "a mark, not text" },
  { group: "menu", label: "Menu links", fg: "navInk", bg: "sidebar", min: 4.5, note: "small capitals" },
  { group: "menu", label: "Current page", fg: "navActive", bg: "sidebar", min: 4.5 },
  { group: "menu", label: "Pointed at", fg: "navHover", bg: "sidebar", min: 4.5 },
  { group: "menu", label: "Phone drawer links", fg: "navInk", bg: "panel", min: 4.5 },
  { group: "captions", label: "Captions on the page", fg: "captionInk", bg: "ground", min: 4.5 },
];
