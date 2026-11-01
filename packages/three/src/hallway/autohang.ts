import type { Placement } from './layout';
import { DEFAULT_FRAME_ID, getFrame, outerSize } from './frames';
import { pieceSize } from './sizing';
import type { HallwayPiece } from './types';
import type { Venue } from './venue';

/** Clear wall left between neighbours when hanging automatically. */
const GAP = 0.35;
/** What an unmeasured, unloaded piece is assumed to take: generous, so nothing touches once it loads. */
const ASSUMED_ASPECT = 1.1;

/**
 * Hang a list of works without a curator: in a slotted room, one per frame in
 * walking order; on open walls, left to right along each face in walking
 * order, on the venue's hang line, until the walls are full. Works that do
 * not fit are left off rather than crowded.
 */
export function autoHang(venue: Venue, pieces: readonly HallwayPiece[]): Placement[] {
  const out: Placement[] = [];
  if (venue.slots) {
    const slots = [...venue.slots].sort((a, b) => venue.orderKey(a.id, 0) - venue.orderKey(b.id, 0));
    pieces.slice(0, slots.length).forEach((p, i) => {
      out.push({ pieceId: p.id, wallId: slots[i]!.id, x: 0, y: 0, frameId: null });
    });
    return out;
  }

  const frame = getFrame(DEFAULT_FRAME_ID);
  const faces = [...venue.faces]
    .filter((f) => f.length > 1.2)
    .sort((a, b) => venue.orderKey(a.id, 0) - venue.orderKey(b.id, 0));
  let next = 0;
  for (const face of faces) {
    // Faces run along their own +X; walking order may run either way along it.
    const forward = venue.orderKey(face.id, 1) >= venue.orderKey(face.id, -1) ? 1 : -1;
    let cursor = -face.length / 2 + GAP;
    while (next < pieces.length) {
      const piece = pieces[next]!;
      const size = pieceSize(piece, piece.aspect ?? ASSUMED_ASPECT, face.length, venue.hang);
      const { width, height } = outerSize(size.width, size.height, frame);
      if (cursor + width > face.length / 2 - GAP) break;
      const x = (cursor + width / 2) * forward;
      const y = Math.max(venue.hang.minBottom + height / 2, Math.min(venue.hang.maxTop - height / 2, venue.hang.line));
      out.push({ pieceId: piece.id, wallId: face.id, x, y, frameId: null });
      cursor += width + GAP;
      next++;
    }
    if (next >= pieces.length) break;
  }
  return out;
}
