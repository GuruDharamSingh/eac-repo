// ============================================================================
// GradientSpec: the stored value of a gradient background.
//
// It is what a Puck prop, a block's style (`blkStyle.bgGradient`, later) or a
// site-style variable holds: small, plain JSON, every number a slider. Like
// page-builder's `cleanStyle`, the stored value is NEVER trusted (a page row is
// JSON anyone with editor access can write by hand, drawn on public pages), so
// `cleanGradient` keeps only known keys, clamps every number and accepts only
// hex colours. Everything downstream (CSS, shader uniforms) reads the cleaned
// value.
// ============================================================================

import { normHex } from "./color";
import { RAMPS, BON_MINERAL } from "./palettes";

export const KINDS = ["linear", "radial", "conic", "mesh", "halo", "bands"] as const;
export type GradientKind = (typeof KINDS)[number];

export const SPACES = ["oklch", "oklab", "srgb"] as const;
export const HUES = ["shorter", "longer"] as const;
export const EASES = ["linear", "smooth", "in", "out", "steps"] as const;
/** Ours (shaders.ts), then Paper Shaders (paper.ts). */
export const SHADERS = [
  "none", "mineral", "aurora", "halo", "silk",
  "mesh-flow", "grain-wave", "grain-sphere", "grain-ripple", "warp", "swirl", "smoke-ring",
] as const;
export const OWN_SHADERS = ["mineral", "aurora", "halo", "silk"] as const;
export type ShaderKind = (typeof SHADERS)[number];

export interface GradientStop {
  color: string;
  /** Position 0..100. */
  at: number;
}

export interface GradientSpec {
  v: 1;
  kind: GradientKind;
  /** 2..8 stops, sorted by `at`. */
  stops: GradientStop[];
  /** Direction for linear, start angle for conic and bands, degrees 0..359. */
  angle: number;
  /** Centre for radial, conic, halo, 0..100 (% of the box). */
  cx: number;
  cy: number;
  /** Interpolation space; the CSS is densified here, so every space works in every browser. */
  space: (typeof SPACES)[number];
  hue: (typeof HUES)[number];
  /** Shape of the transition between stops. "steps" makes hard bands. */
  ease: (typeof EASES)[number];
  /** Bands for ease "steps" and kind "bands", 2..24. */
  steps: number;
  /** 0..100: how far each colour reaches; 100 = full blend, low = tight edges. */
  softness: number;
  /** 0..100: chroma taken out, in OKLCH (the tsakli mute is about 48). */
  mute: number;
  /** -50..50: lightness shift, OKLab L x 100. */
  light: number;
  /** Mesh blobs, 2..7; halo rings, 1..8. */
  count: number;
  /** Seeds mesh placement and generated palettes. */
  seed: number;
  /** 0..100: scale of mesh blobs and halo rings. */
  scale: number;
  /** 0..100: grain overlay strength (drawn by the component, never as CSS url()). */
  grain: number;
  /** Optional WebGL layer; the CSS gradient stays underneath as its fallback. */
  shader: ShaderKind;
  /** 0..100 shader motion; 0 = still. Reduced-motion viewers always get still. */
  motion: number;
  /** 0..100: paper surface (fibre, folds, crumples) multiplied over the gradient; WebGL, Paper Shaders. */
  paper: number;
  /** Hex colour under the gradient (mesh and halo sit on it); defaults to the last stop. */
  base?: string;
}

export const DEFAULT_GRADIENT: GradientSpec = {
  v: 1,
  kind: "linear",
  stops: RAMPS[0].colors.map((color, i, a) => ({ color, at: Math.round((i / (a.length - 1)) * 100) })),
  angle: 120,
  cx: 50,
  cy: 50,
  space: "oklch",
  hue: "shorter",
  ease: "smooth",
  steps: 6,
  softness: 100,
  mute: 0,
  light: 0,
  count: 4,
  seed: 7,
  scale: 60,
  grain: 0,
  shader: "none",
  motion: 30,
  paper: 0,
};

const num = (v: unknown, min: number, max: number, dflt: number, wrap = false): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) return dflt;
  if (wrap) return ((Math.round(v) % (max + 1)) + (max + 1)) % (max + 1);
  return Math.min(max, Math.max(min, Math.round(v)));
};
const pick = <T extends string>(list: readonly T[], v: unknown, dflt: T): T =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : dflt;

/** A clean GradientSpec, or null when the value is not a gradient at all. */
export function cleanGradient(raw: unknown): GradientSpec | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const stops = (Array.isArray(r.stops) ? r.stops : [])
    .slice(0, 8)
    .map((s) => {
      const o = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
      const color = normHex(o.color);
      return color ? { color, at: num(o.at, 0, 100, 0) } : null;
    })
    .filter((s): s is GradientStop => !!s)
    .sort((a, b) => a.at - b.at);
  if (stops.length < 2) return null;
  const d = DEFAULT_GRADIENT;
  const out: GradientSpec = {
    v: 1,
    kind: pick(KINDS, r.kind, d.kind),
    stops,
    angle: num(r.angle, 0, 359, d.angle, true),
    cx: num(r.cx, 0, 100, d.cx),
    cy: num(r.cy, 0, 100, d.cy),
    space: pick(SPACES, r.space, d.space),
    hue: pick(HUES, r.hue, d.hue),
    ease: pick(EASES, r.ease, d.ease),
    steps: num(r.steps, 2, 24, d.steps),
    softness: num(r.softness, 0, 100, d.softness),
    mute: num(r.mute, 0, 100, d.mute),
    light: num(r.light, -50, 50, d.light),
    count: num(r.count, 1, 8, d.count),
    seed: num(r.seed, 0, 9999, d.seed),
    scale: num(r.scale, 0, 100, d.scale),
    grain: num(r.grain, 0, 100, d.grain),
    shader: pick(SHADERS, r.shader, d.shader),
    motion: num(r.motion, 0, 100, d.motion),
    paper: num(r.paper, 0, 100, d.paper),
  };
  const base = normHex(r.base);
  if (base) out.base = base;
  return out;
}

/** Evenly spaced stops from a list of colours. */
export function stopsFrom(colors: readonly string[], at?: readonly number[]): GradientStop[] {
  return colors.map((color, i) => ({ color, at: at?.[i] ?? Math.round((i / Math.max(1, colors.length - 1)) * 100) }));
}

export interface Preset {
  id: string;
  label: string;
  spec: GradientSpec;
}

const P = (id: string, label: string, over: Partial<GradientSpec>): Preset => ({ id, label, spec: { ...DEFAULT_GRADIENT, ...over } });
const ramp = (id: string) => stopsFrom(RAMPS.find((r) => r.id === id)!.colors);
const combo = (id: string) => {
  const c = BON_MINERAL.find((x) => x.id === id)!;
  return { c, stops: stopsFrom([c.ground, c.light, c.mark]) };
};

export const PRESETS: readonly Preset[] = [
  P("spectrum", "Spectrum wash", { stops: ramp("spectrum"), angle: 100 }),
  P("ember", "Ember", { stops: ramp("ember"), angle: 160, mute: 10 }),
  P("tide-radial", "Tide pool", { kind: "radial", stops: ramp("tide"), cx: 30, cy: 35 }),
  P("veil", "Veil", { stops: ramp("veil"), angle: 200 }),
  P("ring", "Logo ring", { kind: "halo", stops: ramp("night-ring"), count: 3, scale: 55, softness: 35, base: "#0B0B0D" }),
  P("ring-shader", "Living ring", { kind: "halo", stops: ramp("spectrum"), count: 3, scale: 55, softness: 30, shader: "halo", motion: 25, base: "#0B0B0D" }),
  P("silk", "Silk", { stops: [...ramp("tide"), { color: "#77448A", at: 100 }].map((s, i, a) => ({ ...s, at: Math.round((i / (a.length - 1)) * 100) })), shader: "silk", motion: 30, angle: 30, light: -8 }),
  P("aura", "Conic aura", { kind: "conic", stops: [...ramp("spectrum"), { color: "#407C83", at: 100 }].map((s, i, a) => ({ ...s, at: Math.round((i / (a.length - 1)) * 100) })), cx: 50, cy: 50 }),
  P("mesh-dusk", "Mandala dusk mesh", { kind: "mesh", stops: combo("mandala-dusk").stops, base: "#2C2B46", count: 4, seed: 12, scale: 70, grain: 18 }),
  P("tsakli", "Tsakli card", { kind: "mesh", stops: combo("tsakli-card").stops, base: "#2A5A83", count: 3, seed: 3, scale: 55, grain: 30, mute: 5 }),
  P("moss", "Moss & orpiment", { kind: "radial", stops: [{ color: "#C1AF6E", at: 0 }, { color: "#6A7853", at: 45 }, { color: "#37362D", at: 100 }], cx: 70, cy: 25, grain: 22 }),
  P("elements-bands", "Five elements", { kind: "bands", stops: ramp("elements"), steps: 5, angle: 90, mute: 15 }),
  P("mineral", "Mineral shader", { kind: "mesh", stops: ramp("spectrum"), base: "#0B0B0D", shader: "mineral", motion: 25, grain: 14 }),
  P("aurora", "Aurora shader", { kind: "linear", stops: ramp("tide"), shader: "aurora", motion: 40 }),
  // Paper Shaders
  P("mesh-flow", "Mesh flow", { kind: "mesh", stops: ramp("spectrum"), shader: "mesh-flow", motion: 25, grain: 20, base: "#0B0B0D" }),
  // the ground is the base, so the blob's own colours are the light and the mark (a blob led by the
  // ground colour disappears into it)
  P("grain-dusk", "Grain dusk", { kind: "radial", stops: stopsFrom(["#B77669", "#7F9364", "#4E455A"]), shader: "grain-ripple", motion: 20, grain: 45, softness: 70, base: "#2C2B46" }),
  P("ember-wave", "Ember wave", { kind: "linear", stops: ramp("ember"), shader: "grain-wave", motion: 20, grain: 35, base: "#1A1210" }),
  P("smoke-ring", "Smoke ring", { kind: "halo", stops: ramp("night-ring"), shader: "smoke-ring", motion: 30, scale: 55, base: "#0B0B0D" }),
  P("tsakli-paper", "Tsakli paper", { kind: "mesh", stops: combo("tsakli-card").stops, base: "#2A5A83", count: 3, seed: 3, scale: 55, mute: 5, paper: 60 }),
];
