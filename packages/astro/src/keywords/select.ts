/**
 * Choosing words.
 *
 * The book gives pools of keywords; the reader chooses from them. This is
 * the chooser. It answers "which of Saturn's eighteen words goes with which
 * of the 5th house's five" by scoring every pairing and taking the best,
 * then refusing to say the same word twice in one reading.
 *
 * A pairing's score:
 *
 *   affinity   the two words are about the same thing (domains.ts). This is
 *              the main term — it is what makes "thrift" go with
 *              "investments" and "discipline" go with "children" rather than
 *              the other way round.
 *   salience   the book lists the most characteristic word first. A small
 *              nudge, so a tie goes to the author's ordering.
 *   context    what the WHOLE chart is about (the key to the chart, step 11)
 *              and, when answering a question, what was asked. The book's
 *              example: a mystical chart reads its 8th house as occult
 *              ability, not legacies. The context vector is how that
 *              preference reaches every choice.
 *   novelty    a word already said in the current block of the reading is
 *              excluded outright, and the same word from another factor is
 *              pushed down ("Justice" appears under both Saturn and
 *              Capricorn — the reading should not say it twice as if it were
 *              two findings). The blocks are the book's: character (steps 4
 *              and 5), circumstance (step 7), and the sevenfold pair (8, 9).
 *              Across blocks a word may return — the book's own example says
 *              "ambition" in step 4 and again in step 7.
 */

import { affinity, bias, vec, type DomainVector } from "./domains";
import type { Keyword, KeywordSet, Role, Sphere } from "./lexicon";
import type { Nature } from "./nature";

export interface Context {
  nature: Nature;
  /** What the chart (and the question, if any) is about. Empty is fine. */
  context: DomainVector;
  /** Keyword ids already spoken in this reading. */
  used: Set<string>;
  /** Lower-cased keyword texts already spoken, across factors. */
  usedText: Set<string>;
  /** Keyword ids said elsewhere in the chart (another aspect): discouraged, not excluded. */
  avoid?: Set<string>;
  /** Pairings ("a.id|b.id") already made elsewhere in the chart: excluded, so no sentence is said twice. */
  avoidPairs?: Set<string>;
}

export function newContext(nature: Nature, context: DomainVector = {}, avoid?: Set<string>, avoidPairs?: Set<string>): Context {
  return { nature, context, used: new Set(), usedText: new Set(), avoid, avoidPairs };
}

export const pairKey = (a: Keyword, b: Keyword) => `${a.id}|${b.id}`;

/** A context that shares the bias but starts with nothing said. */
export function freshContext(ctx: Context): Context {
  return { nature: ctx.nature, context: ctx.context, used: new Set(), usedText: new Set(), avoid: ctx.avoid, avoidPairs: ctx.avoidPairs };
}

/** A context that has heard everything the given ones said. */
export function unionContext(...ctxs: Context[]): Context {
  const out = freshContext(ctxs[0]);
  for (const c of ctxs) {
    c.used.forEach((id) => out.used.add(id));
    c.usedText.forEach((t) => out.usedText.add(t));
  }
  return out;
}

/** The book's rule: basic always; positive with harmonious; negative with inharmonious. */
export function setsFor(nature: Nature, opts: { softened?: boolean; basicOnly?: boolean } = {}): KeywordSet[] {
  if (opts.basicOnly) return ["basic"];
  if (opts.softened) return ["basic", "pos"];
  return ["basic", nature === "harmonious" ? "pos" : "neg"];
}

export interface PoolFilter {
  sets: KeywordSet[];
  roles?: Role[];
  sphere?: Sphere;
  /** Require a particular form to exist (a frame that needs an adjective can only take words that have one). */
  needs?: Array<"adj" | "in" | "det">;
}

export function pool(words: readonly Keyword[], f: PoolFilter): Keyword[] {
  return words.filter((w) => {
    if (w.quiet) return false;
    if (!f.sets.includes(w.set)) return false;
    if (f.roles && !f.roles.includes(w.role)) return false;
    if (f.sphere && w.sphere !== "both" && w.sphere !== f.sphere) return false;
    if (f.needs && !f.needs.every((n) => Boolean(w[n]))) return false;
    return true;
  });
}

const salience = (w: Keyword) => 1 - Math.min(w.rank, 10) * 0.04;

/** Rough stems of the content words, so "ambition" and "ambitions" (or "generous"/"generosity") are seen as the same word. */
function stems(w: Keyword): Set<string> {
  const out = new Set<string>();
  for (const word of `${w.text} ${w.n}`.toLowerCase().split(/[^a-z]+/)) {
    if (word.length < 5) continue;
    out.add(word.replace(/(iveness|ousness|fulness|ality|ation|ility|ness|ment|ious|ence|ance|ing|ive|ous|ful|ity|ism|ist|ies|es|s|y)$/, "").slice(0, 6));
  }
  return out;
}

/** The two words say the same thing — a pairing of them is a tautology, not a combination. */
function sameWord(a: Keyword, b: Keyword): boolean {
  if (a.text.toLowerCase() === b.text.toLowerCase()) return true;
  const sa = stems(a);
  for (const s of stems(b)) if (sa.has(s)) return true;
  return false;
}

/** A word already said in this block is out; the same word from another factor is merely discouraged. */
const spoken = (w: Keyword, ctx: Context) => ctx.used.has(w.id);
function novelty(w: Keyword, ctx: Context): number {
  return (ctx.usedText.has(w.text.toLowerCase()) ? 0.6 : 0) + (ctx.avoid?.has(w.id) ? 0.8 : 0);
}

function contextPull(w: Keyword, ctx: Context): number {
  const b = bias(vec(w.domains), ctx.context);
  // Squash: a strongly emphasised chart should tilt choices, not dictate them.
  return b / (1 + b);
}

/** How much this word wants to be said on its own — for single-word slots. */
export function soloScore(w: Keyword, ctx: Context): number {
  return salience(w) + 0.6 * contextPull(w, ctx) - novelty(w, ctx);
}

export interface Pair<A extends Keyword = Keyword, B extends Keyword = Keyword> {
  a: A;
  b: B;
  score: number;
  affinity: number;
}

/**
 * Score every (a, b) and return the best `n` with no word reused between
 * them. `minAffinity` keeps a pairing from being made just because both
 * pools were short — better to say less than to say "few (Saturn) hotels".
 */
export function bestPairs(as: readonly Keyword[], bs: readonly Keyword[], ctx: Context, n: number, minAffinity = 0.3): Pair[] {
  const scored: Pair[] = [];
  for (const a of as) {
    if (spoken(a, ctx)) continue;
    const va = vec(a.domains);
    for (const b of bs) {
      if (a.id === b.id || spoken(b, ctx) || ctx.avoidPairs?.has(pairKey(a, b))) continue;
      const aff = affinity(va, vec(b.domains));
      if (aff < minAffinity) continue;
      const score =
        2.2 * aff +
        0.5 * (salience(a) + salience(b)) +
        0.4 * (contextPull(a, ctx) + contextPull(b, ctx)) -
        (novelty(a, ctx) + novelty(b, ctx)) -
        (sameWord(a, b) ? 2 : 0);
      scored.push({ a, b, score, affinity: aff });
    }
  }
  scored.sort((x, y) => y.score - x.score || x.a.rank - y.a.rank || x.b.rank - y.b.rank);
  const out: Pair[] = [];
  const takenA = new Set<string>();
  const takenB = new Set<string>();
  const takenText = new Set<string>();
  for (const p of scored) {
    if (out.length >= n) break;
    if (takenA.has(p.a.id) || takenB.has(p.b.id)) continue;
    if (takenText.has(p.a.text.toLowerCase()) || takenText.has(p.b.text.toLowerCase())) continue;
    out.push(p);
    takenA.add(p.a.id);
    takenB.add(p.b.id);
    takenText.add(p.a.text.toLowerCase());
    takenText.add(p.b.text.toLowerCase());
  }
  return out;
}

/**
 * Pairs that need no topical match: a counting word applied to a countable
 * ("few children", "many friends"). Ranked by salience and novelty only.
 */
export function countPairs(dets: readonly Keyword[], counts: readonly Keyword[], ctx: Context, n: number): Pair[] {
  const scored: Pair[] = [];
  for (const a of dets) for (const b of counts) {
    if (spoken(a, ctx) || spoken(b, ctx)) continue;
    scored.push({ a, b, score: 1.2 + 0.5 * (salience(a) + salience(b)) + 0.4 * contextPull(b, ctx) - (novelty(a, ctx) + novelty(b, ctx)), affinity: 1 });
  }
  scored.sort((x, y) => y.score - x.score || x.b.rank - y.b.rank);
  const out: Pair[] = [];
  const taken = new Set<string>();
  for (const p of scored) {
    if (out.length >= n) break;
    if (taken.has(p.a.id) || taken.has(p.b.id)) continue;
    out.push(p);
    taken.add(p.a.id);
    taken.add(p.b.id);
  }
  return out;
}

/**
 * The book's KEY TO THE CHART applied to a house: of a house's affairs, the
 * ones the chart as a whole cares about. "If a person has the 12th house
 * occupied by two or three of the strong planets … planets in the 8th house
 * … we judge that the native will be more interested in [occult ability and
 * regeneration] than in legacies." When the context says nothing about the
 * house, every affair stays in play.
 */
export function affairsByKey(words: readonly Keyword[], ctx: Context, keep = 3): Keyword[] {
  if (words.length <= keep) return [...words];
  const pulls = words.map((w) => ({ w, pull: bias(vec(w.domains), ctx.context) }));
  if (!pulls.some((p) => p.pull > 0.25)) return [...words];
  return pulls
    .sort((x, y) => y.pull - x.pull || x.w.rank - y.w.rank)
    .slice(0, keep)
    .map((p) => p.w);
}

/** The best single word from a pool for a given target vector. */
export function bestFor(words: readonly Keyword[], target: DomainVector, ctx: Context, minAffinity = 0): Keyword | undefined {
  let best: Keyword | undefined;
  let bestScore = -Infinity;
  for (const w of words) {
    if (spoken(w, ctx)) continue;
    const aff = affinity(vec(w.domains), target);
    if (aff < minAffinity) continue;
    const s = 2.2 * aff + soloScore(w, ctx);
    if (s > bestScore) {
      bestScore = s;
      best = w;
    }
  }
  return best;
}

export function markUsed(ctx: Context, ...words: Keyword[]) {
  for (const w of words) {
    ctx.used.add(w.id);
    ctx.usedText.add(w.text.toLowerCase());
  }
}
