/**
 * Client-safe chart wheel: the same drawing as `@elkdonis/astro/svg`, with
 * type set as ordinary <text> in the fonts the page loads (Cinzel, Inter,
 * Noto Sans Symbols via CSS variables), so the SVG is small enough to redraw
 * many times a second and needs no font files. Inline it in HTML — the font
 * variables resolve from the page's CSS.
 */

import { GLYPH_CHARS, renderChartSvg, type RenderOptions, type Typesetter } from "./svg-core";
import type { ChartResult } from "./types";

const FONT_STACK = {
  serif: "var(--font-cinzel), 'EB Garamond', Georgia, serif",
  sans: "var(--font-inter), Inter, system-ui, sans-serif",
  glyph: "var(--font-symbols), 'Noto Sans Symbols', 'Segoe UI Symbol', 'Apple Symbols', 'DejaVu Sans', sans-serif",
};

/**
 * Font size per unit of glyph height, measured from Noto Sans Symbols
 * (fonts/NotoSansSymbols.ttf): 100 / the glyph's bounding-box height at
 * font-size 100. The outline typesetter normalises every glyph to the same
 * height from its real outline; this table lets the browser version do the
 * same, so Aquarius (a wide, short glyph) and Mars (tall) come out the same
 * size instead of Aquarius reading as half the height of its neighbours.
 */
const GLYPH_SCALE: Record<string, number> = {
  aries: 1.379, taurus: 1.321, gemini: 1.203, cancer: 1.401, leo: 1.068, virgo: 1.086,
  libra: 1.437, scorpio: 1.105, sagittarius: 1.458, capricorn: 1.104, aquarius: 1.976, pisces: 1.33,
  moon: 1.441, mercury: 1.23, venus: 1.527, mars: 1.873, jupiter: 1.416, saturn: 1.316,
  uranus: 1.379, neptune: 1.321, pluto: 1.401,
  conjunction: 1.603, opposition: 1.538, sextile: 2.045, quincunx: 2.273, semisextile: 2.273,
  semisquare: 1.401, sesquisquare: 1.133,
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f2 = (n: number) => Number(n.toFixed(2));

export const textTypesetter: Typesetter = {
  text(font, str, x, y, size, opts = {}) {
    const { anchor = "start", fill = "#231e2b", tracking = 0 } = opts;
    const weight = opts.weight ?? (font === "serif" ? 600 : 500);
    return `<text x="${f2(x)}" y="${f2(y)}" font-size="${f2(size)}" font-family="${FONT_STACK[font]}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${tracking ? ` letter-spacing="${f2(tracking)}"` : ""}>${esc(str)}</text>`;
  },
  // Average advance widths of Inter / Cinzel at these sizes; only used to lay
  // a degree label and its sign glyph side by side.
  measure(font, str, size, tracking = 0) {
    return str.length * size * (font === "serif" ? 0.62 : 0.56) + tracking * (str.length - 1);
  },
  glyph(key, cx, cy, h, fill, weight) {
    const ch = GLYPH_CHARS[key];
    if (!ch) return "";
    const size = h * (GLYPH_SCALE[key] ?? 1.3);
    // U+FE0E asks for the text presentation: several zodiac code points are emoji by default.
    return `<text x="${f2(cx)}" y="${f2(cy)}" font-size="${f2(size)}" font-family="${FONT_STACK.glyph}" font-weight="${weight ?? 400}" fill="${fill}" text-anchor="middle" dominant-baseline="central">${ch}︎</text>`;
  },
};

export type WheelOptions = Pick<
  RenderOptions,
  "variant" | "minorAspects" | "rootAttrs" | "background" | "transits"
>;

/** The round chart alone, as a string of SVG. */
export function renderWheelSvg(chart: ChartResult, opts: WheelOptions = {}): string {
  return renderChartSvg(chart, textTypesetter, { layout: "wheel", ...opts });
}
