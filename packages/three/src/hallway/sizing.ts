import { fitPiece } from '../gallery/room';
import type { FittedSize } from '../gallery/types';
import type { HallwayPiece } from './types';
import { framedPiece, type FrameRatio } from './framing';

/**
 * A piece's size on a hallway wall: its recorded size when there is one,
 * shrunk only if it would not fit between the slate and the cornice, and the
 * photograph never stretched (the gallery's `fitPiece` rules, shared). A
 * fixed `ratio` keeps the recorded height and takes its width from the ratio.
 */
export function pieceSize(
  piece: HallwayPiece,
  imageAspect: number,
  wallLength: number,
  hang: { minBottom: number; maxTop: number },
  ratio: FrameRatio = 'auto',
): FittedSize {
  const framed = framedPiece(piece, imageAspect, ratio);
  const p = framed.piece;
  return fitPiece(
    { id: p.id, title: p.title, imageUrl: p.imageUrl, heightCm: p.heightCm, widthCm: p.widthCm },
    framed.aspect,
    Math.max(0.3, wallLength - 0.3),
    hang.maxTop - hang.minBottom - 0.2,
  );
}

/**
 * When each piece's lamp was switched on. Plain module state rather than a
 * store: it is read every frame by every lamp and never needs to re-render.
 */
const litAt = new Map<string, number>();
const WARM_UP_MS = 900;

export function markLit(id: string): () => void {
  litAt.set(id, performance.now());
  return () => litAt.delete(id);
}

/** 0 → 1 as a lamp warms up, with a faint flicker on the way, like a filament. */
export function lampLevel(id: string): number {
  const since = litAt.get(id);
  if (since == null) return 0;
  const t = (performance.now() - since) / WARM_UP_MS;
  if (t >= 1) return 1;
  const eased = 1 - (1 - t) ** 3;
  return Math.max(0, eased - (t < 0.5 ? Math.abs(Math.sin(t * 40)) * 0.15 : 0));
}
