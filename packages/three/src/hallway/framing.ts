import type { HallwayPiece } from './types';

/**
 * How a hung work is framed: the frame's proportion and the crop inside it.
 * The vocabulary and the maths live here so the editor, the drop outline and
 * the rendered piece agree (loft scene editor phase 2, 2026-10-29).
 *
 * The crop is "cover" fit at `zoom`, with the point (x %, y %) of the picture
 * kept where CSS `object-position: x% y%` would put it; at zoom 1 and ratio
 * 'auto' nothing is cropped and the piece is drawn as before.
 */

/** The frame's proportion: the picture's own, or a fixed shape it is cropped to. */
export type FrameRatio = 'auto' | '4:5' | '2:3' | '1:1' | '5:4' | '3:2';

export const FRAME_RATIOS: ReadonlyArray<{ value: FrameRatio; label: string }> = [
  { value: 'auto', label: 'As shot' },
  { value: '4:5', label: 'Portrait 4:5' },
  { value: '2:3', label: 'Tall 2:3' },
  { value: '1:1', label: 'Square' },
  { value: '5:4', label: 'Landscape 5:4' },
  { value: '3:2', label: 'Wide 3:2' },
];

/** Where the picture is centred inside the frame (0–100 %) and how far it is zoomed in (1–3). */
export interface Crop {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_CROP: Crop = { x: 50, y: 50, zoom: 1 };
export const ZOOM_MAX = 3;

/** Width over height for a fixed ratio; null for the picture's own. */
export function ratioNumber(ratio: FrameRatio): number | null {
  switch (ratio) {
    case '4:5':
      return 0.8;
    case '2:3':
      return 2 / 3;
    case '1:1':
      return 1;
    case '5:4':
      return 1.25;
    case '3:2':
      return 1.5;
    default:
      return null;
  }
}

export function isFrameRatio(value: unknown): value is FrameRatio {
  return FRAME_RATIOS.some((r) => r.value === value);
}

/** A placement's ratio, 'auto' for anything missing or unknown. */
export function placementRatio(p: { ratio?: string | null }): FrameRatio {
  return isFrameRatio(p.ratio) ? p.ratio : 'auto';
}

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** A placement's crop, clamped, with the default for anything missing. */
export function placementCrop(p: { crop?: Partial<Crop> | null }): Crop {
  const c = p.crop;
  if (!c) return DEFAULT_CROP;
  return { x: clamp(c.x, 0, 100, 50), y: clamp(c.y, 0, 100, 50), zoom: clamp(c.zoom, 1, ZOOM_MAX, 1) };
}

/** True when the picture is shown whole, as shot. */
export function isUncropped(ratio: FrameRatio, crop: Crop): boolean {
  return ratio === 'auto' && crop.zoom <= 1.001;
}

/**
 * The piece as it is sized for a fixed ratio: its recorded height kept, the
 * width following the ratio, and the image aspect replaced by the ratio so
 * `fitPiece` sees no mismatch. With 'auto' the piece and aspect are returned
 * unchanged.
 */
export function framedPiece(piece: HallwayPiece, imageAspect: number, ratio: FrameRatio): { piece: HallwayPiece; aspect: number } {
  const r = ratioNumber(ratio);
  if (!r) return { piece, aspect: imageAspect };
  const h = piece.heightCm ?? (piece.widthCm ? piece.widthCm / (imageAspect || 1) : null);
  return { piece: { ...piece, heightCm: h, widthCm: h ? h * r : null }, aspect: r };
}

/**
 * Texture repeat and offset for a cover crop of an image of `imageAspect`
 * into a plane of `planeAspect`, zoomed in `crop.zoom` times, keeping the
 * point (x %, y %) of the image where object-position would. Texture v runs
 * bottom-up, so y is flipped.
 */
export function cropUv(imageAspect: number, planeAspect: number, crop: Crop): { repeat: [number, number]; offset: [number, number] } {
  const ia = imageAspect > 0 ? imageAspect : 1;
  const pa = planeAspect > 0 ? planeAspect : 1;
  const zoom = Math.max(1, crop.zoom);
  const repeatX = (ia > pa ? pa / ia : 1) / zoom;
  const repeatY = (ia > pa ? 1 : ia / pa) / zoom;
  return {
    repeat: [repeatX, repeatY],
    offset: [(1 - repeatX) * (crop.x / 100), (1 - repeatY) * (1 - crop.y / 100)],
  };
}
