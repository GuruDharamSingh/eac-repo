import { ASPECTS } from "./constants";
import type { Aspect, AspectPoint, BodyPosition } from "./types";

/** Shortest arc between two longitudes, 0–180. */
export function separation(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export interface AspectablePoint {
  key: AspectPoint;
  longitude: number;
  /** Degrees per day. Angles are fixed points of the chart: 0. */
  speed: number;
}

/** Angles get tighter orbs than planets — three quarters of the planetary orb. */
const ANGLE_ORB = 0.75;
const isAngle = (k: AspectPoint) => k === "ascendant" || k === "midheaven";

/**
 * Chiron and the Node are held to half the planetary orb.
 *
 * Partly convention — most astrologers who use them read only close contacts
 * — and partly arithmetic: they are the eleventh and twelfth bodies, and at
 * full orbs two more points add about forty more pairs, burying the aspects
 * that actually carry the chart.
 */
const POINT_ORB = 0.5;
const isPoint = (k: AspectPoint) => k === "chiron" || k === "northNode";

/**
 * Every aspect within orb between every pair of points, tightest first.
 * Orbs and the aspect set are the prototype's (server/src/lib/aspect-utils.ts).
 * Angle–angle pairs are skipped (the AC and MC are ~90° apart by
 * construction, which would list a meaningless square in most charts).
 *
 * "Applying" is decided from the points' daily speeds: step both forward a
 * small interval and see whether the separation moves toward exact.
 */
export function computeAspects(points: readonly AspectablePoint[]): Aspect[] {
  const found: Aspect[] = [];
  const dt = 0.01; // days

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const p = points[i];
      const q = points[j];
      if (isAngle(p.key) && isAngle(q.key)) continue;
      const toAngle = isAngle(p.key) || isAngle(q.key);
      const toPoint = isPoint(p.key) || isPoint(q.key);
      const sep = separation(p.longitude, q.longitude);
      const sepLater = separation(p.longitude + p.speed * dt, q.longitude + q.speed * dt);

      for (const def of ASPECTS) {
        const maxOrb = def.orb * (toAngle ? ANGLE_ORB : 1) * (toPoint ? POINT_ORB : 1);
        const orb = Math.abs(sep - def.angle);
        if (orb > maxOrb) continue;
        found.push({
          a: p.key,
          b: q.key,
          type: def.key,
          separation: sep,
          orb,
          exactness: 1 - orb / maxOrb,
          applying: Math.abs(sepLater - def.angle) < orb,
          major: def.major,
        });
      }
    }
  }

  return found.sort((x, y) => Number(y.major) - Number(x.major) || x.orb - y.orb);
}

/** Convenience for callers that only have bodies. */
export function bodiesToPoints(bodies: readonly BodyPosition[]): AspectablePoint[] {
  return bodies.map((b) => ({ key: b.key, longitude: b.longitude, speed: b.speed }));
}
