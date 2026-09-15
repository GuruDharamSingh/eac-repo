/**
 * A second source beside the keyword method: delineation texts by other
 * authors, such as astrologychart2/examples/SUN.txt — a compilation of
 * "Natal Sun in Aries", "Natal Sun in 7th House", "Natal Sun trine Moon"
 * passages by some thirty modern writers.
 *
 * These are NOT the Rosicrucian method and are kept out of the lexicon. What
 * they are good for is the question-answerer: once the keyword reading has
 * found which placements and aspects a question touches, a passage written
 * about exactly that placement can be shown beside it, attributed. The
 * passages are indexed the same way the keyword sentences are — a domain
 * vector, here counted from the passage's own words — so the same retrieval
 * ranks both.
 *
 * The files are the user's own and are read from wherever they keep them;
 * nothing here ships a corpus.
 *
 * Format understood (one file per planet):
 *
 *   SUN BY SIGN                        section (ignored)
 *   Natal Sun in Aries                 entry: planet + sign
 *   Natal Sun in 7th House             entry: planet + house
 *   Natal Sun conjunct Moon            entry: planet + aspect + planet
 *   Natal Sun trine / sextile Moon     entry covering two aspect types
 *   (Betty Lundsted)                   author of the following text
 *   Sun trine Moon (Robert Pelletier)  author, narrowing a combined entry
 *   …text…
 */

import { BODIES, SIGNS } from "../constants";
import type { AspectKey, ChartResult } from "../types";
import { addVec, bias, vec, QUESTION_TERMS, type DomainVector } from "./domains";

export type PassageKind = "sign" | "house" | "aspect";

export interface Passage {
  id: string;
  planet: string;
  kind: PassageKind;
  /** Sign name, house number as string, or "<aspect> <Planet>". */
  key: string;
  /** For aspect entries that cover two types ("trine / sextile"), both. */
  aspects?: AspectKey[];
  other?: string;
  author: string;
  text: string;
  domains: DomainVector;
  /** Words in the passage; long passages are not favoured just for being long. */
  length: number;
}

const ASPECT_WORDS: Record<string, AspectKey> = {
  conjunct: "conjunction",
  conjunction: "conjunction",
  sextile: "sextile",
  square: "square",
  trine: "trine",
  opposition: "opposition",
  opposite: "opposition",
  quincunx: "quincunx",
  semisquare: "semisquare",
  semisextile: "semisextile",
  sesquisquare: "sesquisquare",
  sesquiquadrate: "sesquisquare",
};

const PLANET_NAMES = BODIES.map((b) => b.name);
const SIGN_NAMES = SIGNS.map((s) => s.name);
const planetRe = PLANET_NAMES.join("|");
const aspectRe = Object.keys(ASPECT_WORDS).join("|");

const ENTRY = new RegExp(`^Natal (${planetRe}) (?:in (${SIGN_NAMES.join("|")})|in (\\d{1,2})(?:st|nd|rd|th) [Hh]ouse|((?:${aspectRe})(?: */ *(?:${aspectRe}))*) (${planetRe}))\\s*$`, "i");
const AUTHOR_LINE = /^\(([A-Za-z .,'&-]{3,60})\)\s*$/;
const AUTHOR_ASPECT = new RegExp(`^(${planetRe}) (${aspectRe}) (${planetRe}) *\\(([A-Za-z .,'&-]{3,60})\\):?\\s*$`, "i");
const SECTION = /^[A-Z][A-Z ]+$/;

/** Domain vector of free text: each matched question term counts, with diminishing returns. */
export function textVector(text: string): DomainVector {
  const v: DomainVector = {};
  for (const [re, ds] of QUESTION_TERMS) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    const n = (text.match(g) ?? []).length;
    if (!n) continue;
    const w = Math.log1p(n);
    ds.forEach((d, i) => addVec(v, vec([d]), i === 0 ? w : w * 0.5));
  }
  const max = Math.max(1e-9, ...Object.values(v));
  for (const d in v) v[d as keyof DomainVector]! /= max;
  return v;
}

export function parseDelineations(raw: string, opts: { file?: string } = {}): Passage[] {
  const out: Passage[] = [];
  let planet = "";
  let kind: PassageKind | null = null;
  let key = "";
  let aspects: AspectKey[] | undefined;
  let other: string | undefined;
  let author = "";
  let buf: string[] = [];
  let n = 0;

  const flush = () => {
    const text = buf.join("\n").trim();
    buf = [];
    if (!kind || !text || text.length < 40) return;
    out.push({
      id: `${opts.file ?? "corpus"}:${n++}`,
      planet,
      kind,
      key,
      aspects,
      other,
      author: author || "unattributed",
      text,
      domains: textVector(text),
      length: text.split(/\s+/).length,
    });
  };

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    const entry = line.match(ENTRY);
    if (entry) {
      flush();
      planet = cap(entry[1]);
      author = "";
      if (entry[2]) {
        kind = "sign";
        key = cap(entry[2]);
        aspects = undefined;
        other = undefined;
      } else if (entry[3]) {
        kind = "house";
        key = String(Number(entry[3]));
        aspects = undefined;
        other = undefined;
      } else {
        kind = "aspect";
        aspects = entry[4]
          .toLowerCase()
          .split(/\s*\/\s*/)
          .map((w) => ASPECT_WORDS[w])
          .filter(Boolean);
        other = cap(entry[5]);
        key = `${aspects.join("/")} ${other}`;
      }
      continue;
    }
    const aa = line.match(AUTHOR_ASPECT);
    if (aa && kind === "aspect") {
      flush();
      aspects = [ASPECT_WORDS[aa[2].toLowerCase()]];
      other = cap(aa[3]);
      key = `${aspects[0]} ${other}`;
      author = aa[4].trim();
      continue;
    }
    const au = line.match(AUTHOR_LINE);
    if (au) {
      flush();
      author = au[1].trim();
      continue;
    }
    if (SECTION.test(line) && line.length < 40) continue;
    if (kind) buf.push(rawLine);
  }
  flush();
  return out;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export interface CorpusHit {
  passage: Passage;
  score: number;
  /** Why it applies: "Sun in Taurus", "Sun in the 9th", "Sun trine Saturn". */
  because: string;
}

/**
 * The passages that apply to this chart, ranked for a question. A passage
 * applies when its placement is in the chart: the planet in that sign or
 * house, or that aspect between those two planets (either order).
 */
export function passagesFor(corpus: readonly Passage[], chart: ChartResult, question = "", limit = 5): CorpusHit[] {
  const q = textVector(question);
  const asked = Object.keys(q).length > 0;
  const bodyName = (k: string) => BODIES.find((b) => b.key === k)?.name;
  const signName = (k: string) => SIGNS.find((s) => s.key === k)?.name;

  const hits: CorpusHit[] = [];
  for (const p of corpus) {
    let because = "";
    if (p.kind === "sign") {
      const b = chart.bodies.find((x) => bodyName(x.key) === p.planet);
      if (!b || signName(b.sign) !== p.key) continue;
      because = `${p.planet} in ${p.key}`;
    } else if (p.kind === "house") {
      const b = chart.bodies.find((x) => bodyName(x.key) === p.planet);
      if (!b || String(b.house) !== p.key) continue;
      because = `${p.planet} in the ${p.key}${suffix(Number(p.key))}`;
    } else {
      const a = chart.aspects.find(
        (x) =>
          p.aspects?.includes(x.type) &&
          ((bodyName(x.a) === p.planet && bodyName(x.b) === p.other) || (bodyName(x.b) === p.planet && bodyName(x.a) === p.other)),
      );
      if (!a) continue;
      because = `${p.planet} ${a.type} ${p.other}`;
    }
    const topical = asked ? bias(p.domains, q) / (1 + Object.keys(p.domains).length * 0.1) : 0.5;
    const brevity = 1 / (1 + p.length / 400);
    hits.push({ passage: p, score: topical + 0.2 * brevity, because });
  }
  hits.sort((x, y) => y.score - x.score);
  // One passage per author per placement, so a question does not get five Pelletiers.
  const seen = new Set<string>();
  return hits
    .filter((h) => {
      const k = `${h.because}|${h.passage.author}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit);
}

function suffix(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
