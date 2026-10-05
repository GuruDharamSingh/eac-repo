/**
 * Text → factor keys. A deterministic pass over the vocabulary the engine
 * already formats, run backwards: "Natal Sun in Aries", "Mars square Saturn",
 * "Venus in the 7th house", "Leo rising", "transiting Saturn conjunct your
 * Sun", "Aries and Virgo compatibility".
 *
 * Every tag carries how it was found:
 *   explicit  the text names the factor ("Moon in Scorpio")
 *   inferred  popular usage implies it ("a Capricorn" = Sun in Capricorn)
 *
 * What the tagger cannot place is not guessed at. The studio's Tag queue is
 * where a person fills the gap, and each fix is a training example for a
 * better tagger later.
 */

import { BODIES, SIGNS, type AspectKey, type AspectPoint, type BodyKey, type SignKey } from "@elkdonis/astro";
import {
  aspectKey,
  aspectTypeKey,
  compatKey,
  FACTOR_BY_KEY,
  houseKey,
  isFactorKey,
  planetKey,
  realmKey,
  signKey,
  transitHouseKey,
  transitKey,
  transitSignKey,
  zodiacKey,
} from "./factors";

/**
 * explicit   the text names the factor ("Moon in Scorpio")
 * heading    a heading above the text names it (tagWithHeadings)
 * inferred   popular usage implies it ("a Capricorn" = Sun in Capricorn)
 * mentioned  a bare planet, sign, house or aspect named without a placement
 *            (only with { mentions: true }); weakest
 */
export type TagConfidence = "explicit" | "heading" | "inferred" | "mentioned";
const RANK: Record<TagConfidence, number> = { explicit: 3, heading: 2, inferred: 1, mentioned: 0 };

export interface TagOptions {
  /** Also tag bare mentions as planet:, zodiac:, realm:, aspect-type: keys. */
  mentions?: boolean;
}

/** Glyphs to words, so "☉ □ ♄" reads as "Sun square Saturn". */
const GLYPHS: [RegExp, string][] = [
  [/☉/g, "Sun"], [/☽|☾/g, "Moon"], [/☿/g, "Mercury"], [/♀/g, "Venus"], [/♂/g, "Mars"], [/♃/g, "Jupiter"], [/♄/g, "Saturn"],
  [/♅|⛢/g, "Uranus"], [/♆/g, "Neptune"], [/♇/g, "Pluto"], [/☊/g, "North Node"], [/☋/g, "South Node"], [/⚷/g, "Chiron"],
  [/♈/g, "Aries"], [/♉/g, "Taurus"], [/♊/g, "Gemini"], [/♋/g, "Cancer"], [/♌/g, "Leo"], [/♍/g, "Virgo"], [/♎/g, "Libra"],
  [/♏/g, "Scorpio"], [/♐/g, "Sagittarius"], [/♑/g, "Capricorn"], [/♒/g, "Aquarius"], [/♓/g, "Pisces"],
  [/☌/g, "conjunct"], [/⚹|✶/g, "sextile"], [/□/g, "square"], [/△/g, "trine"], [/☍/g, "opposite"], [/⚻/g, "quincunx"],
  [/⚺/g, "semisextile"], [/∠/g, "semisquare"], [/⚼/g, "sesquisquare"], [/℞/g, "retrograde"],
];
export function normalizeAstro(text: string): string {
  let t = text.replace(/\uFE0E|\uFE0F/g, "");
  for (const [re, w] of GLYPHS) t = t.replace(re, ` ${w} `);
  return t.replace(/[ \t]{2,}/g, " ");
}

export interface FactorTag {
  key: string;
  confidence: TagConfidence;
  /** The words that produced the tag, as found in the text. */
  match: string;
}

// ── vocabulary ─────────────────────────────────────────────────────────────

const POINT_WORDS: [RegExp, AspectPoint][] = [
  ...BODIES.filter((b) => b.key !== "northNode").map((b): [RegExp, AspectPoint] => [new RegExp(`^${b.name}$`, "i"), b.key]),
  [/^(?:true |mean )?north node$|^(?:the )?node$|^rahu$/i, "northNode"],
  [/^ascendant$|^asc$|^ac$|^rising(?: sign)?$/i, "ascendant"],
  [/^midheaven$|^mc$|^medium coeli$/i, "midheaven"],
];
const POINT_ALT =
  "sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|(?:true |mean )?north node|node|rahu|ascendant|asc|ac|midheaven|mc";

function pointOf(word: string): AspectPoint | null {
  const w = word.trim().replace(/\s+/g, " ");
  for (const [re, key] of POINT_WORDS) if (re.test(w)) return key;
  return null;
}
const isBody = (p: AspectPoint): p is BodyKey => p !== "ascendant" && p !== "midheaven";

const SIGN_ALT = SIGNS.map((s) => s.name).join("|");
function signOf(word: string): SignKey | null {
  const w = word.toLowerCase();
  return SIGNS.find((s) => s.key === w)?.key ?? null;
}

const ASPECT_WORDS: [RegExp, AspectKey[]][] = [
  [/^(?:conjunct|conjunction|conjoined|conjoins|conjuncts|in conjunction(?: with)?)$/i, ["conjunction"]],
  [/^(?:sextile|sextiles)$/i, ["sextile"]],
  [/^(?:square|squares|squaring)$/i, ["square"]],
  [/^(?:trine|trines)$/i, ["trine"]],
  [/^(?:opposition|opposite|opposes|opposing|in opposition(?: to)?)$/i, ["opposition"]],
  [/^(?:quincunx|inconjunct)$/i, ["quincunx"]],
  [/^(?:semi-?sextile)$/i, ["semisextile"]],
  [/^(?:semi-?square)$/i, ["semisquare"]],
  [/^(?:sesqui-?square|sesquiquadrate)$/i, ["sesquisquare"]],
  // Book chapters that file two aspects together.
  [/^(?:trine ?\/ ?sextile|sextile ?\/ ?trine)$/i, ["trine", "sextile"]],
  [/^(?:square ?\/ ?opposition|opposition ?\/ ?square)$/i, ["square", "opposition"]],
  [/^(?:semi-?square ?\/ ?semi-?sextile)$/i, ["semisquare", "semisextile"]],
];
const ASPECT_ALT =
  "trine ?\\/ ?sextile|sextile ?\\/ ?trine|square ?\\/ ?opposition|opposition ?\\/ ?square|semi-?square ?\\/ ?semi-?sextile|in conjunction(?: with)?|in opposition(?: to)?|conjunct(?:ion|s)?|conjoin(?:ed|s)|sextiles?|squar(?:es?|ing)|trines?|opposition|opposite|oppos(?:es|ing)|quincunx|inconjunct|semi-?sextile|semi-?square|sesqui-?square|sesquiquadrate";

function aspectsOf(word: string): AspectKey[] {
  const w = word.trim().replace(/\s+/g, " ");
  for (const [re, keys] of ASPECT_WORDS) if (re.test(w)) return keys;
  return [];
}

const ORDINAL_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
  seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12,
};
const HOUSE_NUM = "(?:1[0-2]|[1-9])(?:st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth";
function houseOf(word: string): number | null {
  const w = word.toLowerCase();
  if (ORDINAL_WORDS[w]) return ORDINAL_WORDS[w];
  const n = parseInt(w, 10);
  return n >= 1 && n <= 12 ? n : null;
}

// ── patterns ───────────────────────────────────────────────────────────────

const P = `(${POINT_ALT})`;
const S = `(${SIGN_ALT})`;
const A = `(${ASPECT_ALT})`;
const H = `(${HOUSE_NUM})`;

const RE = {
  // transiting Saturn conjunct (your|natal|the) Sun
  transit: new RegExp(`\\btransit(?:ing|s)?\\s+${P}\\s+(?:is\\s+)?${A}\\s+(?:to\\s+|with\\s+)?(?:your\\s+|natal\\s+|the\\s+|a\\s+)*${P}\\b`, "gi"),
  // Saturn transit(ing) (over|to) (your|natal) Sun, with an aspect word somewhere between
  transitAlt: new RegExp(`\\b${P}\\s+${A}\\s+(?:your\\s+|the\\s+)?natal\\s+${P}\\b`, "gi"),
  // Mars square Saturn / Mars in conjunction with Saturn / Mars in trine to the Moon / Sun trine / sextile Moon
  aspect: new RegExp(`\\b${P}\\s+(?:is\\s+)?(?:in\\s+)?${A}\\s+(?:to\\s+|with\\s+)?(?:(?:the|your|natal|a)\\s+)*${P}\\b(\\s+transit)?`, "gi"),
  // a sextile (forms) between the Sun and Mercury
  aspectBetween: new RegExp(`\\b${A}\\s+(?:aspect\\s+)?(?:forms\\s+|is\\s+formed\\s+)?between\\s+(?:(?:the|your|natal|a)\\s+)*${P}\\s+and\\s+(?:(?:the|your|natal|a)\\s+)*${P}\\b`, "gi"),
  // Pluto transits (through) the Second House / Mercury is transiting your 8th house / Uranus's transit in the 2nd house / transiting Mars in the 12th
  transitHouse: new RegExp(`\\b(?:transit(?:ing)?\\s+)?${P}(?:'s)?\\s+(?:is\\s+)?(?:transit(?:s|ing)?|transit\\s+(?:through|in|of|into)|moves?\\s+(?:through|into)|passes?\\s+through)\\s+(?:through\\s+|in\\s+|into\\s+)?(?:the\\s+|your\\s+|a\\s+|one's\\s+)?(?:natal\\s+)?${H}\\s+house\\b|\\btransit(?:ing|s)?\\s+${P}\\s+(?:through|in|into)\\s+(?:the\\s+|your\\s+)?${H}\\s+house\\b`, "gi"),
  // Uranus's transit through Taurus / Saturn transits Leo / Pluto's transit in Gemini
  transitSign: new RegExp(`\\b${P}(?:'s)?\\s+(?:is\\s+)?(?:transit(?:s|ing)?|transit\\s+(?:through|in|of|into)|ingress\\s+into|moves?\\s+into|enters?)\\s+(?:through\\s+|in\\s+|into\\s+)?${S}\\b`, "gi"),
  // Jupiter's energy when placed in Virgo
  pointPlaced: new RegExp(`\\b${P}(?:'s)?\\s+(?:[a-z]+\\s+){0,3}?(?:is\\s+|when\\s+|is\\s+)?(?:placed|located|positioned|posited)\\s+in\\s+${S}\\b`, "gi"),
  // Mars-Saturn square / Sun/Moon conjunction
  aspectPair: new RegExp(`\\b${P}\\s*[-–/]\\s*${P}\\s+${A}\\b`, "gi"),
  // Moon in Scorpio / Venus in the sign of Libra
  pointSign: new RegExp(`\\b${P}\\s+(?:is\\s+)?in\\s+(?:the\\s+sign\\s+(?:of\\s+)?)?${S}\\b`, "gi"),
  // Scorpio Moon / Leo Ascendant / Leo rising
  signPoint: new RegExp(`\\b${S}\\s+(${POINT_ALT}|rising)\\b`, "gi"),
  // Venus in the 7th house / Venus in the seventh / Venus in house 7
  pointHouse: new RegExp(`\\b${P}\\s+(?:is\\s+)?in\\s+(?:the\\s+)?(?:house\\s+(1[0-2]|[1-9])|${H}(?:\\s+house)?)\\b`, "gi"),
  // 7th house Venus
  housePoint: new RegExp(`\\b${H}[\\s-]+house\\s+${P}\\b`, "gi"),
  // compatibility between Aries and Virgo / Aries and Virgo compatibility / Aries with Virgo
  compat: new RegExp(`\\b${S}\\s+(?:and|&|with|\\+|x)\\s+(?:an?\\s+)?${S}\\b`, "gi"),
  // a Capricorn / an Aries / Capricorns / Aquarius people / as a Leo
  sunSign: new RegExp(`\\b(?:an?|as an?|for an?|the)\\s+${S}\\b|\\b${S}(?:s|es)?\\s+(?:people|natives?|individuals?|women|men|man|woman|sign|children|child|partners?|personalit(?:y|ies)|traits?)\\b|\\b${S}s\\b`, "gi"),
};

const COMPAT_CUE = /compatib|relationship|partner|match|marri|love|romance|couple|together|pairing|synastry/i;
const COMPAT_SENTENCE = /\b(compatib\w*|synastry|couples?|pairings?|match(?:es|ed)?|between)\b/i;

/**
 * Tag a text. Returns each factor once, the strongest confidence winning.
 * Transit tags suppress the natal aspect tag the same words would produce.
 */
export function tagText(input: string, opts: TagOptions = {}): FactorTag[] {
  const text = /[☉-♓⚷-⚼□△∠℞]/u.test(input) ? normalizeAstro(input) : input;
  const found = new Map<string, FactorTag>();
  const add = (key: string, confidence: TagConfidence, match: string) => {
    if (!isFactorKey(key)) return;
    const prev = found.get(key);
    if (!prev || RANK[confidence] > RANK[prev.confidence]) found.set(key, { key, confidence, match });
  };
  const spansTaken: [number, number][] = [];
  const taken = (i: number, len: number) => spansTaken.some(([a, b]) => i < b && i + len > a);

  for (const re of [RE.transit, RE.transitAlt]) {
    for (const m of text.matchAll(re)) {
      const moving = pointOf(m[1]);
      const natal = pointOf(m[3]);
      if (!moving || !natal || !isBody(moving)) continue;
      for (const asp of aspectsOf(m[2])) add(transitKey(moving, natal, asp), "explicit", m[0]);
      spansTaken.push([m.index!, m.index! + m[0].length]);
    }
  }

  const transitWord = /\btransit/i.test(text);
  for (const m of text.matchAll(RE.aspect)) {
    if (taken(m.index!, m[0].length)) continue;
    const a = pointOf(m[1]);
    const b = pointOf(m[3]);
    if (!a || !b) continue;
    // "Neptune opposition Neptune" can only be a transit to the natal planet;
    // "Mars in trine to the natal Moon" in a text about transits is one too.
    const before = text.slice(Math.max(0, m.index! - 24), m.index!);
    const asTransit =
      isBody(a) &&
      (a === b || Boolean(m[4]) || /transit(?:ing|s)?\s+(?:of\s+)?(?:the\s+)?$/i.test(before) || (transitWord && /natal/i.test(m[0])));
    for (const asp of aspectsOf(m[2].replace(/^in\s+/i, ""))) {
      if (asTransit) add(transitKey(a as BodyKey, b, asp), "explicit", m[0]);
      else if (a !== b) add(aspectKey(a, b, asp), "explicit", m[0]);
    }
  }
  for (const m of text.matchAll(RE.aspectBetween)) {
    const a = pointOf(m[2]);
    const b = pointOf(m[3]);
    if (!a || !b || a === b) continue;
    for (const asp of aspectsOf(m[1])) add(aspectKey(a, b, asp), "explicit", m[0]);
  }
  for (const m of text.matchAll(RE.transitHouse)) {
    const p = pointOf(m[1] ?? m[3]);
    const h = houseOf(m[2] ?? m[4]);
    if (p && h && isBody(p)) add(transitHouseKey(p, h), "explicit", m[0]);
    spansTaken.push([m.index!, m.index! + m[0].length]);
  }
  for (const m of text.matchAll(RE.transitSign)) {
    const p = pointOf(m[1]);
    const sg = signOf(m[2]);
    if (p && sg && isBody(p)) add(transitSignKey(p, sg), "explicit", m[0]);
    spansTaken.push([m.index!, m.index! + m[0].length]);
  }
  for (const m of text.matchAll(RE.pointPlaced)) {
    const p = pointOf(m[1]);
    const sg = signOf(m[2]);
    if (p && sg) add(signKey(p, sg), "explicit", m[0]);
  }
  for (const m of text.matchAll(RE.aspectPair)) {
    const a = pointOf(m[1]);
    const b = pointOf(m[2]);
    if (!a || !b || a === b) continue;
    for (const asp of aspectsOf(m[3])) add(aspectKey(a, b, asp), "explicit", m[0]);
  }

  for (const m of text.matchAll(RE.pointSign)) {
    if (taken(m.index!, m[0].length)) continue;
    const p = pointOf(m[1]);
    const s = signOf(m[2]);
    if (p && s) add(signKey(p, s), "explicit", m[0]);
  }
  for (const m of text.matchAll(RE.signPoint)) {
    const s = signOf(m[1]);
    const p = /^rising$/i.test(m[2]) ? "ascendant" : pointOf(m[2]);
    if (p && s) add(signKey(p, s), "explicit", m[0]);
  }

  for (const m of text.matchAll(RE.pointHouse)) {
    if (taken(m.index!, m[0].length)) continue;
    const p = pointOf(m[1]);
    const h = houseOf(m[2] ?? m[3]);
    if (p && h && isBody(p)) add(houseKey(p, h), "explicit", m[0]);
  }
  for (const m of text.matchAll(RE.housePoint)) {
    const h = houseOf(m[1]);
    const p = pointOf(m[2]);
    if (p && h && isBody(p)) add(houseKey(p, h), "explicit", m[0]);
  }

  if (COMPAT_CUE.test(text)) {
    for (const m of text.matchAll(RE.compat)) {
      // "Taurus and Libra are warm" and "her Aries and Leo sisters" are lists,
      // not pairings: the sentence itself must be about compatibility.
      const start = Math.max(text.lastIndexOf(".", m.index!), text.lastIndexOf("?", m.index!), text.lastIndexOf("!", m.index!)) + 1;
      const endRel = text.slice(m.index!).search(/[.?!]/);
      const sentence = text.slice(start, endRel < 0 ? undefined : m.index! + endRel + 1);
      if (!COMPAT_SENTENCE.test(sentence)) continue;
      const a = signOf(m[1]);
      const b = signOf(m[2]);
      if (a && b) add(compatKey(a, b), "explicit", m[0]);
    }
  }

  // A bare sign used as a person ("a Capricorn", "Leos") means the Sun sign,
  // unless the same sign already appeared attached to another point.
  const attached = new Set([...found.values()].filter((t) => t.key.startsWith("sign:")).map((t) => t.key.split(":")[2]));
  for (const m of text.matchAll(RE.sunSign)) {
    const word = m[1] ?? m[2] ?? m[3];
    const s = signOf(word.replace(/(?:es|s)$/i, "")) ?? signOf(word);
    if (!s || attached.has(s)) continue;
    add(signKey("sun", s), "inferred", m[0]);
  }

  if (opts.mentions) addMentions(text, found, add);
  return [...found.values()];
}

/**
 * Bare mentions: a planet, sign, house or aspect named without a placement
 * the patterns above recognised. Points and signs must be capitalised
 * ("cancer" the illness is not Cancer the sign); an aspect word counts only in
 * a sentence that also names a point ("opposition from his parents" does not).
 */
function addMentions(text: string, found: Map<string, FactorTag>, add: (k: string, c: TagConfidence, m: string) => void) {
  const used = { point: new Set<string>(), sign: new Set<string>(), house: new Set<number>(), aspect: new Set<string>() };
  for (const k of found.keys()) {
    const p = FACTOR_BY_KEY.get(k)?.parts;
    if (!p) continue;
    if (p.point) used.point.add(p.point);
    if (p.other) used.point.add(p.other);
    if (p.sign) used.sign.add(p.sign);
    if (p.otherSign) used.sign.add(p.otherSign);
    if (p.house) used.house.add(p.house);
    if (p.aspect) used.aspect.add(p.aspect);
  }
  const POINT_CAP = /\b(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|Chiron|North Node|Ascendant|Midheaven|MC)\b/g;
  for (const m of text.matchAll(POINT_CAP)) {
    const p = pointOf(m[1]);
    if (p && !used.point.has(p)) add(planetKey(p), "mentioned", m[0]);
  }
  for (const m of text.matchAll(new RegExp(`\\b(${SIGN_ALT})\\b`, "g"))) {
    const sg = signOf(m[1]);
    if (sg && !used.sign.has(sg)) add(zodiacKey(sg), "mentioned", m[0]);
  }
  for (const m of text.matchAll(new RegExp(`\\b${H}\\s+house\\b`, "gi"))) {
    const h = houseOf(m[1]);
    if (h && !used.house.has(h)) add(realmKey(h), "mentioned", m[0]);
  }
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    POINT_CAP.lastIndex = 0;
    if (!POINT_CAP.test(sentence)) continue;
    for (const m of sentence.matchAll(new RegExp(`\\b(${ASPECT_ALT})\\b`, "gi"))) {
      for (const a of aspectsOf(m[1])) if (!used.aspect.has(a)) add(aspectTypeKey(a), "mentioned", m[0]);
    }
  }
}

/**
 * Tag a chunk together with the headings above it (outermost first). Factors
 * the headings name are inherited with confidence "heading" unless the chunk
 * names them itself: under "Natal Sun in Aries", a paragraph about "Aries
 * people" is about the Sun in Aries.
 */
export function tagWithHeadings(text: string, headings: string[], opts: TagOptions = {}): FactorTag[] {
  const own = tagText(text, opts);
  const byKey = new Map(own.map((t) => [t.key, t]));
  for (const h of headings) {
    for (const t of tagText(h, { mentions: true })) {
      const prev = byKey.get(t.key);
      const conf: TagConfidence = t.confidence === "mentioned" ? "mentioned" : "heading";
      if (!prev || RANK[conf] > RANK[prev.confidence]) byKey.set(t.key, { key: t.key, confidence: conf, match: `heading: ${h}` });
    }
  }
  // A bare mention adds nothing when a stronger tag already names the same
  // point, sign, house or aspect ("Sun By Sign" above "Natal Sun in Aries").
  const covered = new Set<string>();
  for (const t of byKey.values()) {
    if (t.confidence === "mentioned") continue;
    const p = FACTOR_BY_KEY.get(t.key)?.parts ?? {};
    if (p.point) covered.add(`planet:${p.point}`);
    if (p.other) covered.add(`planet:${p.other}`);
    if (p.sign) covered.add(`zodiac:${p.sign}`);
    if (p.otherSign) covered.add(`zodiac:${p.otherSign}`);
    if (p.house) covered.add(`realm:${p.house}`);
    if (p.aspect) covered.add(`aspect-type:${p.aspect}`);
  }
  return [...byKey.values()].filter((t) => !(t.confidence === "mentioned" && covered.has(t.key)));
}

/** Keys only, explicit first. */
export function tagKeys(text: string, opts: TagOptions = {}): string[] {
  return tagText(text, opts)
    .sort((a, b) => RANK[b.confidence] - RANK[a.confidence])
    .map((t) => t.key);
}
