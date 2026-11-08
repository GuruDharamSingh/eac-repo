// ============================================================================
// Marks: what word art fills with a gradient. Every source becomes one shape
// of data, so 2D (a CSS mask / canvas Path2D) and 3D (three's SVGLoader +
// ExtrudeGeometry) read the same thing:
//
//   paths   filled outlines in a viewBox (EAC logo parts, an uploaded SVG,
//           text turned to outlines by opentype.js)
//   image   a raster logo (PNG/JPG/WebP): its alpha is the mask; flat in 3D
//
// Browser-only (DOMParser, opentype, SVGLoader).
// ============================================================================

import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type { ShapePath } from "three";
import { parse as parseOpenType, type Font } from "opentype.js";

export interface MarkPath {
  d: string;
  rule: "nonzero" | "evenodd";
}

export interface Mark {
  label: string;
  /** x, y, width, height of the content (tight bounds). */
  box: [number, number, number, number];
  paths: MarkPath[];
  image?: { src: string; width: number; height: number };
  /** Things the user should know about this source (e.g. strokes dropped). */
  notes?: string[];
}

export interface SeedPart {
  id: string;
  group: string;
  rule: "nonzero" | "evenodd";
  d: string;
}

export interface SeedMark {
  id: string;
  label: string;
  note: string;
  viewBox: number[];
  groups: string[];
  parts: SeedPart[];
}

/** Tight bounds of paths, measured by the browser (exact for curves). */
export function measurePaths(paths: MarkPath[]): [number, number, number, number] {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden";
  const g = document.createElementNS(NS, "g");
  for (const p of paths) {
    const el = document.createElementNS(NS, "path");
    el.setAttribute("d", p.d);
    g.appendChild(el);
  }
  svg.appendChild(g);
  document.body.appendChild(svg);
  try {
    const b = g.getBBox();
    return [b.x, b.y, Math.max(1, b.width), Math.max(1, b.height)];
  } finally {
    svg.remove();
  }
}

/** An EAC logo with some of its groups (monogram, wordmark, rings, crescents). */
export function seedMark(seed: SeedMark, groups: string[]): Mark {
  const keep = new Set(groups.length ? groups : seed.groups);
  const paths = seed.parts.filter((p) => keep.has(p.group)).map(({ d, rule }) => ({ d, rule }));
  if (!paths.length) return { label: seed.label, box: [0, 0, 1, 1], paths: [] };
  return { label: seed.label, box: measurePaths(paths), paths };
}

/** A path's curves as SVG path data (after SVGLoader has applied every transform). */
function shapePathToD(sp: ShapePath): string {
  const f = (n: number) => Math.round(n * 100) / 100;
  let d = "";
  for (const sub of sp.subPaths) {
    let first = true;
    for (const c of sub.curves) {
      const t = c.type;
      const anyC = c as unknown as Record<string, { x: number; y: number }>;
      if (first) {
        const start = c.getPoint(0);
        d += `M${f(start.x)} ${f(start.y)}`;
        first = false;
      }
      if (t === "LineCurve") d += `L${f(anyC.v2.x)} ${f(anyC.v2.y)}`;
      else if (t === "CubicBezierCurve") d += `C${f(anyC.v1.x)} ${f(anyC.v1.y)} ${f(anyC.v2.x)} ${f(anyC.v2.y)} ${f(anyC.v3.x)} ${f(anyC.v3.y)}`;
      else if (t === "QuadraticBezierCurve") d += `Q${f(anyC.v1.x)} ${f(anyC.v1.y)} ${f(anyC.v2.x)} ${f(anyC.v2.y)}`;
      else {
        // arcs, ellipses, splines: sampled
        for (const p of c.getPoints(24).slice(1)) d += `L${f(p.x)} ${f(p.y)}`;
      }
    }
    if (sub.autoClose || sub.curves.length) d += "Z";
  }
  return d;
}

/** An uploaded SVG logo: every filled shape, transforms applied; strokes are dropped (noted). */
export function svgMark(text: string, label = "Uploaded SVG"): Mark {
  const data = new SVGLoader().parse(text);
  const paths: MarkPath[] = [];
  let strokes = 0;
  for (const p of data.paths) {
    const style = (p.userData?.style ?? {}) as { fill?: string; stroke?: string; fillRule?: string };
    if (style.fill === "none" || style.fill === "transparent") {
      if (style.stroke && style.stroke !== "none") strokes++;
      continue;
    }
    const d = shapePathToD(p);
    if (d) paths.push({ d, rule: style.fillRule === "evenodd" ? "evenodd" : "nonzero" });
  }
  const notes: string[] = [];
  if (strokes) notes.push(`${strokes} stroke-only shape${strokes > 1 ? "s were" : " was"} left out. Convert strokes to outlines in your editor to keep them.`);
  if (!paths.length) notes.push("No filled shapes found in this SVG.");
  return { label, box: paths.length ? measurePaths(paths) : [0, 0, 1, 1], paths, notes };
}

export interface TextOptions {
  text: string;
  /** Letter spacing in 1/1000 em. */
  tracking?: number;
  /** Line height as a multiple of the font size. */
  leading?: number;
  align?: "left" | "center" | "right";
}

/** Text as outlines in the given font (TTF/OTF/WOFF; opentype.js doesn't read WOFF2). */
export function textMark(font: Font, o: TextOptions, label?: string): Mark {
  const size = 200;
  const lines = (o.text || " ").split(/\r?\n/);
  const lh = size * (o.leading ?? 1.05);
  const ls = (o.tracking ?? 0) / 1000;
  const widths = lines.map((l) => font.getAdvanceWidth(l, size, { kerning: true, letterSpacing: ls }));
  const maxW = Math.max(...widths, 1);
  const paths: MarkPath[] = [];
  lines.forEach((line, i) => {
    const x = o.align === "left" ? 0 : o.align === "right" ? maxW - widths[i] : (maxW - widths[i]) / 2;
    const p = font.getPath(line, x, size + i * lh, size, { kerning: true, letterSpacing: ls });
    const d = p.toPathData(2);
    if (d) paths.push({ d, rule: "nonzero" });
  });
  return { label: label ?? o.text.split(/\n/)[0].slice(0, 40), box: paths.length ? measurePaths(paths) : [0, 0, 1, 1], paths };
}

export function parseFont(buffer: ArrayBuffer): Font {
  return parseOpenType(buffer);
}
export type { Font };

/** A raster logo: its alpha is the mask. */
export function imageMark(src: string, label = "Uploaded image"): Promise<Mark> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ label, box: [0, 0, img.naturalWidth, img.naturalHeight], paths: [], image: { src, width: img.naturalWidth, height: img.naturalHeight } });
    img.onerror = () => reject(new Error("That image could not be read."));
    img.src = src;
  });
}

/** The mark as a standalone SVG (black fill), for CSS masks and downloads. */
export function markSvg(m: Mark, pad = 0, fill = "#000"): string {
  const [x, y, w, h] = m.box;
  const vb = `${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`;
  if (m.image) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><image href="${m.image.src}" x="0" y="0" width="${m.image.width}" height="${m.image.height}"/></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${m.paths.map((p) => `<path d="${p.d}" fill="${fill}" fill-rule="${p.rule}"/>`).join("")}</svg>`;
}

/** A CSS url() for the mark (mask-image). */
export const markMaskUrl = (m: Mark) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(markSvg(m))}")`;
