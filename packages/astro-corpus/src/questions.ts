/**
 * Question types and the viability check for questions taken from imported
 * datasets. Imported answers are graded as candidates; the questions are
 * what is reused, so they are screened on their own.
 */

export const QUESTION_TYPES = ["interpret", "modify", "combine", "compare", "correct", "ask", "tag"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type Viability =
  | { ok: true }
  | { ok: false; reason: "too-short" | "source-bound" | "not-astrological" | "not-a-question" };

/**
 * Phrasings that only make sense next to the text a question was extracted
 * from ("according to the author", "how is X described"). Those questions ask
 * what a book said, not what is true of a placement.
 */
const SOURCE_BOUND =
  /\b(according to (?:the |this )?(?:text|author|passage|book|chapter|article|writer)|the (?:author|text|passage|writer|chapter|book|article)\b|this (?:text|passage|chapter|book|article|section)|(?:is|are) (?:described|characterized|portrayed|depicted|mentioned|referred to|discussed)\b|mentioned (?:in|above)|as described|in the (?:example|case study)|the example (?:chart|given)|described as|(?:described|characteri[sz]ed|portrayed|depicted|mentioned|defined)\s*\?\s*$)/i;

const ASTRO_WORDS =
  /\b(aries|taur|gemin|cancer|leo|virg|libr|scorp|sagitt|capric|aquar|pisc|ephemeris|birth|zodiacal|celestial|solar|lunar|undecile|quintile|septile|novile|sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|node|ascendant|rising|midheaven|house|sign|zodiac|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|aspect|conjunct|conjunction|square|trine|sextile|opposition|quincunx|transit|retrograde|chart|horoscope|astrolog|element|modality|cardinal|fixed|mutable|synastry|return|progress|planet|star|native|nativity|lord|ruler|triplicit|dignit|exalt|detriment|debilit|firdari|profection|decan|bound|term|sect|lot of|part of fortune|almuten|hyleg|eclipse|lunation|stellium|asteroid|eris|ceres|juno|vesta|pallas|fixed star|solar arc|progressed|direction|election|horary|mundane|ingress|decumbiture|antiscia|midpoint|harmonic|dodecatemor|nakshatra|dasha|dosha|kendra|trikona|bhava|rasi|navamsa|lagna)/i;

export function questionViability(text: string): Viability {
  const t = text.trim();
  if (t.length < 12) return { ok: false, reason: "too-short" };
  if (!/[?]\s*$/.test(t) && !/^(?:describe|explain|what|how|why|which|when|where|who|is|are|does|do|can|should|interpret|analy[sz]e|compare|list|name)\b/i.test(t)) {
    return { ok: false, reason: "not-a-question" };
  }
  if (SOURCE_BOUND.test(t)) return { ok: false, reason: "source-bound" };
  if (!ASTRO_WORDS.test(t)) return { ok: false, reason: "not-astrological" };
  return { ok: true };
}

/**
 * Remove a trailing or embedded reference to the source text when what is
 * left still stands as a question: "What are the characteristics of the Moon
 * in Aries as described in the text?" → "…of the Moon in Aries?". Returns null
 * when the question depends on the source (the author's life, "this example").
 */
export function stripSourceClause(text: string): string | null {
  const t = text
    .replace(/,?\s*(?:as\s+)?(?:described|mentioned|discussed|explained|outlined|presented|stated|noted|defined)\s+(?:in|by)\s+(?:the|this)\s+(?:text|author|passage|book|chapter|article|writer|section)\b/gi, "")
    .replace(/,?\s*according\s+to\s+(?:the|this)\s+(?:text|author|passage|book|chapter|article|writer|section)(?:'s\s+\w+)?\b,?/gi, "")
    .replace(/,?\s*in\s+(?:the|this)\s+(?:text|passage|chapter|book|article|section)\b/gi, "")
    .replace(/\s+\?/g, "?")
    .replace(/^\s*,\s*/, "")
    .trim();
  if (t === text.trim()) return null;
  const fixed = t.charAt(0).toUpperCase() + t.slice(1);
  return questionViability(fixed).ok ? fixed : null;
}

/** Lower-case, collapse whitespace and punctuation: the dedupe key. */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
