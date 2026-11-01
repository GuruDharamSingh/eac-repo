import type { ComponentType } from 'react';
import {
  BODY_RADIUS,
  EYE_Y,
  HALF_WIDTH,
  HANG_LINE_Y,
  HANG_MAX_TOP,
  HANG_MIN_BOTTOM,
  OVERVIEW,
  ROUTE_LENGTH,
  WALL_FACES,
  clampToHall,
  facePoint,
  routeDistance,
  routePoint,
  sideOf,
  wallPose,
  type WallFace,
  type WallSide,
} from './layout';
import { HallwayShell } from './HallwayShell';

type V2 = [number, number];
export type V3 = [number, number, number];

/**
 * A ready-made frame in a scanned room: the picture opening, corners
 * top-left, top-right, bottom-right, bottom-left as seen facing it. A work
 * dropped on a slot fills the opening; the scanned frame stays around it.
 */
export interface Slot {
  id: string;
  shape: 'rect' | 'octagon';
  wall: number;
  corners: [V3, V3, V3, V3];
}

export interface Pose {
  position: V3;
  lookAt: V3;
}

/**
 * A space's own lighting as built: what `SceneLights` draws at the default
 * settings, and what an installation's `SceneLighting` adjusts. A venue with
 * no light entries (a photographed scan drawn as captured) shows only its
 * background, and the lighting settings do not apply to it.
 */
export interface VenueLights {
  background: string;
  hemisphere?: { sky: string; ground: string; intensity: number };
  ambient?: { color: string; intensity: number };
  /** The key light; its position is a direction toward the light from the origin. */
  key?: { position: V3; color: string; intensity: number };
}

/**
 * A space a collection can be hung in.
 *
 * Everything the editor and the visit need to know about a space lives here,
 * so a corridor drawn in code and a room loaded from a model are handled by
 * the same placing, ordering, lighting and camera code. A venue's `id` is what
 * an installation stores; its faces' ids are what each placement stores, so
 * neither may change once work has been hung in it.
 */
export interface Venue {
  id: string;
  name: string;
  /** One line shown under the view — the model's licence, where it needs one. */
  credit?: string | null;
  faces: readonly WallFace[];
  /**
   * Frames already in the room. When present, work fills these one per slot
   * instead of hanging freely; faces then has one per slot, same ids.
   */
  slots?: readonly Slot[];
  hang: { line: number; minBottom: number; maxTop: number };
  eyeY: number;
  /** Walking order: a number that rises along the way a visitor goes round. */
  orderKey: (faceId: string, x: number) => number;
  /** Keeps a walking visitor inside. */
  clamp: (x: number, z: number) => V2;
  /** Where walking starts when the cutaway was at `s`. */
  walkFrom: (s: number) => Pose;
  overview: { target: V3; position: V3; span: number };
  /**
   * The cutaway: a path along the hangable walls, parametrised by `s` from 0
   * to `length`, with a pose for each point and side. `flip` is where the
   * other side's view of the same spot is.
   */
  wall: {
    length: number;
    margin: number;
    pose: (s: number, side: WallSide) => Pose;
    locate: (faceId: string, x: number) => { s: number; side: WallSide } | null;
    flip: (s: number, side: WallSide) => { s: number; side: WallSide };
  };
  /** Standing across from a piece, for walking up to it. */
  viewpoint: (faceId: string, x: number, y: number) => Pose;
  /** Where a single piece is shown when one work is exhibited on its own. */
  feature: { wallId: string; x: number; y: number };
  /** Field of view for the cutaway; a room seen from inside needs it wider than a hall seen from out. */
  wallFov?: number;
  /** Clip the overview at this height, so a closed model reads from above. */
  overviewClip?: number | null;
  /** Background and room lights; drawn by the experience, not the shell, so an installation can adjust them. */
  lights: VenueLights;
  Shell: ComponentType;
}

/** Whether lighting settings change how this venue looks. */
export function venueIsLit(venue: Venue): boolean {
  const l = venue.lights;
  return Boolean(l.hemisphere || l.ambient || l.key);
}

export function faceById(venue: Venue, id: string): WallFace | undefined {
  return venue.faces.find((f) => f.id === id);
}

/** Placements in walking order, numbered from 1. */
export function orderInVenue<T extends { wallId: string; x: number }>(
  venue: Venue,
  placements: readonly T[],
): Array<T & { sequence: number }> {
  return placements
    .map((p) => ({ p, k: faceById(venue, p.wallId) ? venue.orderKey(p.wallId, p.x) : Infinity }))
    .sort((a, b) => a.k - b.k)
    .map(({ p }, i) => ({ ...p, sequence: i + 1 }));
}

/**
 * Build a face from two floor points and the direction into the room, in the
 * same frame the hallway uses: +Z of the group points into the space and
 * placements run along its local X.
 */
export function makeFace(id: string, a: V2, b: V2, normal: V2): WallFace {
  const rotationY = Math.atan2(normal[0], normal[1]);
  return {
    id,
    centre: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    rotationY,
    length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    xAxis: [Math.cos(rotationY), -Math.sin(rotationY)],
    normal,
  };
}

/** Standing `back` metres out from a point on a face, at eye height, facing it. */
export function standOff(face: WallFace, x: number, y: number, back: number, eyeY: number, clamp: Venue['clamp']): Pose {
  const [wx, wz] = facePoint(face, x);
  const [cx, cz] = clamp(wx + face.normal[0] * back, wz + face.normal[1] * back);
  return { position: [cx, eyeY, cz], lookAt: [wx, y, wz] };
}

// ── The hallway ─────────────────────────────────────────────────────────────

export const HALLWAY_VENUE: Venue = {
  id: 'northwest',
  name: 'The long hallway',
  faces: WALL_FACES,
  hang: { line: HANG_LINE_Y, minBottom: HANG_MIN_BOTTOM, maxTop: HANG_MAX_TOP },
  eyeY: EYE_Y,
  orderKey: (faceId, x) => {
    const f = WALL_FACES.find((w) => w.id === faceId);
    if (!f) return Infinity;
    const end = faceId === 'start' ? -1e6 : faceId === 'end' ? 1e6 : 0;
    // Facing pieces met at one point go left wall first.
    return end + routeDistance(facePoint(f, x)) + (faceId.startsWith('R') ? 1e-3 : 0);
  },
  clamp: clampToHall,
  walkFrom: (s) => {
    const { point, dir } = routePoint(s);
    const [x, z] = clampToHall(point[0], point[1]);
    return { position: [x, EYE_Y, z], lookAt: [x + dir[0] * 5, EYE_Y, z + dir[1] * 5] };
  },
  overview: OVERVIEW,
  feature: { wallId: 'L1', x: 0, y: HANG_LINE_Y },
  wall: {
    length: ROUTE_LENGTH,
    margin: HALF_WIDTH,
    pose: wallPose,
    locate: (faceId, x) => {
      const f = WALL_FACES.find((w) => w.id === faceId);
      const side = sideOf(faceId);
      return f && side ? { s: routeDistance(facePoint(f, x)), side } : null;
    },
    flip: (s, side) => ({ s, side: side === 'L' ? 'R' : 'L' }),
  },
  // Daylight from above, through the roof lights; the warm lamps by each
  // piece are added separately and only near the visitor.
  lights: {
    background: '#070910',
    hemisphere: { sky: '#eef3f8', ground: '#4a3d2c', intensity: 1.0 },
    ambient: { color: '#fff1dc', intensity: 0.22 },
    key: { position: [3, 10, 2], color: '#f2f6ff', intensity: 0.5 },
  },
  viewpoint: (faceId, x, y) => {
    const f = WALL_FACES.find((w) => w.id === faceId)!;
    const back = faceId === 'start' || faceId === 'end' ? 2.4 : HALF_WIDTH * 2 - BODY_RADIUS - 0.05;
    return standOff(f, x, y, back, EYE_Y, clampToHall);
  },
  Shell: HallwayShell,
};
