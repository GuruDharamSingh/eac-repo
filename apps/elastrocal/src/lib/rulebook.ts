/**
 * A small, hard-coded slice of the owner's rulebook, for the chart explorer.
 *
 * The full rulebook of tenets lives on the owner's PC; this is only what the
 * explorer needs to state explicit, checkable facts next to the corpus:
 *  - essential dignity (domicile / exaltation / detriment / fall),
 *  - element, modality and polarity of a sign,
 *  - sign rulership, and from it the chart ruler and each planet's dispositor.
 *
 * Conventions:
 *  - Domiciles list the traditional ruler first and the modern co-ruler
 *    second (Scorpio: Mars, Pluto). Both count as "domicile" here, so Mars
 *    is in detriment in Libra and in Taurus (opposite Aries and Scorpio).
 *  - Exaltations are the traditional seven only. The modern exaltations of
 *    the outer planets are disputed between authors and are left out rather
 *    than asserted.
 *  - Detriment and fall are derived: the sign opposite a domicile / an
 *    exaltation.
 */

import { SIGNS, SIGN_BY_KEY, type AspectPoint, type BodyKey, type Element, type Modality, type SignKey } from "@elkdonis/astro";

export type DignityState = "domicile" | "exaltation" | "detriment" | "fall";

/** Signs each planet rules. Traditional rulerships, plus the modern outer-planet ones. */
export const DOMICILE: Partial<Record<BodyKey, SignKey[]>> = {
  sun: ["leo"],
  moon: ["cancer"],
  mercury: ["gemini", "virgo"],
  venus: ["taurus", "libra"],
  mars: ["aries", "scorpio"],
  jupiter: ["sagittarius", "pisces"],
  saturn: ["capricorn", "aquarius"],
  uranus: ["aquarius"],
  neptune: ["pisces"],
  pluto: ["scorpio"],
};

/** Traditional exaltations (the seven visible planets). */
export const EXALTATION: Partial<Record<BodyKey, SignKey>> = {
  sun: "aries",
  moon: "taurus",
  mercury: "virgo",
  venus: "pisces",
  mars: "capricorn",
  jupiter: "cancer",
  saturn: "libra",
};

const opposite = (s: SignKey): SignKey => SIGNS[(SIGNS.findIndex((x) => x.key === s) + 6) % 12].key;

export const POLARITY: Record<Element, "yang" | "yin"> = { fire: "yang", air: "yang", earth: "yin", water: "yin" };

/** Every dignity state a point holds in a sign (Mercury in Virgo is both domicile and exaltation). */
export function dignitiesOf(point: AspectPoint, sign: SignKey): DignityState[] {
  const out: DignityState[] = [];
  const dom = DOMICILE[point as BodyKey];
  const ex = EXALTATION[point as BodyKey];
  if (dom?.includes(sign)) out.push("domicile");
  if (ex === sign) out.push("exaltation");
  if (dom?.some((d) => opposite(d) === sign)) out.push("detriment");
  if (ex && opposite(ex) === sign) out.push("fall");
  return out;
}

export interface SignFacts {
  element: Element;
  modality: Modality;
  polarity: "yang" | "yin";
  /** Traditional ruler first, modern co-ruler second. */
  rulers: BodyKey[];
}

export function signFacts(sign: SignKey): SignFacts {
  const s = SIGN_BY_KEY[sign];
  return { element: s.element, modality: s.modality, polarity: POLARITY[s.element], rulers: [...s.rulers] };
}

/** The chart ruler: the (traditional) ruler of the Ascendant's sign. */
export function chartRuler(ascendantSign: SignKey): BodyKey {
  return SIGN_BY_KEY[ascendantSign].rulers[0];
}

export const DIGNITY_LABEL: Record<DignityState, string> = {
  domicile: "Domicile",
  exaltation: "Exaltation",
  detriment: "Detriment",
  fall: "Fall",
};
