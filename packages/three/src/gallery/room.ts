/**
 * Where work goes in a room, and where a visitor may stand.
 *
 * Plain maths, no React and no three.js objects, so the layout can be reasoned
 * about (and tested) without standing up a renderer — the same split
 * `world.ts` makes for the runner. Every function takes the {@link RoomDesign}
 * it is working in; the hall is the default so a caller that only ever wanted
 * one room need not mention it.
 */

import {
  BODY_RADIUS,
  EYE_Y,
  HANG_CENTRE_Y,
  MIN_FLOOR_CLEARANCE,
  RATIO_TOLERANCE,
  VIEW_DISTANCE,
} from './constants';
import { HALL, type RoomDesign } from './designs';
import type {
  FittedSize,
  GalleryLayout,
  GalleryPiece,
  PlinthSlot,
  SurfaceId,
  WallSlot,
  WallSurface,
} from './types';

export { EYE_Y, HANG_CENTRE_Y, MIN_FLOOR_CLEARANCE, VIEW_DISTANCE, BODY_RADIUS };

/** The hall's dimensions, kept for callers that predate room designs. */
export const ROOM = { ...HALL.room, centerWall: HALL.centreWall! } as const;

/** The hall's hangable faces, kept for callers that predate room designs. */
export const SURFACES: readonly WallSurface[] = HALL.surfaces;

export function getSurface(id: SurfaceId, design: RoomDesign = HALL): WallSurface {
  const surface = design.surfaces.find((s) => s.id === id);
  if (!surface) throw new Error(`Unknown surface '${id}' in room '${design.id}'`);
  return surface;
}

/**
 * Splits `total` across `weights` proportionally, handing the rounding
 * leftovers to the widest walls first. Plain proportional rounding would let
 * several surfaces each round down and leave pieces on the floor.
 */
function distribute(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (total * w) / sum);
  const counts = exact.map(Math.floor);
  let remaining = total - counts.reduce((a, b) => a + b, 0);

  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (const { index } of byRemainder) {
    if (remaining <= 0) break;
    counts[index]! += 1;
    remaining -= 1;
  }
  return counts;
}

/**
 * How many pieces a surface will take before they start to crowd. A gallery
 * that hangs work shoulder to shoulder stops reading as a gallery.
 */
const MIN_SLOT_WIDTH = 1.5;

/** The work's real size in metres, or null if it was never recorded. */
export function trueSizeMetres(
  piece: GalleryPiece,
): { width: number; height: number } | null {
  const { heightCm, widthCm } = piece;
  if (
    typeof heightCm !== 'number' ||
    typeof widthCm !== 'number' ||
    !(heightCm > 0) ||
    !(widthCm > 0)
  ) {
    return null;
  }
  return { width: widthCm / 100, height: heightCm / 100 };
}

/**
 * Where to centre a piece of this height. Everything hangs on the gallery line
 * until the work is tall enough that doing so would push its bottom edge into
 * the floor, at which point it is raised just enough to clear it.
 */
export function hangCentreFor(height: number | null): number {
  if (!height) return HANG_CENTRE_Y;
  return Math.max(HANG_CENTRE_Y, MIN_FLOOR_CLEARANCE + height / 2);
}

/**
 * Assigns every piece a place: wall work spread across the hangable faces in
 * proportion to how much wall each one has, standing work dealt round the
 * bays so none of them empties out.
 */
export function layoutGallery(
  pieces: readonly GalleryPiece[],
  design: RoomDesign = HALL,
): GalleryLayout {
  const omitted: GalleryPiece[] = [];
  const wallPieces: GalleryPiece[] = [];
  const plinthPieces: GalleryPiece[] = [];

  for (const piece of pieces) {
    if (!piece.imageUrl) omitted.push(piece);
    else if (piece.display === 'plinth') plinthPieces.push(piece);
    else wallPieces.push(piece);
  }

  const surfaces = design.surfaces;
  const capacities = surfaces.map((s) => Math.max(1, Math.floor(s.usableWidth / MIN_SLOT_WIDTH)));
  const capacity = capacities.reduce((a, b) => a + b, 0);

  // Anything past what the room can hold hangs nowhere rather than on top of
  // something else; the caller decides whether to paginate or open a second room.
  const hanging = wallPieces.slice(0, capacity);
  omitted.push(...wallPieces.slice(capacity));

  const counts = distribute(
    hanging.length,
    surfaces.map((s) => s.usableWidth),
  ).map((n, i) => Math.min(n, capacities[i]!));

  // Proportional rounding can undershoot once per-surface capacity clamps it;
  // push the remainder onto whichever surfaces still have room.
  let overflow = hanging.length - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; overflow > 0 && i < counts.length; i += 1) {
    const room = capacities[i]! - counts[i]!;
    const take = Math.min(room, overflow);
    counts[i]! += take;
    overflow -= take;
  }

  const walls: WallSlot[] = [];
  let cursor = 0;

  surfaces.forEach((surface, surfaceIndex) => {
    const count = counts[surfaceIndex]!;
    if (count === 0) return;

    const slotWidth = surface.usableWidth / count;

    for (let i = 0; i < count; i += 1) {
      const piece = hanging[cursor];
      cursor += 1;
      if (!piece) break;

      // The gap between neighbours is what reads as breathing room, so a
      // piece is never allowed the full slot.
      const maxWidth = slotWidth * 0.78;
      const maxHeight = surface.maxPieceHeight;

      // Only a piece whose real size is known can be tall enough to need
      // raising, and its height is known here without waiting for the image.
      const trueSize = trueSizeMetres(piece);
      const fittedHeight = trueSize
        ? trueSize.height *
          Math.min(1, maxWidth / trueSize.width, maxHeight / trueSize.height)
        : null;

      walls.push({
        piece,
        surfaceId: surface.id,
        localX: -surface.usableWidth / 2 + slotWidth * (i + 0.5),
        centreY: hangCentreFor(fittedHeight),
        maxWidth,
        maxHeight,
      });
    }
  });

  const bays = design.plinths.bays;
  const perBay: GalleryPiece[][] = bays.map(() => []);
  plinthPieces.forEach((piece, index) => perBay[index % bays.length]!.push(piece));

  const plinths: PlinthSlot[] = [];
  perBay.forEach((inBay, bayIndex) => {
    const step = design.plinths.span / Math.max(1, inBay.length);
    inBay.forEach((piece, i) => {
      const x = inBay.length <= 1 ? 0 : -design.plinths.span / 2 + step * (i + 0.5);
      plinths.push({ piece, position: [x, 0, bays[bayIndex]!] });
    });
  });

  return { walls, plinths, omitted };
}

/**
 * Sizes a piece for its slot, and works out how its photograph should sit
 * inside that.
 *
 * Recorded centimetres win: a gallery is only convincing if a small drawing
 * reads as small next to an eight-foot canvas. The image's own proportions
 * stand in when nothing was recorded, which keeps the shape honest even though
 * the scale is invented.
 *
 * When the two disagree — a square photograph of a canvas twice as tall as it
 * is wide — the picture is never stretched to reconcile them. By default the
 * whole photo is kept and the piece shrinks to its shape; `cover` opts into
 * keeping the recorded footprint and cropping the photo into it instead.
 */
export function fitPiece(
  piece: GalleryPiece,
  imageAspect: number,
  maxWidth: number,
  maxHeight: number,
): FittedSize {
  const aspect = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : 1;
  const uncropped = { repeat: [1, 1] as [number, number], offset: [0, 0] as [number, number] };
  const trueSize = trueSizeMetres(piece);

  if (!trueSize) {
    // Without recorded dimensions every piece is given the same presence, so
    // the wall still reads evenly rather than implying sizes nobody recorded.
    const nominalHeight = Math.min(maxHeight, 1.1);
    let height = nominalHeight;
    let width = height * aspect;

    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspect;
    }
    return { width, height, ...uncropped, ratioMismatch: false };
  }

  const scale = Math.min(1, maxWidth / trueSize.width, maxHeight / trueSize.height);
  let width = trueSize.width * scale;
  let height = trueSize.height * scale;

  const trueAspect = trueSize.width / trueSize.height;
  const mismatch = Math.abs(trueAspect - aspect) / trueAspect > RATIO_TOLERANCE;
  if (!mismatch) return { width, height, ...uncropped, ratioMismatch: false };

  if (piece.imageFit !== 'cover') {
    // The default. Keep every pixel of the photo and give up the recorded
    // footprint: a mismatch usually means the photograph is a detail crop
    // rather than a shot of the whole canvas, and cropping a crop cuts into
    // the work itself. Losing scale is recoverable — a full-canvas photo fixes
    // it — where a bad crop just looks like damage.
    if (aspect > trueAspect) height = width / aspect;
    else width = height * aspect;
    return { width, height, ...uncropped, ratioMismatch: true };
  }

  // Keep the recorded footprint and take the middle of the photo to fill it.
  const planeAspect = width / height;
  const repeatX = aspect > planeAspect ? planeAspect / aspect : 1;
  const repeatY = aspect > planeAspect ? 1 : aspect / planeAspect;

  return {
    width,
    height,
    repeat: [repeatX, repeatY],
    offset: [(1 - repeatX) / 2, (1 - repeatY) / 2],
    ratioMismatch: true,
  };
}

/**
 * Keeps the camera in the room and out of the middle wall. A visitor who can
 * walk through the exhibit stops believing in it, and one who ends up behind
 * a wall has no way back.
 */
export function clampToRoom(x: number, z: number, design: RoomDesign = HALL): [number, number] {
  const limitX = design.room.width / 2 - BODY_RADIUS;
  const limitZ = design.room.depth / 2 - BODY_RADIUS;

  let nextX = Math.min(limitX, Math.max(-limitX, x));
  let nextZ = Math.min(limitZ, Math.max(-limitZ, z));

  const wall = design.centreWall;
  if (wall) {
    // Push out of the free-standing wall along whichever axis is the shorter
    // escape, so sliding along its face feels like a wall rather than a trap.
    const wallHalfX = wall.length / 2 + BODY_RADIUS;
    const wallHalfZ = wall.thickness / 2 + BODY_RADIUS;

    if (Math.abs(nextX) < wallHalfX && Math.abs(nextZ) < wallHalfZ) {
      const escapeZ = wallHalfZ - Math.abs(nextZ);
      const escapeX = wallHalfX - Math.abs(nextX);

      if (escapeZ <= escapeX) nextZ = (nextZ >= 0 ? 1 : -1) * wallHalfZ;
      else nextX = (nextX >= 0 ? 1 : -1) * wallHalfX;
    }
  }

  return [nextX, nextZ];
}

/** Where the camera should stand to look at a hung piece head-on. */
export function viewpointForSlot(
  slot: WallSlot,
  design: RoomDesign = HALL,
): { position: [number, number, number]; lookAt: [number, number, number] } {
  const surface = getSurface(slot.surfaceId, design);
  const sin = Math.sin(surface.rotationY);
  const cos = Math.cos(surface.rotationY);

  // Rotate the slot's local offset and the surface normal (local +Z) into world space.
  const worldX = surface.origin[0] + slot.localX * cos;
  const worldZ = surface.origin[2] - slot.localX * sin;

  const [standX, standZ] = clampToRoom(
    worldX + sin * VIEW_DISTANCE,
    worldZ + cos * VIEW_DISTANCE,
    design,
  );

  return {
    position: [standX, EYE_Y, standZ],
    lookAt: [worldX, slot.centreY, worldZ],
  };
}

/** Where the camera should stand to look at a piece on a plinth. */
export function viewpointForPlinth(
  slot: PlinthSlot,
  design: RoomDesign = HALL,
): { position: [number, number, number]; lookAt: [number, number, number] } {
  const [x, , z] = slot.position;
  // Approach from the bay's outer side, so the visitor is not shoved into a
  // wall to look at it.
  const side = z >= 0 ? 1 : -1;
  const [standX, standZ] = clampToRoom(x, z + side * 1.5, design);

  return {
    position: [standX, EYE_Y - 0.15, standZ],
    lookAt: [x, PLINTH.displayY, z],
  };
}

export const PLINTH = {
  baseWidth: 0.5,
  baseHeight: 0.95,
  caseHeight: 0.55,
  /** Centre of the object inside the vitrine. */
  displayY: 0.95 + 0.55 / 2,
} as const;
