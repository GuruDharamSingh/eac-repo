/**
 * The factor registry: one stable key per thing an interpretation can be
 * about. A saved chart, an imported passage, a question and a grade all point
 * at the same key, so the corpus can be counted, filled and exported by factor.
 *
 * Generated from the engine's constants, never hand-written, so a body or an
 * aspect added to `@elkdonis/astro` appears here without an edit.
 *
 * Key shapes (all lower-case, `:`-separated, point keys as the engine spells
 * them — `northNode`, `ascendant`, `midheaven`):
 *
 *   sign:<point>:<sign>                 Moon in Scorpio, Ascendant in Leo
 *   house:<body>:<1-12>                 Venus in the 7th house
 *   aspect:<a>:<b>:<aspect>             Mars square Saturn (a before b in POINT_ORDER)
 *   transit:<transiting>:<natal>:<aspect>   transiting Saturn conjunct natal Sun (majors only)
 *   transit-sign:<body>:<sign>          Uranus transiting Taurus
 *   transit-house:<body>:<1-12>         Saturn transiting the 5th house
 *   compat:<sign>:<sign>                Aries with Virgo (sun-sign compatibility, unordered)
 *   planet:<point>                      Saturn on its own, before sign, house or aspect
 *   zodiac:<sign>                       Scorpio on its own
 *   realm:<1-12>                        the 7th house as an area of life
 *   aspect-type:<aspect>                the square as such, between any two points
 *
 * Aspects are kept separate. Books file "trine / sextile" as one chapter; that
 * grouping is `bookGroup`, a display convention, and a passage filed under a
 * grouped chapter is tagged on both aspects with `bookGroup` recorded.
 */

import { ASPECTS, BODIES, SIGNS, type AspectKey, type AspectPoint, type BodyKey, type ChartResult, type SignKey } from "@elkdonis/astro";
import { ASPECT_OCCURRENCE } from "./aspect-occurrence";

export type FactorKind =
  | "sign"
  | "house"
  | "aspect"
  | "transit"
  | "transit-sign"
  | "transit-house"
  | "compat"
  | "planet"
  | "zodiac"
  | "realm"
  | "aspect-type"
  // Layers and compounds (2026-10-04, Justin's attribute layering): what a
  // sign carries (element, quality, polarity), a sign on a house, and a body
  // in a sign in a house as one object. Derived onto claims by compounds.ts.
  | "element"
  | "modality"
  | "polarity"
  | "sign-house"
  | "placement";

export type PointGroup = "personal" | "social" | "generational" | "point" | "angle";

export interface Factor {
  key: string;
  kind: FactorKind;
  /** Display text: "Sun in Aries", "Mars square Saturn". */
  label: string;
  /** The points, signs, houses and aspect the key is made of. */
  parts: {
    point?: AspectPoint;
    other?: AspectPoint;
    sign?: SignKey;
    otherSign?: SignKey;
    house?: number;
    aspect?: AspectKey;
    element?: "fire" | "earth" | "air" | "water";
    modality?: "cardinal" | "fixed" | "mutable";
    polarity?: "masculine" | "feminine";
  };
  /** Group of the (first) point; for compat, "personal" (Sun signs). */
  group: PointGroup;
  /**
   * Shared by everyone born within months to years of each other: an outer
   * planet's sign, or an aspect between two slow points. Low weight for an
   * individual reading; still worth one gold text.
   */
  generational: boolean;
  /** A minor aspect (quincunx, semisextile, semisquare, sesquisquare). */
  minor: boolean;
  /**
   * Cannot occur: the pair never reaches the aspect's angle within orb
   * (Sun–Mercury beyond the conjunction, and so on). Established by
   * scripts/scan-aspects.ts over 1800–2200. Never shown, never trained on.
   */
  impossible: boolean;
  /** Possible but not seen in any birth chart 1900–2030 (outer–outer aspects). */
  unobserved: boolean;
  /** The chapter a grouped book files this under ("trine / sextile"), if any. */
  bookGroup: string | null;
}

export const ANGLES = ["ascendant", "midheaven"] as const;
export type AngleKey = (typeof ANGLES)[number];

/** Canonical order: the engine's body order, then the two angles. */
export const POINT_ORDER: readonly AspectPoint[] = [...BODIES.map((b) => b.key), ...ANGLES];

const POINT_NAME: Record<AspectPoint, string> = {
  ...(Object.fromEntries(BODIES.map((b) => [b.key, b.name])) as Record<BodyKey, string>),
  ascendant: "Ascendant",
  midheaven: "Midheaven",
};
const SIGN_NAME = Object.fromEntries(SIGNS.map((s) => [s.key, s.name])) as Record<SignKey, string>;
const ASPECT_NAME: Record<AspectKey, string> = {
  conjunction: "conjunct",
  sextile: "sextile",
  square: "square",
  trine: "trine",
  opposition: "opposite",
  quincunx: "quincunx",
  semisextile: "semisextile",
  semisquare: "semisquare",
  sesquisquare: "sesquisquare",
};

export const pointName = (p: AspectPoint) => POINT_NAME[p];
export const signName = (s: SignKey) => SIGN_NAME[s];

const GROUP: Record<AspectPoint, PointGroup> = {
  sun: "personal",
  moon: "personal",
  mercury: "personal",
  venus: "personal",
  mars: "personal",
  jupiter: "social",
  saturn: "social",
  uranus: "generational",
  neptune: "generational",
  pluto: "generational",
  northNode: "point",
  chiron: "point",
  ascendant: "angle",
  midheaven: "angle",
};

/** Points slow enough that a whole birth cohort shares their aspects. */
const SLOW = new Set<AspectPoint>(["jupiter", "saturn", "uranus", "neptune", "pluto", "chiron", "northNode"]);
/** Points whose sign is shared by a cohort (years in one sign). */
const COHORT_SIGN = new Set<AspectPoint>(["uranus", "neptune", "pluto", "chiron"]);

const BOOK_GROUP: Partial<Record<AspectKey, string>> = {
  conjunction: "conjunct",
  trine: "trine / sextile",
  sextile: "trine / sextile",
  square: "square / opposition",
  opposition: "square / opposition",
  quincunx: "quincunx",
  semisquare: "semisquare / semisextile",
  semisextile: "semisquare / semisextile",
};

/** Points whose mutual angles are bounded by their orbits. */
const INNER = new Set<AspectPoint>(["sun", "mercury", "venus"]);

const MAJOR = new Set(ASPECTS.filter((a) => a.major).map((a) => a.key));
/** Bodies that transit in the registry: all twelve; the angles do not move. */
const TRANSITING: readonly BodyKey[] = BODIES.map((b) => b.key);

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const orderOf = (p: AspectPoint) => POINT_ORDER.indexOf(p);

/** Put a pair in canonical order. */
export function canonicalPair(a: AspectPoint, b: AspectPoint): [AspectPoint, AspectPoint] {
  return orderOf(a) <= orderOf(b) ? [a, b] : [b, a];
}

export const signKey = (point: AspectPoint, sign: SignKey) => `sign:${point}:${sign}`;
export const houseKey = (body: BodyKey, house: number) => `house:${body}:${house}`;
export function aspectKey(a: AspectPoint, b: AspectPoint, aspect: AspectKey) {
  const [x, y] = canonicalPair(a, b);
  return `aspect:${x}:${y}:${aspect}`;
}
export const transitKey = (moving: BodyKey, natal: AspectPoint, aspect: AspectKey) => `transit:${moving}:${natal}:${aspect}`;
export const transitSignKey = (moving: BodyKey, sign: SignKey) => `transit-sign:${moving}:${sign}`;
export const transitHouseKey = (moving: BodyKey, house: number) => `transit-house:${moving}:${house}`;
export const planetKey = (point: AspectPoint) => `planet:${point}`;
export const zodiacKey = (sign: SignKey) => `zodiac:${sign}`;
export const realmKey = (house: number) => `realm:${house}`;
export const aspectTypeKey = (aspect: AspectKey) => `aspect-type:${aspect}`;
export const elementKey = (element: string) => `element:${element}`;
export const modalityKey = (modality: string) => `modality:${modality}`;
export const polarityKey = (polarity: string) => `polarity:${polarity}`;
export const signHouseKey = (sign: SignKey, house: number) => `sign-house:${sign}:${house}`;
export const placementKey = (body: BodyKey, sign: SignKey, house: number) => `placement:${body}:${sign}:${house}`;
export const ELEMENTS = ["fire", "earth", "air", "water"] as const;
export const MODALITIES = ["cardinal", "fixed", "mutable"] as const;
export const POLARITIES = ["masculine", "feminine"] as const;

/** What each house covers, for labels and for questions about areas of life. */
export const HOUSE_REALMS: readonly { house: number; name: string; short: string }[] = [
  { house: 1, name: "self, body and approach to life", short: "self-presentation and the body" },
  { house: 2, name: "money, possessions and values", short: "money and what they value" },
  { house: 3, name: "communication, siblings and the near environment", short: "speech, learning and siblings" },
  { house: 4, name: "home, family and roots", short: "home and family" },
  { house: 5, name: "creativity, romance, children and pleasure", short: "creativity, romance and children" },
  { house: 6, name: "work, health and daily routine", short: "daily work and health" },
  { house: 7, name: "partnership, marriage and open opponents", short: "partnership and marriage" },
  { house: 8, name: "shared resources, intimacy, death and transformation", short: "intimacy, shared money and crisis" },
  { house: 9, name: "belief, higher learning, law and long journeys", short: "belief, study and travel" },
  { house: 10, name: "career, reputation and public standing", short: "career and reputation" },
  { house: 11, name: "friends, groups, hopes and aims", short: "friends, groups and hopes" },
  { house: 12, name: "the hidden, solitude, institutions and the unconscious", short: "solitude and what is hidden" },
];

export function compatKey(a: SignKey, b: SignKey) {
  const ia = SIGNS.findIndex((s) => s.key === a);
  const ib = SIGNS.findIndex((s) => s.key === b);
  return ia <= ib ? `compat:${a}:${b}` : `compat:${b}:${a}`;
}

function occurrence(a: AspectPoint, b: AspectPoint, aspect: AspectKey) {
  const [x, y] = canonicalPair(a, b);
  const row = ASPECT_OCCURRENCE[`${x}:${y}`];
  // Pairs involving an angle are not in the scan (the angles go everywhere);
  // treat them as possible and observed.
  if (!row) return { impossible: false, unobserved: false };
  // Only the Sun, Mercury and Venus are held together by geometry (Mercury
  // stays within ~28° of the Sun, Venus within ~48°). Any other pair can reach
  // any angle given time, so a gap in a 400-year scan is "unobserved", never
  // "impossible".
  const bound = INNER.has(x) && INNER.has(y);
  return {
    impossible: bound && !row.ever.includes(aspect),
    unobserved: !row.births.includes(aspect),
  };
}

function buildRegistry(): Factor[] {
  const out: Factor[] = [];
  const base = { minor: false, impossible: false, unobserved: false, bookGroup: null };

  for (const point of POINT_ORDER) {
    for (const s of SIGNS) {
      const rising = point === "ascendant";
      out.push({
        ...base,
        key: signKey(point, s.key),
        kind: "sign",
        label: rising ? `${s.name} rising` : `${POINT_NAME[point]} in ${s.name}`,
        parts: { point, sign: s.key },
        group: GROUP[point],
        generational: COHORT_SIGN.has(point),
      });
    }
  }

  for (const b of BODIES) {
    for (let h = 1; h <= 12; h++) {
      out.push({
        ...base,
        key: houseKey(b.key, h),
        kind: "house",
        label: `${b.name} in the ${ordinal(h)} house`,
        parts: { point: b.key, house: h },
        group: GROUP[b.key],
        generational: false,
      });
    }
  }

  for (let i = 0; i < POINT_ORDER.length; i++) {
    for (let j = i + 1; j < POINT_ORDER.length; j++) {
      const a = POINT_ORDER[i];
      const b = POINT_ORDER[j];
      if (GROUP[a] === "angle" && GROUP[b] === "angle") continue; // AC–MC: fixed by construction
      for (const asp of ASPECTS) {
        out.push({
          key: aspectKey(a, b, asp.key),
          kind: "aspect",
          label: `${POINT_NAME[a]} ${ASPECT_NAME[asp.key]} ${POINT_NAME[b]}`,
          parts: { point: a, other: b, aspect: asp.key },
          group: GROUP[a],
          generational: SLOW.has(a) && SLOW.has(b),
          minor: !asp.major,
          ...occurrence(a, b, asp.key),
          bookGroup: BOOK_GROUP[asp.key] ?? null,
        });
      }
    }
  }

  for (const moving of TRANSITING) {
    for (const natal of POINT_ORDER) {
      for (const asp of ASPECTS) {
        if (!MAJOR.has(asp.key)) continue;
        out.push({
          ...base,
          key: transitKey(moving, natal, asp.key),
          kind: "transit",
          label: `Transiting ${POINT_NAME[moving]} ${ASPECT_NAME[asp.key]} natal ${POINT_NAME[natal]}`,
          parts: { point: moving, other: natal, aspect: asp.key },
          group: GROUP[moving],
          generational: false,
          bookGroup: BOOK_GROUP[asp.key] ?? null,
        });
      }
    }
  }

  for (const moving of TRANSITING) {
    for (const s of SIGNS) {
      out.push({
        ...base,
        key: transitSignKey(moving, s.key),
        kind: "transit-sign",
        label: `${POINT_NAME[moving]} transiting ${s.name}`,
        parts: { point: moving, sign: s.key },
        group: GROUP[moving],
        // An outer planet's passage through a sign is a period of history.
        generational: COHORT_SIGN.has(moving),
      });
    }
    for (let h = 1; h <= 12; h++) {
      out.push({
        ...base,
        key: transitHouseKey(moving, h),
        kind: "transit-house",
        label: `${POINT_NAME[moving]} transiting the ${ordinal(h)} house`,
        parts: { point: moving, house: h },
        group: GROUP[moving],
        generational: false,
      });
    }
  }

  for (const point of POINT_ORDER) {
    out.push({ ...base, key: planetKey(point), kind: "planet", label: POINT_NAME[point], parts: { point }, group: GROUP[point], generational: false });
  }
  for (const s of SIGNS) {
    out.push({ ...base, key: zodiacKey(s.key), kind: "zodiac", label: s.name, parts: { sign: s.key }, group: "personal", generational: false });
  }
  for (const r of HOUSE_REALMS) {
    out.push({ ...base, key: realmKey(r.house), kind: "realm", label: `${ordinal(r.house)} house: ${r.name}`, parts: { house: r.house }, group: "personal", generational: false });
  }
  for (const asp of ASPECTS) {
    out.push({
      ...base,
      key: aspectTypeKey(asp.key),
      kind: "aspect-type",
      label: `The ${asp.name.toLowerCase()}`,
      parts: { aspect: asp.key },
      group: "personal",
      generational: false,
      minor: !asp.major,
      bookGroup: BOOK_GROUP[asp.key] ?? null,
    });
  }

  for (let i = 0; i < SIGNS.length; i++) {
    for (let j = i; j < SIGNS.length; j++) {
      const a = SIGNS[i];
      const b = SIGNS[j];
      out.push({
        ...base,
        key: compatKey(a.key, b.key),
        kind: "compat",
        label: a.key === b.key ? `${a.name} with ${a.name}` : `${a.name} with ${b.name}`,
        parts: { point: "sun", sign: a.key, otherSign: b.key },
        group: "personal",
        generational: false,
      });
    }
  }

  // Layers: what every sign carries.
  for (const e of ELEMENTS) out.push({ ...base, key: elementKey(e), kind: "element", label: `${e[0].toUpperCase()}${e.slice(1)}`, parts: { element: e }, group: "personal", generational: false });
  for (const m of MODALITIES) out.push({ ...base, key: modalityKey(m), kind: "modality", label: `${m[0].toUpperCase()}${m.slice(1)}`, parts: { modality: m }, group: "personal", generational: false });
  for (const p of POLARITIES) out.push({ ...base, key: polarityKey(p), kind: "polarity", label: `${p[0].toUpperCase()}${p.slice(1)}`, parts: { polarity: p }, group: "personal", generational: false });

  // Compounds: a sign on a house, and a body in a sign in a house.
  for (const s of SIGNS) {
    for (let h = 1; h <= 12; h++) {
      out.push({ ...base, key: signHouseKey(s.key, h), kind: "sign-house", label: `${s.name} on the ${ordinal(h)} house`, parts: { sign: s.key, house: h }, group: "personal", generational: false });
    }
  }
  for (const b of BODIES) {
    for (const s of SIGNS) {
      for (let h = 1; h <= 12; h++) {
        out.push({
          ...base,
          key: placementKey(b.key, s.key, h),
          kind: "placement",
          label: `${b.name} in ${s.name} in the ${ordinal(h)} house`,
          parts: { point: b.key, sign: s.key, house: h },
          group: GROUP[b.key],
          generational: COHORT_SIGN.has(b.key),
        });
      }
    }
  }

  return out;
}

export const FACTORS: readonly Factor[] = buildRegistry();
export const FACTOR_BY_KEY: ReadonlyMap<string, Factor> = new Map(FACTORS.map((f) => [f.key, f]));

export function isFactorKey(key: string): boolean {
  return FACTOR_BY_KEY.has(key);
}

/**
 * The natal factors present in a computed chart: every point's sign, every
 * body's house (not when the birth time is unknown — houses then mean
 * nothing), and every aspect the engine found.
 */
export function factorsOf(chart: ChartResult): string[] {
  const keys: string[] = [];
  for (const b of chart.bodies) {
    keys.push(signKey(b.key, b.sign));
    if (!chart.approximate) keys.push(houseKey(b.key, b.house));
  }
  if (!chart.approximate) {
    keys.push(signKey("ascendant", chart.summary.rising));
    const mc = SIGNS[Math.floor((((chart.angles.midheaven % 360) + 360) % 360) / 30)].key;
    keys.push(signKey("midheaven", mc));
  }
  for (const a of chart.aspects) keys.push(aspectKey(a.a, a.b, a.type));
  return keys.filter(isFactorKey);
}

/** Counts by kind, for dashboards and the smoke test. */
export function registryCounts() {
  const counts: Record<string, number> = {};
  for (const f of FACTORS) {
    counts[f.kind] = (counts[f.kind] ?? 0) + 1;
    if (f.impossible) counts.impossible = (counts.impossible ?? 0) + 1;
    if (f.unobserved) counts.unobserved = (counts.unobserved ?? 0) + 1;
  }
  return counts;
}
