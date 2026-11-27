// A module's colour and its two triadic companions (hue plus and minus 120 degrees in OKLCH), made readable on the dark surfaces.
// Pure functions, no DOM. The companions are lifted to a lightness that keeps text at 4.5:1 or better on the panel and the ground.
const PANEL = "#202226";
const GROUND = "#17181b";

const toLin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const fromLin = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => toLin(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG contrast ratio of two hex colours. */
export function contrast(a: string, b: string): number {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** White or near black, whichever reads better on this background. */
function readable(hex: string): { ink: string } {
  const L = lum(hex);
  return { ink: 1.05 / (L + 0.05) >= (L + 0.05) / (lum("#111111") + 0.05) ? "#ffffff" : "#111111" };
}

function toOklch(hex: string): { L: number; C: number; h: number } {
  const [r, g, b] = hexToRgb(hex).map((v) => toLin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}
/** OKLCH to a hex colour, or null when it falls outside sRGB. */
function fromOklch(L: number, C: number, h: number): string | null {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  if (rgb.some((v) => v < -0.0005 || v > 1.0005)) return null;
  return "#" + rgb.map((v) => Math.round(Math.min(1, Math.max(0, fromLin(v))) * 255).toString(16).padStart(2, "0")).join("");
}
/** The most colourful version of this hue and lightness that fits sRGB, at most `C`. */
function fit(L: number, C: number, h: number): string {
  for (let c = C; c >= 0; c -= 0.004) { const x = fromOklch(L, c, h); if (x) return x; }
  return fromOklch(L, 0, h) ?? "#c8c8c8";
}
/** Lift a hue until it reads on both dark surfaces at `min` contrast (default 4.5:1 for text). */
function readableOnDark(h: number, C: number, L0: number, min = 4.5): string {
  let L = L0, out = fit(L, C, h);
  while (L < 0.97 && (contrast(out, PANEL) < min || contrast(out, GROUND) < min)) { L += 0.02; out = fit(L, C, h); }
  return out;
}

export interface ModuleHues { own: string; two: string; three: string }
/** The module's own colour lifted for text, and its two triadic companions (hue plus and minus 120), all readable on the dark surfaces. */
export function moduleHues(hex: string): ModuleHues {
  const { C, h } = toOklch(hex);
  const base = C < 0.025 ? 255 : h;            // a grey has no hue to turn: start from a calm blue
  const chroma = Math.min(0.15, Math.max(0.1, C * 1.5));
  return {
    own: readableOnDark(base, chroma, 0.76),
    two: readableOnDark((base + 120) % 360, chroma, 0.76),
    three: readableOnDark((base + 240) % 360, chroma, 0.76),
  };
}

/** The CSS variables a module's pane (and its part of the sheet) carries. */
export function moduleVars(hex: string): Record<string, string> {
  const { ink } = readable(hex);
  const t = moduleHues(hex);
  return {
    "--ws-module": hex, "--ws-module-ink": ink,
    "--ws-module-t": t.own, "--ws-module-2": t.two, "--ws-module-3": t.three,
    "--ws-module-2-ink": readable(t.two).ink, "--ws-module-3-ink": readable(t.three).ink,
  };
}
