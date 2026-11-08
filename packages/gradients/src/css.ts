// ============================================================================
// GradientSpec -> CSS.
//
// One `background` value per spec, built only from linear-/radial-/conic-
// gradient, hex colours (8-digit for transparency), numbers, %, deg and the
// keywords circle/ellipse/at/from. No url(), no colour functions, no var():
// that is what page-builder's `cleanCustomCss` and direct-edit's morph
// allowlist accept, so the value can be written straight into a block's style
// or a site variable. `isSafeGradientCss` checks any stored string the same way.
//
// Grain and shaders are not CSS: <GradientBackground> draws them as layers
// over this value, which stays the fallback (no WebGL, print, reduced data).
// ============================================================================

import { cleanGradient, type GradientSpec, type GradientStop } from "./spec";
import { adjustedStops, meshBlobs, ramp, sampleAt } from "./generate";
import { hexToOklch, oklchToHex } from "./color";

const pct = (n: number) => `${Math.round(n * 10) / 10}%`;
const list = (stops: GradientStop[]) => stops.map((s) => `${s.color} ${pct(s.at)}`).join(", ");
const alpha = (hex: string, a: number) => hex + Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, "0").toUpperCase();

/**
 * The base colour under the gradient: the spec's own; for grounds that show
 * through (mesh, halo, the aurora and halo shaders) a near-black tinted with the
 * darkest stop's hue, like the logo sheets; otherwise the last stop.
 */
export function baseColor(spec: GradientSpec): string {
  if (spec.base) return spec.base;
  const s = adjustedStops(spec);
  const showsGround = spec.kind === "mesh" || spec.kind === "halo" || spec.shader === "aurora" || spec.shader === "halo";
  if (!showsGround) return s[s.length - 1].color;
  const darkest = s.map((x) => hexToOklch(x.color)).sort((a, b) => a[0] - b[0])[0];
  return oklchToHex([0.17, Math.min(0.03, darkest[1] * 0.3), darkest[2]]);
}

export interface CssOptions {
  /** Samples per gap between stops (default 6; more = smoother perceptual ramp, longer CSS). */
  per?: number;
  /**
   * Fit a length cap (e.g. a site-style variable): the ramp is thinned until the
   * value fits. Mesh and halo can't thin; they return "" when over the cap.
   */
  maxLength?: number;
}

/** A single `background` CSS value for the spec. */
export function gradientCss(input: GradientSpec | unknown, opts: CssOptions = {}): string {
  const spec = cleanGradient(input);
  if (!spec) return "";
  if (opts.maxLength) {
    for (const per of [opts.per ?? 6, 4, 3, 2, 1]) {
      const v = write(spec, per);
      if (v.length <= opts.maxLength) return v;
    }
    return "";
  }
  return write(spec, opts.per ?? 6);
}

function write(spec: GradientSpec, per: number): string {
  switch (spec.kind) {
    case "linear":
      return `linear-gradient(${spec.angle}deg, ${list(ramp(spec, per))})`;
    case "bands":
      return `linear-gradient(${spec.angle}deg, ${list(ramp(spec, per))})`;
    case "radial":
      return `radial-gradient(ellipse at ${pct(spec.cx)} ${pct(spec.cy)}, ${list(ramp(spec, per))})`;
    case "conic":
      return `conic-gradient(from ${spec.angle}deg at ${pct(spec.cx)} ${pct(spec.cy)}, ${list(ramp(spec, per))})`;
    case "mesh": {
      const soft = 0.35 + (spec.softness / 100) * 0.65;
      const layers = meshBlobs(spec).map(
        (b) => `radial-gradient(circle at ${pct(b.x)} ${pct(b.y)}, ${b.color} 0%, ${alpha(b.color, 0.55)} ${pct(b.r * (1 - soft) * 0.8)}, ${alpha(b.color, 0)} ${pct(b.r)})`
      );
      return [...layers, baseColor(spec)].join(", ");
    }
    case "halo": {
      // concentric rings like the EAC ring marks: each ring a thin band coloured along the ramp
      const stops = adjustedStops(spec);
      const n = Math.max(1, Math.min(8, spec.count));
      const outer = 18 + (spec.scale / 100) * 30; // % of the box
      const width = 0.6 + (1 - spec.softness / 100) * 0.2 + (spec.softness / 100) * 2.4;
      const rings: string[] = [];
      for (let i = 0; i < n; i++) {
        const r = outer - i * (outer * 0.09 + 1.2);
        const c = sampleAt(stops, n === 1 ? 50 : (i / (n - 1)) * 100, spec);
        rings.push(`radial-gradient(circle at ${pct(spec.cx)} ${pct(spec.cy)}, ${alpha(c, 0)} ${pct(r - width)}, ${c} ${pct(r)}, ${alpha(c, 0)} ${pct(r + width)})`);
      }
      // a faint glow inside the rings, in the ramp's lightest colour
      const glow = sampleAt(stops, 0, spec);
      rings.push(`radial-gradient(circle at ${pct(spec.cx)} ${pct(spec.cy)}, ${alpha(glow, 0.14)} 0%, ${alpha(glow, 0)} ${pct(outer)})`);
      return [...rings, baseColor(spec)].join(", ");
    }
  }
}

/** Style props for React/DOM: the background plus a colour for content painted before it loads. */
export function gradientStyle(input: GradientSpec | unknown): { background?: string; backgroundColor?: string } {
  const spec = cleanGradient(input);
  if (!spec) return {};
  return { background: gradientCss(spec), backgroundColor: baseColor(spec) };
}

const SAFE_FN = /^(?:linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient)$/i;
const SAFE_WORD = /^(?:at|from|to|in|circle|ellipse|closest-side|closest-corner|farthest-side|farthest-corner|left|right|top|bottom|center|transparent)$/i;
const SAFE_NUM = /^-?\d+(?:\.\d+)?(?:%|deg|turn|px|rem|em)?$/i;
const SAFE_HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * True when a CSS value is only gradients of hex colours (what this package
 * writes). For editors that store the CSS string rather than the spec.
 */
export function isSafeGradientCss(value: string): boolean {
  if (typeof value !== "string" || value.length > 8000) return false;
  if (/url\s*\(|var\s*\(|expression|javascript:|[{};<>\\@!]|\/\*/i.test(value)) return false;
  let depth = 0;
  const tokens = value.match(/[a-z-]+\(|\)|,|#[0-9a-f]+|-?\d+(?:\.\d+)?[a-z%]*|[a-z-]+|\S/gi) ?? [];
  for (const t of tokens) {
    if (t.endsWith("(")) {
      if (!SAFE_FN.test(t.slice(0, -1))) return false;
      depth++;
    } else if (t === ")") {
      if (--depth < 0) return false;
    } else if (t === ",") {
      continue;
    } else if (!(SAFE_HEX.test(t) || SAFE_NUM.test(t) || SAFE_WORD.test(t))) {
      return false;
    }
  }
  return depth === 0;
}
