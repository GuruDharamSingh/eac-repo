// ============================================================================
// Paint a GradientSpec onto a 2D canvas: the same ramp and geometry as the CSS
// (css.ts), for PNG export and for WebGL textures (word art in 3D).
//
// Follows CSS semantics so a painted gradient matches the page:
//   linear  angle 0 = to top, 90 = to right; the gradient line spans the box's
//           projection on that direction (CSS's "magic corners")
//   radial  ellipse at cx cy, farthest-corner
//   conic   from <angle> at cx cy, 0 = up, clockwise
//   mesh / halo  circles sized against the farthest corner, like
//           `radial-gradient(circle at …)` with % stops
// Shaders are not painted (a still of a shader is a separate capture); grain
// is painted as monochrome noise in overlay.
// Browser-only (CanvasRenderingContext2D), no React.
// ============================================================================

import { cleanGradient, type GradientSpec } from "./spec";
import { adjustedStops, meshBlobs, ramp, sampleAt } from "./generate";
import { baseColor } from "./css";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const alpha = (hex: string, a: number) => hex + Math.round(Math.min(1, Math.max(0, a)) * 255).toString(16).padStart(2, "0");

function addStops(g: CanvasGradient, spec: GradientSpec) {
  for (const s of ramp(spec)) g.addColorStop(Math.min(1, Math.max(0, s.at / 100)), s.color);
}

/** Distance from (x, y) to the box's farthest corner. */
const farthest = (x: number, y: number, w: number, h: number) =>
  Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));

/** Paint `value` over the whole w x h area of ctx (from 0,0). Returns false when it isn't a gradient. */
export function paintGradient(ctx: Ctx, value: unknown, w: number, h: number): boolean {
  const spec = cleanGradient(value);
  if (!spec) return false;
  ctx.save();
  ctx.fillStyle = baseColor(spec);
  ctx.fillRect(0, 0, w, h);
  const cx = (spec.cx / 100) * w, cy = (spec.cy / 100) * h;
  switch (spec.kind) {
    case "linear":
    case "bands": {
      const a = (spec.angle * Math.PI) / 180;
      const dx = Math.sin(a), dy = -Math.cos(a);
      const len = Math.abs(w * dx) + Math.abs(h * dy);
      const g = ctx.createLinearGradient(w / 2 - (dx * len) / 2, h / 2 - (dy * len) / 2, w / 2 + (dx * len) / 2, h / 2 + (dy * len) / 2);
      addStops(g, spec);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "radial": {
      // ellipse farthest-corner = farthest-side radii x sqrt(2)
      const rx = Math.max(cx, w - cx) * Math.SQRT2 || 1, ry = Math.max(cy, h - cy) * Math.SQRT2 || 1;
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      addStops(g, spec);
      ctx.fillStyle = g;
      ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
      break;
    }
    case "conic": {
      if (!("createConicGradient" in ctx)) break; // very old browsers: the base colour stays
      const g = (ctx as CanvasRenderingContext2D).createConicGradient(((spec.angle - 90) * Math.PI) / 180, cx, cy);
      addStops(g, spec);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "mesh": {
      const soft = 0.35 + (spec.softness / 100) * 0.65;
      // css.ts lists blobs first-on-top; paint in reverse so the first ends up on top
      for (const b of [...meshBlobs(spec)].reverse()) {
        const x = (b.x / 100) * w, y = (b.y / 100) * h;
        const R = (b.r / 100) * farthest(x, y, w, h);
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        g.addColorStop(0, b.color);
        g.addColorStop(Math.min(0.99, (1 - soft) * 0.8 * 1), alpha(b.color, 0.55));
        g.addColorStop(1, alpha(b.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
    case "halo": {
      const stops = adjustedStops(spec);
      const n = Math.max(1, Math.min(8, spec.count));
      const ref = farthest(cx, cy, w, h);
      const outer = 18 + (spec.scale / 100) * 30;
      const width = 0.6 + (1 - spec.softness / 100) * 0.2 + (spec.softness / 100) * 2.4;
      const glow = sampleAt(stops, 0, spec);
      const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, (outer / 100) * ref);
      gg.addColorStop(0, alpha(glow, 0.14));
      gg.addColorStop(1, alpha(glow, 0));
      ctx.fillStyle = gg;
      ctx.fillRect(0, 0, w, h);
      for (let i = n - 1; i >= 0; i--) {
        const r = outer - i * (outer * 0.09 + 1.2);
        const c = sampleAt(stops, n === 1 ? 50 : (i / (n - 1)) * 100, spec);
        const R = ref;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        const at = (p: number) => Math.min(1, Math.max(0, p / 100));
        g.addColorStop(at(r - width), alpha(c, 0));
        g.addColorStop(at(r), c);
        g.addColorStop(at(r + width), alpha(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
  }
  ctx.restore();
  if (spec.grain > 0) paintGrain(ctx, w, h, spec.grain / 100, spec.seed);
  return true;
}

/** Monochrome noise in overlay, deterministic by seed. */
function paintGrain(ctx: Ctx, w: number, h: number, amount: number, seed: number) {
  const tile = 256;
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(tile, tile) : Object.assign(document.createElement("canvas"), { width: tile, height: tile });
  const t = c.getContext("2d") as Ctx | null;
  if (!t) return;
  const img = t.createImageData(tile, tile);
  let s = (seed * 2654435761) >>> 0;
  for (let i = 0; i < img.data.length; i += 4) {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    const v = s & 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  t.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.12 + amount * 0.35;
  const pattern = ctx.createPattern(c as CanvasImageSource, "repeat");
  if (pattern) { ctx.fillStyle = pattern; ctx.fillRect(0, 0, w, h); }
  ctx.restore();
}
