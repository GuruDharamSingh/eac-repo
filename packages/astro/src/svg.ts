/**
 * Natal chart → self-contained SVG. Server-only (reads font files).
 *
 * The drawing is svg-core.ts; this module supplies the typesetter that turns
 * every piece of type and every glyph into outlines with opentype.js, so the
 * file carries no font dependency and rasterises identically anywhere, at any
 * size.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as opentype from "opentype.js";
import { GLYPH_CHARS, renderChartSvg, type RenderOptions, type Typesetter } from "./svg-core";
import type { ChartResult } from "./types";

export type { RenderOptions } from "./svg-core";

interface Fonts {
  serif: opentype.Font;
  sans: opentype.Font;
  sym: opentype.Font;
}
let fonts: Fonts | null = null;

/** Same search order as the ephemeris files: env, then dev-friendly relative paths. */
function resolveFontDir(): string {
  const candidates = [
    process.env.ASTRO_FONT_PATH,
    join(__dirname, "../fonts"),
    join(process.cwd(), "../../packages/astro/fonts"),
    join(process.cwd(), "packages/astro/fonts"),
    "/app/packages/astro/fonts",
  ];
  for (const dir of candidates) if (dir && existsSync(join(dir, "Inter.ttf"))) return dir;
  throw new Error("@elkdonis/astro/svg: font directory not found (set ASTRO_FONT_PATH)");
}

function loadFonts(): Fonts {
  if (fonts) return fonts;
  const dir = resolveFontDir();
  const load = (f: string) => opentype.parse(readFileSync(join(dir, f)).buffer.slice(0));
  fonts = { serif: load("EBGaramond.ttf"), sans: load("Inter.ttf"), sym: load("NotoSansSymbols.ttf") };
  return fonts;
}

const f2 = (n: number) => Number(n.toFixed(2));

function outlineTypesetter(): Typesetter {
  const { serif, sans, sym } = loadFonts();
  const fontOf = (role: "serif" | "sans") => (role === "serif" ? serif : sans);
  const measure = (font: opentype.Font, str: string, size: number, tracking = 0) =>
    [...str].reduce((a, ch) => a + font.getAdvanceWidth(ch, size), 0) + tracking * (str.length - 1);
  return {
    text(role, str, x, y, size, opts = {}) {
      const { anchor = "start", fill = "#231e2b", tracking = 0 } = opts;
      const font = fontOf(role);
      const total = measure(font, str, size, tracking);
      let cx = anchor === "middle" ? x - total / 2 : anchor === "end" ? x - total : x;
      const ds: string[] = [];
      for (const ch of str) {
        ds.push(font.getPath(ch, cx, y, size).toPathData(2));
        cx += font.getAdvanceWidth(ch, size) + tracking;
      }
      return `<path d="${ds.join(" ")}" fill="${fill}"/>`;
    },
    measure(role, str, size, tracking) {
      return measure(fontOf(role), str, size, tracking);
    },
    glyph(key, cx, cy, h, fill) {
      // Outlines carry no weight; the variable font's default instance is used.
      const g = sym.charToGlyph(GLYPH_CHARS[key]);
      const p = g.getPath(0, 0, 100);
      const bb = p.getBoundingBox();
      const s = h / (bb.y2 - bb.y1);
      const tx = cx - ((bb.x1 + bb.x2) / 2) * s, ty = cy - ((bb.y1 + bb.y2) / 2) * s;
      return `<path d="${p.toPathData(2)}" fill="${fill}" transform="translate(${f2(tx)} ${f2(ty)}) scale(${f2(s)})"/>`;
    },
  };
}

/** The printable sheet: title, wheel and tables, all type as outlines. */
export function renderNatalSvg(chart: ChartResult, opts: Omit<RenderOptions, "layout"> = {}): string {
  return renderChartSvg(chart, outlineTypesetter(), { ...opts, layout: "sheet" });
}

/** The wheel alone, all type as outlines (for downloads); use @elkdonis/astro/wheel in the browser. */
export function renderWheelSvgOutlined(chart: ChartResult, opts: Omit<RenderOptions, "layout"> = {}): string {
  return renderChartSvg(chart, outlineTypesetter(), { ...opts, layout: "wheel" });
}
