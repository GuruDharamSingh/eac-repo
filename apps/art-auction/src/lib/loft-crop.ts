import type { CSSProperties } from "react";

// ============================================================================
// How a work is framed in the home loft: the frame's proportion and the crop
// inside it. One set of maths for the CSS still and the 3D scene, so the two
// agree. The crop is "cover" fit at `zoom`, with the point (x %, y %) of the
// picture kept where object-position would put it: at zoom 1 it is exactly
// CSS `object-fit: cover; object-position: x% y%`.
// Client-safe: no database import here, because the home page's client
// components read these; `home-sections.ts` re-exports them for the server.
// ============================================================================

/** The frame's proportion: the picture's own, or a fixed shape it is cropped to. */
export type LoftRatio = "auto" | "4:5" | "1:1" | "5:4" | "3:2" | "2:3";
export const LOFT_RATIOS: Array<{ value: LoftRatio; label: string }> = [
  { value: "auto", label: "As shot" },
  { value: "4:5", label: "Portrait 4:5" },
  { value: "2:3", label: "Tall 2:3" },
  { value: "1:1", label: "Square" },
  { value: "5:4", label: "Landscape 5:4" },
  { value: "3:2", label: "Wide 3:2" },
];

/** The crop inside the frame: where the picture is centred (0–100 %) and how far it is zoomed in (1–3). */
export interface LoftCrop {
  x: number;
  y: number;
  zoom: number;
}

/** One of the owners' two spots on the wall: which work, in what frame, cropped how. */
export interface LoftSpot {
  id: string;
  ratio: LoftRatio;
  crop: LoftCrop;
}

export const DEFAULT_CROP: LoftCrop = { x: 50, y: 50, zoom: 1 };

/** Width over height for a fixed ratio; null means the picture's own. */
export function ratioNumber(ratio: LoftRatio): number | null {
  switch (ratio) {
    case "4:5":
      return 0.8;
    case "2:3":
      return 2 / 3;
    case "1:1":
      return 1;
    case "5:4":
      return 1.25;
    case "3:2":
      return 1.5;
    default:
      return null;
  }
}

/** True when the picture is shown whole, as shot: no canvas work needed. */
export function isUncropped(ratio: LoftRatio, crop: LoftCrop): boolean {
  return ratio === "auto" && crop.zoom <= 1.001;
}

/** Inline styles for the still's frame and image. */
export function cropStyles(ratio: LoftRatio, crop: LoftCrop): { frame: CSSProperties; img: CSSProperties } {
  const r = ratioNumber(ratio);
  return {
    frame: r ? { aspectRatio: String(r) } : { aspectRatio: "auto" },
    img: {
      objectFit: r ? "cover" : "contain",
      objectPosition: `${crop.x}% ${crop.y}%`,
      transform: crop.zoom > 1 ? `scale(${crop.zoom})` : undefined,
      transformOrigin: `${crop.x}% ${crop.y}%`,
    },
  };
}

/**
 * The cropped picture as a PNG data URL for the 3D scene (the hall decodes
 * with `createImageBitmap`, which takes data URLs). Same-origin media only,
 * which `/api/media/...` is. `maxEdge` bounds the texture.
 */
export async function cropToDataUrl(url: string, ratio: LoftRatio, crop: LoftCrop, maxEdge = 1024): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  const iw = bitmap.width;
  const ih = bitmap.height;
  const r = ratioNumber(ratio) ?? iw / ih;
  // The frame, scaled so its longer edge is maxEdge.
  const fw = r >= 1 ? maxEdge : Math.round(maxEdge * r);
  const fh = r >= 1 ? Math.round(maxEdge / r) : maxEdge;
  const s = Math.max(fw / iw, fh / ih) * Math.max(1, crop.zoom);
  const dw = iw * s;
  const dh = ih * s;
  const dx = (crop.x / 100) * (fw - dw);
  const dy = (crop.y / 100) * (fh - dh);
  const c = document.createElement("canvas");
  c.width = fw;
  c.height = fh;
  const g = c.getContext("2d");
  if (!g) throw new Error("no 2d context");
  g.drawImage(bitmap, dx, dy, dw, dh);
  bitmap.close();
  return c.toDataURL("image/png");
}
