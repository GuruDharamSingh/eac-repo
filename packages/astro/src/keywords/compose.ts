/**
 * Reading one aspect: the book's steps 1–10.
 *
 * Every step has a small set of sentence FRAMES — the shapes the book's own
 * example uses — and each frame says which roles of word it accepts:
 *
 *   step 4   planet IN sign      → character: "Justice (Capricorn) blended
 *            with generosity (Sun)", "Conservative (Saturn) in methods of
 *            healing (Scorpio)", "Ambition (Sun) for position (Capricorn)"
 *   step 5   planet WITH planet  → character in the abstract: "Diplomacy and
 *            tact (Saturn) in all dealings with men (Sun)"
 *   step 7   planet IN house     → circumstance: "Few (Saturn) children
 *            (5th)", "Serious (Saturn) in pleasures (5th)", "The main
 *            ambitions of the life (Sun) are in connection with
 *            partnerships (7th)"
 *   steps 8/9 the sevenfold combination — one word from each of the seven
 *            factors chained by the aspect's verb, in each direction
 *   step 10  the same choices spoken again in everyday language, with no
 *            planet, sign or house named
 *
 * The words that fill the frames are chosen by select.ts. A frame is only
 * offered a word that has the form it needs (an adjective frame never sees a
 * word with no adjective), so nothing is ever forced into a shape it cannot
 * take. Two versions of every sentence are kept: `learn`, with the book's
 * parenthetical attributions, and `plain`, for the summary.
 */

import { BODY_BY_KEY, SIGN_BY_KEY } from "../constants";
import { ordinal } from "../format";
import type { AspectKey, SignKey } from "../types";
import { addVec, vec, type DomainVector } from "./domains";
import { HOUSE_KEYWORDS, PLANET_KEYWORDS, SIGN_KEYWORDS, type Keyword, type PlanetKey, type Sphere } from "./lexicon";
import { ASPECT_VERBS, aspectNature, type AspectNature, type AspectVerb } from "./nature";
import { affairsByKey, bestFor, bestPairs, countPairs, freshContext, markUsed, newContext, pool, setsFor, unionContext, type Context, type Pair } from "./select";

export interface Placement {
  planet: PlanetKey;
  sign: SignKey;
  house: number;
}

export interface AspectSpec {
  a: Placement;
  b: Placement;
  type: AspectKey;
  /** 1 at exact, 0 at the edge of orb; weights the aspect in a whole-chart reading. */
  exactness?: number;
}

export interface Unit {
  step: number;
  /** With the book's attributions: "Justice (Capricorn) blended with generosity (Sun)." */
  learn: string;
  /** Everyday language, no astrological terms. */
  plain: string;
  keywords: Keyword[];
  domains: DomainVector;
  sphere: Sphere;
}

export interface Step {
  n: number;
  title: string;
  /** The book's instruction for the step. */
  instruction: string;
  /** A note that is not a keyword sentence: the nature, a keyword list. */
  note?: string;
  units: Unit[];
}

export interface AspectReading {
  spec: AspectSpec;
  /** "Sun in Capricorn in the 7th sextile Saturn in Scorpio in the 5th" */
  label: string;
  nature: AspectNature;
  steps: Step[];
  /** Step 10, first half. */
  character: string;
  /** Step 10, second half. */
  circumstances: string;
  /** Every keyword sentence, for retrieval. */
  units: Unit[];
  /** The book's alternate method: one word per factor in one sentence, several ways. */
  abbreviated: string[];
  /** exactness × planet weight; how loudly this aspect speaks in the chart. */
  strength: number;
}

export interface ReadOptions {
  /** The chart's key (and a question's topics): tilts every word choice. */
  context?: DomainVector;
  /** Name the person instead of "they". */
  subject?: string;
  /** How many sentences a step may have. */
  breadth?: 1 | 2 | 3;
  /**
   * Keyword ids already said elsewhere in the chart. Discouraged here, so a
   * planet that takes part in several aspects is described by different words
   * in each — the stronger aspect gets the planet's leading words.
   */
  avoid?: Set<string>;
  /** Pairings ("a.id|b.id") already made elsewhere in the chart: excluded, so no sentence is said twice. */
  avoidPairs?: Set<string>;
}

// ───────────────────────────── language helpers ─────────────────────────────

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const indef = (s: string) => (/^[aeiou]/i.test(s) ? `an ${s}` : `a ${s}`);
const stripThe = (s: string) => s.replace(/^(the|a|an) /i, "");
const isAre = (w: Keyword) => (w.pl ? "are" : "is");

interface Subject {
  they: string;
  their: string;
  be: string;
  have: string;
  tend: string;
  show: string;
}

function subjectOf(name?: string): Subject {
  if (name) return { they: name, their: `${name}’s`, be: "is", have: "has", tend: "tends", show: "shows" };
  return { they: "they", their: "their", be: "are", have: "have", tend: "tend", show: "show" };
}

/** "the emotions" → "their emotions"; "generosity" → "their generosity". */
const poss = (s: Subject, n: string) => `${s.their} ${stripThe(n)}`;

const nameOf = (p: PlanetKey) => BODY_BY_KEY[p].name;
const signName = (s: SignKey) => SIGN_BY_KEY[s].name;
const houseLabel = (h: number) => ordinal(h);

function placementLabel(p: Placement) {
  return `${nameOf(p.planet)} in ${signName(p.sign)} in the ${houseLabel(p.house)}`;
}

export function aspectLabel(spec: AspectSpec): string {
  const verb = spec.type === "conjunction" ? "conjunct" : spec.type === "opposition" ? "opposite" : spec.type;
  return `${placementLabel(spec.a)} ${verb} ${placementLabel(spec.b)}`;
}

/** The phrase that follows "in": the `in` form when there is one, else the noun. */
const inForm = (w: Keyword) => w.in ?? w.n;

function unit(step: number, learn: string, plain: string, sphere: Sphere, ...keywords: Keyword[]): Unit {
  const domains: DomainVector = {};
  for (const w of keywords) addVec(domains, vec(w.domains));
  return { step, learn, plain, keywords, domains, sphere };
}

/** Sentences with a final full stop and a capital. */
const sentence = (s: string) => cap(s.trim()).replace(/[.]*$/, ".");

// ───────────────────────────── candidate frames ─────────────────────────────

interface Candidate {
  unit: Unit;
  score: number;
}

/** Take the best candidates whose keywords do not overlap, then record them as spoken. */
function choose(cands: Candidate[], n: number, ctx: Context): Unit[] {
  cands.sort((x, y) => y.score - x.score);
  // Better to say less than to force a pairing nothing recommends.
  cands = cands.filter((c) => c.score > 0.5);
  const out: Unit[] = [];
  const taken = new Set<string>();
  const takenText = new Set<string>();
  for (const c of cands) {
    if (out.length >= n) break;
    const ids = c.unit.keywords.map((k) => k.id);
    const texts = c.unit.keywords.map((k) => k.text.toLowerCase());
    if (ids.some((i) => taken.has(i)) || texts.some((t) => takenText.has(t))) continue;
    out.push(c.unit);
    ids.forEach((i) => taken.add(i));
    texts.forEach((t) => takenText.add(t));
    markUsed(ctx, ...c.unit.keywords);
  }
  return out;
}

const CHAR_ROLES = ["quality", "faculty", "force", "state"] as const;

// Step 4 — planet in sign → character
function planetInSign(p: Placement, ctx: Context, S: Subject, sets: ReturnType<typeof setsFor>, n: number): Unit[] {
  const P = PLANET_KEYWORDS[p.planet];
  const Z = SIGN_KEYWORDS[p.sign];
  const Pn = nameOf(p.planet);
  const Zn = signName(p.sign);
  const cands: Candidate[] = [];

  const pQual = pool(P, { sets, roles: [...CHAR_ROLES], sphere: "character" });
  const zQual = pool(Z, { sets, roles: [...CHAR_ROLES], sphere: "character" });
  const zDom = pool(Z, { sets, roles: ["domain"] });
  const pDom = pool(P, { sets, roles: ["domain", "person"], needs: ["in"] });

  // A: sign quality blended with planet quality
  for (const { a, b, score } of bestPairs(zQual, pQual, ctx, 4)) {
    const learn = `${cap(a.n)} (${Zn}) blended with ${b.n} (${Pn}).`;
    const plain =
      a.adj && b.adj ? sentence(`${S.they} ${S.be} ${a.adj} and ${b.adj}`) : sentence(`${S.they} ${S.have} ${stripThe(a.n)} blended with ${stripThe(b.n)}`);
    cands.push({ unit: unit(4, learn, plain, "character", a, b), score });
  }
  // B: planet quality / faculty applied to a sign domain
  for (const { a, b, score } of bestPairs(pQual, zDom, ctx, 4)) {
    let learn: string;
    let plain: string;
    if (a.adj && a.role === "quality") {
      learn = `${cap(a.adj)} (${Pn}) in ${inForm(b)} (${Zn}).`;
      plain = sentence(`${S.they} ${S.be} ${a.adj} in ${inForm(b)}`);
    } else if (a.domains.includes("ambition")) {
      learn = `${cap(a.n)} (${Pn}) ${isAre(a)} for ${b.n} (${Zn}).`;
      plain = sentence(`${poss(S, a.n)} ${isAre(a)} for ${b.n}`);
    } else {
      learn = `${cap(a.n)} (${Pn}) directed to ${inForm(b)} (${Zn}).`;
      plain = sentence(`${poss(S, a.n)} ${isAre(a)} directed to ${inForm(b)}`);
    }
    cands.push({ unit: unit(4, learn, plain, "character", a, b), score: score - 0.05 });
  }
  // C: sign quality shown in a planet domain ("Courtesy (Libra) in all dealings with men (Sun)")
  for (const { a, b, score } of bestPairs(zQual, pDom, ctx, 3, 0.45)) {
    const learn = `${cap(a.n)} (${Zn}) in ${inForm(b)} (${Pn}).`;
    const plain = a.adj ? sentence(`${S.they} ${S.be} ${a.adj} in ${inForm(b)}`) : sentence(`${S.they} ${S.show} ${stripThe(a.n)} in ${inForm(b)}`);
    cands.push({ unit: unit(4, learn, plain, "character", a, b), score: score - 0.1 });
  }
  // D: planet domain expressed through sign domain
  for (const { a, b, score } of bestPairs(pDom, zDom, ctx, 2)) {
    const learn = `${cap(a.n)} (${Pn}) expressed through ${inForm(b)} (${Zn}).`;
    const plain = sentence(`${poss(S, a.n)} find${a.pl ? "" : "s"} expression through ${inForm(b)}`);
    cands.push({ unit: unit(4, learn, plain, "character", a, b), score: score - 0.2 });
  }
  const chosen = choose(cands, n, ctx);
  if (chosen.length) return chosen;
  // Nothing topical: the plainest blend the book allows, so the planet is still read.
  const p0 = bestPairs(zQual, pQual, ctx, 1, 0)[0];
  if (!p0) return [];
  const { a, b } = p0;
  markUsed(ctx, a, b);
  return [unit(4, `${cap(a.n)} (${Zn}) blended with ${b.n} (${Pn}).`, a.adj && b.adj ? sentence(`${S.they} ${S.be} ${a.adj} and ${b.adj}`) : sentence(`${S.they} ${S.have} ${stripThe(a.n)} blended with ${stripThe(b.n)}`), "character", a, b)];
}

// Step 5 — planet with planet, aspect in the abstract → character
function planetWithPlanet(spec: AspectSpec, nat: AspectNature, ctx: Context, S: Subject, setsA: ReturnType<typeof setsFor>, setsB: ReturnType<typeof setsFor>, n: number): Unit[] {
  const A = PLANET_KEYWORDS[spec.a.planet];
  const B = PLANET_KEYWORDS[spec.b.planet];
  const An = nameOf(spec.a.planet);
  const Bn = nameOf(spec.b.planet);
  const harm = nat.nature === "harmonious";
  const cands: Candidate[] = [];

  const qA = pool(A, { sets: setsA, roles: ["quality", "force"], sphere: "character" });
  const qB = pool(B, { sets: setsB, roles: ["quality", "force"], sphere: "character" });
  const fA = pool(A, { sets: setsA, roles: ["faculty"] });
  const fB = pool(B, { sets: setsB, roles: ["faculty"] });
  const perA = pool(A, { sets: setsA, roles: ["person"], needs: ["in"] });
  const perB = pool(B, { sets: setsB, roles: ["person"], needs: ["in"] });

  // A: quality with quality
  for (const { a, b, score } of bestPairs(qA, qB, ctx, 3)) {
    const learn = harm ? `${cap(a.n)} (${An}) working together with ${b.n} (${Bn}).` : `${cap(a.n)} (${An}) at odds with ${b.n} (${Bn}).`;
    const plain = harm
      ? a.adj && b.adj
        ? sentence(`${S.they} ${S.be} ${a.adj} and ${b.adj}, the two working together`)
        : sentence(`${poss(S, a.n)} and ${poss(S, b.n)} work together`)
      : sentence(`${poss(S, a.n)} and ${poss(S, b.n)} pull against each other`);
    cands.push({ unit: unit(5, learn, plain, "character", a, b), score });
  }
  // B: a quality of one planet shown in the persons of the other
  const qp = (q: Keyword[], per: Keyword[], Qn: string, Pn: string) => {
    for (const { a, b, score } of bestPairs(q, per, ctx, 2)) {
      const learn = `${cap(a.n)} (${Qn}) in ${b.in} (${Pn}).`;
      const plain = sentence(`${S.they} ${S.show} ${stripThe(a.n)} in ${b.in}`);
      cands.push({ unit: unit(5, learn, plain, "character", a, b), score: score + 0.05 });
    }
  };
  qp(qA, perB, An, Bn);
  qp(qB, perA, Bn, An);
  // C: a quality of one planet colouring a faculty of the other ("a persistent (Saturn) will (Sun)")
  const qf = (q: Keyword[], f: Keyword[], Qn: string, Fn: string) => {
    for (const { a, b, score } of bestPairs(
      q.filter((w) => w.adj),
      f,
      ctx,
      2,
    )) {
      const learn = harm
        ? b.pl
          ? `${cap(a.adj!)} (${Qn}) ${stripThe(b.n)} (${Fn}).`
          : `${cap(indef(`${a.adj!} (${Qn}) ${stripThe(b.n)}`))} (${Fn}).`
        : `${cap(b.n)} (${Fn}) hampered by ${a.n} (${Qn}).`;
      const plain = harm
        ? sentence(`${poss(S, b.n)} ${isAre(b)} ${a.adj}`)
        : sentence(`${poss(S, b.n)} ${isAre(b)} hampered by ${stripThe(a.n)}`);
      cands.push({ unit: unit(5, learn, plain, "character", a, b), score: score - 0.05 });
    }
  };
  qf(qA, fB, An, Bn);
  qf(qB, fA, Bn, An);
  return choose(cands, n, ctx);
}

// Step 7 — planet in house → circumstance
function planetInHouse(p: Placement, ctx: Context, S: Subject, sets: ReturnType<typeof setsFor>, n: number): Unit[] {
  const P = PLANET_KEYWORDS[p.planet];
  const H = HOUSE_KEYWORDS[p.house] ?? [];
  const Pn = nameOf(p.planet);
  const Hn = houseLabel(p.house);
  const cands: Candidate[] = [];

  const pAll = pool(P, { sets });
  const pAdj = pAll.filter((w) => w.adj && w.role === "quality");
  const pDet = pAll.filter((w) => w.det);
  // Faculties that can be "in connection with" a house's affairs — not the bare
  // self-words (individuality, personality), which say nothing about a house.
  const pFac = pAll.filter((w) => w.role === "faculty" && w.domains.some((d) => d !== "self" && d !== "truth"));
  const pForce = pAll.filter((w) => (w.role === "force" || w.role === "state") && !w.adj);
  const pPer = pAll.filter((w) => w.role === "person");
  const pDom = pAll.filter((w) => w.role === "domain");
  const hPeople = H.filter((w) => w.role === "person" || w.who);
  const hCount = H.filter((w) => (w.role === "person" || w.role === "thing") && w.pl);
  // Affairs a quality can be shown "in". Things (lands, mines, legacies) are
  // not affairs — they are had, not done — so they only take a quality when
  // the match is close ("thrifty in the use of resources"), and a count.
  const hDom = affairsByKey(
    H.filter((w) => w.in && (w.role === "domain" || w.role === "state" || w.role === "event")),
    ctx,
  );
  const hThing = H.filter((w) => w.in && w.role === "thing");
  // The house's leading fields, for the faculty frame — a faculty is "in connection with" an affair, not an event.
  const hLead = hDom.filter((w) => w.role === "domain").slice(0, 2);

  // A: counting — "Few (Saturn) children (5th)". A quantity, not a topic: it
  // stands on its own and does not use up the house word, so "few children"
  // and "disciplined children" can both be said, as the book's example does.
  const counted: Unit[] = [];
  for (const { a, b } of countPairs(pDet, hCount, ctx, 1)) {
    const learn = `${cap(a.det!)} (${Pn}) ${b.n} (${Hn}).`;
    const plain = sentence(`${S.they} will have ${a.det} ${b.n}`);
    counted.push(unit(7, learn, plain, "circumstance", a, b));
    markUsed(ctx, a);
  }
  // B: describing the people of the house — "A generous and virile (Sun) marriage partner (7th)"
  for (const { a, b, score } of bestPairs(pAdj, hPeople, ctx, 2)) {
    const who = b.who ?? stripThe(b.n);
    const plural = b.pl || (!b.who && b.role === "person" && /s$/.test(who));
    const learn = plural ? `${cap(a.adj!)} (${Pn}) ${who} (${Hn}).` : `${cap(indef(`${a.adj!} (${Pn}) ${who}`))} (${Hn}).`;
    const plain = plural ? sentence(`${poss(S, who)} are ${a.adj}`) : sentence(`${poss(S, who)} is ${a.adj}`);
    cands.push({ unit: unit(7, learn, plain, "circumstance", a, b), score: score + 0.1 });
  }
  // C: a planet quality in the house's affairs — "Conservative (Saturn) in educational methods (5th)"
  for (const { a, b, score } of [...bestPairs(pAdj, hDom, ctx, 4), ...bestPairs(pAdj, hThing, ctx, 1, 0.55)]) {
    const learn = `${cap(a.adj!)} (${Pn}) in ${b.in} (${Hn}).`;
    const plain = sentence(`${S.they} ${S.be} ${a.adj} in ${b.in}`);
    cands.push({ unit: unit(7, learn, plain, "circumstance", a, b), score });
  }
  // D: a faculty bound to the house — "The main ambitions of the life (Sun) are
  // in connection with partnerships (7th)". A faculty lands in whatever the
  // house is about, so this frame needs little topical match: the house's
  // leading word is the natural partner.
  for (const { a, b, score, affinity } of bestPairs(pFac, hLead, ctx, 1, 0)) {
    const learn = `${cap(a.n)} (${Pn}) ${isAre(a)} in connection with ${b.in} (${Hn}).`;
    const plain = sentence(`${poss(S, a.n)} ${isAre(a)} bound up with ${b.in}`);
    cands.push({ unit: unit(7, learn, plain, "circumstance", a, b), score: score + 0.5 - 1.2 * affinity - 0.05 * a.rank });
  }
  // E: a force or state in the house
  for (const { a, b, score } of bestPairs(pForce, hDom, ctx, 2)) {
    const learn = `${cap(a.n)} (${Pn}) in ${b.in} (${Hn}).`;
    const plain = sentence(`there is ${stripThe(a.n)} in ${b.in}`);
    cands.push({ unit: unit(7, learn, plain, "circumstance", a, b), score: score - 0.1 });
  }
  // F: the planet's people in the house's affairs
  for (const { a, b, score } of bestPairs(pPer, hDom, ctx, 2)) {
    const learn = `${cap(a.n)} (${Pn}) figure in ${b.in} (${Hn}).`;
    const plain = sentence(`${stripThe(a.n)} figure in ${poss(S, b.in!)}`);
    cands.push({ unit: unit(7, learn, plain, "circumstance", a, b), score: score - 0.25 });
  }
  // G: the planet's field in the house's field
  for (const { a, b, score } of bestPairs(pDom, hDom, ctx, 2)) {
    const learn = `${cap(a.n)} (${Pn}) in connection with ${b.in} (${Hn}).`;
    const plain = sentence(`${poss(S, a.n)} ${isAre(a)} connected with ${b.in}`);
    cands.push({ unit: unit(7, learn, plain, "circumstance", a, b), score: score - 0.15 });
  }
  const chosen = choose(cands, n, ctx);
  if (chosen.length || counted.length) return [...counted, ...chosen];
  // Nothing topical: the planet's leading adjective in the house's leading affair — "Combative (Mars) in the home (4th)" is still the book's method.
  const p0 = bestPairs(pAdj, hDom.length ? hDom : H, ctx, 1, 0)[0];
  if (!p0) return [];
  const { a, b } = p0;
  markUsed(ctx, a, b);
  return [unit(7, `${cap(a.adj!)} (${Pn}) in ${inForm(b)} (${Hn}).`, sentence(`${S.they} ${S.be} ${a.adj} in ${inForm(b)}`), "circumstance", a, b)];
}

// Steps 8/9 — the sevenfold combination
function sevenfold(
  src: Placement,
  dst: Placement,
  nat: AspectNature,
  verbs: AspectVerb[],
  ctx: Context,
  S: Subject,
  setsSrc: ReturnType<typeof setsFor>,
  setsDst: ReturnType<typeof setsFor>,
  step: 8 | 9,
  aspectWord: string,
): Unit | undefined {
  const Ps = PLANET_KEYWORDS[src.planet];
  const Zs = SIGN_KEYWORDS[src.sign];
  const Hs = HOUSE_KEYWORDS[src.house] ?? [];
  const Pd = PLANET_KEYWORDS[dst.planet];
  const Zd = SIGN_KEYWORDS[dst.sign];
  const Hd = HOUSE_KEYWORDS[dst.house] ?? [];
  const harm = nat.nature === "harmonious";

  // 1. the driving quality of the source planet and the source house's affair it drives
  const pq = pool(Ps, { sets: setsSrc, roles: ["quality", "force", "faculty"] });
  // The affairs of a house that can be succeeded in: fields, states, events —
  // not its things (lands, hotels) and not its people. When a house has only
  // those left the sentence is not attempted, and the caller retries afresh.
  const affairs = (H: Keyword[]) => affairsByKey(H.filter((w) => w.in && w.role !== "thing" && w.role !== "person"), ctx).filter((w) => !ctx.used.has(w.id));
  const hs = affairs(Hs);
  const first = bestPairs(pq, hs, ctx, 1, 0.1)[0] ?? bestPairs(pq, hs, ctx, 1, 0)[0];
  if (!first) return undefined;
  const { a: pS, b: hS } = first;
  markUsed(ctx, pS, hS); // each pick is spoken before the next, so a same-house aspect cannot say one house word twice
  // 2. the source sign names the subject matter of that affair — a field if the sign has one, else a quality
  const zPool = pool(Zs, { sets: setsSrc });
  const zS = bestFor(zPool.filter((w) => w.role === "domain"), addVec(vec(hS.domains), vec(pS.domains), 0.5), ctx, 0.25) ?? bestFor(zPool, addVec(vec(hS.domains), vec(pS.domains), 0.5), ctx);
  // 3. the target house affair reached through the aspect
  const bridge = addVec(vec(hS.domains), zS ? vec(zS.domains) : {}, 0.5);
  if (zS) markUsed(ctx, zS);
  const hD = bestFor(affairs(Hd), bridge, ctx, 0.15) ?? bestFor(Hd.filter((w) => w.in), bridge, ctx) ?? Hd.find((w) => !ctx.used.has(w.id));
  if (!hD) return undefined;
  markUsed(ctx, hD);
  // 4. the target planet: the people or field the affair touches; a quality only if it has nothing else.
  //    What an inharmonious aspect obstructs is the planet's BASIC matter ("hinder dealings with men"),
  //    never its negative quality — "detract from suspicion" would be a double negative.
  const dSets = harm ? setsDst : (["basic"] as const);
  const dPool = pool(Pd, { sets: [...dSets] });
  const pD =
    bestFor(dPool.filter((w) => w.role === "person" || w.role === "domain" || w.role === "faculty"), vec(hD.domains), ctx, 0.2) ??
    bestFor(dPool.filter((w) => w.role === "quality" || w.role === "faculty" || w.role === "force"), vec(hD.domains), ctx) ??
    bestFor(dPool, vec(hD.domains), ctx);
  if (pD) markUsed(ctx, pD);
  // 5. the target sign: what is gained or lost there — again a field first, and basic words when the aspect is adverse
  const zdPool = pool(Zd, { sets: [...dSets] });
  const zD = bestFor(zdPool.filter((w) => w.role === "domain"), pD ? vec(pD.domains) : vec(hD.domains), ctx, 0.2) ?? bestFor(zdPool, pD ? vec(pD.domains) : vec(hD.domains), ctx);
  if (!pD || !zD || !zS) return undefined;
  markUsed(ctx, zD);

  const Psn = nameOf(src.planet);
  const Zsn = signName(src.sign);
  const Hsn = houseLabel(src.house);
  const Pdn = nameOf(dst.planet);
  const Zdn = signName(dst.sign);
  const Hdn = houseLabel(dst.house);
  // Rotate verbs so step 9 does not echo step 8.
  const off = step === 8 ? 0 : 3;
  const v1 = verbs[(off + 0) % verbs.length];
  const v2 = verbs[(off + 1) % verbs.length];
  const v3 = verbs[(off + 2) % verbs.length];

  const personal = (w: Keyword) => w.role === "quality" || w.role === "faculty" || w.role === "force";
  const reach = (w: Keyword) => (w.role === "person" ? w.in ?? w.n : personal(w) ? poss(S, w.n) : inForm(w));
  const reachLearn = (w: Keyword) => (w.role === "person" ? w.in ?? w.n : personal(w) ? `the native’s ${stripThe(w.n)}` : inForm(w));
  const gainLearn = reachLearn(zD);
  const gainPlain = reach(zD);
  // "…succeed in publishing (5th) along the lines of the secret forces of nature (Scorpio)" / "…with thoroughness (Taurus)"
  const colourLearn = personal(zS) ? `with ${zS.n} (${Zsn})` : `along the lines of ${inForm(zS)} (${Zsn})`;
  const colourPlain = personal(zS) ? `with ${stripThe(zS.n)}` : `along the lines of ${inForm(zS)}`;

  const learn = harm
    ? `Through ${pS.n} (${Psn}) the native has the capacity to succeed in ${hS.in} (${Hsn}) ${colourLearn}. ` +
      `This would ${v1.base} (${aspectWord}) ${reachLearn(hD)} (${Hdn}), ${v2.base} (${aspectWord}) ${reachLearn(pD)} (${Pdn}) and ${v3.base} (${aspectWord}) ${gainLearn} (${Zdn}).`
    : `Through ${pS.n} (${Psn}) the native tends to go to extremes in ${hS.in} (${Hsn}) ${colourLearn}. ` +
      `This would ${v1.base} (${aspectWord}) ${reachLearn(hD)} (${Hdn}), ${v2.base} (${aspectWord}) ${reachLearn(pD)} (${Pdn}) and ${v3.base} (${aspectWord}) ${gainLearn} (${Zdn}).`;
  const plain = harm
    ? sentence(`through ${poss(S, pS.n)} ${S.they} ${S.have} the capacity to succeed in ${hS.in} ${colourPlain}`) +
      " " +
      sentence(`this would ${v1.base} ${reach(hD)}, ${v2.base} ${reach(pD)} and ${v3.base} ${gainPlain}`)
    : sentence(`through ${poss(S, pS.n)} ${S.they} ${S.tend} to go to extremes in ${hS.in} ${colourPlain}`) +
      " " +
      sentence(`this would ${v1.base} ${reach(hD)}, ${v2.base} ${reach(pD)} and ${v3.base} ${gainPlain}`);
  return unit(step, learn, plain, "circumstance", pS, hS, zS, hD, pD, zD);
}

// ───────────────────────────── the reading ─────────────────────────────

export function readAspect(spec: AspectSpec, opts: ReadOptions = {}): AspectReading {
  const nat = aspectNature(spec.type, spec.a.planet, spec.b.planet);
  const ctx = newContext(nat.nature, opts.context ?? {}, opts.avoid, opts.avoidPairs);
  const S = subjectOf(opts.subject);
  const breadth = opts.breadth ?? 2;
  const verbs = ASPECT_VERBS[nat.nature];

  // Which set each planet draws from. In a mixed conjunction the benefic keeps its positive words.
  const setsA = setsFor(nat.nature, { softened: nat.mixed && nat.softenedBy === spec.a.planet });
  const setsB = setsFor(nat.nature, { softened: nat.mixed && nat.softenedBy === spec.b.planet });
  // Signs follow the aspect outright (the book: positive when the planet in it is in good aspect).
  const setsSign = setsFor(nat.nature);

  const An = nameOf(spec.a.planet);
  const Bn = nameOf(spec.b.planet);
  const list = (words: Keyword[], sets: ReturnType<typeof setsFor>) =>
    sets.map((s) => `${s === "basic" ? "Basic" : s === "pos" ? "Positive" : "Negative"}: ${words.filter((w) => w.set === s).map((w) => w.text).join(", ")}`).join(" · ");

  const steps: Step[] = [];

  steps.push({
    n: 1,
    title: "Nature of the aspect",
    instruction: "Determine the nature of the aspect, harmonious or inharmonious.",
    note:
      `The ${spec.type} is ${nat.nature}${nat.mixed ? ` (a mixed conjunction, softened by ${nameOf(nat.softenedBy!)})` : ""}: ${nat.meaning}.` +
      (nat.note ? ` ${nat.note}` : "") +
      (nat.inSystem ? "" : " This aspect is outside the book’s system; the reading is by analogy."),
    units: [],
  });
  steps.push({
    n: 2,
    title: "Keywords of the planets",
    instruction: "Look up the keywords of the two planets. Basic keywords always; positive with a harmonious aspect, negative with an inharmonious one.",
    note: `${An} — ${list(PLANET_KEYWORDS[spec.a.planet], setsA)}\n${Bn} — ${list(PLANET_KEYWORDS[spec.b.planet], setsB)}`,
    units: [],
  });
  steps.push({
    n: 3,
    title: "Keywords of the signs",
    instruction: "Ascertain the keywords of the two signs containing the planets, positive or negative as the planet is aspected.",
    note: `${signName(spec.a.sign)} — ${list(SIGN_KEYWORDS[spec.a.sign], setsSign)}\n${signName(spec.b.sign)} — ${list(SIGN_KEYWORDS[spec.b.sign], setsSign)}`,
    units: [],
  });

  // Each planet-in-sign is its own reading (two planets in one sign may both be
  // "ambitious"); step 5 then avoids what either said.
  const ctx4a = freshContext(ctx);
  const ctx4b = freshContext(ctx);
  const s4 = [...planetInSign(spec.a, ctx4a, S, mergeSets(setsA, setsSign), breadth), ...planetInSign(spec.b, ctx4b, S, mergeSets(setsB, setsSign), breadth)];
  const ctx5 = unionContext(ctx4a, ctx4b);
  steps.push({ n: 4, title: "Planet in sign — type of character", instruction: "Combine the keywords of each planet with the keywords of the sign it is in.", units: s4 });

  const s5 = planetWithPlanet(spec, nat, ctx5, S, setsA, setsB, breadth);
  steps.push({ n: 5, title: "Planet with planet — the aspect in the abstract", instruction: "Combine the keywords of the two planets by themselves, taking the aspect into account.", units: s5 });

  steps.push({
    n: 6,
    title: "Keywords of the houses",
    instruction: "Ascertain the keywords of the two houses containing the planets.",
    note: `${houseLabel(spec.a.house)} — ${(HOUSE_KEYWORDS[spec.a.house] ?? []).map((w) => w.text).join(", ")}\n${houseLabel(spec.b.house)} — ${(HOUSE_KEYWORDS[spec.b.house] ?? []).map((w) => w.text).join(", ")}`,
    units: [],
  });

  // Circumstance is a new block: a word from the character steps may return here,
  // and each planet-in-house is read on its own (two planets in one house both speak of it).
  const s7 = [...planetInHouse(spec.a, freshContext(ctx), S, setsA, breadth + 1), ...planetInHouse(spec.b, freshContext(ctx), S, setsB, breadth + 1)];
  steps.push({ n: 7, title: "Planet in house — the planetary influence in the house", instruction: "Combine the keywords of each planet with the keywords of its house, leaving the aspect out for the moment.", units: s7 });

  // The sevenfold sentences may reuse words from steps 4–7 (the book's own do), but not each other's.
  const ctx89 = freshContext(ctx);
  const s8 = sevenfold(spec.a, spec.b, nat, verbs, ctx89, S, setsA, setsB, 8, spec.type);
  steps.push({
    n: 8,
    title: `Action of the ${houseLabel(spec.a.house)} house upon the ${houseLabel(spec.b.house)}`,
    instruction: "Consider the action of the affairs of one house upon the affairs of the other, as brought about by the aspect — the sevenfold combination of keywords.",
    units: s8 ? [s8] : [],
  });
  // Two planets in one house can exhaust its words; then step 9 may reuse step 8's rather than go unsaid.
  const s9 =
    sevenfold(spec.b, spec.a, nat, verbs, ctx89, S, setsB, setsA, 9, spec.type) ??
    sevenfold(spec.b, spec.a, nat, verbs, freshContext(ctx), S, setsB, setsA, 9, spec.type);
  steps.push({
    n: 9,
    title: `Reaction of the ${houseLabel(spec.b.house)} house upon the ${houseLabel(spec.a.house)}`,
    instruction: "Consider the reaction of the affairs of the second house upon those of the first, in the same way.",
    units: s9 ? [s9] : [],
  });

  const natureSentence =
    nat.nature === "harmonious"
      ? sentence(`${S.they} use${S.be === "is" ? "s" : ""} good judgment in these matters`)
      : sentence(`${S.they} ${S.tend} to go to extremes in these matters`);
  const character = ["So far as this aspect goes:", natureSentence, ...s4.map((u) => u.plain), ...s5.map((u) => u.plain)].join(" ");
  const circumstances = [...s7.map((u) => u.plain), ...(s8 ? [s8.plain] : []), ...(s9 ? [s9.plain] : [])].join(" ");
  steps.push({
    n: 10,
    title: "Summary in non-technical language",
    instruction: "Correlate and balance all the elements into one composite judgment, in everyday language, without reference to aspects or other astrological elements.",
    note: `Character of the native: ${character}\n\nCircumstantial details of the life: ${circumstances}`,
    units: [],
  });

  const units = steps.flatMap((s) => s.units);
  const abbreviated = abbreviatedMethod(spec, nat, verbs, ctx, setsA, setsB, setsSign);
  const strength = ((spec.exactness ?? 0.5) * (planetWeight(spec.a.planet) + planetWeight(spec.b.planet))) / 2;

  return { spec, label: aspectLabel(spec), nature: nat, steps, character, circumstances, units, abbreviated, strength };
}

function mergeSets(a: ReturnType<typeof setsFor>, b: ReturnType<typeof setsFor>) {
  return Array.from(new Set([...a, ...b])) as ReturnType<typeof setsFor>;
}

/** Sun and Moon carry most; the outer planets, whose keywords are generational, least. */
export function planetWeight(p: PlanetKey): number {
  switch (p) {
    case "sun":
      return 1;
    case "moon":
      return 0.95;
    case "mercury":
    case "venus":
    case "mars":
      return 0.85;
    case "jupiter":
    case "saturn":
      return 0.85;
    default:
      return 0.7;
  }
}

/**
 * The book's ALTERNATE METHOD: one keyword for each of the planets, signs and
 * houses and one for the aspect, in one sentence — "by using different
 * keywords several such sentences may be made, each indicating some possible
 * phase of the life". Three are made; each drops the words the last one used.
 */
function abbreviatedMethod(
  spec: AspectSpec,
  nat: AspectNature,
  verbs: AspectVerb[],
  ctxIn: Context,
  setsA: ReturnType<typeof setsFor>,
  setsB: ReturnType<typeof setsFor>,
  setsSign: ReturnType<typeof setsFor>,
): string[] {
  const ctx = newContext(nat.nature, ctxIn.context);
  const out: string[] = [];
  const Pa = pool(PLANET_KEYWORDS[spec.a.planet], { sets: setsA });
  const Pb = pool(PLANET_KEYWORDS[spec.b.planet], { sets: setsB });
  const Za = pool(SIGN_KEYWORDS[spec.a.sign], { sets: setsSign });
  const Zb = pool(SIGN_KEYWORDS[spec.b.sign], { sets: setsSign });
  const Ha = (HOUSE_KEYWORDS[spec.a.house] ?? []).filter((w) => w.in);
  const Hb = (HOUSE_KEYWORDS[spec.b.house] ?? []).filter((w) => w.in);
  for (let i = 0; i < 3; i++) {
    const ha = bestFor(Ha, ctx.context, ctx);
    if (!ha) break;
    const pa = bestFor(Pa, vec(ha.domains), ctx);
    const za = bestFor(Za, vec(ha.domains), ctx);
    const hb = bestFor(Hb, za ? vec(za.domains) : vec(ha.domains), ctx);
    if (!pa || !za || !hb) break;
    const pb = bestFor(Pb, vec(hb.domains), ctx);
    const zb = bestFor(Zb, vec(hb.domains), ctx);
    if (!pb || !zb) break;
    markUsed(ctx, ha, pa, za, hb, pb, zb);
    const v = verbs[i % verbs.length];
    out.push(
      `${cap(pa.n)} (${nameOf(spec.a.planet)}) through ${inForm(za)} (${signName(spec.a.sign)}) in ${ha.in} (${houseLabel(spec.a.house)}) ` +
        `${v.third} (${spec.type}) ${pb.n} (${nameOf(spec.b.planet)}) through ${inForm(zb)} (${signName(spec.b.sign)}) in ${hb.in} (${houseLabel(spec.b.house)}).`,
    );
  }
  return out;
}

/**
 * A planet with no aspect: steps 4 and 7 only, basic keywords only — with
 * no aspect there is nothing to say whether the positive or the negative
 * set applies, and the book gives no other rule.
 */
export interface PlacementReading {
  placement: Placement;
  label: string;
  character: Unit[];
  circumstances: Unit[];
  units: Unit[];
}

export function readPlacement(p: Placement, opts: ReadOptions = {}): PlacementReading {
  const ctx = newContext("harmonious", opts.context ?? {}, opts.avoid, opts.avoidPairs);
  const S = subjectOf(opts.subject);
  const sets = setsFor("harmonious", { basicOnly: true });
  const character = planetInSign(p, ctx, S, sets, opts.breadth ?? 2);
  const circumstances = planetInHouse(p, ctx, S, sets, (opts.breadth ?? 2) + 1);
  return { placement: p, label: placementLabel(p), character, circumstances, units: [...character, ...circumstances] };
}

export type { Pair };
