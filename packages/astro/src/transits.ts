import { ASPECTS } from "./constants";
import { separation, type AspectablePoint } from "./aspects";
import type { AspectKey, AspectPoint, ChartResult } from "./types";

// ============================================================================
// Cross-chart comparison: transits and synastry.
//
// Both are the same drawing — a BI-WHEEL, one chart ringed by another — and
// the same maths, a full product of two point lists. They differ in what the
// outer ring *is*, and that changes the orbs and what "applying" can mean:
//
//   TRANSITS   the outer ring is a moment. It moves, so applying/separating
//              is the whole point, and orbs are tight because a wide orb on a
//              slow planet is a window years long.
//   SYNASTRY   the outer ring is another person's birth chart. Neither chart
//              moves, so applying/separating is MEANINGLESS and is not shown;
//              orbs sit between natal and transit.
//
// ---------------------------------------------------------------------------
// Transits: one chart read against another.
//
// A transit chart is a BI-WHEEL — the natal chart drawn as usual, with the
// planets of a second moment placed in a ring around it. The convention the
// craft settled on, and the one this follows:
//
//   · the natal chart is the INNER wheel and owns the houses. A transiting
//     planet is read in the natal house it falls in; the transit moment's own
//     houses are not drawn, because they say nothing about this person.
//   · only CROSS aspects are drawn — transiting planet to natal planet. The
//     natal chart's own aspects are already the inner chart's business, and
//     drawing both at once makes an unreadable web.
//   · orbs are much tighter than natal. A natal aspect is a lifelong fact and
//     earns 6–8°; a transit is a moment, and an 8° orb on Pluto would be a
//     decade long. Astrologers commonly work at 1–3°, so that is the range
//     here.
//   · an APPLYING transit (closing on exact) is drawn solid, a SEPARATING one
//     dotted. This is the one piece of transit notation that is close to
//     universal, and it is the thing a reader most wants to know: what is
//     still coming versus what has already landed.
//
// Sources for the conventions are cited in the commit; the short version is
// that inner/outer and natal-houses-win are agreed everywhere, while orb
// width is a matter of school — hence ORBS below is a default, not a law, and
// every entry point takes an override.
// ============================================================================

/**
 * Default transit orbs, in degrees.
 *
 * Deliberately not the natal table scaled by a constant: the natal orbs are
 * proportioned by how much an aspect *matters*, whereas a transit orb is
 * really a question of timing — how long before and after exact the contact
 * is worth showing. So the majors sit together at 3° and the minors at 1–1.5°.
 */
export const TRANSIT_ORBS: Readonly<Record<AspectKey, number>> = {
  conjunction: 3,
  opposition: 3,
  square: 3,
  trine: 3,
  sextile: 2,
  quincunx: 1.5,
  semisextile: 1,
  semisquare: 1,
  sesquisquare: 1,
};

/**
 * Per-body tightening of the transit orb.
 *
 * An orb in degrees is a window in time, and how long that window lasts
 * depends entirely on how fast the transiting body moves. 3° of Pluto is
 * years; 3° of the Moon is about five hours either side of exact, which is
 * why the Moon is conventionally given 1–2°. Halving it keeps a Moon transit
 * roughly a day wide instead of a fortnight of noise.
 */
const MOVING_ORB_FACTOR: Partial<Record<AspectPoint, number>> = {
  moon: 0.5,
};

/** Chiron and the Node keep the half-orb they are given natally, on either side. */
const POINT_ORB = 0.5;
const isPoint = (k: AspectPoint) => k === "chiron" || k === "northNode";

/** Angles keep the same three-quarter orb they get natally. */
const ANGLE_ORB = 0.75;
const isAngle = (k: AspectPoint) => k === "ascendant" || k === "midheaven";

/** One contact between a transiting point and a natal one. */
export interface CrossAspect {
  /** The transiting point — the outer wheel. */
  moving: AspectPoint;
  /** The natal point it touches — the inner wheel. */
  fixed: AspectPoint;
  type: AspectKey;
  /** Actual angular separation, 0–180. */
  separation: number;
  /** Distance from exact, in degrees. */
  orb: number;
  /** 1 at exact, 0 at the edge of the orb. */
  exactness: number;
  /** True while the transit is closing on exact. Drawn solid; separating is dotted. */
  applying: boolean;
  major: boolean;
}

export interface CrossAspectOptions {
  /** Override any orb. Omitted keys keep the default. */
  orbs?: Partial<Record<AspectKey, number>>;
  /** Include the minor aspects. Off by default — at transit orbs they are noise. */
  minorAspects?: boolean;
}

/**
 * Every aspect within orb from each `moving` point to each `fixed` point,
 * tightest first.
 *
 * Unlike `computeAspects` this is not symmetric: the two lists are different
 * charts, so every pair is considered (no i<j skipping) and the result keeps
 * which side each point came from. `fixed` points are treated as motionless
 * regardless of the speed they carry — a natal position does not move, so the
 * approach to exact is entirely the transiting body's, retrogrades included.
 */
export function computeCrossAspects(
  moving: readonly AspectablePoint[],
  fixed: readonly AspectablePoint[],
  opts: CrossAspectOptions = {},
): CrossAspect[] {
  const found: CrossAspect[] = [];
  const dt = 0.01; // days

  for (const m of moving) {
    for (const f of fixed) {
      // An angle of one chart against an angle of the other is the same
      // meaningless pairing computeAspects skips natally.
      if (isAngle(m.key) && isAngle(f.key)) continue;

      const sep = separation(m.longitude, f.longitude);
      // Only the transiting body moves; the natal point is a fixed mark.
      const sepLater = separation(m.longitude + m.speed * dt, f.longitude);

      for (const def of ASPECTS) {
        if (!def.major && !opts.minorAspects) continue;

        const base = opts.orbs?.[def.key] ?? TRANSIT_ORBS[def.key];
        const maxOrb =
          base *
          (MOVING_ORB_FACTOR[m.key] ?? 1) *
          (isAngle(m.key) || isAngle(f.key) ? ANGLE_ORB : 1) *
          (isPoint(m.key) || isPoint(f.key) ? POINT_ORB : 1);

        const orb = Math.abs(sep - def.angle);
        if (orb > maxOrb) continue;

        found.push({
          moving: m.key,
          fixed: f.key,
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

/**
 * Default synastry orbs, in degrees.
 *
 * Wider than transit orbs and tighter than natal: a contact between two birth
 * charts is a standing fact rather than a passing moment, so it does not need
 * the transit table's timing precision — but two whole charts against each
 * other is 100+ pairs, and natal orbs would return a wall of them. The common
 * teaching is majors to 5° and minors to 3°, read tightest first.
 */
export const SYNASTRY_ORBS: Readonly<Record<AspectKey, number>> = {
  conjunction: 5,
  opposition: 5,
  square: 5,
  trine: 5,
  sextile: 4,
  quincunx: 3,
  semisextile: 2,
  semisquare: 2,
  sesquisquare: 2,
};

/**
 * The interaspects between two birth charts.
 *
 * `outer` is the chart drawn in the outer ring, `inner` the one that keeps the
 * houses — but which person goes where is a matter of taste and varies between
 * astrologers and software, so a reader should be told whose ring is whose
 * rather than left to infer it from the radius.
 *
 * Angles are kept on BOTH sides, unlike transits: someone's Venus on your
 * Descendant, or their Sun on your Midheaven, is among the most-read contacts
 * in the technique. Speeds are zeroed because neither chart moves — the
 * `applying` flag on these results is meaningless and must not be shown.
 */
export function synastryAspects(
  inner: ChartResult,
  outer: ChartResult,
  opts: CrossAspectOptions = {},
): CrossAspect[] {
  const still = (p: AspectablePoint): AspectablePoint => ({ ...p, speed: 0 });
  return computeCrossAspects(chartToPoints(outer).map(still), chartToPoints(inner).map(still), {
    orbs: SYNASTRY_ORBS,
    ...opts,
  });
}

/** The aspectable points of a chart: its bodies, plus its two angles. */
export function chartToPoints(chart: ChartResult, opts: { angles?: boolean } = {}): AspectablePoint[] {
  const points: AspectablePoint[] = chart.bodies.map((b) => ({
    key: b.key,
    longitude: b.longitude,
    speed: b.speed,
  }));
  if (opts.angles !== false) {
    points.push({ key: "ascendant", longitude: chart.angles.ascendant, speed: 0 });
    points.push({ key: "midheaven", longitude: chart.angles.midheaven, speed: 0 });
  }
  return points;
}

/**
 * The transits of `transit` to `natal`.
 *
 * Transiting ANGLES are left out: the Ascendant and Midheaven of the transit
 * moment are a function of the clock and the place you happen to be standing,
 * not of the sky, so they sweep the whole zodiac every day and would bury the
 * list. Natal angles stay in — a transit to the natal Ascendant or Midheaven
 * is one of the contacts astrologers care most about.
 */
export function transitAspects(
  natal: ChartResult,
  transit: ChartResult,
  opts: CrossAspectOptions = {},
): CrossAspect[] {
  return computeCrossAspects(chartToPoints(transit, { angles: false }), chartToPoints(natal), opts);
}
