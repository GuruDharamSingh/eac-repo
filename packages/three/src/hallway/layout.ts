/**
 * The hallway: a long corridor heading north-west in six straight runs joined
 * by five right-angled turns. Everything that places work in it — walls,
 * collision, the walking order of what is hung — is derived from one
 * centreline here, so changing the route is changing `ROUTE`.
 *
 * World frame matches the gallery's: metres, Y up, north is −Z, west is −X.
 */

import type { PieceLamp } from './lighting';

/** Centreline corners, in XZ. Alternating north and west legs. */
export const ROUTE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, -18],
  [-12, -18],
  [-12, -34],
  [-24, -34],
  [-24, -52],
  [-34, -52],
];

/** About sixteen feet: room to stand back from a wall and see it whole. */
export const HALL_WIDTH = 5.0;
export const HALF_WIDTH = HALL_WIDTH / 2;
export const HALL_HEIGHT = 3.0;
/** Slate panelling runs to about waist height. */
export const SLATE_HEIGHT = 0.95;

export const EYE_Y = 1.62;
export const BODY_RADIUS = 0.4;

/** Where a piece's centre sits by default, and the band it may move within. */
export const HANG_LINE_Y = 1.55;
export const HANG_MIN_BOTTOM = SLATE_HEIGHT + 0.1;
export const HANG_MAX_TOP = HALL_HEIGHT - 0.25;
/** Drops within this of the hang line snap to it, so a wall reads level. */
export const HANG_SNAP = 0.08;
/** Clear wall kept between neighbouring frames. */
export const HANG_GAP = 0.12;

/** Spacing of skylights along the centreline, and how far from a turn they stop. */
const SKYLIGHT_EVERY = 6;
const SKYLIGHT_CLEAR_OF_TURN = 1.6;

type V2 = [number, number];

const sub = (a: readonly number[], b: readonly number[]): V2 => [a[0]! - b[0]!, a[1]! - b[1]!];
const len = (v: V2) => Math.hypot(v[0], v[1]);
const norm = (v: V2): V2 => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l];
};
/** Left of a heading, looking along it from above with north up. */
const leftOf = (d: V2): V2 => [d[1], -d[0]];

export interface Leg {
  start: V2;
  end: V2;
  dir: V2;
  length: number;
  /** Arc length along the route at `start`. */
  from: number;
}

export const LEGS: readonly Leg[] = (() => {
  const legs: Leg[] = [];
  let from = 0;
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const start = [...ROUTE[i]!] as V2;
    const end = [...ROUTE[i + 1]!] as V2;
    const d = sub(end, start);
    legs.push({ start, end, dir: norm(d), length: len(d), from });
    from += len(d);
  }
  return legs;
})();

export const ROUTE_LENGTH = LEGS.reduce((sum, leg) => sum + leg.length, 0);

/**
 * The route's corners pushed sideways by `offset` (positive = left), mitred so
 * consecutive legs meet exactly. Used for both walls, the carpet's edges and
 * its trim — one rule, so nothing ever overlaps at a turn.
 */
export function offsetPolyline(offset: number): V2[] {
  return ROUTE.map((p, i) => {
    const before = LEGS[Math.max(0, i - 1)]!;
    const after = LEGS[Math.min(LEGS.length - 1, i)]!;
    const n0 = leftOf(before.dir);
    const n1 = leftOf(after.dir);
    if (i === 0) return [p[0] + n1[0] * offset, p[1] + n1[1] * offset];
    if (i === ROUTE.length - 1) return [p[0] + n0[0] * offset, p[1] + n0[1] * offset];
    const scale = offset / (1 + n0[0] * n1[0] + n0[1] * n1[1]);
    return [p[0] + (n0[0] + n1[0]) * scale, p[1] + (n0[1] + n1[1]) * scale];
  });
}

/** A quad strip between two offset polylines: one quad per leg. */
export function stripQuads(inner: number, outer: number): Array<[V2, V2, V2, V2]> {
  const a = offsetPolyline(inner);
  const b = offsetPolyline(outer);
  return LEGS.map((_, i) => [a[i]!, a[i + 1]!, b[i + 1]!, b[i]!]);
}

/**
 * A hangable face. A group placed at `centre` with `rotationY` has its +Z
 * pointing into the hall, and `x` along its own +X runs from −length/2 to
 * +length/2 — the frame every placement is stored in.
 */
export interface WallFace {
  id: string;
  centre: V2;
  rotationY: number;
  length: number;
  /** Unit vector of the group's local +X, in XZ. */
  xAxis: V2;
  /** Into the hall. */
  normal: V2;
}

function face(id: string, a: V2, b: V2, normal: V2): WallFace {
  const rotationY = Math.atan2(normal[0], normal[1]);
  return {
    id,
    centre: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
    rotationY,
    length: len(sub(b, a)),
    xAxis: [Math.cos(rotationY), -Math.sin(rotationY)],
    normal,
  };
}

export const WALL_FACES: readonly WallFace[] = (() => {
  const left = offsetPolyline(HALF_WIDTH);
  const right = offsetPolyline(-HALF_WIDTH);
  const faces: WallFace[] = [];
  LEGS.forEach((leg, i) => {
    const n = leftOf(leg.dir);
    faces.push(face(`L${i + 1}`, left[i]!, left[i + 1]!, [-n[0], -n[1]]));
    faces.push(face(`R${i + 1}`, right[i]!, right[i + 1]!, n));
  });
  const first = LEGS[0]!;
  const last = LEGS[LEGS.length - 1]!;
  faces.push(face('start', left[0]!, right[0]!, first.dir));
  faces.push(face('end', left[left.length - 1]!, right[right.length - 1]!, [-last.dir[0], -last.dir[1]]));
  return faces;
})();

const FACES_BY_ID = new Map(WALL_FACES.map((f) => [f.id, f]));

export function getFace(id: string): WallFace | undefined {
  return FACES_BY_ID.get(id);
}

/** World XZ of a point on a face. */
export function facePoint(f: WallFace, x: number): V2 {
  return [f.centre[0] + f.xAxis[0] * x, f.centre[1] + f.xAxis[1] * x];
}

/**
 * How far along the walk a point is met: its projection onto the centreline,
 * as arc length. This is what puts a hang in order — the sequence of a
 * collection is the order a visitor reaches each piece walking from the
 * entrance, not the order the pieces happened to be dropped.
 */
export function routeDistance(point: V2): number {
  let best = { d: Infinity, s: 0 };
  for (const leg of LEGS) {
    const rel = sub(point, leg.start);
    const t = Math.max(0, Math.min(leg.length, rel[0] * leg.dir[0] + rel[1] * leg.dir[1]));
    const px = leg.start[0] + leg.dir[0] * t;
    const pz = leg.start[1] + leg.dir[1] * t;
    const d = Math.hypot(point[0] - px, point[1] - pz);
    if (d < best.d - 1e-6) best = { d, s: leg.from + t };
  }
  return best.s;
}

export interface Placement {
  pieceId: string;
  wallId: string;
  /** Along the face, metres from its centre. */
  x: number;
  /** World height of the piece's centre. */
  y: number;
  frameId: string | null;
  /**
   * Size multiplier on the piece's base size (its recorded cm, or the nominal
   * size when none is recorded). Absent or null means 1. Set with the corner
   * handles when curating. (2026-10-29)
   */
  scale?: number | null;
  /** The frame's proportion ('auto' or a `FrameRatio`); see `framing.ts`. (2026-10-29) */
  ratio?: string | null;
  /** The crop inside the frame; absent means the default. */
  crop?: { x: number; y: number; zoom: number } | null;
  /** The piece's picture lamp; absent means one above, centred. See `lighting.ts`. (2026-10-30) */
  lamp?: PieceLamp | null;
}

/** Resizing bounds: a quarter to four times the base size. */
export const SCALE_MIN = 0.25;
export const SCALE_MAX = 4;

export function placementScale(p: { scale?: number | null }): number {
  const s = p.scale ?? 1;
  return Number.isFinite(s) && s > 0 ? Math.min(SCALE_MAX, Math.max(SCALE_MIN, s)) : 1;
}

/** Nudge distances from the keyboard: a centimetre, ten with Shift. */
export const NUDGE = 0.01;
export const NUDGE_FAST = 0.1;

/**
 * Placements in walking order, numbered from 1. Two pieces met at the same
 * point (facing each other across the hall) go left wall first.
 */
export function orderPlacements<T extends Placement>(placements: readonly T[]): Array<T & { sequence: number }> {
  const keyed = placements.map((p) => {
    const f = getFace(p.wallId);
    const s = f ? routeDistance(facePoint(f, p.x)) : Infinity;
    const side = p.wallId.startsWith('L') ? 0 : 1;
    const end = p.wallId === 'start' ? -1 : p.wallId === 'end' ? 1 : 0;
    return { p, key: [end, s, side] as const };
  });
  keyed.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]);
  return keyed.map(({ p }, i) => ({ ...p, sequence: i + 1 }));
}

/**
 * Keeps the visitor inside the hall: the nearest point to where they are
 * trying to go that lies inside some leg, each leg's rectangle reaching
 * across the turn square so a corner can be walked round without snagging.
 */
export function clampToHall(x: number, z: number): V2 {
  const lateral = HALF_WIDTH - BODY_RADIUS;
  let best: V2 = [x, z];
  let bestD = Infinity;
  LEGS.forEach((leg, i) => {
    const n = leftOf(leg.dir);
    const rel = sub([x, z], leg.start);
    const minT = i === 0 ? BODY_RADIUS : -lateral;
    const maxT = i === LEGS.length - 1 ? leg.length - BODY_RADIUS : leg.length + lateral;
    const t = Math.max(minT, Math.min(maxT, rel[0] * leg.dir[0] + rel[1] * leg.dir[1]));
    const s = Math.max(-lateral, Math.min(lateral, rel[0] * n[0] + rel[1] * n[1]));
    const px = leg.start[0] + leg.dir[0] * t + n[0] * s;
    const pz = leg.start[1] + leg.dir[1] * t + n[1] * s;
    const d = Math.hypot(px - x, pz - z);
    if (d < bestD) {
      bestD = d;
      best = [px, pz];
    }
  });
  return best;
}

export interface Skylight {
  position: V2;
  /** Heading of the leg it sits over, as a Y rotation. */
  rotationY: number;
}

export const SKYLIGHTS: readonly Skylight[] = (() => {
  const out: Skylight[] = [];
  for (const leg of LEGS) {
    for (let t = SKYLIGHT_EVERY / 2; t < leg.length; t += SKYLIGHT_EVERY) {
      if (t < SKYLIGHT_CLEAR_OF_TURN || leg.length - t < SKYLIGHT_CLEAR_OF_TURN) continue;
      out.push({
        position: [leg.start[0] + leg.dir[0] * t, leg.start[1] + leg.dir[1] * t],
        rotationY: Math.atan2(leg.dir[0], leg.dir[1]),
      });
    }
  }
  return out;
})();

/** Where the visitor stands when the hall opens: just inside, facing up it. */
export const ENTRANCE = (() => {
  const leg = LEGS[0]!;
  const p: V2 = [leg.start[0] + leg.dir[0] * 1.2, leg.start[1] + leg.dir[1] * 1.2];
  return { position: p, lookAt: [p[0] + leg.dir[0] * 5, p[1] + leg.dir[1] * 5] as V2 };
})();

/** Standing across the hall from a piece, facing it. */
export function viewpointFor(p: Placement): { position: [number, number, number]; lookAt: [number, number, number] } {
  const f = getFace(p.wallId);
  if (!f) {
    return { position: [ENTRANCE.position[0], EYE_Y, ENTRANCE.position[1]], lookAt: [0, EYE_Y, -5] };
  }
  const [wx, wz] = facePoint(f, p.x);
  const back = f.id === 'start' || f.id === 'end' ? 2.4 : HALL_WIDTH - BODY_RADIUS - 0.05;
  const [cx, cz] = clampToHall(wx + f.normal[0] * back, wz + f.normal[1] * back);
  return { position: [cx, EYE_Y, cz], lookAt: [wx, p.y, wz] };
}

/** The leg a route distance falls in, and the point and heading there. */
export function routePoint(s: number): { leg: Leg; point: V2; dir: V2; left: V2 } {
  const clamped = Math.max(0, Math.min(ROUTE_LENGTH, s));
  const leg = LEGS.find((l) => clamped <= l.from + l.length) ?? LEGS[LEGS.length - 1]!;
  const t = clamped - leg.from;
  return {
    leg,
    point: [leg.start[0] + leg.dir[0] * t, leg.start[1] + leg.dir[1] * t],
    dir: leg.dir,
    left: leftOf(leg.dir),
  };
}

export type WallSide = 'L' | 'R';

/**
 * How far outside the near wall the cutaway camera hangs, and how high: above
 * the roofline and angled down, as in a dollhouse, so the ceiling drops out
 * of the shot and the far wall and floor read together.
 */
const CUTAWAY_BACK = 4.4;
const CUTAWAY_EYE_Y = 4.9;
const CUTAWAY_LOOK_Y = 1.5;

/**
 * The cutaway view of one wall: the camera held outside the hall, square on
 * to the far wall, looking in through the near one (which the scene hides).
 * `s` is where along the route the view is centred.
 */
export function wallPose(s: number, side: WallSide): { position: [number, number, number]; lookAt: [number, number, number] } {
  const { point, left } = routePoint(s);
  const sign = side === 'L' ? 1 : -1;
  const back = HALF_WIDTH + CUTAWAY_BACK;
  return {
    position: [point[0] - left[0] * sign * back, CUTAWAY_EYE_Y, point[1] - left[1] * sign * back],
    lookAt: [point[0] + left[0] * sign * HALF_WIDTH, CUTAWAY_LOOK_Y, point[1] + left[1] * sign * HALF_WIDTH],
  };
}

/** Which side of the hall a wall face belongs to, for the cutaway view. */
export function sideOf(wallId: string): WallSide | null {
  return wallId.startsWith('L') ? 'L' : wallId.startsWith('R') ? 'R' : null;
}

/** The whole hall seen from above, at an angle: its centre and a pose framing it. */
export const OVERVIEW = (() => {
  const xs = ROUTE.map((p) => p[0]);
  const zs = ROUTE.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) + HALL_WIDTH * 2;
  return {
    target: [cx, 0, cz] as [number, number, number],
    position: [cx + span * 0.3, span * 1.05, cz + span * 0.8] as [number, number, number],
    span,
  };
})();
