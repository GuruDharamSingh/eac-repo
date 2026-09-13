import { bodiesToPoints, computeAspects } from "./aspects";
import { BODIES, BODY_BY_KEY, SIGN_BY_KEY } from "./constants";
import { normalizeDegrees, signOf } from "./format";
import type {
  BodyKey,
  BodyPosition,
  ChartInput,
  ChartResult,
  Element,
  HouseCusp,
  Modality,
} from "./types";

/**
 * Turning raw numbers into a chart.
 *
 * The ephemeris produces a dozen longitudes, twelve cusps and two angles;
 * everything else a chart shows — which sign, which house, which aspects, the
 * balance of elements — is arithmetic over those. Keeping that arithmetic in
 * one place means the engine and the SPAN path (a table of positions sent to
 * the browser so a dial can be scrubbed without a round trip per day) cannot
 * drift apart. The smoke test asserts they agree exactly.
 *
 * Pure and client-safe: no native addon, no file system.
 */

/** House number (1–12) for a longitude, given cusps in house order. */
export function houseOf(longitude: number, cusps: readonly number[]): number {
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    const span = normalizeDegrees(end - start);
    if (normalizeDegrees(longitude - start) < span) return i + 1;
  }
  return 1;
}

function tally<T extends string>(keys: readonly T[], values: T[]): Record<T, number> {
  const counts = Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>;
  for (const v of values) counts[v]++;
  return counts;
}

/** The numbers a chart cannot be derived from anything else. */
export interface ChartRaw {
  /** Ecliptic longitudes, in BODIES order. Short arrays lose the trailing points. */
  longitudes: readonly number[];
  /** Degrees per day, same order. */
  speeds: readonly number[];
  /**
   * Ecliptic latitudes, same order. Optional: a span omits them, because
   * nothing in the wheel or the tables reads latitude and carrying twelve
   * more numbers a day would grow the payload by a third for no picture.
   * Absent means zero.
   */
  latitudes?: readonly number[];
  /** Twelve cusps, in house order. */
  cusps: readonly number[];
  ascendant: number;
  midheaven: number;
  vertex: number;
}

export interface AssembleOptions {
  input: Required<ChartInput>;
  engineVersion: string;
  utc: string;
  julianDayUt: number;
  ephemeris: "swiss" | "moshier";
  approximate: boolean;
  warnings: string[];
  /**
   * Which bodies the longitudes belong to. Defaults to every body in BODIES;
   * a chart that lost Chiron passes the shorter list.
   */
  keys?: readonly BodyKey[];
}

export function assembleChart(raw: ChartRaw, opts: AssembleOptions): ChartResult {
  const keys = opts.keys ?? BODIES.map((b) => b.key);

  const bodies: BodyPosition[] = keys.map((key, i) => {
    const longitude = raw.longitudes[i];
    const speed = raw.speeds[i];
    return {
      key,
      longitude,
      latitude: raw.latitudes?.[i] ?? 0,
      speed,
      retrograde: speed < 0,
      ...signOf(longitude),
      house: houseOf(longitude, raw.cusps),
    };
  });

  const houses: HouseCusp[] = raw.cusps.map((lon, i) => ({
    house: i + 1,
    longitude: lon,
    ...signOf(lon),
  }));

  // The balance counts the ten planets only — see constants.ts.
  const planets = bodies.filter((b) => BODY_BY_KEY[b.key].group === "planet");

  return {
    engineVersion: opts.engineVersion,
    input: opts.input,
    approximate: opts.approximate,
    utc: opts.utc,
    julianDayUt: opts.julianDayUt,
    ephemeris: opts.ephemeris,
    bodies,
    houses,
    angles: {
      ascendant: raw.ascendant,
      midheaven: raw.midheaven,
      descendant: normalizeDegrees(raw.ascendant + 180),
      imumCoeli: normalizeDegrees(raw.midheaven + 180),
      vertex: raw.vertex,
    },
    // Bodies first, then the two angles (fixed points), so planet–angle
    // aspects read as "Sun trine Ascendant".
    aspects: computeAspects([
      ...bodiesToPoints(bodies),
      { key: "ascendant", longitude: raw.ascendant, speed: 0 },
      { key: "midheaven", longitude: raw.midheaven, speed: 0 },
    ]),
    summary: {
      sun: bodies[0].sign,
      moon: bodies[1].sign,
      rising: signOf(raw.ascendant).sign,
      elements: tally<Element>(
        ["fire", "earth", "air", "water"],
        planets.map((b) => SIGN_BY_KEY[b.sign].element),
      ),
      modalities: tally<Modality>(
        ["cardinal", "fixed", "mutable"],
        planets.map((b) => SIGN_BY_KEY[b.sign].modality),
      ),
    },
    warnings: opts.warnings,
  };
}
