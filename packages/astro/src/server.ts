/**
 * The chart engine. Server-only: `sweph` is a native addon.
 *
 * Replaces the prototype's birthchart/ (nine classes, ~4k lines) with the five
 * steps it actually performed — local time → UTC → Julian day, planets, houses,
 * house placement, aspects — on the maintained `sweph` binding (Swiss Ephemeris
 * 2.10, N-API, so no rebuild across Node versions).
 *
 * Ephemeris data: when SWISSEPH_PATH points at a directory of .se1 files the
 * Swiss Ephemeris proper is used; otherwise the built-in Moshier model, which
 * the prototype also ran on (it never shipped the files). Moshier is accurate
 * to well under an arc-second for the planets, far inside any orb.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { calc_ut, constants, houses_ex2, set_ephe_path, utc_to_jd } from "sweph";
import tzlookup from "@photostructure/tz-lookup";
import { bodiesToPoints, computeAspects } from "./aspects";
import { BODIES, DEFAULT_HOUSE_SYSTEM, HOUSE_SYSTEMS, SIGN_BY_KEY } from "./constants";
import { normalizeDegrees, signOf } from "./format";
import { ChartInputError, localToUtc, nowUtc, utcIso, type UtcParts } from "./time";
import type { BodyPosition, ChartInput, ChartResult, Element, HouseCusp, Modality } from "./types";

/** Bump when output for an unchanged input would differ, so cached charts can be recomputed. */
export const ENGINE_VERSION = "3";

let ephemerisFlag: number | null = null;

/**
 * Where the .se1 files are. SWISSEPH_PATH wins (that is what docker-compose
 * sets); the rest are dev conveniences for running outside the container,
 * where this module may be bundled and __dirname no longer points into the
 * package. A directory only counts if the planet file is actually in it.
 */
function resolveEphePath(): string | null {
  const candidates = [
    process.env.SWISSEPH_PATH,
    join(process.cwd(), "../../packages/astro/ephe"), // from apps/<app>
    join(process.cwd(), "packages/astro/ephe"), // from the repo root
    "/app/packages/astro/ephe", // in-container absolute
  ];
  for (const dir of candidates) {
    if (dir && existsSync(join(dir, "sepl_18.se1"))) return dir;
  }
  return null;
}

function ephemeris(): number {
  if (ephemerisFlag === null) {
    const dir = resolveEphePath();
    if (dir) {
      set_ephe_path(dir);
      ephemerisFlag = constants.SEFLG_SWIEPH;
    } else {
      // No data files: the built-in analytical model. Sub-arc-second for the
      // planets, but no Chiron or asteroids.
      ephemerisFlag = constants.SEFLG_MOSEPH;
    }
  }
  return ephemerisFlag;
}

function assertInput(input: ChartInput): void {
  if (!Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90) {
    throw new ChartInputError("Latitude must be between -90 and 90");
  }
  if (!Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180) {
    throw new ChartInputError("Longitude must be between -180 and 180");
  }
  if (input.houseSystem && !HOUSE_SYSTEMS.some((h) => h.code === input.houseSystem)) {
    throw new ChartInputError(`Unsupported house system "${input.houseSystem}"`);
  }
}

function julianDayUt(utc: UtcParts): number {
  const res = utc_to_jd(utc.year, utc.month, utc.day, utc.hour, utc.minute, utc.second, constants.SE_GREG_CAL);
  if (res.flag < 0) throw new ChartInputError(res.error || "Date is outside the supported range");
  return res.data[1];
}

/** House number (1–12) for a longitude, given cusps in house order. */
function houseOf(longitude: number, cusps: readonly number[]): number {
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

export function calculateChart(input: ChartInput): ChartResult {
  assertInput(input);
  const houseSystem = input.houseSystem ?? DEFAULT_HOUSE_SYSTEM;
  const timeKnown = input.timeKnown ?? true;
  const warnings: string[] = [];
  if (!timeKnown) {
    warnings.push(
      "Birth time unknown — cast for local noon. The Ascendant, Midheaven, houses and the Moon's position are approximate; the Moon can be up to 7° either side.",
    );
  }

  const { utc } = localToUtc(input.date, input.time, input.timezone);
  const jd = julianDayUt(utc);
  const eph = ephemeris();

  // Houses first: planet placement needs the cusps.
  const h = houses_ex2(jd, 0, input.latitude, input.longitude, houseSystem);
  if (h.flag < 0) {
    // Placidus/Koch are undefined inside the polar circles; Swiss Ephemeris
    // falls back to Porphyry and says so.
    warnings.push(h.error || "House calculation fell back to Porphyry at this latitude");
  }
  const cusps = h.data.houses.slice(0, 12) as number[];
  const [asc, mc, , vertex] = h.data.points as number[];

  let usedMoshier = eph === constants.SEFLG_MOSEPH;
  const bodies: BodyPosition[] = BODIES.map((b) => {
    const r = calc_ut(jd, b.sweId, eph | constants.SEFLG_SPEED);
    if (r.flag < 0) throw new Error(`${b.name}: ${r.error}`);
    if (r.flag & constants.SEFLG_MOSEPH) usedMoshier = true;
    const [lon, lat, , speed] = r.data;
    const { sign, signDegree } = signOf(lon);
    return {
      key: b.key,
      longitude: lon,
      latitude: lat,
      speed,
      retrograde: speed < 0,
      sign,
      signDegree,
      house: houseOf(lon, cusps),
    };
  });

  const houses: HouseCusp[] = cusps.map((lon, i) => ({ house: i + 1, longitude: lon, ...signOf(lon) }));

  const elements = tally<Element>(
    ["fire", "earth", "air", "water"],
    bodies.map((b) => SIGN_BY_KEY[b.sign].element),
  );
  const modalities = tally<Modality>(
    ["cardinal", "fixed", "mutable"],
    bodies.map((b) => SIGN_BY_KEY[b.sign].modality),
  );

  return {
    engineVersion: ENGINE_VERSION,
    input: { ...input, houseSystem, timeKnown },
    approximate: !timeKnown,
    utc: utcIso(utc),
    julianDayUt: jd,
    ephemeris: usedMoshier ? "moshier" : "swiss",
    bodies,
    houses,
    angles: {
      ascendant: asc,
      midheaven: mc,
      descendant: normalizeDegrees(asc + 180),
      imumCoeli: normalizeDegrees(mc + 180),
      vertex,
    },
    // Bodies first, then the two angles (fixed points), so planet–angle
    // aspects read as "Sun trine Ascendant".
    aspects: computeAspects([
      ...bodiesToPoints(bodies),
      { key: "ascendant", longitude: asc, speed: 0 },
      { key: "midheaven", longitude: mc, speed: 0 },
    ]),
    summary: {
      sun: bodies[0].sign,
      moon: bodies[1].sign,
      rising: signOf(asc).sign,
      elements,
      modalities,
    },
    warnings,
  };
}

/**
 * The sky at an instant, with houses for the given place (Greenwich by
 * default, as the prototype did). `at` is a real moment in time, so the input
 * is expressed in UTC and no zone conversion is involved.
 */
export function calculateSkyAt(
  at: Date,
  latitude = 51.4769,
  longitude = -0.0005,
  houseSystem = DEFAULT_HOUSE_SYSTEM,
): ChartResult {
  if (Number.isNaN(at.getTime())) throw new ChartInputError("Invalid date");
  const pad = (v: number) => String(v).padStart(2, "0");
  return calculateChart({
    date: `${at.getUTCFullYear()}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`,
    time: `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}:${pad(at.getUTCSeconds())}`,
    timezone: "UTC",
    latitude,
    longitude,
    houseSystem,
  });
}

/** The sky right now. */
export function calculateSky(latitude?: number, longitude?: number, houseSystem = DEFAULT_HOUSE_SYSTEM): ChartResult {
  const n = nowUtc();
  const pad = (v: number) => String(v).padStart(2, "0");
  return calculateSkyAt(
    new Date(`${n.year}-${pad(n.month)}-${pad(n.day)}T${pad(n.hour)}:${pad(n.minute)}:${pad(n.second)}Z`),
    latitude,
    longitude,
    houseSystem,
  );
}

/** IANA time zone at a coordinate (offline boundary lookup — no API call). */
export function timeZoneAt(latitude: number, longitude: number): string {
  return tzlookup(latitude, longitude);
}

export { ChartInputError } from "./time";
