/**
 * Client-safe entry: types, reference data, formatting and the pure time/aspect
 * maths. The engine itself (native Swiss Ephemeris) lives at
 * `@elkdonis/astro/server`.
 */

export * from "./types";
export * from "./constants";
export * from "./format";
export { bodiesToPoints, computeAspects, separation, type AspectablePoint } from "./aspects";
export {
  SYNASTRY_ORBS,
  TRANSIT_ORBS,
  chartToPoints,
  computeCrossAspects,
  synastryAspects,
  transitAspects,
  type CrossAspect,
  type CrossAspectOptions,
} from "./transits";
export {
  ChartInputError,
  isValidTimeZone,
  localToUtc,
  parseLocalDateTime,
  stepInstant,
  type StepUnit,
} from "./time";
export { moonPhase, moonPhaseFrom, type MoonPhase, type MoonPhaseName } from "./moon";
export {
  elongation,
  illuminatedFraction,
  julianDay,
  moonLongitude,
  sunLongitude,
} from "./approx";
