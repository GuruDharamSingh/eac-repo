/**
 * The chart explorer's model: every hoverable thing in a chart — points,
 * aspects, patterns, signs and houses — with the explicit factor keys it
 * stands for and the other things it lights up.
 *
 * Pure and serialisable: built on the server from a ChartResult and handed to
 * the client component as a prop. Factor keys use the registry grammar from
 * @elkdonis/astro-corpus (sign:<point>:<sign>, house:<body>:<n>,
 * aspect:<a>:<b>:<aspect> in canonical point order, …) and are filtered to
 * keys the registry knows, so every key can be looked up in the corpus.
 */

import {
  ASPECT_BY_KEY,
  BODY_BY_KEY,
  HOUSES,
  SIGN_BY_KEY,
  formatArc,
  formatPosition,
  ordinal,
  signOf,
  type AspectKey,
  type AspectPoint,
  type BodyKey,
  type ChartResult,
  type SignKey,
} from "@elkdonis/astro";
import {
  HOUSE_REALMS,
  aspectKey,
  aspectTypeKey,
  houseKey,
  isFactorKey,
  planetKey,
  realmKey,
  signKey,
  zodiacKey,
} from "@elkdonis/astro-corpus";
import { DIGNITY_LABEL, chartRuler, dignitiesOf, signFacts, type DignityState } from "./rulebook";

export type ExplorerKind = "point" | "aspect" | "pattern" | "sign" | "house";

export type PatternType =
  | "stellium-sign"
  | "stellium-house"
  | "t-square"
  | "grand-trine"
  | "grand-cross"
  | "yod"
  | "kite"
  | "mutual-reception";

/** A labelled fact shown in the panel. */
export interface Fact {
  label: string;
  value: string;
  tone?: "good" | "bad" | "gold";
}

export interface FactorRef {
  key: string;
  label: string;
}

export interface ExplorerElement {
  id: string;
  kind: ExplorerKind;
  label: string;
  /** One line under the label: position, orb, members… */
  detail: string;
  glyph?: string;
  /** Explicit factor keys this element stands for, most specific first. */
  factors: FactorRef[];
  /** Ids lit up together with this one. */
  related: string[];
  facts: Fact[];
  /** Pattern only: the phrase searched for in the corpus. */
  patternPhrase?: string;
  patternType?: PatternType;
  /** Points: the point key; aspects: both ends; patterns: the members. */
  points: AspectPoint[];
  /** Aspects only. */
  aspect?: { type: AspectKey; major: boolean };
}

export interface ExplorerModel {
  elements: Record<string, ExplorerElement>;
  /** Ordered ids per kind, for lists and keyboard order. */
  order: { points: string[]; aspects: string[]; patterns: string[]; signs: string[]; houses: string[] };
  chartRuler: BodyKey;
}

const PLANETS: readonly BodyKey[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
const ASPECT_VERB: Record<AspectKey, string> = {
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

export const pointId = (p: AspectPoint) => `point:${p}`;
export const signId = (s: SignKey) => `sign:${s}`;
export const houseId = (n: number) => `house:${n}`;

export function pointLabel(p: AspectPoint): string {
  if (p === "ascendant") return "Ascendant";
  if (p === "midheaven") return "Midheaven";
  return BODY_BY_KEY[p].name;
}
export function pointGlyph(p: AspectPoint): string {
  if (p === "ascendant") return "AC";
  if (p === "midheaven") return "MC";
  return BODY_BY_KEY[p].glyph;
}

const PATTERN_INFO: Record<PatternType, { name: string; phrase: string }> = {
  "stellium-sign": { name: "Stellium", phrase: "stellium" },
  "stellium-house": { name: "Stellium", phrase: "stellium" },
  "t-square": { name: "T-square", phrase: "T-square" },
  "grand-trine": { name: "Grand trine", phrase: "grand trine" },
  "grand-cross": { name: "Grand cross", phrase: "grand cross" },
  yod: { name: "Yod", phrase: "yod" },
  kite: { name: "Kite", phrase: "kite" },
  "mutual-reception": { name: "Mutual reception", phrase: "mutual reception" },
};
/** The references key for a pattern: `pattern:<slug>`, matching REF_PATTERN_PHRASES in @elkdonis/astro-corpus. */
export const patternRefKey = (phrase: string) => `pattern:${phrase.toLowerCase().replace(/\s+/g, "-")}`;

function ref(key: string, label: string): FactorRef | null {
  return isFactorKey(key) ? { key, label } : null;
}
const nonNull = <T,>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null);

export function buildExplorerModel(chart: ChartResult): ExplorerModel {
  const els: Record<string, ExplorerElement> = {};
  const housesKnown = !chart.approximate;
  const ascSign = chart.summary.rising;
  const mcSign = signOf(chart.angles.midheaven).sign;
  const ruler = chartRuler(ascSign);

  // Where everything is.
  const where = new Map<AspectPoint, { sign: SignKey; house: number | null; lon: number; retro: boolean }>();
  for (const b of chart.bodies) where.set(b.key, { sign: b.sign, house: housesKnown ? b.house : null, lon: b.longitude, retro: b.retrograde });
  if (housesKnown) {
    where.set("ascendant", { sign: ascSign, house: 1, lon: chart.angles.ascendant, retro: false });
    where.set("midheaven", { sign: mcSign, house: 10, lon: chart.angles.midheaven, retro: false });
  }
  const points = [...where.keys()];

  // ── aspects ──
  const aspectIds: string[] = [];
  const aspectsOf = new Map<AspectPoint, string[]>();
  for (const a of chart.aspects) {
    if (!where.has(a.a) || !where.has(a.b)) continue;
    const key = aspectKey(a.a, a.b, a.type);
    const id = key; // the factor key doubles as the element id
    const info = ASPECT_BY_KEY[a.type];
    els[id] = {
      id,
      kind: "aspect",
      label: `${pointLabel(a.a)} ${ASPECT_VERB[a.type]} ${pointLabel(a.b)}`,
      detail: `${info.name} · orb ${formatArc(a.orb)} · ${a.applying ? "applying" : "separating"}${a.major ? "" : " · minor"}`,
      glyph: info.glyph,
      factors: nonNull([
        ref(key, `${pointLabel(a.a)} ${ASPECT_VERB[a.type]} ${pointLabel(a.b)}`),
        ref(aspectTypeKey(a.type), `${info.name} (any)`),
      ]),
      related: [pointId(a.a), pointId(a.b)],
      facts: [
        { label: "Aspect", value: `${info.name} (${info.angle}°), ${info.nature}` },
        { label: "Separation", value: `${formatArc(a.separation)} · orb ${formatArc(a.orb)}` },
        { label: "Phase", value: a.applying ? "Applying" : "Separating" },
      ],
      points: [a.a, a.b],
      aspect: { type: a.type, major: a.major },
    };
    aspectIds.push(id);
    for (const p of [a.a, a.b]) aspectsOf.set(p, [...(aspectsOf.get(p) ?? []), id]);
  }

  // ── points ──
  const pointIds: string[] = [];
  for (const p of points) {
    const w = where.get(p)!;
    const sf = signFacts(w.sign);
    const sname = SIGN_BY_KEY[w.sign].name;
    const isPlanet = PLANETS.includes(p as BodyKey);
    const dign = isPlanet ? dignitiesOf(p, w.sign) : [];
    const dispositor = sf.rulers[0];
    const dispIn = where.get(dispositor);
    const facts: Fact[] = [
      { label: "Sign", value: `${sname} — ${sf.element}, ${sf.modality}, ${sf.polarity}` },
      ...(w.house ? [{ label: "House", value: `${ordinal(w.house)} — ${HOUSE_REALMS[w.house - 1].short}` }] : []),
      ...(dign.length
        ? dign.map((d: DignityState) => ({ label: "Dignity", value: DIGNITY_LABEL[d], tone: (d === "domicile" || d === "exaltation" ? "good" : "bad") as Fact["tone"] }))
        : !isPlanet
          ? []
          : [{ label: "Dignity", value: "Peregrine (no essential dignity in the table)" }]),
      {
        label: p === "ascendant" ? "Chart ruler" : "Dispositor",
        value:
          dispositor === p
            ? `${pointLabel(dispositor)} (rules itself here)`
            : `${pointLabel(dispositor)}${dispIn ? ` in ${SIGN_BY_KEY[dispIn.sign].name}${dispIn.house ? `, ${ordinal(dispIn.house)} house` : ""}` : ""}${sf.rulers[1] ? ` · modern co-ruler ${pointLabel(sf.rulers[1])}` : ""}`,
      },
      ...(p === ruler ? [{ label: "Role", value: `Chart ruler (rules the ${SIGN_BY_KEY[ascSign].name} Ascendant)`, tone: "gold" as const }] : []),
      ...(w.retro ? [{ label: "Motion", value: "Retrograde", tone: "bad" as const }] : []),
    ];
    const label = pointLabel(p);
    els[pointId(p)] = {
      id: pointId(p),
      kind: "point",
      label,
      detail: `${formatPosition(w.lon)}${w.house ? ` · ${ordinal(w.house)} house` : ""}${w.retro ? " · retrograde" : ""}`,
      glyph: pointGlyph(p),
      factors: nonNull([
        ref(signKey(p, w.sign), `${label} in ${sname}`),
        w.house && p !== "ascendant" && p !== "midheaven" ? ref(houseKey(p as BodyKey, w.house), `${label} in the ${ordinal(w.house)} house`) : null,
        ...(aspectsOf.get(p) ?? []).map((id) => ref(id, els[id].label)),
        ref(planetKey(p), `${label} (any placement)`),
        ref(zodiacKey(w.sign), `${sname} (the sign)`),
        w.house ? ref(realmKey(w.house), `${ordinal(w.house)} house (the realm)`) : null,
      ]),
      related: [...(aspectsOf.get(p) ?? []), signId(w.sign), ...(w.house ? [houseId(w.house)] : [])],
      facts,
      points: [p],
    };
    pointIds.push(pointId(p));
  }

  // ── signs and houses ──
  const signIds: string[] = [];
  for (const s of Object.keys(SIGN_BY_KEY) as SignKey[]) {
    const occupants = points.filter((p) => where.get(p)!.sign === s);
    const sf = signFacts(s);
    els[signId(s)] = {
      id: signId(s),
      kind: "sign",
      label: SIGN_BY_KEY[s].name,
      detail: `${sf.element} · ${sf.modality} · ruled by ${sf.rulers.map(pointLabel).join(" / ")}`,
      glyph: SIGN_BY_KEY[s].glyph,
      factors: nonNull([ref(zodiacKey(s), `${SIGN_BY_KEY[s].name} (the sign)`), ...occupants.map((p) => ref(signKey(p, s), `${pointLabel(p)} in ${SIGN_BY_KEY[s].name}`))]),
      related: occupants.map(pointId),
      facts: [
        { label: "Element", value: `${sf.element} (${sf.polarity})` },
        { label: "Modality", value: sf.modality },
        { label: "Ruler", value: sf.rulers.map(pointLabel).join(", modern ") },
        { label: "Occupants", value: occupants.length ? occupants.map(pointLabel).join(", ") : "none" },
      ],
      points: occupants,
    };
    signIds.push(signId(s));
  }
  const houseIds: string[] = [];
  if (housesKnown) {
    for (const h of chart.houses) {
      const occupants = chart.bodies.filter((b) => b.house === h.house).map((b) => b.key);
      const cuspRuler = SIGN_BY_KEY[h.sign].rulers[0];
      const rIn = where.get(cuspRuler);
      els[houseId(h.house)] = {
        id: houseId(h.house),
        kind: "house",
        label: `${ordinal(h.house)} house`,
        detail: `${HOUSES[h.house - 1].type} · cusp ${formatPosition(h.longitude)}`,
        factors: nonNull([
          ref(realmKey(h.house), `${ordinal(h.house)} house (the realm)`),
          ...occupants.map((p) => ref(houseKey(p, h.house), `${pointLabel(p)} in the ${ordinal(h.house)} house`)),
        ]),
        related: [...occupants.map(pointId), signId(h.sign)],
        facts: [
          { label: "Realm", value: HOUSE_REALMS[h.house - 1].name },
          { label: "Cusp", value: formatPosition(h.longitude) },
          { label: "Cusp ruler", value: `${pointLabel(cuspRuler)}${rIn ? ` in ${SIGN_BY_KEY[rIn.sign].name}${rIn.house ? `, ${ordinal(rIn.house)} house` : ""}` : ""}` },
          { label: "Occupants", value: occupants.length ? occupants.map(pointLabel).join(", ") : "none" },
        ],
        points: occupants,
      };
      houseIds.push(houseId(h.house));
    }
  }

  // ── patterns ──
  const patternIds: string[] = [];
  const has = (a: AspectPoint, b: AspectPoint, t: AspectKey) =>
    chart.aspects.some((x) => x.type === t && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
  const addPattern = (type: PatternType, members: AspectPoint[], detail: string, extraFactors: FactorRef[] = [], extraRelated: string[] = []) => {
    const sorted = [...members].sort((a, b) => PLANETS.indexOf(a as BodyKey) - PLANETS.indexOf(b as BodyKey));
    const id = `pattern:${type}:${sorted.join("-")}`;
    if (els[id]) return;
    const memberAspects = aspectIds.filter((aid) => {
      const e = els[aid];
      return sorted.includes(e.points[0]) && sorted.includes(e.points[1]);
    });
    const info = PATTERN_INFO[type];
    els[id] = {
      id,
      kind: "pattern",
      label: info.name,
      detail,
      factors: [...extraFactors, ...memberAspects.map((aid) => ({ key: aid, label: els[aid].label }))],
      related: [...sorted.map(pointId), ...memberAspects, ...extraRelated],
      facts: [
        { label: "Members", value: sorted.map(pointLabel).join(", ") },
        ...(memberAspects.length ? [{ label: "Built from", value: memberAspects.map((a) => els[a].label).join("; ") }] : []),
      ],
      patternPhrase: info.phrase,
      patternType: type,
      points: sorted,
    };
    patternIds.push(id);
  };

  const planetsHere = PLANETS.filter((p) => where.has(p));
  // Stellium: three or more of the ten planets in one sign, or one house.
  for (const s of Object.keys(SIGN_BY_KEY) as SignKey[]) {
    const m = planetsHere.filter((p) => where.get(p)!.sign === s);
    if (m.length >= 3) addPattern("stellium-sign", m, `${m.length} planets in ${SIGN_BY_KEY[s].name}`, nonNull([ref(zodiacKey(s), `${SIGN_BY_KEY[s].name} (the sign)`)]), [signId(s)]);
  }
  if (housesKnown) {
    for (let h = 1; h <= 12; h++) {
      const m = planetsHere.filter((p) => where.get(p)!.house === h);
      if (m.length >= 3) addPattern("stellium-house", m, `${m.length} planets in the ${ordinal(h)} house`, nonNull([ref(realmKey(h), `${ordinal(h)} house (the realm)`)]), [houseId(h)]);
    }
  }
  // Aspect figures, among the ten planets, from the engine's own aspect list.
  const P = planetsHere;
  for (let i = 0; i < P.length; i++)
    for (let j = i + 1; j < P.length; j++) {
      const [a, b] = [P[i], P[j]];
      if (has(a, b, "opposition")) {
        for (const c of P) if (c !== a && c !== b && has(a, c, "square") && has(b, c, "square")) {
          addPattern("t-square", [a, b, c], `${pointLabel(a)} opposite ${pointLabel(b)}, both square ${pointLabel(c)} (apex)`);
        }
        for (let k = 0; k < P.length; k++)
          for (let l = k + 1; l < P.length; l++) {
            const [c, d] = [P[k], P[l]];
            if ([c, d].some((x) => x === a || x === b)) continue;
            if (has(c, d, "opposition") && has(a, c, "square") && has(a, d, "square") && has(b, c, "square") && has(b, d, "square"))
              addPattern("grand-cross", [a, b, c, d], `${pointLabel(a)}–${pointLabel(b)} and ${pointLabel(c)}–${pointLabel(d)} oppositions, all squared`);
          }
      }
      if (has(a, b, "sextile")) {
        for (const c of P) if (c !== a && c !== b && has(a, c, "quincunx") && has(b, c, "quincunx"))
          addPattern("yod", [a, b, c], `${pointLabel(a)} sextile ${pointLabel(b)}, both quincunx ${pointLabel(c)} (apex)`);
      }
      for (let k = j + 1; k < P.length; k++) {
        const c = P[k];
        if (has(a, b, "trine") && has(b, c, "trine") && has(a, c, "trine")) {
          addPattern("grand-trine", [a, b, c], `${pointLabel(a)}, ${pointLabel(b)}, ${pointLabel(c)} in mutual trine`);
          for (const d of P) {
            if ([a, b, c].includes(d)) continue;
            for (const [x, y, z] of [[a, b, c], [b, a, c], [c, a, b]] as const)
              if (has(d, x, "opposition") && has(d, y, "sextile") && has(d, z, "sextile"))
                addPattern("kite", [a, b, c, d], `Grand trine with ${pointLabel(d)} opposite ${pointLabel(x)}`);
          }
        }
      }
    }
  // Mutual reception: each planet in a sign the other rules (domicile, either ruler).
  for (let i = 0; i < P.length; i++)
    for (let j = i + 1; j < P.length; j++) {
      const [a, b] = [P[i], P[j]];
      const sa = where.get(a)!.sign, sb = where.get(b)!.sign;
      if (SIGN_BY_KEY[sa].rulers.includes(b) && SIGN_BY_KEY[sb].rulers.includes(a))
        addPattern("mutual-reception", [a, b], `${pointLabel(a)} in ${SIGN_BY_KEY[sa].name}, ${pointLabel(b)} in ${SIGN_BY_KEY[sb].name}`, nonNull([ref(signKey(a, sa), `${pointLabel(a)} in ${SIGN_BY_KEY[sa].name}`), ref(signKey(b, sb), `${pointLabel(b)} in ${SIGN_BY_KEY[sb].name}`)]));
    }

  // Points and aspects also light up the patterns they are part of.
  for (const pid of patternIds) {
    for (const r of els[pid].related) els[r]?.related.push(pid);
  }

  return {
    elements: els,
    order: { points: pointIds, aspects: aspectIds, patterns: patternIds, signs: signIds, houses: houseIds },
    chartRuler: ruler,
  };
}
