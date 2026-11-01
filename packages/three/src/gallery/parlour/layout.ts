/**
 * The parlour: one painting, seen the way a buyer would live with it — from
 * the sofa across a coffee table, with a chair either side for the angles.
 *
 * World frame matches the gallery's: metres, Y up, the art on the north wall
 * (−Z). The sofa sits against the south wall facing it.
 */

export const PARLOUR = { width: 5.2, depth: 5.6, height: 3.1 } as const;

export const HALF_W = PARLOUR.width / 2;
export const HALF_D = PARLOUR.depth / 2;

/** Depth of the masonry, seen in the reveals of the two openings. */
export const WALL_THICKNESS = 0.22;

/** Edwardian heights: panelled dado, papered field, picture rail, frieze. */
export const DADO_Y = 0.9;
export const PICTURE_RAIL_Y = 2.55;

/**
 * The art hangs between the top of the dado and just under the picture rail,
 * so the box a piece must fit is the wall between those, less the sconces
 * either side.
 */
export const ART_MAX_WIDTH = 2.6;
export const ART_MAX_HEIGHT = 1.5;
export const ART_MIN_BOTTOM = DADO_Y + 0.08;
export const ART_CENTRE_Y = 1.62;

/**
 * Openings, in the owning wall's own left-to-right frame (see `Wall`). The
 * west wall's frame runs north-to-south reversed, so both sit toward the art
 * wall, where the sofa can see them.
 */
export const FRENCH_DOORS = { x: 1.45, width: 1.4, height: 2.35 } as const;
export const SIDE_DOOR = { x: -1.45, width: 0.95, height: 2.2 } as const;

export type ParlourSeatId = 'left' | 'sofa' | 'right';

export interface ParlourSeat {
  id: ParlourSeatId;
  label: string;
  /** Seated eye, in world space. */
  position: [number, number, number];
}

/** Where the furniture stands. Seats are derived from these. */
export const SOFA = { position: [0, 0, 1.78] as [number, number, number], scale: 1.15 };
export const COFFEE_TABLE = { position: [0, 0, 0.3] as [number, number, number] };
export const VASE = { position: [-0.95, 0, 0.22] as [number, number, number], scale: 1.3 };

/** Turned in toward the table, half facing the art. */
const CHAIR_X = 1.62;
const CHAIR_Z = 0.25;
const CHAIR_FACING = Math.atan2(CHAIR_X, -0.95);

export const CHAIRS = [
  { id: 'left', position: [-CHAIR_X, 0, CHAIR_Z] as [number, number, number], rotationY: CHAIR_FACING },
  { id: 'right', position: [CHAIR_X, 0, CHAIR_Z] as [number, number, number], rotationY: -CHAIR_FACING },
] as const;

const SEATED_EYE = 1.1;

/** A little back from the chair's centre, where a sitter's head is. */
function chairEye(x: number, z: number, rotationY: number): [number, number, number] {
  const back = 0.08;
  return [x - Math.sin(rotationY) * back, SEATED_EYE, z - Math.cos(rotationY) * back];
}

export const PARLOUR_SEATS: readonly ParlourSeat[] = [
  { id: 'left', label: 'Left chair', position: chairEye(-CHAIR_X, CHAIR_Z, CHAIR_FACING) },
  { id: 'sofa', label: 'Sofa', position: [0, SEATED_EYE, SOFA.position[2] - 0.1] },
  { id: 'right', label: 'Right chair', position: chairEye(CHAIR_X, CHAIR_Z, -CHAIR_FACING) },
];

export function getSeat(id: ParlourSeatId): ParlourSeat {
  return PARLOUR_SEATS.find((s) => s.id === id) ?? PARLOUR_SEATS[1]!;
}
