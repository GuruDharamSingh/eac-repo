// ============================================================================
// Generators: the algorithms behind the sliders.
//
//   ramp()       stops -> many hex stops, interpolated in OKLCH/OKLab with an
//                easing, so a plain CSS gradient renders the perceptual ramp
//   harmony()    one colour -> a palette (analogous, complementary, triad,
//                split, tetrad, shades, elements)
//   generate()   a seed + a pigment set -> a fresh muted spec, like the logos
//   meshBlobs()  seeded blob layout for the mesh kind (and the shader)
//
// Deterministic: the same spec always yields the same CSS (server and browser
// render identical markup; no hydration drift).
// ============================================================================

import { hexToOklch, mix, mute as muteHex, lighten, oklchToHex } from "./color";
import { LOGO_INK } from "./palettes";
import { DEFAULT_GRADIENT, stopsFrom, type GradientSpec, type GradientStop } from "./spec";

/** mulberry32: small, fast, seedable. */
export function rng(seed: number): () => number {
  let a = (seed >>> 0) + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EASE = {
  linear: (t: number) => t,
  smooth: (t: number) => t * t * (3 - 2 * t),
  in: (t: number) => t * t,
  out: (t: number) => 1 - (1 - t) * (1 - t),
} as const;

/** Stops after mute and lightness: what every renderer starts from. */
export function adjustedStops(spec: GradientSpec): GradientStop[] {
  return spec.stops.map((s) => {
    let c = s.color;
    if (spec.mute) c = muteHex(c, spec.mute / 100);
    if (spec.light) c = lighten(c, spec.light / 100);
    return { color: c, at: s.at };
  });
}

/**
 * The densified ramp: between each pair of stops, `per` samples in the spec's
 * space and easing. Softness pulls each transition toward its midpoint
 * (100 = full blend across the gap, 0 = a hard edge). Steps makes flat bands.
 */
export function ramp(spec: GradientSpec, per = 6): GradientStop[] {
  const stops = adjustedStops(spec);
  if (spec.ease === "steps" || spec.kind === "bands") return bands(stops, spec);
  const out: GradientStop[] = [];
  const soft = spec.softness / 100;
  const ease = EASE[spec.ease as keyof typeof EASE] ?? EASE.smooth;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    const gap = b.at - a.at;
    const half = (gap * (1 - soft)) / 2; // the flat part held at each end
    out.push({ color: a.color, at: a.at });
    if (half > 0) out.push({ color: a.color, at: a.at + half });
    const from = a.at + half, to = b.at - half;
    const n = gap > 0 && soft > 0 ? per : 0;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      out.push({ color: mix(a.color, b.color, ease(t), spec.space, spec.hue), at: from + (to - from) * t });
    }
    if (half > 0) out.push({ color: b.color, at: b.at - half });
  }
  out.push(stops[stops.length - 1]);
  return dedupe(out);
}

/** Flat bands sampled along the ramp: N colours, hard edges. */
function bands(stops: GradientStop[], spec: GradientSpec): GradientStop[] {
  const n = spec.steps;
  const out: GradientStop[] = [];
  for (let i = 0; i < n; i++) {
    const c = sampleAt(stops, n === 1 ? 0 : (i / (n - 1)) * 100, spec);
    out.push({ color: c, at: (i / n) * 100 }, { color: c, at: ((i + 1) / n) * 100 });
  }
  return out;
}

/** Colour at position p (0..100) along the stops. */
export function sampleAt(stops: GradientStop[], p: number, spec: Pick<GradientSpec, "space" | "hue">): string {
  if (p <= stops[0].at) return stops[0].color;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (p <= b.at) return mix(a.color, b.color, b.at === a.at ? 1 : (p - a.at) / (b.at - a.at), spec.space, spec.hue);
  }
  return stops[stops.length - 1].color;
}

function dedupe(s: GradientStop[]): GradientStop[] {
  const out: GradientStop[] = [];
  for (const x of s) {
    const at = Math.round(x.at * 10) / 10;
    const last = out[out.length - 1];
    if (last && last.color === x.color && last.at === at) continue;
    out.push({ color: x.color, at });
  }
  return out;
}

export const HARMONIES = ["analogous", "complementary", "triad", "split", "tetrad", "shades", "elements"] as const;
export type Harmony = (typeof HARMONIES)[number];

/** A palette built around one colour, in OKLCH (lightness held, so it stays even). */
export function harmony(base: string, kind: Harmony, spread = 30): string[] {
  const [L, C, H] = hexToOklch(base);
  const at = (dh: number, dl = 0, k = 1) => oklchToHex([L + dl, C * k, (H + dh + 360) % 360]);
  switch (kind) {
    case "analogous": return [at(-spread), at(-spread / 2), base, at(spread / 2), at(spread)];
    case "complementary": return [base, at(0, 0.08, 0.55), at(180, 0, 0.9)];
    case "triad": return [base, at(120), at(240)];
    case "split": return [base, at(150), at(210)];
    case "tetrad": return [base, at(90), at(180), at(270)];
    case "shades": return [at(0, -0.22, 0.7), at(0, -0.1, 0.9), base, at(0, 0.12, 0.6), at(0, 0.24, 0.3)];
    case "elements": {
      // the Bon five: water (blue), wind (green), earth (yellow), fire (red) at this colour's
      // lightness and chroma, rotated so the element nearest the base leads; space (white) last
      const hues = [255, 145, 95, 28];
      const dist = (a: number) => Math.abs(((a - H + 540) % 360) - 180);
      const lead = hues.reduce((best, h, i) => (dist(h) < dist(hues[best]) ? i : best), 0);
      const four = hues.map((h) => oklchToHex([L, C, h]));
      return [...four.slice(lead), ...four.slice(0, lead), oklchToHex([Math.max(L, 0.88), 0.015, 85])];
    }
  }
}

/**
 * A fresh gradient from a seed, the way the logo sheets vary: 2-5 neighbouring
 * colours from the measured ink (or a given pigment set), muted, on a kind
 * that suits them.
 */
export function generate(seed: number, opts: { pigments?: readonly string[]; kind?: GradientSpec["kind"] } = {}): GradientSpec {
  const r = rng(seed);
  const pool = opts.pigments?.length ? [...opts.pigments] : LOGO_INK.map((p) => p.hex);
  // order the pool by hue so neighbours are neighbours on the wheel
  const sorted = pool.map((h) => ({ h, H: hexToOklch(h)[2] })).sort((a, b) => a.H - b.H).map((x) => x.h);
  const n = 2 + Math.floor(r() * 4);
  const start = Math.floor(r() * sorted.length);
  const colors = Array.from({ length: n }, (_, i) => sorted[(start + i * (1 + Math.floor(r() * 2))) % sorted.length]);
  if (r() < 0.5) colors.reverse();
  const kinds: GradientSpec["kind"][] = ["linear", "linear", "radial", "mesh", "conic", "halo"];
  const kind = opts.kind ?? kinds[Math.floor(r() * kinds.length)];
  return {
    ...DEFAULT_GRADIENT,
    kind,
    stops: stopsFrom(colors),
    angle: Math.floor(r() * 360),
    cx: 20 + Math.floor(r() * 60),
    cy: 20 + Math.floor(r() * 60),
    mute: opts.pigments ? 35 + Math.floor(r() * 20) : Math.floor(r() * 15),
    count: kind === "halo" ? 2 + Math.floor(r() * 3) : 3 + Math.floor(r() * 3),
    seed,
    scale: 45 + Math.floor(r() * 40),
    base: kind === "mesh" || kind === "halo" ? "#0B0B0D" : undefined,
  };
}

export interface Blob {
  x: number; // 0..100
  y: number;
  r: number; // radius, % of the box's larger side
  color: string;
}

/** Seeded blob layout for mesh: one blob per stop (cycling to `count`), spread so they don't stack. */
export function meshBlobs(spec: GradientSpec): Blob[] {
  const r = rng(spec.seed * 7919 + 13);
  const stops = adjustedStops(spec);
  const n = Math.max(2, Math.min(7, spec.count));
  const blobs: Blob[] = [];
  for (let i = 0; i < n; i++) {
    // jittered points on a loose ring + centre, so coverage is even at any seed
    const ang = (i / n) * Math.PI * 2 + r() * 1.2;
    const rad = 18 + r() * 26;
    blobs.push({
      x: Math.round(50 + Math.cos(ang) * rad + (spec.cx - 50) * 0.6),
      y: Math.round(50 + Math.sin(ang) * rad + (spec.cy - 50) * 0.6),
      r: Math.round(30 + (spec.scale / 100) * 45 + r() * 12),
      color: stops[i % stops.length].color,
    });
  }
  return blobs;
}

export { mix };
