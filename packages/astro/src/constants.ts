/**
 * Reference data. Carried over from the astrologychart2 prototype
 * (birthchart/config.js, chartSerializer.js, server/src/lib/aspect-utils.ts)
 * so the ported app computes and labels charts the same way.
 */

import type { AspectKey, BodyKey, Element, HouseSystemCode, Modality, SignKey } from "./types";

export interface BodyInfo {
  key: BodyKey;
  name: string;
  glyph: string;
  /** Swiss Ephemeris body number (SE_SUN = 0 … SE_PLUTO = 9, SE_TRUE_NODE = 11, SE_CHIRON = 15). */
  sweId: number;
  /**
   * "planet" counts toward the element/modality balance and must always
   * compute; "point" is extra — it may be missing from a chart (Chiron needs
   * the asteroid ephemeris and covers a narrower span of years) and is left
   * out of the tally.
   */
  group: "planet" | "point";
  color: string;
  keywords: string[];
}

export const BODIES: readonly BodyInfo[] = [
  { key: "sun", name: "Sun", glyph: "☉", sweId: 0, color: "#FFA500", group: "planet", keywords: ["ego", "identity", "vitality", "purpose"] },
  { key: "moon", name: "Moon", glyph: "☽", sweId: 1, color: "#C0C0C0", group: "planet", keywords: ["emotions", "instinct", "subconscious", "nurturing"] },
  { key: "mercury", name: "Mercury", glyph: "☿", sweId: 2, color: "#87CEEB", group: "planet", keywords: ["communication", "intellect", "learning", "travel"] },
  { key: "venus", name: "Venus", glyph: "♀", sweId: 3, color: "#FF69B4", group: "planet", keywords: ["love", "beauty", "harmony", "values"] },
  { key: "mars", name: "Mars", glyph: "♂", sweId: 4, color: "#DC143C", group: "planet", keywords: ["action", "energy", "courage", "desire"] },
  { key: "jupiter", name: "Jupiter", glyph: "♃", sweId: 5, color: "#DAA520", group: "planet", keywords: ["expansion", "wisdom", "philosophy", "luck"] },
  { key: "saturn", name: "Saturn", glyph: "♄", sweId: 6, color: "#2F4F4F", group: "planet", keywords: ["discipline", "structure", "responsibility", "limits"] },
  { key: "uranus", name: "Uranus", glyph: "♅", sweId: 7, color: "#4FD0E3", group: "planet", keywords: ["innovation", "rebellion", "technology", "freedom"] },
  { key: "neptune", name: "Neptune", glyph: "♆", sweId: 8, color: "#4169E1", group: "planet", keywords: ["dreams", "intuition", "spirituality", "illusion"] },
  { key: "pluto", name: "Pluto", glyph: "♇", sweId: 9, color: "#8B008B", group: "planet", keywords: ["transformation", "power", "regeneration", "depth"] },
  // The TRUE node, not the mean one: it follows the Moon's actual orbit
  // rather than a smoothed average, and it is what astro.com and most modern
  // software show. The South Node is always exactly opposite, so it is not
  // stored — derive it as northNode + 180° if it is ever wanted.
  { key: "northNode", name: "North Node", glyph: "☊", sweId: 11, color: "#6A5ACD", group: "point", keywords: ["direction", "growth", "what is being learned"] },
  { key: "chiron", name: "Chiron", glyph: "⚷", sweId: 15, color: "#8FBC8F", group: "point", keywords: ["wound", "healing", "teaching", "the bridge"] },
];

export const BODY_BY_KEY = Object.fromEntries(BODIES.map((b) => [b.key, b])) as Record<BodyKey, BodyInfo>;

export interface SignInfo {
  key: SignKey;
  name: string;
  short: string;
  glyph: string;
  element: Element;
  modality: Modality;
  /** Traditional ruler first, modern co-ruler second where there is one. */
  rulers: BodyKey[];
}

/** In zodiacal order: index × 30° is the sign's starting longitude. */
export const SIGNS: readonly SignInfo[] = [
  { key: "aries", name: "Aries", short: "Ari", glyph: "♈", element: "fire", modality: "cardinal", rulers: ["mars"] },
  { key: "taurus", name: "Taurus", short: "Tau", glyph: "♉", element: "earth", modality: "fixed", rulers: ["venus"] },
  { key: "gemini", name: "Gemini", short: "Gem", glyph: "♊", element: "air", modality: "mutable", rulers: ["mercury"] },
  { key: "cancer", name: "Cancer", short: "Can", glyph: "♋", element: "water", modality: "cardinal", rulers: ["moon"] },
  { key: "leo", name: "Leo", short: "Leo", glyph: "♌", element: "fire", modality: "fixed", rulers: ["sun"] },
  { key: "virgo", name: "Virgo", short: "Vir", glyph: "♍", element: "earth", modality: "mutable", rulers: ["mercury"] },
  { key: "libra", name: "Libra", short: "Lib", glyph: "♎", element: "air", modality: "cardinal", rulers: ["venus"] },
  { key: "scorpio", name: "Scorpio", short: "Sco", glyph: "♏", element: "water", modality: "fixed", rulers: ["mars", "pluto"] },
  { key: "sagittarius", name: "Sagittarius", short: "Sag", glyph: "♐", element: "fire", modality: "mutable", rulers: ["jupiter"] },
  { key: "capricorn", name: "Capricorn", short: "Cap", glyph: "♑", element: "earth", modality: "cardinal", rulers: ["saturn"] },
  { key: "aquarius", name: "Aquarius", short: "Aqu", glyph: "♒", element: "air", modality: "fixed", rulers: ["saturn", "uranus"] },
  { key: "pisces", name: "Pisces", short: "Pis", glyph: "♓", element: "water", modality: "mutable", rulers: ["jupiter", "neptune"] },
];

export const SIGN_BY_KEY = Object.fromEntries(SIGNS.map((s) => [s.key, s])) as Record<SignKey, SignInfo>;

/** Element colours as used on the chart wheel (tuned in the prototype to match astro-seek). */
export const ELEMENT_COLORS: Record<Element, string> = {
  fire: "#FF6B6B",
  earth: "#8B7355",
  air: "#95E1D3",
  water: "#6495ED",
};

export interface HouseInfo {
  house: number;
  type: "angular" | "succedent" | "cadent";
  keywords: string[];
}

export const HOUSES: readonly HouseInfo[] = [
  { house: 1, type: "angular", keywords: ["Self", "Identity", "Appearance", "First Impressions"] },
  { house: 2, type: "succedent", keywords: ["Values", "Possessions", "Money", "Self-Worth"] },
  { house: 3, type: "cadent", keywords: ["Communication", "Siblings", "Short Trips", "Learning"] },
  { house: 4, type: "angular", keywords: ["Home", "Family", "Roots", "Private Life"] },
  { house: 5, type: "succedent", keywords: ["Creativity", "Children", "Romance", "Self-Expression"] },
  { house: 6, type: "cadent", keywords: ["Work", "Health", "Service", "Daily Routine"] },
  { house: 7, type: "angular", keywords: ["Partnerships", "Marriage", "Open Enemies", "Cooperation"] },
  { house: 8, type: "succedent", keywords: ["Transformation", "Shared Resources", "Death/Rebirth", "Intimacy"] },
  { house: 9, type: "cadent", keywords: ["Philosophy", "Higher Learning", "Travel", "Religion"] },
  { house: 10, type: "angular", keywords: ["Career", "Reputation", "Status", "Public Image"] },
  { house: 11, type: "succedent", keywords: ["Friends", "Groups", "Hopes", "Social Networks"] },
  { house: 12, type: "cadent", keywords: ["Spirituality", "Hidden", "Subconscious", "Sacrifice"] },
];

export interface HouseSystemInfo {
  code: HouseSystemCode;
  name: string;
  description: string;
}

export const HOUSE_SYSTEMS: readonly HouseSystemInfo[] = [
  { code: "P", name: "Placidus", description: "Most popular modern house system, time-based" },
  { code: "K", name: "Koch", description: "Birthplace (GOH) house system" },
  { code: "O", name: "Porphyry", description: "Ancient space-based system" },
  { code: "R", name: "Regiomontanus", description: "Medieval time-based system" },
  { code: "C", name: "Campanus", description: "Space-based quadrant system" },
  { code: "E", name: "Equal", description: "30° houses from the Ascendant" },
  { code: "W", name: "Whole Sign", description: "Ancient system, signs = houses" },
  { code: "M", name: "Morinus", description: "Equatorial system" },
  { code: "T", name: "Topocentric", description: "Topocentric house system" },
  { code: "B", name: "Alcabitius", description: "Medieval proportional system" },
];

export const DEFAULT_HOUSE_SYSTEM: HouseSystemCode = "P";

export interface AspectInfo {
  key: AspectKey;
  name: string;
  glyph: string;
  angle: number;
  orb: number;
  major: boolean;
  nature: "variable" | "harmonious" | "inharmonious" | "neutral";
  color: string;
}

export const ASPECTS: readonly AspectInfo[] = [
  { key: "conjunction", name: "Conjunction", glyph: "☌", angle: 0, orb: 8, major: true, nature: "variable", color: "#FF6B9D" },
  { key: "sextile", name: "Sextile", glyph: "⚹", angle: 60, orb: 4, major: true, nature: "harmonious", color: "#3498DB" },
  { key: "square", name: "Square", glyph: "□", angle: 90, orb: 6, major: true, nature: "inharmonious", color: "#E67E22" },
  { key: "trine", name: "Trine", glyph: "△", angle: 120, orb: 6, major: true, nature: "harmonious", color: "#2ECC71" },
  { key: "opposition", name: "Opposition", glyph: "☍", angle: 180, orb: 8, major: true, nature: "inharmonious", color: "#E74C3C" },
  { key: "quincunx", name: "Quincunx", glyph: "⚻", angle: 150, orb: 3, major: false, nature: "neutral", color: "#9B59B6" },
  { key: "semisextile", name: "Semi-sextile", glyph: "⚺", angle: 30, orb: 2, major: false, nature: "neutral", color: "#95A5A6" },
  { key: "semisquare", name: "Semi-square", glyph: "∠", angle: 45, orb: 2, major: false, nature: "inharmonious", color: "#D35400" },
  { key: "sesquisquare", name: "Sesquisquare", glyph: "⚼", angle: 135, orb: 2, major: false, nature: "inharmonious", color: "#C0392B" },
];

export const ASPECT_BY_KEY = Object.fromEntries(ASPECTS.map((a) => [a.key, a])) as Record<AspectKey, AspectInfo>;
