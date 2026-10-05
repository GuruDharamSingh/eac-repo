/**
 * What a book passage is ABOUT, from its heading path — with the sibling
 * correction the PDF chunker's headings need.
 *
 * The chunker records the headings above a passage outermost first, but a
 * PDF's heading levels are guessed from type size, so a run of same-level
 * headings often comes out nested:
 *
 *   ["SUN", "SUN BY SIGN", "Natal Sun in Aquarius", "Natal Sun in Pisces"]
 *   ["Pluto in the Eighth House or Scorpio 151", "Natal Pluto in 9th House"]   (a running page header)
 *   ["JUPITER BY SIGN Natal Jupiter in Aries", "Natal Jupiter in Scorpio"]    (a part title fused with its first entry)
 *   ["CHAPTER II", "II. Virgo.", "TAURUS, THE BULL"]
 *
 * Rule: tag each heading (the corpus tagger, mentions included, so "TAURUS,
 * THE BULL" counts as Taurus). Each key fills a SLOT — the point's sign, the
 * point's house, a pair's aspect, "the sign", "the house", a compat pair….
 * When a later heading fills a slot an earlier heading also fills, with a
 * different value, the earlier heading is a SIBLING (or a running header),
 * not a parent: it is dropped from the breadcrumb and none of its keys count.
 * "Sun in Aquarius" › "Sun in Pisces" is about the Sun in Pisces.
 *
 * The passage's SCOPE is the union of the surviving headings' keys. Part
 * titles ("SUN BY HOUSE") survive and contribute only general keys (planet:sun).
 */

import { FACTOR_BY_KEY, tagText } from "@elkdonis/astro-corpus";
import { isPlacementKey } from "./applicability";

export interface Crumb {
  text: string;
  keys: string[];
}

export interface Scope {
  /** The corrected breadcrumb (sibling headings removed), outermost first. */
  breadcrumb: Crumb[];
  /** Headings dropped as siblings / running headers. */
  ignored: string[];
  /** Every key the surviving headings name. */
  keys: string[];
}

const HEADING_CACHE = new Map<string, string[]>();
const CACHE_MAX = 50_000;

/** Factor keys a heading names (explicit, inferred and bare mentions), cached. */
export function headingKeys(h: string): string[] {
  let keys = HEADING_CACHE.get(h);
  if (!keys) {
    keys = tagText(h, { mentions: true }).map((t) => t.key);
    if (HEADING_CACHE.size >= CACHE_MAX) HEADING_CACHE.clear();
    HEADING_CACHE.set(h, keys);
  }
  return keys;
}

/** The slot a key fills, or null for keys that never conflict (planet:, aspect-type:). */
export function slotOf(key: string): string | null {
  const f = FACTOR_BY_KEY.get(key);
  if (!f) return null;
  const p = f.parts as Record<string, string | number | undefined>;
  switch (f.kind) {
    case "sign":
      return `sign:${p.point}`;
    case "house":
      return `house:${p.point}`;
    case "aspect":
      return `aspect:${[p.point, p.other].sort().join("|")}`;
    case "zodiac":
      return "zodiac";
    case "realm":
      return "realm";
    case "compat":
      return "compat";
    case "transit":
      return `transit:${p.point}|${p.other}`;
    case "transit-sign":
      return `transit-sign:${p.point}`;
    case "transit-house":
      return `transit-house:${p.point}`;
    default:
      return null;
  }
}

export function resolveScope(headings: readonly string[]): Scope {
  const tagged = headings.map((text) => ({ text, keys: headingKeys(text) }));
  const dropped = new Set<number>();
  for (let i = 0; i < tagged.length; i++) {
    const mine = new Set(tagged[i].keys);
    outer: for (const k of tagged[i].keys) {
      const slot = slotOf(k);
      if (!slot) continue;
      for (let j = i + 1; j < tagged.length; j++) {
        if (tagged[j].keys.some((k2) => !mine.has(k2) && slotOf(k2) === slot)) {
          dropped.add(i);
          break outer;
        }
      }
    }
  }
  const breadcrumb = tagged.filter((_, i) => !dropped.has(i));
  return {
    breadcrumb,
    ignored: tagged.filter((_, i) => dropped.has(i)).map((t) => t.text),
    keys: [...new Set(breadcrumb.flatMap((c) => c.keys))],
  };
}

// ── is a passage about a key? ───────────────────────────────────────────────

/**
 * Does this set of keys (a scope, or a passage's own strong tags) make the
 * passage ABOUT `key`? A placement key must be named itself (alternatives in
 * one heading — "Pluto in the 8th House or Scorpio" — are both named). A
 * general key is about anything placing it: planet:mars ← sign:mars:*,
 * house:mars:*, aspects with Mars; zodiac:leo ← sign:*:leo; realm:7 ←
 * house:*:7; aspect-type:square ← aspect:*:*:square.
 */
export function isAbout(keys: readonly string[], key: string): boolean {
  if (keys.includes(key)) return true;
  if (isPlacementKey(key)) return false;
  return keys.some((k) => involves(k, key));
}

/** A placement key that places the general key's subject. */
export function involves(k: string, general: string): boolean {
  const f = FACTOR_BY_KEY.get(k);
  const g = FACTOR_BY_KEY.get(general);
  if (!f || !g) return false;
  const p = f.parts as Record<string, string | number | undefined>;
  const q = g.parts as Record<string, string | number | undefined>;
  switch (g.kind) {
    case "planet":
      return p.point === q.point || p.other === q.point;
    case "zodiac":
      return p.sign === q.sign || p.otherSign === q.sign;
    case "realm":
      return p.house !== undefined && Number(p.house) === Number(q.house);
    case "aspect-type":
      return p.aspect === q.aspect;
    default:
      return false;
  }
}

/** Placement registry keys that would make a passage about a general key (for candidate lookup). */
export function placementKeysFor(general: string): string[] {
  const out: string[] = [];
  for (const k of FACTOR_BY_KEY.keys()) if (isPlacementKey(k) && !k.startsWith("transit") && involves(k, general)) out.push(k);
  return out;
}

export const labelOf = (k: string) => FACTOR_BY_KEY.get(k)?.label ?? k;

/** "Sun in the 7th house", or "Moon in Leo + Venus in Aries"; general keys when there is nothing more specific. */
export function scopeLabel(keys: readonly string[]): string | null {
  const placements = keys.filter(isPlacementKey);
  const shown = placements.length ? placements : keys;
  return shown.length ? shown.map(labelOf).join(" + ") : null;
}

/** Words that lean on the passage's subject. */
export const ANAPHORA = /\b(this placement|this position|this aspect|these people|these natives|such natives|such people|this person|these individuals|you|your|they|their)\b/i;
