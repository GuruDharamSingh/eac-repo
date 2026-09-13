/**
 * Drawing-grade positions for the Sun and Moon, without the ephemeris.
 *
 * The engine is the authority for anything a person reads as a chart. This is
 * for the other job: putting a mark on a dial while a finger is dragging it.
 * A picker that recomputed through Swiss Ephemeris on every pointer move would
 * need a round trip per frame, and the difference would be invisible — a
 * hundredth of a degree on a 180px circle is a ten-thousandth of a pixel.
 *
 * So these are the standard low-precision series (Meeus, *Astronomical
 * Algorithms*, ch. 25 and 47, truncated), in plain arithmetic, client-safe:
 *
 *   sunLongitude   within 0.01°  over 1920–2040 (measured worst: 0.008°)
 *   moonLongitude  within 0.1°   over 1920–2040 (measured worst: 0.059°)
 *
 * Those bounds are asserted against the real engine in the smoke test, so if
 * either drifts it fails loudly rather than quietly mis-drawing. Never use
 * them for a chart; `@elkdonis/astro/server` exists for that.
 */

const D2R = Math.PI / 180;
const sin = (deg: number) => Math.sin(deg * D2R);

function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Julian Day from a JS instant. 2440587.5 is the Unix epoch. */
export function julianDay(at: Date): number {
  return at.getTime() / 86_400_000 + 2440587.5;
}

/** Julian centuries since J2000.0. */
const centuries = (at: Date) => (julianDay(at) - 2451545) / 36525;

/**
 * The Sun's apparent ecliptic longitude, degrees, tropical.
 *
 * Geometric mean longitude plus the equation of centre, then the small
 * correction to apparent place (nutation in longitude and aberration).
 */
export function sunLongitude(at: Date): number {
  const T = centuries(at);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) +
    (0.019993 - 0.000101 * T) * sin(2 * M) +
    0.000289 * sin(3 * M);
  const omega = 125.04 - 1934.136 * T;
  return norm360(L0 + C - 0.00569 - 0.00478 * sin(omega));
}

/**
 * The Moon's ecliptic longitude, degrees, tropical.
 *
 * The dozen largest periodic terms. Enough to draw a phase correctly — the
 * illuminated fraction moves by about a percent per 0.3° of elongation — and
 * nowhere near enough to cast a chart with.
 */
export function moonLongitude(at: Date): number {
  const T = centuries(at);
  // Mean elements.
  const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T * T;

  const lon =
    Lp +
    6.288774 * sin(Mp) +
    1.274027 * sin(2 * D - Mp) +
    0.658314 * sin(2 * D) +
    0.213618 * sin(2 * Mp) -
    0.185116 * sin(M) -
    0.114332 * sin(2 * F) +
    0.058793 * sin(2 * D - 2 * Mp) +
    0.057066 * sin(2 * D - M - Mp) +
    0.05332 * sin(2 * D + Mp) +
    0.045758 * sin(2 * D - M) -
    0.040923 * sin(M - Mp) -
    0.034720 * sin(D) -
    0.030383 * sin(M + Mp) +
    0.015327 * sin(2 * D - 2 * F) -
    0.012528 * sin(Mp + 2 * F);

  return norm360(lon);
}

/**
 * How far the Moon has pulled east of the Sun, 0–360.
 *
 * 0 is new, 180 is full. The lit fraction follows from it directly, which is
 * why a dial can show a true phase from two cheap series.
 */
export function elongation(at: Date): number {
  return norm360(moonLongitude(at) - sunLongitude(at));
}

/** Fraction of the Moon's disc lit at this instant, 0–1. */
export function illuminatedFraction(at: Date): number {
  return (1 - Math.cos(elongation(at) * D2R)) / 2;
}
