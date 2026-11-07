// ============================================================================
// The shared font library (2026-11-01): every face an EAC page may name.
//
// A closed list, like danamccool's original (apps/danamccool/src/lib/fonts.ts):
// each entry is a known family with its real weights and italics, so a page
// can never ask for a face that silently falls back. ~500 curated Google
// families (catalogue.ts, generated) plus the system faces every machine has.
//
// Pure data, no DOM: servers validate stored font names against this list,
// editors list it in pickers, pages build their stylesheet URL from it.
// A group-curated table (proposals, uploads, approvals) is planned on top of
// this (docs/open/DIRECT_EDITING_PANEL_PLAN_2026-11-01.md, Phase 3); until
// then the list grows by editing scripts/build-catalogue.mjs.
// ============================================================================

import { GOOGLE_ROWS } from "./catalogue";

export type FontCategory = "serif" | "sans" | "display" | "mono" | "script" | "blackletter";
export type FontSource = "google" | "system";

export interface FontEntry {
  family: string;
  category: FontCategory;
  /** Upright weights the family has, ascending. */
  weights: number[];
  /** Weights that also come in italic. */
  italics: number[];
  source: FontSource;
  /** A full CSS font-family value, when the family name alone is not one. */
  stack?: string;
}

export const FONT_CATEGORIES: ReadonlyArray<{ id: FontCategory; label: string }> = [
  { id: "serif", label: "Serif" },
  { id: "sans", label: "Sans serif" },
  { id: "display", label: "Display" },
  { id: "script", label: "Script and handwriting" },
  { id: "blackletter", label: "Blackletter" },
  { id: "mono", label: "Monospace" },
];

const nums = (s: string) => (s ? s.split(",").map(Number) : []);

const SYSTEM: FontEntry[] = [
  { family: "Georgia", category: "serif", weights: [400, 700], italics: [400, 700], source: "system" },
  { family: "Times New Roman", category: "serif", weights: [400, 700], italics: [400, 700], source: "system" },
  { family: "Arial", category: "sans", weights: [400, 700], italics: [400, 700], source: "system" },
  { family: "Helvetica Neue", category: "sans", weights: [300, 400, 500, 700], italics: [400, 700], source: "system", stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { family: "Verdana", category: "sans", weights: [400, 700], italics: [400, 700], source: "system" },
  { family: "Trebuchet MS", category: "sans", weights: [400, 700], italics: [400, 700], source: "system" },
  { family: "System UI", category: "sans", weights: [300, 400, 500, 600, 700], italics: [400], source: "system", stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { family: "Courier New", category: "mono", weights: [400, 700], italics: [400, 700], source: "system" },
];

export const FONT_LIBRARY: readonly FontEntry[] = [
  ...SYSTEM,
  ...GOOGLE_ROWS.map(([family, category, w, i]) => ({ family, category: category as FontCategory, weights: nums(w), italics: nums(i), source: "google" as const })),
];

const BY_FAMILY = new Map(FONT_LIBRARY.map((f) => [f.family, f]));

export function fontEntry(family: unknown): FontEntry | null {
  return typeof family === "string" ? (BY_FAMILY.get(family) ?? null) : null;
}
export const isKnownFont = (family: unknown): family is string => fontEntry(family) !== null;

/** Library entries of one category, in catalogue (popularity) order. */
export function fontsIn(category: FontCategory): FontEntry[] {
  return FONT_LIBRARY.filter((f) => f.category === category);
}

const FALLBACK: Record<FontCategory, string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: '"Helvetica Neue", Arial, sans-serif',
  display: "Georgia, serif",
  script: "cursive",
  blackletter: "Georgia, serif",
  mono: "ui-monospace, Menlo, Consolas, monospace",
};

/**
 * The full CSS font-family value for a family: the face, then fallbacks of
 * the same kind. Double quotes, so the value is safe inside a single-quoted
 * attribute and storable as a theme variable (themes.ts VALUE_RE).
 */
export function fontStack(family: string): string {
  const e = fontEntry(family);
  if (e?.stack) return e.stack;
  const name = family.replace(/["'\\;{}<>]/g, "");
  const fb = FALLBACK[e?.category ?? (/mono|courier|code/i.test(name) ? "mono" : "serif")];
  return `"${name}", ${fb}`;
}

/** The family's weight nearest to `w` (what the browser would pick). */
export function nearestWeight(family: string, w: number): number {
  const e = fontEntry(family);
  if (!e || !e.weights.length) return w;
  return e.weights.reduce((best, x) => (Math.abs(x - w) < Math.abs(best - w) ? x : best), e.weights[0]!);
}
