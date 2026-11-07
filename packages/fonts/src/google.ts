// Google Fonts stylesheet URLs, built only from library entries.
//
// The css2 API rejects the WHOLE request when one family is asked for a
// weight or italic it does not have, so every axis list here comes from the
// entry's own weights and italics, and unknown or system families are skipped.

import { fontEntry, type FontEntry } from "./library";

export const GOOGLE_CSS = "https://fonts.googleapis.com/css2";

export interface FamilyAxes {
  /** Limit to these upright weights (the nearest real ones are used). Default: all. */
  weights?: number[];
  /** Include italics. Default true. */
  italics?: boolean;
}

/** One `family=` value, e.g. `Old+Standard+TT:ital,wght@0,400;0,700;1,400`. */
export function googleFamilyParam(e: FontEntry, axes: FamilyAxes = {}): string {
  const name = e.family.trim().replace(/ +/g, "+");
  const want = axes.weights?.length
    ? [...new Set(axes.weights.map((w) => e.weights.reduce((b, x) => (Math.abs(x - w) < Math.abs(b - w) ? x : b), e.weights[0] ?? 400)))]
    : e.weights;
  const upright = want.filter((w) => e.weights.includes(w)).sort((a, b) => a - b);
  const italic = axes.italics === false ? [] : e.italics.filter((w) => !axes.weights?.length || want.includes(w)).sort((a, b) => a - b);
  // A single regular weight and no italics: the bare family name is enough.
  if (!italic.length && (upright.length === 0 || (upright.length === 1 && upright[0] === 400))) return name;
  if (!italic.length) return `${name}:wght@${upright.join(";")}`;
  const tuples = [...upright.map((w) => `0,${w}`), ...italic.map((w) => `1,${w}`)];
  return `${name}:ital,wght@${tuples.join(";")}`;
}

/** One stylesheet for every Google family in `families`, or null if none. */
export function googleFontsHref(families: Iterable<string | undefined | null>, axes?: FamilyAxes): string | null {
  const params: string[] = [];
  const seen = new Set<string>();
  for (const f of families) {
    const e = fontEntry(f);
    if (!e || e.source !== "google" || seen.has(e.family)) continue;
    seen.add(e.family);
    params.push(`family=${googleFamilyParam(e, axes)}`);
  }
  if (!params.length) return null;
  params.sort();
  return `${GOOGLE_CSS}?${params.join("&")}&display=swap`;
}
