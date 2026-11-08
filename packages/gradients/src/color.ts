// ============================================================================
// Colour maths for gradients, on culori (MIT, culorijs.org).
//
// Why OKLCH: interpolating in sRGB (what CSS does by default) sends a blue to
// orange ramp through grey mud, and a gold to purple ramp through brown. OKLab
// keeps perceived lightness even and OKLCH walks the hue wheel, which is how
// the EAC logo ramps read (turquoise -> green -> gold -> orange -> red). The
// CSS this package writes is plain hex stops, densified in OKLCH here, so it
// looks the same in every browser and passes the editors' CSS allowlists
// (no `in oklch`, no colour functions).
//
// culori/fn is the tree-shakable entry: only the modes registered below are
// bundled. Out-of-gamut colours are mapped with CSS Color 4's algorithm
// (`toGamut`), which keeps lightness and hue and gives up chroma.
//
// Pure: no DOM, no React. Safe on the server and in workers.
// ============================================================================

import {
  useMode, modeRgb, modeLrgb, modeHsl, modeOklab, modeOklch,
  converter, formatHex, interpolate, parse, toGamut, wcagContrast, fixupHueShorter, fixupHueLonger,
  type Color, type Oklab, type Oklch,
} from "culori/fn";

useMode(modeRgb);
useMode(modeLrgb);
useMode(modeHsl); // parsing only: colour pickers may hand back hsl()
useMode(modeOklab);
useMode(modeOklch);

const toRgb = converter("rgb");
const toLrgb = converter("lrgb");
const toOklab = converter("oklab");
const toOklch = converter("oklch");
const intoGamut = toGamut("rgb", "oklch");

export type RGB = [number, number, number]; // 0..1 sRGB (gamma-encoded)
export type Lab = [number, number, number]; // OKLab L 0..1, a, b
export type LCH = [number, number, number]; // OKLCH L 0..1, C, H degrees

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v.trim());
}

const hexOf = (c: Color) => formatHex(intoGamut(c)).toUpperCase();

function parseHex(hex: string): Color {
  const m = HEX_RE.exec(hex.trim());
  let s = m ? m[1] : "000000";
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
  return { mode: "rgb", r, g, b };
}

export function hexToRgb(hex: string): RGB {
  const c = toRgb(parseHex(hex));
  return [c.r, c.g, c.b];
}

export function rgbToHex([r, g, b]: RGB): string {
  return hexOf({ mode: "rgb", r, g, b });
}

/** Any CSS colour culori can parse (hex, rgb(), hsl()...) as #RRGGBB; null when it can't. */
export function cssColorToHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (HEX_RE.test(v.trim())) return normHex(v);
  const c = parse(v.trim());
  return c ? hexOf(c) : null;
}

/** Normalised #RRGGBB, or null for anything that is not a hex colour. */
export function normHex(v: unknown): string | null {
  return isHex(v) ? hexOf(parseHex(v)) : null;
}

export function rgbToLinear(rgb: RGB): RGB {
  const c = toLrgb({ mode: "rgb", r: rgb[0], g: rgb[1], b: rgb[2] });
  return [c.r, c.g, c.b];
}
export function linearToRgb(lin: RGB): RGB {
  const c = toRgb({ mode: "lrgb", r: lin[0], g: lin[1], b: lin[2] });
  return [c.r, c.g, c.b];
}

export function hexToOklab(hex: string): Lab {
  const c = toOklab(parseHex(hex));
  return [c.l, c.a, c.b];
}
export function hexToOklch(hex: string): LCH {
  const c = toOklch(parseHex(hex));
  return [c.l, c.c, Number.isFinite(c.h) ? (c.h as number) : 0];
}

export const labToLch = ([L, a, b]: Lab): LCH => {
  const c = toOklch({ mode: "oklab", l: L, a, b });
  return [c.l, c.c, Number.isFinite(c.h) ? (c.h as number) : 0];
};
export const lchToLab = ([L, C, H]: LCH): Lab => {
  const c = toOklab({ mode: "oklch", l: L, c: C, h: H });
  return [c.l, c.a, c.b];
};

/** OKLCH to hex, mapped into sRGB by CSS Color 4 gamut mapping (chroma gives way). */
export function oklchToHex([L, C, H]: LCH): string {
  return hexOf({ mode: "oklch", l: Math.min(1, Math.max(0, L)), c: Math.max(0, C), h: H } as Oklch);
}
export const oklabToHex = ([l, a, b]: Lab): string => hexOf({ mode: "oklab", l, a, b } as Oklab);

export type MixSpace = "oklch" | "oklab" | "srgb";
export type HueDirection = "shorter" | "longer";

/** Colour at t (0..1) between a and b, in the given space. */
export function mix(a: string, b: string, t: number, space: MixSpace = "oklch", hue: HueDirection = "shorter"): string {
  if (t <= 0) return normHex(a) ?? "#000000";
  if (t >= 1) return normHex(b) ?? "#000000";
  const A = parseHex(a), B = parseHex(b);
  if (space === "srgb") return hexOf(interpolate([A, B], "rgb")(t));
  if (space === "oklab") return hexOf(interpolate([A, B], "oklab")(t));
  // A near-grey end (bone, soot: chroma < 0.02) gets no hue, so culori takes the other
  // end's and bone -> lapis doesn't swing through red. culori only does this for exact greys.
  const grey = (c: Oklch): Oklch => (c.c < 0.02 ? { ...c, h: undefined } : c);
  // culori reads overrides.h.fixup at runtime (src/interpolate/interpolate.js); @types/culori 4.0.1 omits it
  const overrides = { h: { fixup: hue === "longer" ? fixupHueLonger : fixupHueShorter } } as unknown as Parameters<typeof interpolate>[2];
  const f = interpolate([grey(toOklch(A)), grey(toOklch(B))], "oklch", overrides);
  return hexOf(f(t));
}

/** Scale chroma by (1 - amount) in OKLCH: 0 = unchanged, 1 = grey. The tsakli mute is about 0.48. */
export function mute(hex: string, amount: number): string {
  const [L, C, H] = hexToOklch(hex);
  return oklchToHex([L, C * (1 - Math.min(1, Math.max(0, amount))), H]);
}

/** Shift lightness by delta (OKLab L units, -1..1). */
export function lighten(hex: string, delta: number): string {
  const [L, C, H] = hexToOklch(hex);
  return oklchToHex([L + delta, C, H]);
}

export function luminance(hex: string): number {
  const c = toLrgb(parseHex(hex));
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/** WCAG 2 contrast ratio, 1..21. */
export function contrast(a: string, b: string): number {
  return wcagContrast(parseHex(a), parseHex(b));
}
