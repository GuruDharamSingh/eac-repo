/**
 * The dials: ten axes, each 0–10, that shape how a stretch of the section
 * is generated. Every keyframe carries a preset (catalog.ts), the field
 * blends the presets of the keyframes in play at a spot, and the reader's
 * own dials (HUD panel, or `d=` in the URL hash) then push each axis up or
 * down from there. Nothing reads a dial directly: style.ts and plane.ts
 * turn them into sizes, probabilities and shares.
 *
 *   density        0 = large type, few boxes       10 = agate, every column full
 *   breaks         0 = one column grid per tile    10 = bands of different column counts, often
 *   heterogeneity  0 = every box the theme's voice 10 = every box its own voice
 *   colour         0 = black and white             10 = tints, accents, coloured heads everywhere
 *   fontMix        0 = one body and one head face  10 = faces change box by box
 *   borders        0 = hairlines and rules only    10 = every box boxed, heavy, double, dashed
 *   headers        0 = few heads, plain            10 = a head over every run, reversed, cascading down the column
 *   scale          0 = small boxes, no wide units  10 = big displays spanning columns, white space inside them
 *   structures     0 = no banners or patterns      10 = banners, strips and ribbons often
 *   editorial      0 = classifieds only            10 = articles, weather and listings mixed in freely
 */
export type DialKey = "density" | "breaks" | "heterogeneity" | "colour" | "fontMix" | "borders" | "headers" | "scale" | "structures" | "editorial";
export type Dials = Record<DialKey, number>;

export const DIAL_KEYS: DialKey[] = ["density", "breaks", "heterogeneity", "colour", "fontMix", "borders", "headers", "scale", "structures", "editorial"];

export const DIAL_LABELS: Record<DialKey, [string, string]> = {
  density: ["airy", "agate"],
  breaks: ["one grid", "broken columns"],
  heterogeneity: ["conforming", "every box its own"],
  colour: ["mono", "colour"],
  fontMix: ["one face", "many faces"],
  borders: ["rules", "boxes"],
  headers: ["few heads", "cascading heads"],
  scale: ["small", "big displays"],
  structures: ["plain", "banners & patterns"],
  editorial: ["ads only", "newspaper"],
};

/** The neutral reader setting: no push on any axis. */
export const NEUTRAL: Dials = { density: 5, breaks: 5, heterogeneity: 5, colour: 5, fontMix: 5, borders: 5, headers: 5, scale: 5, structures: 5, editorial: 5 };

export function clampDial(v: number): number {
  return Math.max(0, Math.min(10, v));
}

/** Blend presets by weight. */
export function blendDials(entries: Array<[Dials, number]>): Dials {
  const out = { ...NEUTRAL };
  let total = 0;
  for (const [, w] of entries) total += w;
  for (const k of DIAL_KEYS) {
    let acc = 0;
    for (const [d, w] of entries) acc += d[k] * w;
    out[k] = total ? acc / total : 5;
  }
  return out;
}

/** Apply the reader's dials as a push around 5: each point moves the blended value 0.6 towards that end. */
export function pushDials(base: Dials, reader: Dials): Dials {
  const out = { ...base };
  for (const k of DIAL_KEYS) out[k] = clampDial(base[k] + (reader[k] - 5) * 0.6);
  return out;
}

/** 0–10 → 0–1. */
export const unitOf = (v: number): number => clampDial(v) / 10;

export function encodeDials(d: Dials): string {
  return DIAL_KEYS.map((k) => Math.round(clampDial(d[k])).toString()).join("").replace(/10/g, "X");
}
export function decodeDials(s: string | null | undefined): Dials | null {
  if (!s) return null;
  const chars = s.replace(/X/g, "A").split("");
  if (chars.length !== DIAL_KEYS.length) return null;
  const out = { ...NEUTRAL };
  DIAL_KEYS.forEach((k, i) => {
    out[k] = chars[i] === "A" ? 10 : Number(chars[i]);
    if (!Number.isFinite(out[k])) out[k] = 5;
  });
  return out;
}
