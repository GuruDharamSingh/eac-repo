/**
 * Turn review rows into training and evaluation records. Pure: the script
 * (scripts/export.ts) loads the rows, this decides what they mean.
 *
 * Direction of every preference pair (chosen is what the model should learn
 * to prefer):
 *
 *   pick with a winner   chosen = winner, rejected = each other candidate shown
 *   pick "about same"    no pair (a tie says nothing about direction)
 *   fix                  chosen = the corrected text, rejected = the text it was corrected from
 *   rate (two answers    chosen = higher mean score, rejected = lower, only when the
 *    to one question)    means differ by at least RATE_MARGIN; marked origin "rating"
 *   write                no pair: writing your own is not a judgement of the others
 *
 * A reviewer's later review of the same question replaces their earlier one of
 * the same action (changes of mind). Different reviewers' reviews are all kept;
 * contradictory pairs are both exported and visible in meta.
 *
 * Gold texts (kind own/edit) become supervised examples, prompted by the
 * question they were written for.
 *
 * Ratings also become unpaired examples (TRL's KTO format: prompt, completion,
 * label): a mean of KTO_GOOD or more is labelled good, KTO_BAD or less bad,
 * anything between is left out. This uses a rating on a question with a single
 * answer, which gives no pair.
 *
 * A review's explanation (src/explanation.ts) rides along in meta: on the pair
 * or KTO row its review produced (a rating pair carries both ratings'). Every
 * explained review is also one explanations.jsonl row with the texts it was
 * about, for building a rubric, judge examples or critique data.
 *
 * The held-out split is by question: every record for a question in the fixed
 * test set (src/eval-set.ts) goes to the eval files, everything else to train.
 * The script passes the set in.
 */

import { latestClaimVerdicts } from "./claims-rules";
import { replayVocab, type VocabReviewRow } from "./vocab-rules";
import {
  buildConceptEntry,
  buildTermEntry,
  replayFoundations,
  type CatalogueTerm,
  type FoundationItem,
  type FoundationReviewRow,
  type ImageEntry,
  type PassageEntry,
  type TraitEntry,
} from "./foundations-rules";
import { explanationOf, type Explanation } from "./explanation";
import { FACTOR_BY_KEY } from "./factors";
import { latestRefVotes, patternPhraseOf, refKey, type RetrievedReference } from "./reasoning-rules";

export const RATE_MARGIN = 1.5;
export const KTO_GOOD = 4;
export const KTO_BAD = 2.5;

export interface ExportText {
  id: string;
  body: string;
  kind: string;
  tradition: string | null;
  sourceSlug: string;
  trainable: boolean;
  model: string | null;
}

export interface ExportQuestion {
  id: string;
  prompt: string;
  factorKeys: string[];
  tradition: string | null;
}

export interface ExportReview {
  id: string;
  questionId: string;
  reviewerId: string;
  action: string;
  payload: Record<string, unknown>;
  candidateIds: string[];
  stance: string | null;
  createdAt: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PairRecord {
  id: string;
  prompt: ChatMessage[];
  chosen: ChatMessage[];
  rejected: ChatMessage[];
  meta: {
    questionId: string;
    reviewId: string;
    origin: "pick" | "fix" | "rating";
    reviewer: string;
    stance: string | null;
    reasons?: string[];
    factorKeys: string[];
    chosenText: string;
    rejectedText: string;
    trainable: boolean;
    /** Pick or fix: the review's explanation. Rating pair: the chosen answer's rating's. */
    explanation?: Explanation;
    /** Rating pair only: the explanation on the rejected answer's rating. */
    rejectedExplanation?: Explanation;
  };
}

export interface KtoRecord {
  id: string;
  prompt: ChatMessage[];
  completion: ChatMessage[];
  label: boolean;
  meta: {
    questionId: string;
    reviewId: string;
    textId: string;
    reviewer: string;
    stance: string | null;
    meanScore: number;
    scores: Record<string, number>;
    trainable: boolean;
    explanation?: Explanation;
  };
}

/** One explained review with the texts it was about. */
export interface ExplanationRecord {
  id: string;
  question_id: string;
  prompt: string;
  action: "pick" | "rate" | "fix";
  candidates: { text_id: string; body: string }[];
  /** Pick: the winner's text id, or null for "about the same". */
  winner?: string | null;
  /** Rate: the rated text and its scores. */
  ratings?: { text_id: string; scores: Record<string, number> };
  /** Fix: the corrected text and the one it was corrected from. */
  edited?: { from_text_id: string; text_id: string; body: string };
  explanation: Explanation;
  meta: { questionId: string; reviewId: string; reviewer: string; stance: string | null; reasons?: string[]; factorKeys: string[]; trainable: boolean };
}

export interface SftRecord {
  id: string;
  messages: ChatMessage[];
  meta: { questionId: string; textId: string; kind: string; tradition: string | null; factorKeys: string[]; trainable: boolean; stance: string | null };
}


const user = (content: string): ChatMessage[] => [{ role: "user", content }];
const assistant = (content: string): ChatMessage[] => [{ role: "assistant", content }];

/**
 * Latest review per (reviewer, question, action, target). The target is the
 * text a rate or fix was about: rating answer A and then answer B are two
 * judgements, not a change of mind.
 */
function latest(reviews: ExportReview[]): ExportReview[] {
  const byKey = new Map<string, ExportReview>();
  const target = (r: ExportReview) =>
    r.action === "rate" ? String(r.payload.textId) : r.action === "fix" ? String(r.payload.fromTextId) : "";
  for (const r of [...reviews].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    byKey.set(`${r.reviewerId}|${r.questionId}|${r.action}|${target(r)}`, r);
  }
  return [...byKey.values()];
}

export function buildPairs(questions: Map<string, ExportQuestion>, texts: Map<string, ExportText>, reviews: ExportReview[]): PairRecord[] {
  const out: PairRecord[] = [];
  const kept = latest(reviews);

  const pair = (r: ExportReview, origin: PairRecord["meta"]["origin"], chosenId: string, rejectedId: string, extra: Partial<PairRecord["meta"]> = {}) => {
    const q = questions.get(r.questionId);
    const c = texts.get(chosenId);
    const x = texts.get(rejectedId);
    if (!q || !c || !x || c.id === x.id) return;
    out.push({
      id: `${r.id}:${chosenId.slice(0, 8)}>${rejectedId.slice(0, 8)}`,
      prompt: user(q.prompt),
      chosen: assistant(c.body),
      rejected: assistant(x.body),
      meta: {
        questionId: q.id,
        reviewId: r.id,
        origin,
        reviewer: r.reviewerId,
        stance: r.stance,
        factorKeys: q.factorKeys,
        chosenText: c.id,
        rejectedText: x.id,
        trainable: c.trainable && x.trainable,
        ...extra,
      },
    });
  };

  const explained = (key: "explanation" | "rejectedExplanation", r: ExportReview): Partial<PairRecord["meta"]> => {
    const e = explanationOf(r.payload);
    return e ? { [key]: e } : {};
  };

  for (const r of kept) {
    if (r.action === "pick") {
      const winner = r.payload.winner as string | null;
      if (!winner) continue;
      for (const other of r.candidateIds) {
        if (other !== winner) pair(r, "pick", winner, other, { reasons: (r.payload.reasons as string[]) ?? [], ...explained("explanation", r) });
      }
    } else if (r.action === "fix") {
      const edited = r.payload.textId as string | undefined;
      const from = r.payload.fromTextId as string | undefined;
      if (edited && from) pair(r, "fix", edited, from, explained("explanation", r));
    }
  }

  // Ratings: compare every two answers one reviewer rated on one question.
  const rates = kept.filter((r) => r.action === "rate");
  const groups = new Map<string, ExportReview[]>();
  for (const r of rates) {
    const k = `${r.reviewerId}|${r.questionId}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const mean = (r: ExportReview) => {
    const s = (r.payload.scores ?? {}) as Record<string, number>;
    const v = Object.values(s).filter((n) => typeof n === "number");
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
  };
  for (const g of groups.values()) {
    // One rating per text: the latest.
    const perText = new Map<string, ExportReview>();
    for (const r of g.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) perText.set(r.payload.textId as string, r);
    const list = [...perText.values()];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const d = mean(a) - mean(b);
        if (!(Math.abs(d) >= RATE_MARGIN)) continue;
        const [hi, lo] = d > 0 ? [a, b] : [b, a];
        pair(hi, "rating", hi.payload.textId as string, lo.payload.textId as string, {
          ...explained("explanation", hi),
          ...explained("rejectedExplanation", lo),
        });
      }
    }
  }
  return out;
}

const meanOf = (r: ExportReview) => {
  const v = Object.values((r.payload.scores ?? {}) as Record<string, number>).filter((n) => typeof n === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
};

export function buildKto(questions: Map<string, ExportQuestion>, texts: Map<string, ExportText>, reviews: ExportReview[]): KtoRecord[] {
  const out: KtoRecord[] = [];
  for (const r of latest(reviews)) {
    if (r.action !== "rate") continue;
    const q = questions.get(r.questionId);
    const t = texts.get(r.payload.textId as string);
    const m = meanOf(r);
    if (!q || !t || Number.isNaN(m) || (m > KTO_BAD && m < KTO_GOOD)) continue;
    const explanation = explanationOf(r.payload);
    out.push({
      id: `${r.id}:${t.id.slice(0, 8)}`,
      prompt: user(q.prompt),
      completion: assistant(t.body),
      label: m >= KTO_GOOD,
      meta: {
        questionId: q.id,
        reviewId: r.id,
        textId: t.id,
        reviewer: r.reviewerId,
        stance: r.stance,
        meanScore: m,
        scores: (r.payload.scores ?? {}) as Record<string, number>,
        trainable: t.trainable,
        ...(explanation ? { explanation } : {}),
      },
    });
  }
  return out;
}

/** Every explained pick, rate or fix (the latest per reviewer, question, action and target). */
export function buildExplanations(questions: Map<string, ExportQuestion>, texts: Map<string, ExportText>, reviews: ExportReview[]): ExplanationRecord[] {
  const out: ExplanationRecord[] = [];
  for (const r of latest(reviews)) {
    if (r.action !== "pick" && r.action !== "rate" && r.action !== "fix") continue;
    const explanation = explanationOf(r.payload);
    const q = questions.get(r.questionId);
    if (!explanation || !q) continue;
    const shown = r.candidateIds.map((id) => texts.get(id)).filter((t): t is ExportText => Boolean(t));
    if (!shown.length) continue;
    const involved = [...shown];
    const rec: ExplanationRecord = {
      id: r.id,
      question_id: q.id,
      prompt: q.prompt,
      action: r.action as ExplanationRecord["action"],
      candidates: shown.map((t) => ({ text_id: t.id, body: t.body })),
      explanation,
      meta: { questionId: q.id, reviewId: r.id, reviewer: r.reviewerId, stance: r.stance, factorKeys: q.factorKeys, trainable: false },
    };
    if (r.action === "pick") {
      rec.winner = (r.payload.winner as string | null) ?? null;
      rec.meta.reasons = (r.payload.reasons as string[]) ?? [];
    } else if (r.action === "rate") {
      rec.ratings = { text_id: String(r.payload.textId), scores: (r.payload.scores ?? {}) as Record<string, number> };
    } else {
      const edited = texts.get(r.payload.textId as string);
      if (!edited) continue;
      involved.push(edited);
      rec.edited = { from_text_id: String(r.payload.fromTextId), text_id: edited.id, body: edited.body };
    }
    rec.meta.trainable = involved.every((t) => t.trainable);
    out.push(rec);
  }
  return out;
}

export function buildSft(
  questions: Map<string, ExportQuestion>,
  texts: Map<string, ExportText>,
  /** Which question each gold text was written for (from astro_candidates). */
  goldQuestion: { textId: string; questionId: string; stance: string | null }[],
): SftRecord[] {
  const out: SftRecord[] = [];
  for (const g of goldQuestion) {
    const t = texts.get(g.textId);
    const q = questions.get(g.questionId);
    if (!t || !q || (t.kind !== "own" && t.kind !== "edit")) continue;
    out.push({
      id: `${q.id}:${t.id}`,
      messages: [...user(q.prompt), ...assistant(t.body)],
      meta: { questionId: q.id, textId: t.id, kind: t.kind, tradition: t.tradition, factorKeys: q.factorKeys, trainable: t.trainable, stance: g.stance },
    });
  }
  return out;
}

// ── reasoning explorer (migrations 178, 179; src/reasoning.ts) ─────────────

export interface ReasoningExportStep {
  id: string;
  ordinal: number;
  kind: string;
  body: string;
  basedOn: number[];
  factorKeys: string[];
  statementId: string | null;
  textId: string | null;
  /** The cited statement and passage, from studio rows when imported. */
  statement: string | null;
  passage: string | null;
  /** The worker's snapshot of the citation (book, author, pages, headings, statement, excerpt). */
  source: Record<string, unknown>;
  /** From the cited text's source; null when the book isn't in the studio. */
  trainable: boolean | null;
}

export interface ReasoningExportChain {
  id: string;
  interpretationId: string;
  ordinal: number;
  sentences: number[];
  summary: string;
  model: string | null;
  promptVersion: string | null;
}

export interface ReasoningExportInterpretation {
  id: string;
  body: string;
  sentences: string[];
  factorKeys: string[];
  /** Set when it started from a deck question ("Explain my thinking", migration 181). */
  questionId?: string | null;
  /** Every passage the worker retrieved (meta.references), with its book's training clearance when imported. */
  references?: (RetrievedReference & { trainable: boolean | null })[];
}

/** One retrieved passage with the owner's mark on it: a retrieval relevance label. */
export interface RetrievalLabel {
  chunkId: string;
  docHash: string | null;
  statementOrdinal: number | null;
  book: string | null;
  author: string | null;
  pages: number[];
  headings: string[];
  /** Withheld (null) when the book is not cleared for training. */
  statement: string | null;
  excerpt: string | null;
  factors: string[];
  note: string | null;
}

export interface ReasoningExportReview {
  id: string;
  reviewerId: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ReasoningRecord {
  id: string;
  factor_keys: string[];
  body: string;
  sentences: string[];
  chains: (Omit<ReasoningExportChain, "interpretationId"> & {
    verdict: Record<string, unknown> | null;
    steps: (ReasoningExportStep & { verdict: Record<string, unknown> | null })[];
  })[];
  /** The owner's latest "closest to my reasoning" pick. */
  pick: Record<string, unknown> | null;
  /** Steps the owner says the chains missed. */
  added_steps: Record<string, unknown>[];
  /** Every review on this interpretation, oldest first. */
  history: ReasoningExportReview[];
  /**
   * Retrieval relevance labels from the owner's ref-marks (latest per passage):
   * the query is the interpretation and its factors; positives = "part of my
   * thinking", weak positives = "related", negatives = "not it". Null when
   * nothing has been marked.
   */
  retrieval: {
    query: { body: string; factor_keys: string[] };
    positives: RetrievalLabel[];
    weak_positives: RetrievalLabel[];
    negatives: RetrievalLabel[];
  } | null;
  meta: { interpretationId: string; questionId: string | null; trainable: true; withheldCitations: number };
}

const WITHHELD_SOURCE_FIELDS = ["statement", "excerpt"];

/**
 * One record per interpretation that has chains: its chains and steps (the
 * "why" trail is `basedOn`, ordinals of earlier steps), the owner's latest
 * verdict per chain and step, the latest pick, added steps and the full
 * history, and the owner's marks on the retrieved passages as retrieval labels.
 * Citations and passages from sources not cleared for training keep their ids
 * but lose their text; the owner's own interpretation and verdicts always stay.
 * Birth data and chart ids are never included.
 */
export function buildReasoning(
  interpretations: ReasoningExportInterpretation[],
  chains: ReasoningExportChain[],
  steps: Map<string, ReasoningExportStep[]>,
  reviews: ReasoningExportReview[],
): ReasoningRecord[] {
  const byInterp = new Map<string, ReasoningExportReview[]>();
  for (const r of [...reviews].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const id = r.payload.interpretationId;
    if (typeof id !== "string") continue;
    const list = byInterp.get(id) ?? [];
    list.push(r);
    byInterp.set(id, list);
  }
  const out: ReasoningRecord[] = [];
  for (const interp of interpretations) {
    const own = chains.filter((c) => c.interpretationId === interp.id).sort((a, b) => a.ordinal - b.ordinal);
    if (!own.length) continue;
    const history = byInterp.get(interp.id) ?? [];
    const latest = (action: string, key: string, id: string) =>
      [...history].reverse().find((r) => r.action === action && r.payload[key] === id)?.payload ?? null;
    let withheld = 0;
    out.push({
      id: interp.id,
      factor_keys: interp.factorKeys,
      body: interp.body,
      sentences: interp.sentences,
      chains: own.map((c) => ({
        id: c.id,
        ordinal: c.ordinal,
        sentences: c.sentences,
        summary: c.summary,
        model: c.model,
        promptVersion: c.promptVersion,
        verdict: latest("chain-verdict", "chainId", c.id),
        steps: (steps.get(c.id) ?? [])
          .slice()
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((s) => {
            if (s.trainable !== false) return { ...s, verdict: latest("step-verdict", "stepId", s.id) };
            withheld++;
            const source = { ...s.source };
            for (const f of WITHHELD_SOURCE_FIELDS) delete source[f];
            return { ...s, statement: null, passage: null, source, verdict: latest("step-verdict", "stepId", s.id) };
          }),
      })),
      pick: [...history].reverse().find((r) => r.action === "chain-pick")?.payload ?? null,
      added_steps: history.filter((r) => r.action === "step-add").map((r) => r.payload),
      history,
      retrieval: retrievalLabels(interp, history),
      meta: { interpretationId: interp.id, questionId: interp.questionId ?? null, trainable: true, withheldCitations: withheld },
    });
  }
  return out;
}

function retrievalLabels(interp: ReasoningExportInterpretation, history: ReasoningExportReview[]): ReasoningRecord["retrieval"] {
  const latest = new Map<string, Record<string, unknown>>();
  for (const r of history) {
    if (r.action !== "ref-mark" || typeof r.payload.chunkId !== "string") continue;
    latest.set(refKey(r.payload.chunkId, r.payload.statementOrdinal as number | null), r.payload);
  }
  if (!latest.size) return null;
  const refs = new Map((interp.references ?? []).map((ref) => [refKey(ref.chunkId, ref.statementOrdinal), ref]));
  const labels = { mine: [] as RetrievalLabel[], related: [] as RetrievalLabel[], not: [] as RetrievalLabel[] };
  for (const [key, p] of latest) {
    const verdict = p.verdict as keyof typeof labels;
    if (!labels[verdict]) continue;
    const ref = refs.get(key);
    const cleared = ref?.trainable !== false;
    labels[verdict].push({
      chunkId: p.chunkId as string,
      docHash: ref?.docHash ?? null,
      statementOrdinal: typeof p.statementOrdinal === "number" ? p.statementOrdinal : null,
      book: ref?.book ?? null,
      author: ref?.author ?? null,
      pages: ref?.pages ?? [],
      headings: ref?.headings ?? [],
      statement: cleared ? (ref?.statement ?? null) : null,
      excerpt: cleared ? (ref?.excerpt ?? null) : null,
      factors: ref?.factors ?? [],
      note: typeof p.note === "string" ? p.note : null,
    });
  }
  return {
    query: { body: interp.body, factor_keys: interp.factorKeys },
    positives: labels.mine,
    weak_positives: labels.related,
    negatives: labels.not,
  };
}

// ── retrieval labels from the chart explorer's ref-votes ────────────────────

export interface RefVoteExportReview {
  id: string;
  reviewerId: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** A voted passage with its book and the book's training clearance. */
export interface RefVotePassage {
  textId: string;
  passage: string | null;
  book: string | null;
  author: string | null;
  pages: number[];
  headings: string[];
  trainable: boolean;
}

export interface RefVoteLabel {
  textId: string;
  /** The claim the passage was found by, when the vote named one (context only). */
  statementId: string | null;
  book: string | null;
  author: string | null;
  pages: number[];
  headings: string[];
  /** Withheld (null) in the trainable/ variant when the book is not cleared for training. */
  passage: string | null;
  note: string | null;
  reviewer: string;
  votedAt: string;
}

export interface RetrievalRecord {
  id: string;
  /** What was being looked up: a factor key, as seen from one chart element (point:mars, aspect:…, pattern:…). */
  query: { factor_key: string; factor_label: string | null; element_id: string | null };
  /** Marked helpful. */
  positives: RefVoteLabel[];
  /** Marked not helpful. */
  negatives: RefVoteLabel[];
  meta: { trainable: boolean; withheld: number; source: "ref-vote" };
}

/**
 * One record per (factor key, explorer element) with standing ref-votes: the
 * latest vote per reviewer + passage + key, "clear" retracting. Chart ids
 * are never exported (the element id names a placement, not a person).
 *
 * `withholdUncleared`: passages from books not cleared for
 * training keep their ids, book and pages but lose their text; such records
 * still count as trainable (the labels are the owner's). Without it, records
 * carry all text and are trainable only when every book is cleared.
 */
export function buildRefVoteRetrieval(
  reviews: RefVoteExportReview[],
  passages: Map<string, RefVotePassage>,
  opts: { withholdUncleared: boolean },
): RetrievalRecord[] {
  const groups = new Map<string, RetrievalRecord>();
  for (const r of latestRefVotes(reviews, true).values()) {
    const p = r.payload;
    const st = passages.get(p.textId);
    if (!st) continue; // passage deleted since
    const elementId = p.elementId ?? null;
    const id = `${p.factorKey}|${elementId ?? ""}`;
    let rec = groups.get(id);
    if (!rec) {
      rec = {
        id,
        query: { factor_key: p.factorKey, factor_label: FACTOR_BY_KEY.get(p.factorKey)?.label ?? patternPhraseOf(p.factorKey), element_id: elementId },
        positives: [],
        negatives: [],
        meta: { trainable: true, withheld: 0, source: "ref-vote" },
      };
      groups.set(id, rec);
    }
    const hide = opts.withholdUncleared && !st.trainable;
    if (hide) rec.meta.withheld++;
    if (!opts.withholdUncleared && !st.trainable) rec.meta.trainable = false;
    const label: RefVoteLabel = {
      textId: st.textId,
      statementId: typeof p.statementId === "string" ? p.statementId : null,
      book: st.book,
      author: st.author,
      pages: st.pages,
      headings: st.headings,
      passage: hide ? null : st.passage,
      note: typeof p.note === "string" ? p.note : null,
      reviewer: r.reviewerId,
      votedAt: r.createdAt,
    };
    (p.verdict === "helpful" ? rec.positives : rec.negatives).push(label);
  }
  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}

// ── "Check AI claims" (src/claims.ts): supervision for the extraction step ──

export interface ClaimExportStatement {
  id: string;
  ordinal: number;
  body: string;
  factorKeys: { key: string; role: string }[];
  conditionKeys: string[];
  condition: string | null;
  valence: string | null;
  certainty: string | null;
  register: string | null;
  frame: Record<string, unknown>;
  lifeArea: number | null;
  because: string | null;
}

export interface ClaimExportPassage {
  textId: string;
  body: string;
  headings: string[];
  pages: number[];
  book: string | null;
  author: string | null;
  docHash: string | null;
  /** The book is cleared for training. */
  trainable: boolean;
  statements: ClaimExportStatement[];
}

export interface ClaimExportReview {
  id: string;
  reviewerId: string;
  action: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ClaimRecord {
  id: string;
  /** null when withheld (book not cleared for training, trainable/ file). */
  passage: string | null;
  headings: string[];
  pages: number[];
  book: string | null;
  author: string | null;
  claims: (Omit<ClaimExportStatement, "body" | "condition" | "because"> & {
    body: string | null;
    condition: string | null;
    because: string | null;
    /** The owner's latest claim-verdict ({verdict, fixes, tagsAdd, tagsRemove, condition, note}), or null if unjudged. */
    verdict: Record<string, unknown> | null;
    /** The claim's keys (factor and condition) after the owner's tag fixes. */
    corrected_keys: string[];
  })[];
  /** Claims the owner says the AI missed, in his words (never withheld). */
  added_claims: { body: string; factorKeys: string[]; note: string | null }[];
  /** Every claim review on this passage, oldest first. */
  history: ClaimExportReview[];
  meta: { textId: string; docHash: string | null; trainable: boolean; withheld: boolean };
}

/**
 * One record per passage the owner judged (a claim-verdict or claim-add; a
 * skip alone is not a label): the passage and its heading path, every AI
 * claim with its latest verdict and the keys after his fixes, and the claims
 * he added. With withholdUncleared, passages from books not cleared for
 * training keep their ids, headings and the owner's verdicts and added
 * claims, but lose the passage and the AI's paraphrases of it.
 */
export function buildClaims(passages: ClaimExportPassage[], reviews: ClaimExportReview[], opts: { withholdUncleared: boolean }): ClaimRecord[] {
  const byText = new Map<string, ClaimExportReview[]>();
  for (const r of [...reviews].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const id = r.payload.textId;
    if (typeof id !== "string") continue;
    byText.set(id, [...(byText.get(id) ?? []), r]);
  }
  const out: ClaimRecord[] = [];
  for (const p of [...passages].sort((a, b) => a.textId.localeCompare(b.textId))) {
    const history = byText.get(p.textId) ?? [];
    if (!history.some((r) => r.action === "claim-verdict" || r.action === "claim-add")) continue;
    const latest = latestClaimVerdicts(history);
    const withheld = opts.withholdUncleared && !p.trainable;
    out.push({
      id: p.textId,
      passage: withheld ? null : p.body,
      headings: p.headings,
      pages: p.pages,
      book: p.book,
      author: p.author,
      claims: [...p.statements]
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((s) => {
          const verdict = latest.get(s.id)?.payload ?? null;
          const remove = new Set(Array.isArray(verdict?.tagsRemove) ? (verdict.tagsRemove as string[]) : []);
          const add = Array.isArray(verdict?.tagsAdd) ? (verdict.tagsAdd as string[]) : [];
          const keys = [...s.factorKeys.map((f) => f.key), ...s.conditionKeys].filter((k) => !remove.has(k));
          return {
            ...s,
            body: withheld ? null : s.body,
            condition: withheld ? null : s.condition,
            because: withheld ? null : s.because,
            verdict,
            corrected_keys: [...new Set([...keys, ...add])],
          };
        }),
      added_claims: history
        .filter((r) => r.action === "claim-add")
        .map((r) => ({
          body: String(r.payload.body ?? ""),
          factorKeys: Array.isArray(r.payload.factorKeys) ? (r.payload.factorKeys as string[]) : [],
          note: typeof r.payload.note === "string" ? r.payload.note : null,
        })),
      history,
      meta: { textId: p.textId, docHash: p.docHash, trainable: p.trainable, withheld },
    });
  }
  return out;
}

// ── "Sort the vocabulary" (src/vocab.ts): concept kinds and the thesaurus ───

export interface VocabExportCard {
  id: string;
  norm: string;
  term: string;
  also: string[];
  kindHint: string | null;
  groupHint: string | null;
  books: number;
  uses: number;
}

export interface VocabRecord {
  id: string;
  term: string;
  norm: string;
  also: string[];
  kind_hint: string | null;
  group_hint: string | null;
  books: number;
  uses: number;
  /** The owner's latest standing decision: group | not-a-term | skip, or null if unsorted. */
  decision: string | null;
  /** Every group the card is in, after renames and merges (a synonym also has all of its main card's). */
  groups: string[];
  /** groups[0], kept for readers of the single-group format. */
  group: string | null;
  preferred: string | null;
  /** The label to use: the preferred one, else the term. */
  label: string;
  /** For a synonym: the main card at the end of the "same as" chain, by its label. */
  same_as: { id: string; label: string } | null;
  note: string | null;
  /** The owner's standing ratings of the card's example sentences. */
  example_ratings: { example: number; text: string; book: string | null; rating: string; note: string | null }[];
  /** "owner" for a term he added himself (vocab-add), else "generated". */
  source: "owner" | "generated";
  /** An added term he took back (undo) whose card had to stay; ignore it. */
  withdrawn: boolean;
  /** For an owner-added term: the card (and example sentence) it was added from. */
  added_from: { cardId: string; term: string | null; example: number | null } | null;
  meta: { cardId: string; trainable: true };
}

export interface VocabGroupRecord {
  name: string;
  /** The group it is nested under, if any; `path` runs from the top group down to this one. */
  parent: string | null;
  path: string[];
  cards: number;
  /** Labels of the group's main cards (synonyms are folded into them). */
  terms: string[];
}

/**
 * One record per card with the owner's decision replayed (src/vocab-rules.ts:
 * latest vocab-sort per card, vocab-group renames in order, undone reviews
 * skipped), and the group list. Cards and decisions carry no book text, so
 * every record is trainable. Reviews are replayed together: the studio has
 * one owner sorting.
 */
export function buildVocab(cards: VocabExportCard[], reviews: VocabReviewRow[]): { records: VocabRecord[]; groups: VocabGroupRecord[] } {
  const state = replayVocab(reviews);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const labelOf = (id: string) => state.decisions.get(id)?.preferred ?? byId.get(id)?.term ?? id;
  const addedBy = new Map(state.added.map((a) => [a.cardId, a]));
  const records = [...cards]
    .sort((a, b) => a.norm.localeCompare(b.norm))
    .map((c): VocabRecord => {
      const d = state.decisions.get(c.id);
      return {
        id: c.id,
        term: c.term,
        norm: c.norm,
        also: c.also,
        kind_hint: c.kindHint,
        group_hint: c.groupHint,
        books: c.books,
        uses: c.uses,
        decision: d?.verdict ?? null,
        groups: d?.groups ?? [],
        group: d?.group ?? null,
        preferred: d?.preferred ?? null,
        label: d?.preferred ?? c.term,
        same_as: d && d.mainId !== c.id ? { id: d.mainId, label: labelOf(d.mainId) } : null,
        note: d?.note ?? null,
        example_ratings: [...(state.examples.get(c.id)?.values() ?? [])]
          .sort((a, b) => a.example - b.example)
          .map((e) => ({ example: e.example, text: e.text, book: e.book, rating: e.rating, note: e.note })),
        source: addedBy.has(c.id) || state.withdrawn.has(c.id) ? "owner" : "generated",
        withdrawn: state.withdrawn.has(c.id),
        added_from: (() => {
          const a = addedBy.get(c.id);
          return a?.fromCardId ? { cardId: a.fromCardId, term: byId.get(a.fromCardId)?.term ?? null, example: a.fromExample } : null;
        })(),
        meta: { cardId: c.id, trainable: true },
      };
    });
  const pathOf = (name: string): string[] => {
    const out = [name];
    for (let p = state.parents.get(name); p !== undefined && !out.includes(p); p = state.parents.get(p)) out.unshift(p);
    return out;
  };
  const groups = state.groups.map((g) => ({
    name: g.name,
    parent: state.parents.get(g.name) ?? null,
    path: pathOf(g.name),
    cards: g.cards,
    terms: records
      .filter((r) => r.groups.includes(g.name) && !r.same_as)
      .sort((a, b) => b.books - a.books || a.label.localeCompare(b.label))
      .map((r) => r.label),
  }));
  return { records, groups };
}

// ── "Foundations" (src/foundations.ts): the rulebook entry of each basic idea ──

export interface FoundationsExportLesson {
  lesson: string;
  title: string;
  version: string | null;
  concepts: { id: string; label: string }[];
}

export interface FoundationsExportCatalogue {
  slug: string;
  book: string;
  author: string | null;
  terms: (CatalogueTerm & { id: string; stale?: boolean })[];
}

const exportTrait = (t: TraitEntry) => ({ text: t.text, facet: t.facet, degree: t.degree, books: t.books, uses: t.uses, synonyms: t.synonyms.map((s) => s.text), yours: t.yours, note: t.note });

/**
 * foundations.json: per lesson and concept, what the owner confirmed — his
 * definition, core and fitting traits (merged synonyms under their head
 * trait), rejected traits, apt images, passages by verdict with their
 * citation and the reading that stands (his correction of role / mode when he
 * made one), and what he added himself — then each book's term catalogue as
 * he left it. Decisions are replayed together (src/foundations-rules.ts):
 * the studio has one owner reviewing. `withholdQuotes` leaves out the books'
 * own words (passages, image and term quotes) and keeps the citations, for
 * the trainable/ copy.
 */
export function buildFoundations(
  lessons: FoundationsExportLesson[],
  items: FoundationItem[],
  catalogues: FoundationsExportCatalogue[],
  reviews: FoundationReviewRow[],
  opts: { withholdQuotes: boolean },
) {
  const state = replayFoundations(reviews);
  const quote = (text: string | null) => (opts.withholdQuotes ? null : text);
  const passage = (p: PassageEntry) => ({
    id: p.id,
    text: quote(p.text),
    ...(opts.withholdQuotes ? { withheld: true } : {}),
    citation: p.citation,
    role: p.role,
    mode: p.mode,
    model_role: p.modelRole,
    model_mode: p.modelMode,
    corrected: p.corrected,
    note: p.note,
  });
  const image = (i: ImageEntry) => ({
    text: i.yours ? i.text : (quote(i.text) ?? i.text),
    meaning: i.meaning,
    model_meaning: i.modelMeaning,
    yours: i.yours,
    note: i.note,
    books: i.books,
    citation: i.citation,
    quote: quote(i.quote),
  });
  return {
    lessons: lessons.map((l) => ({
      lesson: l.lesson,
      title: l.title,
      version: l.version,
      concepts: l.concepts.map((c) => {
        const e = buildConceptEntry(l.lesson, c.id, items, state);
        return {
          concept: c.id,
          label: c.label,
          definition: e.definition,
          core_traits: e.traits.core.map(exportTrait),
          fits_traits: e.traits.fits.map(exportTrait),
          rejected_traits: e.traits.rejected.map(exportTrait),
          apt_images: e.images.apt.map(image),
          rejected_images: e.images.notApt.map(image),
          good_passages: e.passages.good.map(passage),
          fine_passages: e.passages.fine.map(passage),
          misread_passages: e.passages.misread.map(passage),
          corrected_passages: e.passages.correctedOnly.map(passage),
          figurative_counts: e.figurative.counts.map(passage),
          figurative_only: e.figurative.figure.map(passage),
          notes: e.notes.map((n) => n.text),
          additions: e.additions.map((a) => ({ kind: a.kind, text: a.text, meaning: a.meaning, verdict: a.verdict })),
          progress: e.progress,
        };
      }),
    })),
    term_catalogues: catalogues.map((c) => {
      const terms = c.terms.map((t) => buildTermEntry(t, state)).filter((t) => t.verdict || t.note || t.droppedKeywords.length || t.droppedSecondary.length || t.addedKeywords.length);
      return {
        slug: c.slug,
        book: c.book,
        author: c.author,
        total: c.terms.length,
        reviewed: terms.filter((t) => t.verdict).length,
        terms: terms.map((t) => ({
          term: t.term,
          group: t.group,
          facet: t.facet,
          code: t.code,
          verdict: t.verdict,
          verdict_note: t.verdictNote,
          note: t.note,
          keywords: t.keywords,
          added_keywords: t.addedKeywords,
          dropped_keywords: [...t.droppedKeywords, ...t.droppedSecondary],
          secondary: t.secondary,
          definition: t.definition,
          how_to_weigh: t.howToWeigh,
          figure: t.figure,
          related: t.related,
          pages: t.pages,
          book_pages: t.bookPages,
          quote: quote(t.quote),
        })),
      };
    }),
  };
}

export { buildCorrespondencesExport } from "./foundations-rules";
