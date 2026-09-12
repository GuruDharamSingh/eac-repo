/**
 * Chart shapes. Everything here is plain JSON so a computed chart can be
 * cached in a JSONB column and shipped to a client component unchanged.
 */

export type BodyKey =
  | "sun"
  | "moon"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune"
  | "pluto";

export type SignKey =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export type Element = "fire" | "earth" | "air" | "water";
export type Modality = "cardinal" | "fixed" | "mutable";

/** Swiss Ephemeris single-letter house system codes offered in the UI. */
export type HouseSystemCode = "P" | "K" | "O" | "R" | "C" | "E" | "W" | "M" | "T" | "B";

export type AspectKey =
  | "conjunction"
  | "sextile"
  | "square"
  | "trine"
  | "opposition"
  | "quincunx"
  | "semisextile"
  | "semisquare"
  | "sesquisquare";

export interface ChartInput {
  /** Local civil date at the birthplace, YYYY-MM-DD. */
  date: string;
  /** Local civil time at the birthplace, HH:MM or HH:MM:SS (24h). */
  time: string;
  /** IANA zone ("America/Toronto"), "UTC", or a fixed offset ("+05:30"). */
  timezone: string;
  latitude: number;
  longitude: number;
  houseSystem?: HouseSystemCode;
  /**
   * false when the birth time is not known. `time` should then be local noon;
   * the result carries a warning and `approximate: true`, because the houses,
   * the angles and the Moon depend on the time of day.
   */
  timeKnown?: boolean;
}

export interface BodyPosition {
  key: BodyKey;
  /** Ecliptic longitude, 0–360, tropical. */
  longitude: number;
  latitude: number;
  /** Degrees per day; negative means retrograde. */
  speed: number;
  retrograde: boolean;
  sign: SignKey;
  /** 0–30 within the sign. */
  signDegree: number;
  /** 1–12. */
  house: number;
}

export interface HouseCusp {
  house: number;
  longitude: number;
  sign: SignKey;
  signDegree: number;
}

export interface Angles {
  ascendant: number;
  midheaven: number;
  descendant: number;
  imumCoeli: number;
  vertex: number;
}

/** Anything an aspect can join: a body, or one of the two main angles. */
export type AspectPoint = BodyKey | "ascendant" | "midheaven";

export interface Aspect {
  /** Bodies come first; an aspect to an angle always has the angle as `b`. */
  a: AspectPoint;
  b: AspectPoint;
  type: AspectKey;
  /** Actual angular separation, 0–180. */
  separation: number;
  /** Distance from exact, in degrees. */
  orb: number;
  /** 1 at exact, 0 at the edge of the orb. */
  exactness: number;
  /** True when the faster body is closing on exact. */
  applying: boolean;
  major: boolean;
}

export interface ChartResult {
  /** Bumped whenever the engine's output would change for the same input. */
  engineVersion: string;
  input: Required<ChartInput>;
  /** The birth moment in UTC, ISO 8601. */
  utc: string;
  julianDayUt: number;
  /** "swiss" when ephemeris files were used, "moshier" for the built-in analytical fallback. */
  ephemeris: "swiss" | "moshier";
  bodies: BodyPosition[];
  houses: HouseCusp[];
  angles: Angles;
  aspects: Aspect[];
  /** True when cast without a known birth time: houses, angles and Moon are approximate. */
  approximate: boolean;
  summary: {
    sun: SignKey;
    moon: SignKey;
    rising: SignKey;
    /** How many of the ten bodies fall in each element / modality. */
    elements: Record<Element, number>;
    modalities: Record<Modality, number>;
  };
  warnings: string[];
}
