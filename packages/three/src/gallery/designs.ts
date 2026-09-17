/**
 * The rooms a gallery can be held in.
 *
 * A design is data: dimensions, which faces hang work, where plinths stand,
 * and whether the room is sealed or open to daylight. The layout engine reads
 * one of these rather than module constants, so adding a room is adding a
 * record here plus the shell that draws it — not a second copy of the placing
 * maths.
 */

import { HANG_CENTRE_Y, SURFACE_EPSILON } from './constants';
import type { SurfaceId, WallSurface } from './types';

export type RoomDesignId = 'hall' | 'pavilion';

export interface RoomDimensions {
  width: number;
  depth: number;
  height: number;
}

export interface CentreWall {
  length: number;
  height: number;
  thickness: number;
}

export interface RoomDesign {
  id: RoomDesignId;
  /** Shown in the room switcher. */
  name: string;
  description: string;
  room: RoomDimensions;
  /** The free-standing wall down the middle, or null for a room without one. */
  centreWall: CentreWall | null;
  surfaces: readonly WallSurface[];
  /** Where plinths stand: how far along X they spread, and the z of each bay. */
  plinths: { span: number; bays: number[] };
  /** Where the visitor is standing when the room opens. */
  start: [number, number, number];
  /**
   * The room is open to the outside. Changes the lighting from gallery
   * downlights to daylight, and tells the shell to draw a world beyond it.
   */
  outdoors: boolean;
}

interface PerimeterOptions {
  room: RoomDimensions;
  maxPieceHeight: number;
  /** Walls that hang nothing — a glazed elevation, say. */
  exclude?: SurfaceId[];
}

/**
 * The four walls of a rectangular room, facing inwards. `rotationY` turns a
 * plane's default +Z normal into the room, so a consumer can drop a group at
 * `origin` with this rotation and lay pieces out along its local X.
 */
function perimeterSurfaces({ room, maxPieceHeight, exclude = [] }: PerimeterOptions): WallSurface[] {
  const halfW = room.width / 2;
  const halfD = room.depth / 2;

  const all: WallSurface[] = [
    {
      id: 'west',
      origin: [-halfW + SURFACE_EPSILON, HANG_CENTRE_Y, 0],
      rotationY: Math.PI / 2,
      usableWidth: room.depth - 2,
      maxPieceHeight,
    },
    {
      id: 'east',
      origin: [halfW - SURFACE_EPSILON, HANG_CENTRE_Y, 0],
      rotationY: -Math.PI / 2,
      usableWidth: room.depth - 2,
      maxPieceHeight,
    },
    {
      id: 'north',
      origin: [0, HANG_CENTRE_Y, -halfD + SURFACE_EPSILON],
      rotationY: 0,
      usableWidth: room.width - 3,
      maxPieceHeight,
    },
    {
      id: 'south',
      origin: [0, HANG_CENTRE_Y, halfD - SURFACE_EPSILON],
      rotationY: Math.PI,
      usableWidth: room.width - 3,
      maxPieceHeight,
    },
  ];

  return all.filter((s) => !exclude.includes(s.id));
}

/** Both faces of a free-standing wall running along X at z = 0. */
function centreWallSurfaces(wall: CentreWall, maxPieceHeight: number): WallSurface[] {
  const halfT = wall.thickness / 2;
  return [
    {
      id: 'centerNorth',
      origin: [0, HANG_CENTRE_Y, -halfT - SURFACE_EPSILON],
      rotationY: Math.PI,
      usableWidth: wall.length - 1,
      maxPieceHeight,
    },
    {
      id: 'centerSouth',
      origin: [0, HANG_CENTRE_Y, halfT + SURFACE_EPSILON],
      rotationY: 0,
      usableWidth: wall.length - 1,
      maxPieceHeight,
    },
  ];
}

// ─── The hall ───────────────────────────────────────────────────────────────
// Plan is an H: the long east and west walls are the uprights, and a
// free-standing wall down the middle is the crossbar. It divides the floor
// into a north and a south bay, hangs work on both of its faces, and gives a
// visitor a reason to walk a loop rather than stand in a box turning around.
//
//        -X  ┌─────────────────────┐  +X
//            │      north bay      │
//            │  ╶───────────────╴  │   ← free-standing wall (hangs both faces)
//            │      south bay      │
//            └─────────────────────┘
//              gaps at each end to walk around

const HALL_ROOM: RoomDimensions = { width: 20, depth: 14, height: 4.5 };
const HALL_CENTRE: CentreWall = { length: 12, height: 3.6, thickness: 0.35 };

export const HALL: RoomDesign = {
  id: 'hall',
  name: 'The hall',
  description: 'An enclosed H-plan room with a free-standing wall down the middle.',
  room: HALL_ROOM,
  centreWall: HALL_CENTRE,
  surfaces: [
    ...perimeterSurfaces({ room: HALL_ROOM, maxPieceHeight: 2.9 }),
    // The free-standing wall is shorter than the perimeter, so its pieces are
    // capped lower to keep the same clearance above and below.
    ...centreWallSurfaces(HALL_CENTRE, 2.7),
  ],
  plinths: { span: 9, bays: [-(HALL_ROOM.depth / 2 + HALL_CENTRE.thickness / 2) / 2, (HALL_ROOM.depth / 2 + HALL_CENTRE.thickness / 2) / 2] },
  start: [0, 0, 5.5],
  outdoors: false,
};

// ─── The pavilion ───────────────────────────────────────────────────────────
// Taller, wider, and open: the whole south elevation is glazed doors onto
// ground and sky, so the room is lit by daylight falling across the work
// rather than by track lights aimed at it. The extra height is the point —
// it takes a canvas the hall would have to shrink, and it makes the walk in
// from outside part of the experience.

const PAVILION_ROOM: RoomDimensions = { width: 26, depth: 17, height: 7 };
const PAVILION_CENTRE: CentreWall = { length: 15, height: 4.4, thickness: 0.4 };

export const PAVILION: RoomDesign = {
  id: 'pavilion',
  name: 'The pavilion',
  description: 'A daylit hall with a glazed south wall opening onto the grounds.',
  room: PAVILION_ROOM,
  centreWall: PAVILION_CENTRE,
  surfaces: [
    // Nothing hangs on the south elevation — it is glass and doors.
    ...perimeterSurfaces({ room: PAVILION_ROOM, maxPieceHeight: 3.8, exclude: ['south'] }),
    ...centreWallSurfaces(PAVILION_CENTRE, 3.2),
  ],
  plinths: { span: 12, bays: [-4.5, 4.9] },
  // Standing just inside the doors, looking in.
  start: [0, 0, 7],
  outdoors: true,
};

export const ROOM_DESIGNS: readonly RoomDesign[] = [HALL, PAVILION];

export function getDesign(id: RoomDesignId | undefined): RoomDesign {
  return ROOM_DESIGNS.find((d) => d.id === id) ?? HALL;
}
