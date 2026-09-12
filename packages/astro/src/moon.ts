/**
 * The Moon's phase, and which way up it appears.
 *
 * Pure maths over a chart that has already been cast, so this is client-safe:
 * the sky components recompute the phase on every scrub of the clock without
 * another round trip to the engine.
 *
 * Two separate questions live here.
 *
 *   HOW MUCH is lit depends only on the Sun–Moon elongation, and is the same
 *   for everyone on Earth.
 *
 *   WHICH WAY UP it looks depends on where you stand and when you look. A
 *   waxing crescent hangs like a bowl at the equator, leans right in Toronto
 *   and leans the other way in Sydney; the same moon rotates through the
 *   night as it crosses the sky. That is the position angle of the bright
 *   limb measured from the observer's zenith — the parallactic angle
 *   subtracted from the limb's equatorial position angle — and it needs the
 *   place and the sidereal time, both of which the chart carries.
 */

import type { BodyPosition, ChartResult } from "./types";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const J2000 = 2451545;

function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export type MoonPhaseName =
  | "new"
  | "waxing crescent"
  | "first quarter"
  | "waxing gibbous"
  | "full"
  | "waning gibbous"
  | "last quarter"
  | "waning crescent";

export interface MoonPhase {
  /** Fraction of the disc lit, 0–1. */
  illumination: number;
  /** The Moon's elongation east of the Sun, 0–360. 0 is new, 180 is full. */
  elongation: number;
  /** Position through the synodic month, 0–1. 0 and 1 are new, 0.5 is full. */
  age: number;
  waxing: boolean;
  phase: MoonPhaseName;
  /** "Waxing crescent" — the phase name, sentence case. */
  label: string;
  /**
   * Clockwise rotation in degrees that carries a disc drawn with its bright
   * limb to the RIGHT into the orientation an observer at the chart's place
   * and moment actually sees, zenith up. Null when the chart has no usable
   * place or instant.
   */
  angle: number | null;
}

/** The eight names, by how far round the cycle we are. 0 = new, 0.5 = full. */
function nameFor(age: number): MoonPhaseName {
  // Each named phase owns an eighth of the cycle, centred on its exact moment,
  // so "full" covers the day and a half either side of exact full rather than
  // an instant nobody is looking at.
  const eighth = Math.floor(norm360(age * 360 + 22.5) / 45) % 8;
  return (
    ["new", "waxing crescent", "first quarter", "waxing gibbous", "full", "waning gibbous", "last quarter", "waning crescent"] as const
  )[eighth];
}

/** Ecliptic (λ, β) in degrees → equatorial (α, δ) in radians. */
function toEquatorial(lon: number, lat: number, obliquity: number): { ra: number; dec: number } {
  const l = lon * D2R;
  const b = lat * D2R;
  const e = obliquity * D2R;
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  return { ra, dec };
}

/** Mean obliquity of the ecliptic, degrees (Meeus 22.2, linear term is plenty). */
function obliquityAt(jd: number): number {
  return 23.439291 - 0.0130042 * ((jd - J2000) / 36525);
}

/** Greenwich apparent-enough sidereal time, degrees (Meeus 12.4). */
function gmst(jd: number): number {
  const d = jd - J2000;
  const t = d / 36525;
  return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38710000);
}

/**
 * The phase from two ecliptic positions and, optionally, a place and time.
 *
 * Latitude is carried through the elongation because the Moon can sit 5° off
 * the ecliptic: near new moon that is the difference between a hairline
 * crescent and an eclipse.
 */
export function moonPhaseFrom(
  sun: Pick<BodyPosition, "longitude" | "latitude">,
  moon: Pick<BodyPosition, "longitude" | "latitude">,
  observer?: { julianDayUt: number; latitude: number; longitude: number },
): MoonPhase {
  const dLon = (moon.longitude - sun.longitude) * D2R;
  const bMoon = moon.latitude * D2R;
  const bSun = sun.latitude * D2R;

  // True angular separation of the two on the sky.
  const cosElong =
    Math.sin(bSun) * Math.sin(bMoon) + Math.cos(bSun) * Math.cos(bMoon) * Math.cos(dLon);
  const elongTrue = Math.acos(Math.min(1, Math.max(-1, cosElong)));

  // Signed elongation (which side of the Sun the Moon is on) decides waxing.
  const elongation = norm360(moon.longitude - sun.longitude);
  const waxing = elongation < 180;

  // The lit fraction is half of one minus the cosine of the phase angle; the
  // phase angle is the supplement of the elongation, which cancels the sign.
  const illumination = (1 - Math.cos(elongTrue)) / 2;
  const age = elongation / 360;

  let angle: number | null = null;
  if (
    observer &&
    Number.isFinite(observer.julianDayUt) &&
    Number.isFinite(observer.latitude) &&
    Number.isFinite(observer.longitude)
  ) {
    const eps = obliquityAt(observer.julianDayUt);
    const s = toEquatorial(sun.longitude, sun.latitude, eps);
    const m = toEquatorial(moon.longitude, moon.latitude, eps);
    const phi = observer.latitude * D2R;

    // Hour angle of the Moon at this place and instant.
    const lst = (gmst(observer.julianDayUt) + observer.longitude) * D2R;
    const H = lst - m.ra;

    // Parallactic angle: how far the celestial pole is rotated from straight
    // up as seen from here. Zero on the meridian to the south, 180 to the north.
    const q = Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(m.dec) - Math.sin(m.dec) * Math.cos(H));

    // Position angle of the bright limb — it points at the Sun (Meeus 48.5).
    const chi = Math.atan2(
      Math.cos(s.dec) * Math.sin(s.ra - m.ra),
      Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra),
    );

    // (chi - q) is the limb's angle from the zenith, counted the way position
    // angles are — anticlockwise in the view the eye gets, north up, east
    // left. A disc drawn bright-limb-right starts 90° clockwise of up, so the
    // clockwise CSS rotation that lands it correctly is its negation less 90.
    angle = norm360(-(chi - q) * R2D - 90);
  }

  const phase = nameFor(age);
  return {
    illumination,
    elongation,
    age,
    waxing,
    phase,
    label: phase.charAt(0).toUpperCase() + phase.slice(1),
    angle,
  };
}

/** The phase of a cast chart, oriented for the place the chart was cast at. */
export function moonPhase(chart: ChartResult): MoonPhase {
  const sun = chart.bodies.find((b) => b.key === "sun");
  const moon = chart.bodies.find((b) => b.key === "moon");
  if (!sun || !moon) {
    throw new Error("This chart has no Sun or Moon to take a phase from");
  }
  return moonPhaseFrom(sun, moon, {
    julianDayUt: chart.julianDayUt,
    latitude: chart.input.latitude,
    longitude: chart.input.longitude,
  });
}
