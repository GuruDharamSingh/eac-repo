/**
 * Curated question sets (2026-09-26), generated from the factor registry.
 *
 * 1. Combinations: questions that include different parts of a chart factor —
 *    a planet alone, a sign alone, an aspect alone, a planet in a sign, in a
 *    house, in both, an aspect between bare planets, with one or both planets
 *    in signs, and with signs and houses — including questions about a
 *    planet's or an aspect's attitude, and compare-and-contrast questions.
 * 2. Realms: ten questions for each of the twelve houses as areas of life.
 *
 * Every combination is one that can occur: aspects flagged impossible or not
 * seen in 1900–2030 births are excluded, two planets in an aspect sit the
 * right number of signs apart (a square three, a trine four), and their houses
 * follow the sign distance to within one house. Deterministic for a seed, so
 * a re-run produces the same set and re-import inserts nothing new.
 */

import { ASPECTS, BODIES, SIGNS, type AspectKey, type AspectPoint, type BodyKey, type SignKey } from "@elkdonis/astro";
import {
  aspectKey,
  aspectTypeKey,
  FACTOR_BY_KEY,
  HOUSE_REALMS,
  houseKey,
  planetKey,
  pointName,
  POINT_ORDER,
  realmKey,
  signKey,
  signName,
  zodiacKey,
} from "./factors";

export interface CuratedQuestion {
  /** Stable id within the set: pattern and a counter. */
  ref: string;
  pattern: string;
  prompt: string;
  factorKeys: string[];
}

// ── deterministic randomness ────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── wording ────────────────────────────────────────────────────────────────

const ARTICLE: Partial<Record<AspectPoint, string>> = { sun: "the Sun", moon: "the Moon", northNode: "the North Node", ascendant: "the Ascendant", midheaven: "the Midheaven" };
/** "the Sun", "Saturn". */
const P = (p: AspectPoint) => ARTICLE[p] ?? pointName(p);
/** Sentence start: "The Sun", "Saturn". */
const Pc = (p: AspectPoint) => {
  const s = P(p);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
/** Possessive: "the Sun's", "Mars's". */
const Ps = (p: AspectPoint) => `${P(p)}'s`;
const S = (s: SignKey) => signName(s);
const H = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const REALM = (n: number) => HOUSE_REALMS[n - 1].short;

const VERB: Record<AspectKey, string> = {
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
const NOUN: Record<AspectKey, string> = {
  conjunction: "conjunction",
  sextile: "sextile",
  square: "square",
  trine: "trine",
  opposition: "opposition",
  quincunx: "quincunx",
  semisextile: "semisextile",
  semisquare: "semisquare",
  sesquisquare: "sesquisquare",
};
const aN = (a: AspectKey) => (/^[aeiou]/.test(NOUN[a]) ? `an ${NOUN[a]}` : `a ${NOUN[a]}`);

/** Sign distances (0–6) an aspect can span without being out of sign. */
const SIGN_STEPS: Record<AspectKey, number[]> = {
  conjunction: [0],
  semisextile: [1],
  semisquare: [1, 2],
  sextile: [2],
  square: [3],
  trine: [4],
  sesquisquare: [4, 5],
  quincunx: [5],
  opposition: [6],
};
/** A contrasting aspect for compare questions. */
const CONTRAST: Record<AspectKey, AspectKey> = {
  conjunction: "opposition",
  opposition: "conjunction",
  square: "trine",
  trine: "square",
  sextile: "square",
  quincunx: "trine",
  semisextile: "sextile",
  semisquare: "square",
  sesquisquare: "trine",
};

const BODY_KEYS: BodyKey[] = BODIES.map((b) => b.key);
const SIGN_KEYS: SignKey[] = SIGNS.map((s) => s.key);
const ASPECT_KEYS: AspectKey[] = ASPECTS.map((a) => a.key);
/**
 * Signs the slowest planets occupied in birth years 1900–2030 (Neptune
 * Gemini 1887–1902 to Aries from 2025; Pluto Gemini 1882–1913 to Aquarius
 * from 2023). A question about Pluto in Aries describes nobody alive.
 */
const OCCUPIED: Partial<Record<AspectPoint, SignKey[]>> = {
  neptune: ["gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces", "aries"],
  pluto: ["gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius"],
};
const signOk = (p: AspectPoint, s: SignKey) => !OCCUPIED[p] || OCCUPIED[p]!.includes(s);
/** Outer pairs whose sign combinations belong to particular decades: asked without signs. */
const OUTER = new Set<AspectPoint>(["uranus", "neptune", "pluto"]);
const bothOuter = (a: AspectPoint, b: AspectPoint) => OUTER.has(a) && OUTER.has(b);

const signAt = (from: SignKey, steps: number) => SIGN_KEYS[(SIGN_KEYS.indexOf(from) + steps + 120) % 12];
const houseAt = (from: number, steps: number) => ((from - 1 + steps + 120) % 12) + 1;

/** Aspects between two points that can occur and do occur in living people's charts. */
function usable(a: AspectPoint, b: AspectPoint, asp: AspectKey): boolean {
  const f = FACTOR_BY_KEY.get(aspectKey(a, b, asp));
  return Boolean(f && !f.impossible && !f.unobserved);
}

// ── the combinations ───────────────────────────────────────────────────────

export function combinationQuestions(seed = 20260926): CuratedQuestion[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
  const out: CuratedQuestion[] = [];
  const seen = new Set<string>();
  const counters: Record<string, number> = {};

  const add = (pattern: string, prompt: string, keys: string[]) => {
    if (seen.has(prompt)) return false;
    if (!keys.every((k) => FACTOR_BY_KEY.has(k))) return false;
    seen.add(prompt);
    counters[pattern] = (counters[pattern] ?? 0) + 1;
    out.push({ ref: `${pattern}:${counters[pattern]}`, pattern, prompt, factorKeys: [...new Set(keys)] });
    return true;
  };
  /** Call `make` until it has added `n` questions (or given up). */
  const fill = (n: number, make: () => boolean) => {
    for (let tries = 0, made = 0; made < n && tries < n * 40; tries++) if (make()) made++;
  };

  // A planet alone.
  for (const p of POINT_ORDER) {
    add("planet", `What is ${Ps(p)} basic attitude, before any sign, house or aspect modifies it?`, [planetKey(p)]);
    add("planet", `What does ${P(p)} want, and what does it resist?`, [planetKey(p)]);
    add("planet", `How does ${P(p)} behave when it is strong in a chart, and when it is weak or afflicted?`, [planetKey(p)]);
    add("planet", `What does a prominent ${pointName(p)} ask of the person who has it?`, [planetKey(p)]);
  }

  // A sign alone.
  for (const s of SIGN_KEYS) {
    add("zodiac", `What is ${S(s)}'s attitude toward life, apart from any planet placed in it?`, [zodiacKey(s)]);
    add("zodiac", `How does any planet placed in ${S(s)} change the way it expresses itself?`, [zodiacKey(s)]);
    add("zodiac", `What does ${S(s)} protect, and what does it pursue?`, [zodiacKey(s)]);
    add("zodiac", `What separates ${S(s)} at its best from ${S(s)} at its worst?`, [zodiacKey(s)]);
  }

  // An aspect alone.
  for (const a of ASPECT_KEYS) {
    add("aspect-type", `What is the attitude of ${aN(a)} between any two planets?`, [aspectTypeKey(a)]);
    add("aspect-type", `What does ${aN(a)} ask of a person, whatever the planets involved?`, [aspectTypeKey(a)]);
    add("aspect-type", `When does ${aN(a)} help, and when does it hinder?`, [aspectTypeKey(a)]);
    add("aspect-type", `How does ${aN(a)} differ in practice from ${aN(CONTRAST[a])}?`, [aspectTypeKey(a), aspectTypeKey(CONTRAST[a])]);
  }

  // A sign on a house cusp.
  fill(36, () => {
    const s = pick(SIGN_KEYS);
    const h = pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    return add("sign-cusp", `What does ${S(s)} on the cusp of the ${H(h)} house suggest about ${REALM(h)}?`, [zodiacKey(s), realmKey(h)]);
  });

  // A planet in a sign.
  fill(100, () => {
    const p = pick(POINT_ORDER);
    const s = pick(SIGN_KEYS);
    if (!signOk(p, s)) return false;
    const k = signKey(p, s);
    if (p === "ascendant") return add("planet-sign", `What does ${S(s)} rising show about how a person meets the world?`, [k]);
    if (p === "midheaven") return add("planet-sign", `What does a ${S(s)} Midheaven say about vocation and public life?`, [k]);
    const t = pick([0, 1, 2, 3, 4]);
    if (t === 0) return add("planet-sign", `Interpret ${P(p)} in ${S(s)}.`, [k]);
    if (t === 1) return add("planet-sign", `How does ${P(p)} in ${S(s)} show in everyday behaviour?`, [k]);
    if (t === 2) return add("planet-sign", `What is ${Ps(p)} attitude when it is placed in ${S(s)}?`, [k]);
    if (t === 3) return add("planet-sign", `What does ${P(p)} in ${S(s)} find easy, and what does it struggle with?`, [k]);
    const o = signAt(s, 6);
    if (!signOk(p, o)) return false;
    return add("planet-sign", `How does ${P(p)} in ${S(s)} differ from ${P(p)} in ${S(o)}?`, [k, signKey(p, o)]);
  });

  // A planet in a house.
  fill(100, () => {
    const p = pick(BODY_KEYS);
    const h = pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const k = houseKey(p, h);
    const t = pick([0, 1, 2, 3, 4]);
    if (t === 0) return add("planet-house", `Interpret ${P(p)} in the ${H(h)} house.`, [k]);
    if (t === 1) return add("planet-house", `What does ${P(p)} in the ${H(h)} house bring to ${REALM(h)}?`, [k, realmKey(h)]);
    if (t === 2) return add("planet-house", `Where does ${Ps(p)} attention go when it sits in the ${H(h)} house?`, [k]);
    if (t === 3) return add("planet-house", `What is ${Ps(p)} attitude toward ${REALM(h)} when it is in the ${H(h)} house?`, [k, realmKey(h)]);
    const o = houseAt(h, 6);
    return add("planet-house", `How does ${P(p)} in the ${H(h)} house differ from ${P(p)} in the ${H(o)}?`, [k, houseKey(p, o)]);
  });

  // A planet in a sign in a house.
  fill(120, () => {
    const p = pick(BODY_KEYS);
    const s = pick(SIGN_KEYS);
    if (!signOk(p, s)) return false;
    const h = pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const keys = [signKey(p, s), houseKey(p, h)];
    const t = pick([0, 1, 2, 3]);
    if (t === 0) return add("planet-sign-house", `Interpret ${P(p)} in ${S(s)} in the ${H(h)} house.`, keys);
    if (t === 1) return add("planet-sign-house", `How does ${S(s)} colour ${Ps(p)} work in the ${H(h)} house, the house of ${REALM(h)}?`, [...keys, realmKey(h)]);
    if (t === 2) return add("planet-sign-house", `What is ${P(p)} in ${S(s)} trying to achieve in the ${H(h)} house?`, keys);
    return add("planet-sign-house", `How might ${P(p)} in ${S(s)} in the ${H(h)} house show up in ${REALM(h)}?`, [...keys, realmKey(h)]);
  });

  const pair = () => {
    for (let i = 0; i < 50; i++) {
      const a = pick(POINT_ORDER);
      const b = pick(POINT_ORDER);
      const asp = pick(ASPECT_KEYS);
      if (a === b || (["ascendant", "midheaven"].includes(a) && ["ascendant", "midheaven"].includes(b))) continue;
      if (!usable(a, b, asp)) continue;
      return { a, b, asp };
    }
    return null;
  };

  // An aspect between two planets, no signs or houses.
  fill(120, () => {
    const x = pair();
    if (!x) return false;
    const { a, b, asp } = x;
    const k = aspectKey(a, b, asp);
    const t = pick([0, 1, 2, 3, 4]);
    if (t === 0) return add("aspect", `Interpret ${P(a)} ${VERB[asp]} ${P(b)}.`, [k]);
    if (t === 1) return add("aspect", `What is ${Ps(a)} attitude toward ${P(b)} when they form ${aN(asp)}?`, [k]);
    if (t === 2) return add("aspect", `In ${P(a)} ${VERB[asp]} ${P(b)}, which planet tends to lead and which gives way?`, [k]);
    if (t === 3) return add("aspect", `How does ${P(a)} ${VERB[asp]} ${P(b)} feel from the inside, and how does it look to others?`, [k]);
    const c = CONTRAST[asp];
    if (!usable(a, b, c)) return false;
    return add("aspect", `How does ${P(a)} ${VERB[asp]} ${P(b)} differ from ${P(a)} ${VERB[c]} ${P(b)}?`, [k, aspectKey(a, b, c)]);
  });

  // An aspect with one planet in a sign.
  fill(100, () => {
    const x = pair();
    if (!x) return false;
    const { a, b, asp } = x;
    const sa = pick(SIGN_KEYS);
    if (!signOk(a, sa) || bothOuter(a, b)) return false;
    const keys = [aspectKey(a, b, asp), signKey(a, sa)];
    const t = pick([0, 1, 2]);
    if (t === 0) return add("aspect-one-sign", `Interpret ${P(a)} in ${S(sa)} ${VERB[asp]} ${P(b)}.`, keys);
    if (t === 1) return add("aspect-one-sign", `How does ${Ps(a)} being in ${S(sa)} change its ${NOUN[asp]} to ${P(b)}?`, keys);
    return add("aspect-one-sign", `What is ${Ps(b)} attitude toward ${P(a)} in ${S(sa)} when they form ${aN(asp)}?`, keys);
  });

  // An aspect with both planets in signs.
  fill(100, () => {
    const x = pair();
    if (!x) return false;
    const { a, b, asp } = x;
    const sa = pick(SIGN_KEYS);
    const sb = signAt(sa, pick(SIGN_STEPS[asp]) * (rnd() < 0.5 ? 1 : -1));
    if (!signOk(a, sa) || !signOk(b, sb) || bothOuter(a, b)) return false;
    const keys = [aspectKey(a, b, asp), signKey(a, sa), signKey(b, sb)];
    const t = pick([0, 1, 2]);
    if (t === 0) return add("aspect-two-signs", `Interpret ${P(a)} in ${S(sa)} ${VERB[asp]} ${P(b)} in ${S(sb)}.`, keys);
    if (t === 1) return add("aspect-two-signs", `What passes between ${P(a)} in ${S(sa)} and ${P(b)} in ${S(sb)} across this ${NOUN[asp]}?`, keys);
    return add("aspect-two-signs", `How do ${S(sa)} and ${S(sb)} shape the ${NOUN[asp]} between ${P(a)} and ${P(b)}?`, keys);
  });

  const bodyPair = () => {
    for (let i = 0; i < 50; i++) {
      const x = pair();
      if (x && BODY_KEYS.includes(x.a as BodyKey) && BODY_KEYS.includes(x.b as BodyKey)) return x as { a: BodyKey; b: BodyKey; asp: AspectKey };
    }
    return null;
  };

  // A planet in a sign and house, aspecting another planet in a sign.
  fill(120, () => {
    const x = bodyPair();
    if (!x) return false;
    const { a, b, asp } = x;
    const sa = pick(SIGN_KEYS);
    const ha = pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const sb = signAt(sa, pick(SIGN_STEPS[asp]) * (rnd() < 0.5 ? 1 : -1));
    if (!signOk(a, sa) || !signOk(b, sb) || bothOuter(a, b)) return false;
    const keys = [signKey(a, sa), houseKey(a, ha), aspectKey(a, b, asp), signKey(b, sb)];
    const t = pick([0, 1, 2]);
    if (t === 0) return add("placed-aspect", `Interpret ${P(a)} in ${S(sa)} in the ${H(ha)} house ${VERB[asp]} ${P(b)} in ${S(sb)}.`, keys);
    if (t === 1)
      return add(
        "placed-aspect",
        `${Pc(a)} in ${S(sa)} in the ${H(ha)} house is ${VERB[asp]} ${P(b)} in ${S(sb)}. How does this play out in ${REALM(ha)}?`,
        [...keys, realmKey(ha)],
      );
    return add("placed-aspect", `What is ${Ps(a)} attitude toward ${P(b)} when ${P(a)} is in ${S(sa)} in the ${H(ha)} house and ${VERB[asp]} ${P(b)} in ${S(sb)}?`, keys);
  });

  // Both planets in signs and houses.
  fill(80, () => {
    const x = bodyPair();
    if (!x) return false;
    const { a, b, asp } = x;
    const steps = pick(SIGN_STEPS[asp]) * (rnd() < 0.5 ? 1 : -1);
    const sa = pick(SIGN_KEYS);
    const sb = signAt(sa, steps);
    if (!signOk(a, sa) || !signOk(b, sb) || bothOuter(a, b)) return false;
    const ha = pick([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // Houses follow the sign distance to within one house (unequal house sizes).
    const hb = houseAt(ha, steps + pick([-1, 0, 0, 0, 1]));
    const keys = [signKey(a, sa), houseKey(a, ha), aspectKey(a, b, asp), signKey(b, sb), houseKey(b, hb)];
    if (rnd() < 0.5)
      return add("full", `Interpret ${P(a)} in ${S(sa)} in the ${H(ha)} house ${VERB[asp]} ${P(b)} in ${S(sb)} in the ${H(hb)} house.`, keys);
    return add(
      "full",
      `How does ${P(a)} in ${S(sa)} (${H(ha)} house) ${VERB[asp]} ${P(b)} in ${S(sb)} (${H(hb)} house) connect ${REALM(ha)} with ${REALM(hb)}?`,
      [...keys, realmKey(ha), realmKey(hb)],
    );
  });

  return out;
}

// ── the twelve realms, ten questions each ──────────────────────────────────

export const REALM_QUESTIONS: Record<number, string[]> = {
  1: [
    "What in a chart shows how a person comes across on first meeting?",
    "How does the 1st house describe the body and physical constitution?",
    "What does the ruler of the Ascendant say about the direction of a life?",
    "How does a person's instinctive approach to new situations show in the 1st house?",
    "What does an empty 1st house mean, if anything?",
    "How do planets in the 1st house change the way others see a person?",
    "What does the 1st house say about how a person starts things, and how they finish them?",
    "How does the 1st house differ from the Sun as a statement of identity?",
    "What in the 1st house shows how a person defends themselves?",
    "How does the sign on the Ascendant shape a person's early years?",
  ],
  2: [
    "What in a chart shows how a person earns money?",
    "How does the 2nd house describe a person's relationship to possessions?",
    "What does the 2nd house say about self-worth, apart from money?",
    "What does the ruler of the 2nd house show about where income comes from?",
    "How does a chart show whether a person saves or spends?",
    "What do planets in the 2nd house say about talents that can be turned into income?",
    "How does the 2nd house describe what a person will not compromise on?",
    "What in the 2nd house points to financial insecurity, and how is it worked with?",
    "How does the 2nd house relate to the body and the senses?",
    "What does a heavily occupied 2nd house suggest about a person's priorities?",
  ],
  3: [
    "What in a chart shows how a person speaks and writes?",
    "How does the 3rd house describe relationships with brothers and sisters?",
    "What does the 3rd house say about early schooling and how a person learns?",
    "How does the 3rd house describe the neighbourhood and daily errands?",
    "What does the ruler of the 3rd house show about a person's way of thinking?",
    "How do planets in the 3rd house affect curiosity and restlessness?",
    "What does the 3rd house say about short journeys and local travel?",
    "How does the 3rd house describe the way a person listens?",
    "What in the 3rd house shows difficulty in communication?",
    "How does the 3rd house differ from the 9th in matters of learning?",
  ],
  4: [
    "What in a chart describes the home a person grew up in?",
    "How does the 4th house describe a person's relationship with one of their parents?",
    "What does the 4th house say about the kind of home a person makes as an adult?",
    "How does the 4th house describe family inheritance, emotional and material?",
    "What does the ruler of the 4th house show about a person's roots?",
    "How do planets in the 4th house affect a person's sense of security?",
    "What does the 4th house say about the later part of life?",
    "How does the 4th house describe a person's private life, away from public view?",
    "What in the 4th house points to moving house often or settling in one place?",
    "How does the 4th house relate to land, property and real estate?",
  ],
  5: [
    "What in a chart shows how a person plays and enjoys themselves?",
    "How does the 5th house describe romance and courtship, as distinct from marriage?",
    "What does the 5th house say about children and a person's relationship to them?",
    "How does the 5th house describe creative work and self-expression?",
    "What does the ruler of the 5th house show about what gives a person joy?",
    "How do planets in the 5th house affect risk-taking and speculation?",
    "What does the 5th house say about a person's need to be seen and appreciated?",
    "How does the 5th house describe hobbies and pastimes?",
    "What in the 5th house points to difficulty with pleasure or play?",
    "How does the 5th house describe the child within the adult?",
  ],
  6: [
    "What in a chart shows how a person works day to day?",
    "How does the 6th house describe health and the tendency to particular illnesses?",
    "What does the 6th house say about habits and daily routine?",
    "How does the 6th house describe relationships with colleagues and employees?",
    "What does the ruler of the 6th house show about the kind of work that suits a person?",
    "How do planets in the 6th house affect a person's attitude to service?",
    "What does the 6th house say about how a person copes with stress?",
    "How does the 6th house describe a person's relationship with small animals and pets?",
    "What in the 6th house points to overwork or neglect of the body?",
    "How does the 6th house differ from the 10th in matters of work?",
  ],
  7: [
    "What in a chart describes the kind of partner a person is drawn to?",
    "How does the 7th house describe marriage and long-term partnership?",
    "What does the 7th house say about business partnerships and contracts?",
    "How does the 7th house describe open opponents and rivals?",
    "What does the ruler of the 7th house show about how partnerships begin?",
    "How do planets in the 7th house affect what a person projects onto others?",
    "What does the 7th house say about how a person handles conflict with a partner?",
    "How does the sign on the Descendant relate to the sign on the Ascendant in a person's life?",
    "What in the 7th house points to difficulty sustaining partnership?",
    "How does the 7th house describe the way a person works with clients or the public one to one?",
  ],
  8: [
    "What in a chart shows how a person handles shared money and debts?",
    "How does the 8th house describe intimacy and sexuality?",
    "What does the 8th house say about inheritance and a partner's resources?",
    "How does the 8th house describe a person's attitude to death?",
    "What does the ruler of the 8th house show about crises and how a person comes through them?",
    "How do planets in the 8th house affect trust and control in close relationships?",
    "What does the 8th house say about interest in the occult and hidden knowledge?",
    "How does the 8th house describe psychological transformation?",
    "What in the 8th house points to financial entanglement with others?",
    "How does the 8th house differ from the 2nd in matters of money?",
  ],
  9: [
    "What in a chart shows a person's beliefs and philosophy of life?",
    "How does the 9th house describe higher education and advanced study?",
    "What does the 9th house say about long journeys and life abroad?",
    "How does the 9th house describe religion and spiritual practice?",
    "What does the ruler of the 9th house show about where a person looks for meaning?",
    "How do planets in the 9th house affect a person's relationship with law and justice?",
    "What does the 9th house say about publishing and teaching?",
    "How does the 9th house describe a person's relationship with foreigners and other cultures?",
    "What in the 9th house points to dogmatism, or to a loss of faith?",
    "How does the 9th house describe relationships with in-laws?",
  ],
  10: [
    "What in a chart shows a person's vocation?",
    "How does the 10th house describe reputation and public standing?",
    "What does the 10th house say about ambition and how it is pursued?",
    "How does the 10th house describe a person's relationship with authority and employers?",
    "What does the ruler of the Midheaven show about the path of a career?",
    "How do planets in the 10th house affect visibility and fame?",
    "What does the 10th house say about the parent who shaped a person's view of the world?",
    "How does the 10th house describe a person's achievements late in life?",
    "What in the 10th house points to a fall from position, and how is it met?",
    "How does the 10th house differ from the 6th and the 2nd in matters of work and money?",
  ],
  11: [
    "What in a chart shows the kind of friends a person keeps?",
    "How does the 11th house describe groups, clubs and associations?",
    "What does the 11th house say about hopes and long-term aims?",
    "How does the 11th house describe a person's role in a community or movement?",
    "What does the ruler of the 11th house show about who helps a person along?",
    "How do planets in the 11th house affect a person's sense of belonging?",
    "What does the 11th house say about income from career, in traditional astrology?",
    "How does the 11th house describe a person's political or social ideals?",
    "What in the 11th house points to disappointment with friends or groups?",
    "How does the 11th house differ from the 7th in matters of relationship?",
  ],
  12: [
    "What in a chart shows what a person hides, even from themselves?",
    "How does the 12th house describe solitude and retreat?",
    "What does the 12th house say about hospitals, prisons and other institutions?",
    "How does the 12th house describe self-undoing and hidden enemies?",
    "What does the ruler of the 12th house show about a person's spiritual life?",
    "How do planets in the 12th house affect a person's confidence and visibility?",
    "What does the 12th house say about service to others without recognition?",
    "How does the 12th house describe dreams and the unconscious?",
    "What in the 12th house points to addiction or escape, and what helps?",
    "How does the 12th house describe what is carried from family or earlier generations?",
  ],
};

export function realmQuestions(): CuratedQuestion[] {
  const out: CuratedQuestion[] = [];
  for (const r of HOUSE_REALMS) {
    REALM_QUESTIONS[r.house].forEach((prompt, i) => out.push({ ref: `realm-${r.house}:${i + 1}`, pattern: "realm", prompt, factorKeys: [realmKey(r.house)] }));
  }
  return out;
}
