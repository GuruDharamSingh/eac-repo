"use client";

import { useId, type CSSProperties, type ElementType, type ReactNode } from "react";
import { cleanGradient, type GradientSpec } from "../spec";
import { gradientStyle } from "../css";
import { isOwnShader } from "../shaders";
import { isPaperShader } from "../paper";
import { ShaderCanvas } from "./ShaderCanvas";
import { PaperLayer, PaperSurface } from "./PaperLayer";

export interface GradientBackgroundProps {
  /** A GradientSpec (any stored value; it is cleaned here). Nothing valid = a plain element. */
  value: GradientSpec | unknown;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /**
   * Milliseconds of animation, for frame-by-frame renders (Remotion: frame / fps * 1000).
   * Shaders then draw that moment and never run their own clock.
   */
  frame?: number;
}

/**
 * An element painted with a gradient. Layers, bottom to top:
 *   CSS background (server-rendered, always present: the fallback)
 *   shader     our WebGL (mineral, aurora, halo, silk) or Paper Shaders (mesh-flow, grain-*, warp, swirl, smoke-ring)
 *   paper      Paper Shaders' paper surface, multiplied
 *   grain      SVG noise, overlaid
 *   children
 * Layers never take pointer events.
 */
/** What the element is given; typed explicitly so `as` stays usable across @types/react versions. */
type Host = ElementType<{ className?: string; style?: CSSProperties; children?: ReactNode; "data-gradient"?: string }>;

export function GradientBackground({ value, as = "div", className, style, children, frame }: GradientBackgroundProps) {
  const Tag = as as Host;
  const spec = cleanGradient(value);
  const id = useId().replace(/:/g, "");
  if (!spec) return <Tag className={className} style={style}>{children}</Tag>;
  const layered = spec.grain > 0 || spec.paper > 0 || spec.shader !== "none";
  return (
    <Tag
      className={className}
      data-gradient={spec.kind}
      style={{ ...gradientStyle(spec), ...(layered ? { position: "relative", isolation: "isolate" } : null), ...style }}
    >
      {/* keyed: a new shader gets a new canvas (the old one's context is released on cleanup) */}
      {isOwnShader(spec.shader) && <ShaderCanvas key={spec.shader} spec={spec} frame={frame} style={{ zIndex: -1 }} />}
      {isPaperShader(spec.shader) && <PaperLayer key={spec.shader} spec={spec} frame={frame} style={{ zIndex: -1 }} />}
      {spec.paper > 0 && <PaperSurface spec={spec} frame={frame} style={{ zIndex: -1 }} />}
      {spec.grain > 0 && <Grain id={`g${id}`} amount={spec.grain} seed={spec.seed} />}
      {children}
    </Tag>
  );
}

/**
 * Film/pigment grain: SVG fractal noise as an element (not a CSS url(), which
 * the editors' CSS allowlists refuse), blended over the gradient.
 */
export function Grain({ id, amount, seed = 0 }: { id: string; amount: number; seed?: number }) {
  const a = Math.min(100, Math.max(0, amount)) / 100;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: -1, mixBlendMode: "overlay", opacity: 0.25 + a * 0.6 }}
    >
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency={0.95 - a * 0.25} numOctaves={2} seed={seed % 100} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncA type="linear" slope={0.35 + a * 0.9} />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}
