// ============================================================================
// Paper Shaders (Apache-2.0, @paper-design/shaders-react 0.0.82, pinned: pre-1.0,
// its props can change between releases) driven by a GradientSpec.
//
// Pure: maps a spec to { component, props } for <PaperLayer>. One spec drives
// both engines, so switching shader keeps the colours, angle, centre, scale,
// softness, grain and motion the author already set.
//
//   mesh-flow     MeshGradient      flowing colour spots (up to 10 colours)
//   grain-wave    GrainGradient     grainy bands, wave form (up to 7 colours)
//   grain-sphere  GrainGradient     grainy sphere (blob renders blank in headless SwiftShader; untested on GPU, left out)
//   grain-ripple  GrainGradient     grainy ripples
//   warp          Warp              warped stripes of the ramp
//   swirl         Swirl             a vortex of bands
//   smoke-ring    SmokeRing         a smoke ring, close to the EAC ring marks
//   + spec.paper  PaperTexture      fibre, folds and crumples multiplied over any gradient
// ============================================================================

import { adjustedStops } from "./generate";
import { baseColor } from "./css";
import type { GradientSpec } from "./spec";

export const PAPER_SHADERS = ["mesh-flow", "grain-wave", "grain-sphere", "grain-ripple", "warp", "swirl", "smoke-ring"] as const;
export type PaperShader = (typeof PAPER_SHADERS)[number];
export const isPaperShader = (s: string): s is PaperShader => (PAPER_SHADERS as readonly string[]).includes(s);

export type PaperComponent = "MeshGradient" | "GrainGradient" | "Warp" | "Swirl" | "SmokeRing";

export interface PaperRender {
  component: PaperComponent;
  props: Record<string, unknown>;
}

/** Common sizing and motion. `frame` (ms) makes it deterministic, for video renders. */
function common(spec: GradientSpec, frame?: number) {
  const motion = spec.motion / 100;
  // Paper's shapes grow in from nothing at frame 0 (its own blob preset is blank there), so
  // every layer starts a few seconds in, varied by seed. Renders add the same offset, so
  // they stay deterministic.
  const start = 6000 + (spec.seed % 12) * 750;
  return {
    speed: frame === undefined ? motion * 1.2 : 0,
    frame: start + (frame ?? 0),
    rotation: spec.angle,
    scale: 0.5 + (spec.scale / 100) * 1.5,
    offsetX: (spec.cx - 50) / 50,
    offsetY: (spec.cy - 50) / 50,
    fit: "cover" as const,
    // our cost rules, not Paper's defaults (min pixel ratio 2): match ShaderCanvas
    minPixelRatio: 1,
    maxPixelCount: 1920 * 1080 * 1.5,
  };
}

export function paperRender(spec: GradientSpec, frame?: number): PaperRender | null {
  if (!isPaperShader(spec.shader)) return null;
  const colors = adjustedStops(spec).map((s) => s.color);
  const base = baseColor(spec);
  const soft = spec.softness / 100;
  const grain = spec.grain / 100;
  // Paper's sizing defaults: object shapes (blob, ripple, ring, swirl) are drawn whole with
  // "contain"; patterns (wave) tile with "none"; fields (mesh, warp) fill with "cover".
  // "cover" on an object shape blows it past the edges and only the ground shows.
  const FIT: Record<string, "contain" | "none" | "cover"> = {
    "grain-sphere": "contain", "grain-ripple": "contain", "smoke-ring": "contain", swirl: "contain", "grain-wave": "none",
  };
  const c = { ...common(spec, frame), fit: FIT[spec.shader] ?? "cover" };
  switch (spec.shader) {
    case "mesh-flow":
      return { component: "MeshGradient", props: { ...c, colors: colors.slice(0, 10), distortion: 0.3 + soft * 0.6, swirl: 0.1 + (spec.scale / 100) * 0.6, grainMixer: grain * 0.4, grainOverlay: grain * 0.5 } };
    case "grain-wave":
    case "grain-sphere":
    case "grain-ripple":
      return {
        component: "GrainGradient",
        props: { ...c, colorBack: base, colors: colors.slice(0, 7), softness: soft, intensity: 0.15 + (1 - soft) * 0.5, noise: 0.15 + grain * 0.6, shape: spec.shader.slice(6) },
      };
    case "warp":
      return { component: "Warp", props: { ...c, colors: colors.slice(0, 10), proportion: 0.45, softness: soft, shape: "edge", shapeScale: 0.1 + (spec.scale / 100) * 0.4, distortion: 0.25, swirl: 0.8, swirlIterations: 10 } };
    case "swirl":
      return { component: "Swirl", props: { ...c, colorBack: base, colors: colors.slice(0, 10), bandCount: Math.max(2, spec.count), twist: 0.15 + (spec.scale / 100) * 0.5, center: 0.2, proportion: 0.5, softness: soft, noise: grain * 0.6, noiseFrequency: 0.4 } };
    case "smoke-ring":
      return { component: "SmokeRing", props: { ...c, colorBack: base, colors: colors.slice(0, 10), radius: 0.15 + (spec.scale / 100) * 0.4, thickness: 0.3 + soft * 0.5, innerShape: 0.7, noiseScale: 3, noiseIterations: 8 } };
  }
}

/**
 * PaperTexture props for the `paper` overlay: a white sheet with brown-grey
 * shadows, multiplied over the gradient so only fibre, folds and crumples show.
 */
export function paperTextureProps(spec: GradientSpec, frame?: number): Record<string, unknown> | null {
  if (!spec.paper) return null;
  const a = spec.paper / 100;
  return {
    ...common(spec, frame),
    speed: 0,
    colorBack: "#FFFFFF",
    colorPaper: "#FFFFFF",
    colorShadow: "#6E6458",
    roughness: 0.25 + a * 0.4,
    roughnessSize: 0.4,
    fiber: 0.2 + a * 0.5,
    fiberSize: 0.3,
    folds: a * 0.35,
    foldSizeX: 0.5,
    foldSizeY: 0.5,
    crumples: a * 0.5,
    crumpleCount: 6,
    wrinkles: a * 0.3,
    wrinkleSize: 0.5,
    drops: a * 0.2,
    seed: spec.seed,
    angle: 45,
  };
}
