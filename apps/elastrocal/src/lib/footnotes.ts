/**
 * Footnotes: where an AI-written sentence came from, and why it says what it
 * says. Pure and client-safe; used by the claims review page, the explorer's
 * AI summaries and the deck's AI drafts (components/footnote.tsx renders them).
 *
 * A footnote points at one book passage and names:
 *  - the source sentence(s): those sharing the most content words with the
 *    AI's sentence (at least two, and at least a fifth of its words — the
 *    claims page's rule, @elkdonis/astro-corpus claims-rules.ts). Word overlap
 *    only, so every match is marked APPROXIMATE, and "no source sentence
 *    found" is said plainly when nothing reaches the bar;
 *  - book, author, pages, and the corrected heading path / subject (lib/scope.ts);
 *  - "the book's reason": the digest's `because`, when the author gave one;
 *  - "why these tags": for each factor key, the evidence in the passage — a
 *    heading that names it, the words in a numbered sentence, or the
 *    passage's subject it inherits from — or that there is none.
 */

import { FACTOR_BY_KEY, tagText } from "@elkdonis/astro-corpus";
import { isPlacementKey } from "./applicability";
import { headingKeys, involves, resolveScope, scopeLabel, slotOf } from "./scope";

// ── words ───────────────────────────────────────────────────────────────────

const STOP = new Set(
  (
    "a an the and or but if then than that this these those there their they them he she his her its it is are was were be been being " +
    "to of in on at by for with from as into about over under not no so such can may might will would should could do does did has have had " +
    "who whom which what when where while how all any each more most other some very also often one ones person people native natives someone " +
    "chart planet planets sign signs house houses aspect aspects your you"
  ).split(" "),
);

/** A word's matching form: lower-case, crude stem (the claims page's contentWords rule). */
export function stemOf(word: string): string | null {
  const w = word.toLowerCase().replace(/'s$/, "");
  if (w.length <= 2 || STOP.has(w) || !/^[a-z][a-z'-]+$/.test(w)) return null;
  return w.replace(/(?:ies)$/, "y").replace(/(?:ing|ed|es|s)$/, "") || w;
}

export function contentStems(s: string): string[] {
  const out: string[] = [];
  for (const m of s.match(/[A-Za-z][A-Za-z'-]+/g) ?? []) {
    const st = stemOf(m);
    if (st) out.push(st);
  }
  return out;
}

/** Sentences: split after . ! ? (and a closing quote) and at blank lines. */
export function splitSentences(body: string): string[] {
  return body
    .replace(/\r/g, "")
    .split(/(?<=[.!?]["'”’)]?)\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface SentenceMatch {
  index: number;
  /** Shared stems. */
  shared: string[];
}

/** The passage sentences most like `text`, best first (at most `max`); empty when none reaches the bar. */
export function matchSentences(sentences: readonly string[], text: string, max = 2, minShare = 0.2): SentenceMatch[] {
  const words = [...new Set(contentStems(text))];
  if (!words.length) return [];
  const need = Math.max(2, Math.ceil(words.length * minShare));
  return sentences
    .map((s, index) => {
      const bag = new Set(contentStems(s));
      return { index, shared: words.filter((w) => bag.has(w)) };
    })
    .filter((x) => x.shared.length >= need)
    .sort((a, b) => b.shared.length - a.shared.length || a.index - b.index)
    .slice(0, max);
}

// ── the footnote ────────────────────────────────────────────────────────────

export interface TagReason {
  key: string;
  label: string;
  /** "heading “Natal Venus in Aries”", "words “Venus in Aries” in sentence 2", … */
  from: string;
  /** No support in this passage. */
  unsupported: boolean;
}

export interface Footnote {
  textId: string | null;
  book: string | null;
  author: string | null;
  pages: number[];
  /** Corrected heading path (siblings removed), and what was dropped. */
  breadcrumb: string[];
  ignored: string[];
  subject: string | null;
  /** Matched source sentences (1-based numbers), with the shared stems to highlight. */
  sentences: Array<{ n: number; text: string; shared: string[] }>;
  /** Matched by shared words only. Always true when anything matched. */
  approximate: boolean;
  found: boolean;
  /** The author's stated reason, when the digest recorded one. */
  because: string | null;
  /** An AI claim digested from the passage that the sentence leans on (deck drafts). */
  viaClaim: string | null;
  /** The passage is about a different placement in the same slot than the text names ("about Mars in Sagittarius, not Mars in Capricorn"). */
  contextWarning: string | null;
  /** Drafts only: the sentence shares few words with its best source (below 3 words or a quarter of its words). */
  weak?: { shared: number; of: number };
  tags: TagReason[];
}

export interface PassageLike {
  textId: string | null;
  body: string;
  headings: readonly string[];
  pages: readonly number[];
  book: string | null;
  author: string | null;
}

const labelOf = (k: string) => FACTOR_BY_KEY.get(k)?.label ?? k;

/** Where in the passage each key is evidenced. */
export function tagReasons(keys: readonly string[], p: PassageLike, sentences: readonly string[]): TagReason[] {
  const scope = resolveScope(p.headings);
  const sentenceTags = new Map<number, { key: string; match: string }[]>();
  const tagsOf = (i: number) => {
    let t = sentenceTags.get(i);
    if (!t) {
      t = tagText(sentences[i]).map((x) => ({ key: x.key, match: x.match }));
      sentenceTags.set(i, t);
    }
    return t;
  };
  const subjectKeys = scope.keys.filter(isPlacementKey);
  return [...new Set(keys)].map((key) => {
    const label = labelOf(key);
    const crumb = scope.breadcrumb.find((c) => c.keys.includes(key));
    if (crumb) return { key, label, from: `heading “${crumb.text}”`, unsupported: false };
    for (let i = 0; i < sentences.length; i++) {
      const hit = tagsOf(i).find((t) => t.key === key);
      if (hit) return { key, label, from: `words “${hit.match.trim()}” in sentence ${i + 1}`, unsupported: false };
    }
    const sub = subjectKeys.find((k) => !isPlacementKey(key) && involves(k, key));
    if (sub) return { key, label, from: `inherited from the passage's subject (${labelOf(sub)})`, unsupported: false };
    const sibling = scope.ignored.find((h) => headingKeys(h).includes(key));
    if (sibling) return { key, label, from: `only the heading “${sibling}”, which is a sibling heading — probably mis-inherited`, unsupported: true };
    return { key, label, from: "nothing in this passage or its headings names it", unsupported: true };
  });
}

/** A footnote for `text` (an AI claim or draft sentence) pointing into passage `p`. */
export function footnoteFor(
  text: string,
  p: PassageLike,
  opts: {
    keys?: readonly string[];
    /** Placements the text is about, for the context check (defaults to `keys`). */
    contextKeys?: readonly string[];
    because?: string | null;
    viaClaim?: string | null;
    sentences?: readonly string[];
    max?: number;
  } = {},
): Footnote {
  const sentences = opts.sentences ?? splitSentences(p.body);
  const matches = matchSentences(sentences, opts.viaClaim ? `${text} ${opts.viaClaim}` : text, opts.max ?? 2);
  const scope = resolveScope(p.headings);
  return {
    textId: p.textId,
    book: p.book,
    author: p.author,
    pages: [...p.pages],
    breadcrumb: scope.breadcrumb.map((c) => c.text),
    ignored: scope.ignored,
    subject: scopeLabel(scope.keys.some(isPlacementKey) ? scope.keys.filter(isPlacementKey) : scope.keys),
    sentences: matches.map((m) => ({ n: m.index + 1, text: sentences[m.index], shared: m.shared })),
    approximate: matches.length > 0,
    found: matches.length > 0,
    because: opts.because?.trim() ? opts.because.trim() : null,
    viaClaim: opts.viaClaim ?? null,
    contextWarning: contextWarning(scope.keys, opts.contextKeys ?? opts.keys ?? []),
    tags: tagReasons(opts.keys ?? [], p, sentences),
  };
}

// ── drafts: one footnote per sentence, from the draft's references ──────────

export interface RefPassage extends PassageLike {
  /** The AI digest's claims from this passage (secondary support), with the book's reason if any. */
  claims: Array<{ body: string; because: string | null }>;
}

/** How much a draft sentence must share with a passage sentence or claim to count as sourced. */
export const DRAFT_BAR = { minShared: 2, minShare: 0.2 };

export interface FootnotedSentence {
  text: string;
  /** Empty when no reference supports it. */
  notes: Footnote[];
}

/**
 * Split a draft into sentences and give each the reference passage that best
 * supports it: most content words shared with one of the passage's sentences
 * (or with one of its digested claims, which then shows as "via the AI
 * digest"). Below the bar (DRAFT_BAR: at least two shared words and a fifth of the
 * sentence's words, the claims page's rule) the sentence gets no footnote and is shown as unsourced.
 */
export function footnoteDraft(draft: string, refs: readonly RefPassage[], bar: { minShared: number; minShare: number } = DRAFT_BAR): FootnotedSentence[] {
  const prepared = refs.map((r) => ({ r, sentences: splitSentences(r.body) }));
  const draftPlacements = tagText(draft).map((t) => t.key).filter(isPlacementKey);
  return splitSentences(draft).map((text) => {
    const words = [...new Set(contentStems(text))];
    const need = Math.max(bar.minShared, Math.ceil(words.length * bar.minShare));
    let best: { score: number; ref: (typeof prepared)[number]; claim: RefPassage["claims"][number] | null } | null = null;
    for (const p of prepared) {
      for (const s of p.sentences) {
        const bag = new Set(contentStems(s));
        const score = words.filter((w) => bag.has(w)).length;
        if (score >= need && (!best || score > best.score)) best = { score, ref: p, claim: null };
      }
      for (const c of p.r.claims) {
        const bag = new Set(contentStems(c.body));
        const score = words.filter((w) => bag.has(w)).length;
        if (score >= need && (!best || score > best.score)) best = { score, ref: p, claim: c };
      }
    }
    if (!best) return { text, notes: [] };
    const keys = tagText(text).map((t) => t.key);
    const contextKeys = [...new Set([...keys, ...draftPlacements])];
    return {
      text,
      notes: [
        {
          ...footnoteFor(text, best.ref.r, {
            keys,
            sentences: best.ref.sentences,
            because: best.claim?.because ?? null,
            viaClaim: best.claim?.body ?? null,
            contextKeys,
          }),
          ...(best.score < Math.max(3, Math.ceil(words.length * 0.25)) ? { weak: { shared: best.score, of: words.length } } : {}),
        },
      ],
    };
  });
}

/**
 * When the passage's subject fills a slot the text also fills, with another
 * value — the passage is about Mars in Sagittarius, the text about Mars in
 * Capricorn — say so: a pronoun in that passage does not mean the text's placement.
 */
function contextWarning(scopeKeys: readonly string[], textKeys: readonly string[]): string | null {
  const scoped = scopeKeys.filter(isPlacementKey);
  const clashes: string[] = [];
  for (const k of textKeys.filter(isPlacementKey)) {
    if (scoped.includes(k)) continue;
    const slot = slotOf(k);
    const other = scoped.find((s) => slotOf(s) === slot);
    if (slot && other) clashes.push(`about ${labelOf(other)}, not ${labelOf(k)}`);
  }
  return clashes.length ? `This passage is ${[...new Set(clashes)].join("; ")}.` : null;
}
