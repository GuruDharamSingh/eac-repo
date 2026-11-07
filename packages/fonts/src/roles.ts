// ============================================================================
// Font roles and the CSS variables they become: danamccool's pattern
// (apps/danamccool/src/lib/fonts.ts: FontChoice, FONT_ROLES, fontVars) made
// general over the shared library. A site picks a family per role; each role
// is one CSS custom property the site's CSS reads. danamccool keeps its own
// file for now (its ids are stored in site_config `theme:fonts`).
// ============================================================================

import { fontEntry, fontStack, type FontCategory } from "./library";
import { googleFontsHref } from "./google";

/** One choice offered to a site: a library family, or a fixed stack. */
export interface FontChoice {
  id: string;
  label: string;
  /** The full CSS font-family value. */
  stack: string;
  /** The library family, when the choice is a web font from the library. */
  family?: string;
  kind: FontCategory;
}

/** A choice for any library family (null for unknown names). */
export function choiceFor(family: string, label?: string): FontChoice | null {
  const e = fontEntry(family);
  if (!e) return null;
  return { id: family.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label: label ?? family, stack: fontStack(family), family, kind: e.category };
}

export const FONT_ROLES = ["body", "heading", "nav", "caption", "reading"] as const;
export type FontRole = (typeof FONT_ROLES)[number];
/** Library family names per role. */
export type RoleFonts = Partial<Record<FontRole, string>>;

/** Keep only roles naming a known family (stored values are never trusted). */
export function cleanRoleFonts(raw: unknown): RoleFonts {
  const out: RoleFonts = {};
  if (!raw || typeof raw !== "object") return out;
  for (const role of FONT_ROLES) {
    const v = (raw as Record<string, unknown>)[role];
    if (fontEntry(v)) out[role] = v as string;
  }
  return out;
}

/**
 * CSS custom properties for a set of role choices: `${prefix}${role}` → stack.
 * Unset roles are omitted. The block library reads heading and body through
 * `--eac-block-font-title` / `--eac-block-font-body` (blocks.css), so those
 * are set too, unless `blocks: false`.
 */
export function fontVars(fonts: RoleFonts, prefix = "--font-", opts: { blocks?: boolean } = {}): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const role of FONT_ROLES) {
    const f = fonts[role];
    if (f && fontEntry(f)) vars[`${prefix}${role}`] = fontStack(f);
  }
  if (opts.blocks !== false) Object.assign(vars, blockFontVars({ title: fonts.heading, body: fonts.body }));
  return vars;
}

/** The two hooks every shared block reads (blocks.css :104). */
export function blockFontVars(f: { title?: string; body?: string }): Record<string, string> {
  const vars: Record<string, string> = {};
  if (f.title && fontEntry(f.title)) vars["--eac-block-font-title"] = fontStack(f.title);
  if (f.body && fontEntry(f.body)) vars["--eac-block-font-body"] = fontStack(f.body);
  return vars;
}

/** `:root { … }` for a set of variables ("" when empty). */
export function fontCss(vars: Record<string, string>, selector = ":root"): string {
  const body = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n");
  return body ? `${selector} {\n${body}\n}` : "";
}

/** One stylesheet URL for every web font a set of role choices needs. */
export function roleFontsHref(fonts: RoleFonts): string | null {
  return googleFontsHref(FONT_ROLES.map((r) => fonts[r]));
}
