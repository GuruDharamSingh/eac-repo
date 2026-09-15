/**
 * Asking the chart a question.
 *
 * The reading is a few dozen keyword sentences, each carrying the domain
 * vector of the words it was built from. A question is turned into a domain
 * vector the same way (QUESTION_TERMS), and the sentences are ranked by how
 * well their topics answer it, weighted by how strongly their aspect speaks
 * in the chart. Mentioning a planet, sign or house narrows the search to
 * sentences that came from it.
 *
 * Nothing is generated at question time that was not already in the
 * reading — the answer is a retrieval, so every line of it can be traced to
 * an aspect and to the keywords the book gives for it. That is the point:
 * this is the book's method with a search over it, not a model's opinion.
 */

import { BODIES, SIGNS } from "../constants";
import { ordinal } from "../format";
import { bias, vec, QUESTION_TERMS, type Domain, type DomainVector } from "./domains";
import type { ChartReading } from "./reading";

export interface Answer {
  /** Everyday-language answer, several sentences. */
  text: string;
  /** Each sentence used, with where it came from. */
  sources: Array<{ plain: string; learn: string; source: string; score: number }>;
  /** The topics the question was read as being about. */
  topics: Domain[];
  /** Factors the question named, if any. */
  filters: string[];
}

export function questionVector(q: string): { v: DomainVector; topics: Domain[] } {
  const v: DomainVector = {};
  const topics: Domain[] = [];
  for (const [re, ds] of QUESTION_TERMS) {
    if (!re.test(q)) continue;
    ds.forEach((d, i) => {
      const w = i === 0 ? 1 : 0.6;
      if ((v[d] ?? 0) < w) v[d] = w;
      if (!topics.includes(d)) topics.push(d);
    });
  }
  return { v, topics };
}

/** Planet, sign and house names in the question, as the labels the reading uses. */
function questionFilters(q: string): string[] {
  const out: string[] = [];
  for (const b of BODIES) if (new RegExp(`\\b${b.name}\\b`, "i").test(q)) out.push(b.name);
  for (const s of SIGNS) if (new RegExp(`\\b${s.name}\\b`, "i").test(q)) out.push(s.name);
  const h = q.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+house\b/i) ?? q.match(/\bhouse\s+(\d{1,2})\b/i);
  if (h) {
    const n = Number(h[1]);
    if (n >= 1 && n <= 12) out.push(`in the ${ordinal(n)}`);
  }
  return out;
}

export function ask(reading: ChartReading, question: string): Answer {
  const { v, topics } = questionVector(question);
  const filters = questionFilters(question);
  const aboutSelf = /\b(who am i|what am i like|my (character|nature|personality)|myself)\b/i.test(question);

  let pool = reading.units;
  if (filters.length) {
    const narrowed = pool.filter((u) => filters.every((f) => u.source.toLowerCase().includes(f.toLowerCase())));
    if (narrowed.length) pool = narrowed;
  }

  const scored = pool
    .map((u) => {
      const topical = topics.length ? bias(u.domains, v) / (1 + Object.keys(u.domains).length * 0.15) : 0.5;
      const sphereBonus = aboutSelf ? (u.sphere === "character" ? 0.4 : 0) : topics.length ? (u.sphere === "circumstance" ? 0.15 : 0) : 0;
      const stepBonus = u.step === 8 || u.step === 9 ? 0.15 : 0; // the sevenfold sentences say the most
      return { u, score: topical * (0.6 + u.strength) + sphereBonus + stepBonus };
    })
    .filter((s) => (topics.length ? s.score > 0.2 : true))
    .sort((a, b) => b.score - a.score);

  // At most two sentences from any one aspect, so the answer draws on the chart, not one contact.
  const picked: typeof scored = [];
  const perSource = new Map<string, number>();
  const said = new Set<string>();
  for (const s of scored) {
    if (picked.length >= 4) break;
    if (said.has(s.u.plain)) continue;
    said.add(s.u.plain);
    const n = perSource.get(s.u.source) ?? 0;
    if (n >= 2) continue;
    perSource.set(s.u.source, n + 1);
    picked.push(s);
  }

  const lines: string[] = [];
  if (topics.length === 0 && filters.length === 0) {
    lines.push(reading.key.summary);
    lines.push(reading.character);
    return { text: lines.join("\n\n"), sources: [], topics, filters };
  }
  if (!picked.length) {
    lines.push(
      `The chart’s aspects do not speak directly to ${topics.length ? topics.join(", ") : filters.join(", ")}.` +
        ` The key to the chart is worth remembering here: ${reading.key.summary}`,
    );
    return { text: lines.join(" "), sources: [], topics, filters };
  }
  const keyTouches = topics.some((t) => (reading.key.context[t] ?? 0) > 0.5);
  if (keyTouches) lines.push(`This is close to the key of the chart, so it will colour more than this one answer.`);
  lines.push(...picked.map((p) => p.u.plain));
  return {
    text: lines.join(" "),
    sources: picked.map((p) => ({ plain: p.u.plain, learn: p.u.learn, source: p.u.source, score: Number(p.score.toFixed(3)) })),
    topics,
    filters,
  };
}

/** The domain vector of a free-text topic, for callers that want to bias a reading toward a subject. */
export function topicContext(text: string): DomainVector {
  return questionVector(text).v;
}

export { vec };
