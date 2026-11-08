"use client";

import { lazy, Suspense, useEffect, useState, type ComponentType, type CSSProperties } from "react";
import { paperRender, paperTextureProps, type PaperComponent } from "../paper";
import type { GradientSpec } from "../spec";

// Paper Shaders is loaded only when a spec uses it: pages with CSS gradients or our
// own shaders never download it. One lazy component per shader we map.
type AnyShader = ComponentType<Record<string, unknown>>;
const load = (name: PaperComponent | "PaperTexture") =>
  lazy(() => import("@paper-design/shaders-react").then((m) => ({ default: (m as unknown as Record<string, AnyShader>)[name] })));
const COMPONENTS: Record<PaperComponent | "PaperTexture", ReturnType<typeof load>> = {
  MeshGradient: load("MeshGradient"),
  GrainGradient: load("GrainGradient"),
  Warp: load("Warp"),
  Swirl: load("Swirl"),
  SmokeRing: load("SmokeRing"),
  PaperTexture: load("PaperTexture"),
};

const fill: CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" };

/** Respects reduced motion the same way ShaderCanvas does: still frame, no clock. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const q = matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const on = () => setReduced(q.matches);
    q.addEventListener?.("change", on);
    return () => q.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** A Paper Shaders background for the spec's shader (behind content, above the CSS fallback). */
export function PaperLayer({ spec, frame, style }: { spec: GradientSpec; frame?: number; style?: CSSProperties }) {
  const reduced = useReducedMotion();
  const r = paperRender(spec, frame);
  if (!r) return null;
  const C = COMPONENTS[r.component];
  const props = reduced && frame === undefined ? { ...r.props, speed: 0 } : r.props;
  return (
    <Suspense fallback={null}>
      <C {...props} aria-hidden="true" style={{ ...fill, ...style }} />
    </Suspense>
  );
}

/** The paper surface, multiplied over everything below it. */
export function PaperSurface({ spec, frame, style }: { spec: GradientSpec; frame?: number; style?: CSSProperties }) {
  const props = paperTextureProps(spec, frame);
  if (!props) return null;
  const C = COMPONENTS.PaperTexture;
  return (
    <Suspense fallback={null}>
      <C {...props} aria-hidden="true" style={{ ...fill, mixBlendMode: "multiply", opacity: 0.35 + (spec.paper / 100) * 0.55, ...style }} />
    </Suspense>
  );
}
