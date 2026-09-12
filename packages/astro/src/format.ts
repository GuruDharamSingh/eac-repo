import { SIGNS, SIGN_BY_KEY } from "./constants";
import type { SignKey } from "./types";

export function normalizeDegrees(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

export function signOf(longitude: number): { sign: SignKey; signDegree: number } {
  const lon = normalizeDegrees(longitude);
  const index = Math.floor(lon / 30) % 12;
  return { sign: SIGNS[index].key, signDegree: lon - index * 30 };
}

/** Whole degrees and minutes, rounding minutes so 29.9999° never prints as 29°60′. */
function degMin(value: number): { deg: number; min: number } {
  const totalMinutes = Math.round(Math.abs(value) * 60);
  return { deg: Math.floor(totalMinutes / 60), min: totalMinutes % 60 };
}

/**
 * Zodiacal position for display.
 *   full   → 24° Taurus 29′   (the prototype's default format)
 *   glyph  → 24°♉29′
 *   short  → 24° Tau 29′
 *   degree → 24°29′            (for callers drawing the sign themselves)
 */
export function formatPosition(
  longitude: number,
  style: "full" | "glyph" | "short" | "degree" = "full",
): string {
  const { sign, signDegree } = signOf(longitude);
  let { deg, min } = degMin(signDegree);
  let info = SIGN_BY_KEY[sign];
  // Rounding can carry a 29°59.7′ position into the next sign.
  if (deg === 30) {
    deg = 0;
    min = 0;
    info = SIGNS[(SIGNS.indexOf(info) + 1) % 12];
  }
  const mm = String(min).padStart(2, "0");
  if (style === "degree") return `${deg}°${mm}′`;
  if (style === "glyph") return `${deg}°${info.glyph}${mm}′`;
  if (style === "short") return `${deg}° ${info.short} ${mm}′`;
  return `${deg}° ${info.name} ${mm}′`;
}

/** Orbs and separations: 3°12′. */
export function formatArc(degrees: number): string {
  const { deg, min } = degMin(degrees);
  return `${deg}°${String(min).padStart(2, "0")}′`;
}

export function formatLatitude(lat: number): string {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`;
}

export function formatLongitude(lon: number): string {
  return `${Math.abs(lon).toFixed(4)}°${lon >= 0 ? "E" : "W"}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
