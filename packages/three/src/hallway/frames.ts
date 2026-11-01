/**
 * Frame styles a piece can be hung in.
 *
 * Every style is drawn procedurally today. `modelUrl` is where a real frame
 * asset goes once one exists: a glTF moulding modelled around a 1 × 1 opening,
 * centred on the origin with its face toward +Z. It is stretched to each
 * piece's size, so the asset should be built to survive that — a plain or
 * evenly repeating profile, not carved corners. When a model is given, the
 * procedural numbers still matter: `border` is how far the moulding extends
 * past the image, and the fallback is drawn from them while the file loads.
 *
 * A real frame — scanned or photographed, carved corners and all — gives
 * `modelOpening` instead: the asset is then modelled at its true size around
 * that opening, and it is fitted by slicing rather than stretching. Corners
 * keep their shape and only the rails' length changes to fit the piece. Such a
 * frame also grows and shrinks with the piece (see `frameScale`), so it keeps
 * the same prominence on a large canvas as on a small one; `border` and
 * `depth` are then its true sizes around its own opening.
 */
export interface FrameStyle {
  id: string;
  label: string;
  /** Moulding width, metres, beyond the image on each side. */
  border: number;
  depth: number;
  colour: string;
  metalness?: number;
  roughness?: number;
  /** A mount board between moulding and image, metres. 0 for none. */
  mount?: number;
  mountColour?: string;
  modelUrl?: string | null;
  /** The asset's own opening, metres, width × height. Switches fitting to slicing. */
  modelOpening?: readonly [number, number] | null;
  /**
   * How far into the frame's depth the piece sits, 0 (against the wall) to 1
   * (level with the frame's front). A carved frame holds its picture well back
   * from the carving; only used with `modelOpening`. Default 0.35.
   */
  imageRecess?: number;
  /** A small picture of the frame for pickers. */
  thumbnailUrl?: string | null;
}

export const FRAME_STYLES: readonly FrameStyle[] = [
  { id: 'gallery-black', label: 'Black gallery', border: 0.045, depth: 0.05, colour: '#1f1c19', roughness: 0.55, mount: 0.05 },
  { id: 'walnut', label: 'Walnut', border: 0.07, depth: 0.055, colour: '#4a2e1c', roughness: 0.45 },
  { id: 'gilt', label: 'Gilt', border: 0.1, depth: 0.07, colour: '#a8823f', metalness: 0.55, roughness: 0.38 },
  { id: 'float', label: 'Float, no frame', border: 0.012, depth: 0.04, colour: '#e9e4da', roughness: 0.8 },
];

export const DEFAULT_FRAME_ID = 'gallery-black';

export function getFrame(id: string | null | undefined, styles: readonly FrameStyle[] = FRAME_STYLES): FrameStyle {
  return styles.find((s) => s.id === id) ?? styles.find((s) => s.id === DEFAULT_FRAME_ID) ?? styles[0]!;
}

/**
 * How much a real frame is scaled to hold a piece of this size: 1 for a piece
 * the size of the frame's own opening. Procedural styles always return 1.
 */
export function frameScale(frame: FrameStyle, width: number, height: number): number {
  if (!frame.modelOpening) return 1;
  const [ow, oh] = frame.modelOpening;
  return Math.sqrt((width / ow) * (height / oh));
}

/** The room a framed piece takes on the wall, moulding included. */
export function outerSize(width: number, height: number, frame: FrameStyle) {
  const edge = frame.border * frameScale(frame, width, height) + (frame.mount ?? 0);
  return { width: width + edge * 2, height: height + edge * 2 };
}
