/**
 * Reading a whole chart: the book's step 11 and its KEY TO THE CHART.
 *
 * "Any aspect, position or configuration may represent any one of a number
 * of possibilities and the only way to get a reasonable line on which one
 * of these will develop is first to ascertain the key to the chart as a
 * whole. The key is usually found in some strong group of planets or in the
 * ruling planet."
 *
 * So the chart is read in this order:
 *
 *   1. find the key — the most occupied houses, the ruling planet (ruler of
 *      the rising sign) and where it sits, the dominant element and
 *      modality, and the balance of harmonious to inharmonious aspects;
 *   2. turn the key into a CONTEXT vector over the domains and read every
 *      aspect with it. This is how "planets in the 8th of a mystical chart
 *      mean occult ability rather than legacies" happens: the 12th-house
 *      emphasis lifts the mystical/occult domains, and select.ts then
 *      prefers "the occult" over "legacies" when it fills the 8th-house slot;
 *   3. read the unaspected planets from their basic keywords;
 *   4. correlate: which qualities recur across aspects (reinforced), which
 *      domains are touched both harmoniously and inharmoniously (the book's
 *      "balance"), and what the strongest aspects say.
 */

import { BODY_BY_KEY, SIGNS, SIGN_BY_KEY } from "../constants";
import { ordinal } from "../format";
import type { ChartResult, Element, Modality, SignKey } from "../types";
import { readAspect, readPlacement, planetWeight, type AspectReading, type AspectSpec, type Placement, type PlacementReading, type ReadOptions, type Unit } from "./compose";
import { addVec, vec, type Domain, type DomainVector } from "./domains";
import { HOUSE_KEYWORDS, PLANET_KEYWORDS, SIGN_KEYWORDS, SIGN_NATURE, isPlanet, type Keyword, type PlanetKey } from "./lexicon";

export interface HouseGroup {
  house: number;
  planets: PlanetKey[];
  weight: number;
}

export interface ChartKey {
  /** Houses holding two or more planets, strongest first. */
  groups: HouseGroup[];
  ruler: { planet: PlanetKey; sign: SignKey; house: number } | null;
  rising: SignKey;
  element: Element;
  modality: Modality;
  harmonious: number;
  inharmonious: number;
  /** The "type" the key suggests, in the book's manner: "the mystical type". */
  type: string;
  /** Everyday-language statement of the key. */
  summary: string;
  /** The context vector every word choice is tilted by. */
  context: DomainVector;
}

export interface ChartReading {
  key: ChartKey;
  /** Major planet-to-planet aspects, strongest first. */
  aspects: AspectReading[];
  /** Planets with no major aspect, read from basic keywords. */
  placements: PlacementReading[];
  /** Step 11: the composite judgment. */
  character: string;
  circumstances: string;
  strengths: string[];
  challenges: string[];
  /** Domains the chart speaks about both well and badly — where the book asks for balance. */
  tensions: Array<{ domain: Domain; well: string; badly: string; strength: number }>;
  /** Every keyword sentence in the reading, for retrieval. */
  units: Array<Unit & { source: string; strength: number }>;
  /** Names the reading was written for. */
  subject?: string;
}

/** The domains a house's TYPE is about — what a strong group there tilts the whole reading toward. */
const HOUSE_TYPE_DOMAINS: Record<number, Domain[]> = {
  1: ["self", "body"],
  2: ["money", "material"],
  3: ["mind", "communication", "writing"],
  4: ["home", "family"],
  5: ["pleasure", "education", "children", "art"],
  6: ["service", "work", "health"],
  7: ["partnership", "marriage", "public"],
  8: ["occult", "healing", "spirit", "change"],
  9: ["philosophy", "religion", "travel"],
  10: ["career", "position", "honor"],
  11: ["friends", "groups", "humanity"],
  12: ["mysticism", "spirit", "secrets"],
};

/** What a house group says about the person's type, after the book's 12th-house example. */
const HOUSE_TYPE: Record<number, string> = {
  1: "personal, self-directed",
  2: "practical, concerned with resources",
  3: "mental, communicative",
  4: "home-centred",
  5: "creative, pleasure- and education-loving",
  6: "service-minded, concerned with work and health",
  7: "partnership- and public-facing",
  8: "occult, regenerative",
  9: "philosophical, religious",
  10: "professional, ambitious for standing",
  11: "social, humanitarian",
  12: "mystical",
};

export function chartKey(chart: ChartResult): ChartKey {
  const rising = chart.summary.rising;
  const rulerKey = SIGN_BY_KEY[rising].rulers[0];
  const rulerBody = chart.bodies.find((b) => b.key === rulerKey);
  const ruler = rulerBody && isPlanet(rulerBody.key) ? { planet: rulerBody.key, sign: rulerBody.sign, house: rulerBody.house } : null;

  const byHouse = new Map<number, HouseGroup>();
  for (const b of chart.bodies) {
    if (!isPlanet(b.key)) continue;
    const g = byHouse.get(b.house) ?? { house: b.house, planets: [], weight: 0 };
    g.planets.push(b.key);
    g.weight += planetWeight(b.key) + (b.key === rulerKey ? 0.3 : 0);
    byHouse.set(b.house, g);
  }
  const groups = [...byHouse.values()].filter((g) => g.planets.length >= 2).sort((x, y) => y.weight - x.weight || x.house - y.house);

  const element = dominant(chart.summary.elements) as Element;
  const modality = dominant(chart.summary.modalities) as Modality;

  let harmonious = 0;
  let inharmonious = 0;
  for (const a of chart.aspects) {
    if (!a.major || !isPlanet(a.a) || !isPlanet(a.b)) continue;
    if (a.type === "sextile" || a.type === "trine") harmonious++;
    else if (a.type === "square" || a.type === "opposition") inharmonious++;
  }

  // The context: occupied houses speak loudest, then the ruler's sign and house, then the element.
  const context: DomainVector = {};
  groups.forEach((g, i) => {
    const w = (1 / (i + 1)) * Math.min(g.weight, 3);
    addVec(context, vec(HOUSE_TYPE_DOMAINS[g.house]), w);
    for (const kw of HOUSE_KEYWORDS[g.house] ?? []) addVec(context, vec(kw.domains), w * 0.15);
  });
  if (ruler) {
    for (const kw of SIGN_KEYWORDS[ruler.sign].filter((k) => k.set === "basic")) addVec(context, vec(kw.domains), 0.4);
    for (const kw of HOUSE_KEYWORDS[ruler.house] ?? []) addVec(context, vec(kw.domains), 0.4);
    for (const kw of PLANET_KEYWORDS[ruler.planet].filter((k) => k.set === "basic")) addVec(context, vec(kw.domains), 0.25);
  }
  const ELEMENT_DOMAINS: Record<Element, Domain[]> = {
    fire: ["spirit", "effort", "ambition"],
    earth: ["material", "money", "work"],
    air: ["mind", "social", "communication"],
    water: ["emotion", "psychic", "spirit"],
  };
  addVec(context, vec(ELEMENT_DOMAINS[element]), 0.3);
  // Normalise so the largest entry is 1: the scorer squashes it anyway, but keep it readable.
  const max = Math.max(1e-9, ...Object.values(context));
  for (const d in context) context[d as Domain]! /= max;

  const type = groups.length ? HOUSE_TYPE[groups[0].house] : ruler ? HOUSE_TYPE[ruler.house] : HOUSE_TYPE[1];

  const parts: string[] = [];
  if (groups.length) {
    const g = groups[0];
    parts.push(
      `The key to this chart is the ${ordinal(g.house)} house, occupied by ${listNames(g.planets)}: the native is of the ${type} type, ` +
        `and will be drawn to ${(HOUSE_KEYWORDS[g.house] ?? []).filter((k) => k.role === "domain").slice(0, 2).map((k) => k.n).join(" and ")} in whatever else the chart shows.`,
    );
    if (groups[1]) parts.push(`The ${ordinal(groups[1].house)} house is also strongly tenanted (${listNames(groups[1].planets)}).`);
  } else {
    parts.push(`No house holds more than one planet, so the key is the ruling planet.`);
  }
  if (ruler) {
    parts.push(
      `${SIGN_BY_KEY[rising].name} rises, so the ruling planet is ${BODY_BY_KEY[ruler.planet].name}, placed in ${SIGN_BY_KEY[ruler.sign].name} in the ${ordinal(ruler.house)} house` +
        ` — ${ruler.house === (groups[0]?.house ?? -1) ? "within the key group itself" : `giving the ${HOUSE_TYPE[ruler.house]} side of life a second emphasis`}.`,
    );
  }
  parts.push(
    `${cap(element)} predominates (${SIGN_NATURE.element[element]}); ${modality} signs lead (${SIGN_NATURE.modality[modality]}).`,
  );
  parts.push(
    harmonious === inharmonious
      ? `Harmonious and inharmonious aspects are evenly balanced, so good judgment and extremes alternate by department of life.`
      : harmonious > inharmonious
        ? `Harmonious aspects outnumber inharmonious ones (${harmonious} to ${inharmonious}): good judgment is the rule, extremes the exception.`
        : `Inharmonious aspects outnumber harmonious ones (${inharmonious} to ${harmonious}): the native is apt to go to extremes, and the lessons of the chart come through that.`,
  );

  return { groups, ruler, rising, element, modality, harmonious, inharmonious, type, summary: parts.join(" "), context };
}

function dominant<K extends string>(counts: Record<K, number>): K {
  return (Object.entries(counts) as [K, number][]).sort((a, b) => b[1] - a[1])[0][0];
}

function listNames(ps: PlanetKey[]): string {
  const names = ps.map((p) => BODY_BY_KEY[p].name);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface ChartReadOptions extends ReadOptions {
  /** Read minor aspects too. Off by default — the book's method is for the five major aspects. */
  minor?: boolean;
}

export function readChart(chart: ChartResult, opts: ChartReadOptions = {}): ChartReading {
  const key = chartKey(chart);
  const context = addVec({ ...key.context }, opts.context ?? {});
  const readOpts: ReadOptions = { context, subject: opts.subject, breadth: opts.breadth };

  const placementOf = (k: PlanetKey): Placement | undefined => {
    const b = chart.bodies.find((x) => x.key === k);
    return b ? { planet: k, sign: b.sign, house: b.house } : undefined;
  };

  // Strongest aspects are read first and get a planet's leading words; the
  // rest are asked to say something else about the same planet.
  const avoid = new Set<string>();
  const avoidPairs = new Set<string>();
  const candidates = chart.aspects
    .filter((a) => isPlanet(a.a) && isPlanet(a.b) && (a.major || opts.minor))
    .map((a) => ({ a, strength: (a.exactness * (planetWeight(a.a as PlanetKey) + planetWeight(a.b as PlanetKey))) / 2 }))
    .sort((x, y) => y.strength - x.strength);
  const aspects: AspectReading[] = [];
  const aspected = new Set<PlanetKey>();
  for (const { a } of candidates) {
    const pa = placementOf(a.a as PlanetKey);
    const pb = placementOf(a.b as PlanetKey);
    if (!pa || !pb) continue;
    const spec: AspectSpec = { a: pa, b: pb, type: a.type, exactness: a.exactness };
    const r = readAspect(spec, { ...readOpts, avoid, avoidPairs });
    aspects.push(r);
    for (const u of r.units) {
      for (const k of u.keywords) if (k.factor === "planet") avoid.add(k.id);
      if (u.keywords.length >= 2) avoidPairs.add(`${u.keywords[0].id}|${u.keywords[1].id}`);
    }
    if (a.major) {
      aspected.add(a.a as PlanetKey);
      aspected.add(a.b as PlanetKey);
    }
  }

  const placements: PlacementReading[] = [];
  for (const b of chart.bodies) {
    if (!isPlanet(b.key) || aspected.has(b.key)) continue;
    placements.push(readPlacement({ planet: b.key, sign: b.sign, house: b.house }, { ...readOpts, avoid, avoidPairs }));
  }

  const units = [
    ...aspects.flatMap((r) => r.units.map((u) => ({ ...u, source: r.label, strength: r.strength }))),
    ...placements.flatMap((r) => r.units.map((u) => ({ ...u, source: `${r.label} (unaspected)`, strength: 0.3 }))),
  ];

  const { character, circumstances, strengths, challenges, tensions } = correlate(aspects, placements, key, opts.subject);
  return { key, aspects, placements, character, circumstances, strengths, challenges, tensions, units, subject: opts.subject };
}

/**
 * Step 11. The book gives no recipe beyond "correlate and balance
 * similarly", so this does what a careful reader does with a page of
 * aspect summaries: counts what recurs, notices where the chart contradicts
 * itself, and leads with the aspects that speak loudest.
 */
function correlate(aspects: AspectReading[], placements: PlacementReading[], key: ChartKey, subject?: string) {
  const they = subject ?? "They";
  const their = subject ? `${subject}’s` : "their";
  const be = subject ? "is" : "are";

  // Character words, weighted by the strength of the aspects that used them.
  type Tally = { kw: Keyword; weight: number; sources: Set<string>; nature: "harmonious" | "inharmonious" | "basic" };
  const traits = new Map<string, Tally>();
  const add = (kw: Keyword, weight: number, source: string, nature: Tally["nature"]) => {
    const key = `${kw.text.toLowerCase()}|${nature}`;
    const t = traits.get(key) ?? { kw, weight: 0, sources: new Set(), nature };
    t.weight += weight;
    t.sources.add(source);
    traits.set(key, t);
  };
  for (const r of aspects) {
    for (const u of r.units) {
      if (u.sphere !== "character") continue;
      for (const kw of u.keywords) {
        if (kw.role !== "quality" || !kw.adj) continue;
        add(kw, r.strength, r.label, kw.set === "basic" ? "basic" : r.nature.nature);
      }
    }
  }
  for (const r of placements) {
    for (const u of r.character) for (const kw of u.keywords) if (kw.role === "quality" && kw.adj) add(kw, 0.3, r.label, "basic");
  }
  const ranked = [...traits.values()].sort((a, b) => b.weight - a.weight);
  const good = ranked.filter((t) => t.nature === "harmonious" || t.nature === "basic").slice(0, 6);
  const bad = ranked.filter((t) => t.nature === "inharmonious").slice(0, 5);
  const reinforced = ranked.filter((t) => t.sources.size >= 2).slice(0, 4);

  const charParts: string[] = [];
  charParts.push(`${cap(they)} ${be}, on the whole, of the ${key.type} type.`);
  if (good.length) charParts.push(`Where good judgment rules ${they === "They" ? "they are" : `${they} is`} ${joinAdj(good.map((t) => t.kw.adj!))}.`);
  if (bad.length) charParts.push(`Where ${they === "They" ? "they go" : `${they} goes`} to extremes ${they === "They" ? "they can be" : `${they} can be`} ${joinAdj(bad.map((t) => t.kw.adj!))}.`);
  if (reinforced.length)
    charParts.push(
      `${joinAdj(reinforced.map((t) => cap(t.kw.n)), true)} ${reinforced.length > 1 ? "recur" : "recurs"} in more than one aspect and ${reinforced.length > 1 ? "are" : "is"} the most consistent of these traits.`,
    );
  if (aspects[0]) charParts.push(`The strongest aspect, ${aspects[0].label}, says: ${stripLead(aspects[0].character)}`);

  // Circumstances: the strongest sentence for each of the chart's leading domains.
  const domainBest = new Map<Domain, { unit: Unit; strength: number; source: string }>();
  for (const r of aspects) {
    for (const u of r.units) {
      if (u.sphere !== "circumstance") continue;
      const top = topDomain(u.domains);
      if (!top) continue;
      const cur = domainBest.get(top);
      if (!cur || cur.strength < r.strength) domainBest.set(top, { unit: u, strength: r.strength, source: r.label });
    }
  }
  const leadDomains = [...domainBest.entries()]
    .sort((a, b) => b[1].strength + (key.context[b[0]] ?? 0) - (a[1].strength + (key.context[a[0]] ?? 0)))
    .slice(0, 6);
  const circParts = leadDomains.map(([, v]) => v.unit.plain);
  if (!circParts.length && placements.length) circParts.push(...placements.flatMap((p) => p.circumstances.slice(0, 1).map((u) => u.plain)));

  const gist = (r: AspectReading) => {
    const s4 = r.units.find((u) => u.step === 4)?.plain ?? "";
    const s7 = r.units.find((u) => u.step === 7)?.plain ?? "";
    return `${s4} ${s7}`.trim();
  };
  const strengths = aspects.filter((r) => r.nature.nature === "harmonious").slice(0, 5).map((r) => `${r.label}: ${gist(r)}`);
  const challenges = aspects.filter((r) => r.nature.nature === "inharmonious").slice(0, 5).map((r) => `${r.label}: ${gist(r)}`);

  // Tensions: a domain spoken of both harmoniously and inharmoniously.
  const wellBy = new Map<Domain, { plain: string; strength: number }>();
  const badlyBy = new Map<Domain, { plain: string; strength: number }>();
  for (const r of aspects) {
    for (const u of r.units) {
      const top = topDomain(u.domains);
      if (!top) continue;
      const m = r.nature.nature === "harmonious" ? wellBy : badlyBy;
      if (!m.has(top)) m.set(top, { plain: u.plain, strength: r.strength });
    }
  }
  const tensions: ChartReading["tensions"] = [];
  for (const [d, well] of wellBy) {
    const badly = badlyBy.get(d);
    if (badly) tensions.push({ domain: d, well: well.plain, badly: badly.plain, strength: well.strength + badly.strength });
  }
  tensions.sort((a, b) => b.strength - a.strength);
  tensions.splice(3);
  if (tensions.length) {
    circParts.push(
      `In matters of ${tensions.map((t) => t.domain).join(", ")} the chart speaks both ways, and ${their} judgment there will be tested more than elsewhere.`,
    );
  }

  return { character: charParts.join(" "), circumstances: circParts.join(" "), strengths, challenges, tensions };
}

function topDomain(v: DomainVector): Domain | undefined {
  let best: Domain | undefined;
  let bw = 0;
  for (const d in v) {
    if (v[d as Domain]! > bw) {
      bw = v[d as Domain]!;
      best = d as Domain;
    }
  }
  return best;
}

function joinAdj(words: string[], capFirst = false): string {
  const w = [...new Set(words)];
  const s = w.length <= 1 ? w.join("") : `${w.slice(0, -1).join(", ")} and ${w[w.length - 1]}`;
  return capFirst ? cap(s) : s;
}

const stripLead = (s: string) => s.replace(/^So far as this aspect goes:\s*/, "");

/** Signs in zodiacal order, for callers that want to tabulate. */
export const SIGN_ORDER = SIGNS.map((s) => s.key);
