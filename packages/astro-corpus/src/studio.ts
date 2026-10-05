/**
 * The review studio's data layer: the queue, candidates, and recording a
 * review. Server only (shared postgres client). Called from Elastrocal's
 * /hub/studio pages and actions, which resolve the reviewer from the session.
 *
 * Reviews are append-only. A Fix or a Write also creates a text (kind 'edit'
 * or 'own') tagged with the question's factors, so gold texts accumulate per
 * factor as a side effect of reviewing.
 */

import { db } from "@elkdonis/db";
import { engineText, ENGINE_SOURCE_SLUG, ENGINE_TRADITION } from "./engine";
import { EVAL_SET } from "./eval-set";
import { cleanExplanation, ExplanationError } from "./explanation";
import { FACTOR_BY_KEY } from "./factors";
import { CLAIM_ACTIONS } from "./claims-rules";
import { VOCAB_ACTIONS } from "./vocab-rules";
import { isReasoningAction, REASONING_ACTIONS, REF_VOTE_ACTION, ReasoningError, recordReasoningReview } from "./reasoning";
import { ORG_ID, upsertSource } from "./sources";

export const OWN_SOURCE_SLUG = "own:elastrocal";

/** Actions on a deck question (astro_reviews.question_id set). */
export const QUESTION_REVIEW_ACTIONS = ["pick", "rate", "fix", "write", "tag", "skip", "flag"] as const;
/**
 * Every action astro_reviews holds: the deck's, plus the reasoning explorer's and the chart
 * explorer's ref-vote and "Check AI claims" (all question_id NULL; src/reasoning.ts, src/ref-votes.ts,
 * src/claims.ts, src/vocab.ts).
 */
export const REVIEW_ACTIONS = [...QUESTION_REVIEW_ACTIONS, ...REASONING_ACTIONS, REF_VOTE_ACTION, ...CLAIM_ACTIONS, ...VOCAB_ACTIONS] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

/** Filters offered on the deck. `general` = questions with no factor tag. */
export const DECK_KINDS = [
  "all",
  "curated",
  "sign",
  "house",
  "aspect",
  "planet",
  "zodiac",
  "realm",
  "aspect-type",
  "transit",
  "transit-house",
  "transit-sign",
  "compat",
  "general",
] as const;

/**
 * How often the deck draws from each pool: the curated sets (origin
 * 'curated') three times for every one imported question (decision,
 * 2026-09-26). When a pool is empty the other is used. Questions with AI
 * drafts come before both (see nextQuestionId).
 */
export const QUEUE_MIX = { curated: 3, other: 1 } as const;
export type DeckKind = (typeof DECK_KINDS)[number];

/**
 * What the deck serves. `judge` (the default): questions with AI-drafted
 * candidates (text kind 'generated') first, then the curated/other mix.
 * `test`: only the fixed test set, answered blind — asked for explicitly.
 */
export const DECK_MODES = ["judge", "test"] as const;
export type DeckMode = (typeof DECK_MODES)[number];

/** Text kind of the AI-drafted candidate answers (scripts/import-generated.ts). */
export const GENERATED_KIND = "generated";

export const FLAG_REASONS = ["wrong-tags", "impossible", "duplicate", "not-astrology", "source-bound", "unclear"] as const;
export { PICK_REASONS, EXPLANATION_ABOUT, EXPLANATION_SEVERITY, EXPLANATION_MAX, QUOTE_MAX, type Explanation } from "./explanation";
export const TRADITIONS = ["modern", "psychological", "rosicrucian", "hellenistic", "medieval", "vedic", "evolutionary"] as const;

export interface DeckCandidate {
  id: string;
  body: string;
  kind: string;
  tradition: string | null;
  sourceTitle: string;
  sourceKind: string;
}

export interface DeckItem {
  question: {
    id: string;
    type: string;
    prompt: string;
    original: string | null;
    tradition: string | null;
    factorKeys: string[];
    factorLabels: string[];
    sourceTitle: string | null;
    /** In the fixed test set: answer it yourself; it is kept out of training. */
    isTest: boolean;
  };
  candidates: DeckCandidate[];
  /** Gold texts already written for the question's factors, for reference. */
  gold: { id: string; body: string; kind: string; tradition: string | null }[];
}

let ownSource: string | null = null;
let engineSource: string | null = null;

async function ownSourceId() {
  ownSource ??= await upsertSource({
    slug: OWN_SOURCE_SLUG,
    title: "Studio writing",
    kind: "own",
    licence: "owner",
    trainable: true,
    notes: "Texts written or edited by Elastrocal owners in the review studio.",
    importer: "astro-corpus/studio.ts",
  });
  return ownSource;
}

async function engineSourceId() {
  engineSource ??= await upsertSource({
    slug: ENGINE_SOURCE_SLUG,
    title: "Keyword engine (Rosicrucian)",
    author: "@elkdonis/astro/keywords, after the Rosicrucian Fellowship's Astrological Keyword System",
    kind: "engine",
    licence: "unknown",
    trainable: false,
    notes: "Deterministic readings from the keyword lexicon. The lexicon transcribes a published book; licence not cleared.",
    importer: "astro-corpus/studio.ts",
  });
  return engineSource;
}

/**
 * The next question for a reviewer: open, not yet reviewed by them, not about
 * an impossible factor; highest priority first, then factors with the fewest
 * gold texts, then at random so a session does not march through one planet.
 *
 * The owner judges the AI's drafts first (decision, 2026-10-01): questions
 * with a 'generated' candidate come before everything else. The blind test
 * set is served only in mode 'test', where the kind filter does not apply.
 */
export async function nextQuestionId(reviewerId: string, kind: DeckKind = "all", mode: DeckMode = "judge"): Promise<string | null> {
  if (mode === "test") return pickFrom(reviewerId, "all", "test");
  const drafted = await pickFrom(reviewerId, kind, "drafted");
  if (drafted) return drafted;
  if (kind === "curated") return pickFrom(reviewerId, kind, "curated");
  const curatedFirst = Math.random() < QUEUE_MIX.curated / (QUEUE_MIX.curated + QUEUE_MIX.other);
  const order: ("curated" | "other")[] = curatedFirst ? ["curated", "other"] : ["other", "curated"];
  for (const pool of order) {
    const id = await pickFrom(reviewerId, kind, pool);
    if (id) return id;
  }
  return null;
}

/** Questions with at least one AI-drafted candidate. */
const hasDraft = () =>
  db`EXISTS (SELECT 1 FROM astro_candidates c JOIN astro_texts t ON t.id = c.text_id WHERE c.question_id = q.id AND t.kind = ${GENERATED_KIND})`;

async function pickFrom(reviewerId: string, kind: DeckKind, pool: "drafted" | "curated" | "other" | "test"): Promise<string | null> {
  const kindFilter =
    kind === "all"
      ? db``
      : kind === "curated"
        ? db`AND q.origin = 'curated'`
        : kind === "general"
          ? db`AND cardinality(q.factor_keys) = 0`
          : db`AND EXISTS (SELECT 1 FROM unnest(q.factor_keys) k WHERE split_part(k, ':', 1) = ${kind})`;
  const poolFilter =
    pool === "test"
      ? db`AND q.meta->>'evalSet' = ${EVAL_SET}`
      : pool === "drafted"
        ? db`AND q.meta->>'evalSet' IS NULL AND ${hasDraft()}`
        : pool === "curated"
          ? db`AND q.origin = 'curated' AND q.meta->>'evalSet' IS NULL`
          : db`AND q.origin <> 'curated' AND q.meta->>'evalSet' IS NULL`;
  const [row] = await db<{ id: string }[]>`
    SELECT q.id
    FROM astro_questions q
    WHERE q.org_id = ${ORG_ID}
      AND q.status = 'open'
      AND NOT EXISTS (SELECT 1 FROM astro_reviews r WHERE r.question_id = q.id AND r.reviewer_id = ${reviewerId})
      AND NOT EXISTS (SELECT 1 FROM astro_factors f WHERE f.impossible AND f.key = ANY (q.factor_keys))
      ${kindFilter}
      ${poolFilter}
    ORDER BY q.priority DESC,
      (SELECT count(*) FROM astro_text_factors tf JOIN astro_texts t ON t.id = tf.text_id
        WHERE t.kind IN ('own', 'edit') AND tf.factor_key = ANY (q.factor_keys)) ASC,
      random()
    LIMIT 1
  `;
  return row?.id ?? null;
}

/** Make sure the keyword engine's reading is among the candidates, where it has one. */
async function ensureEngineCandidate(questionId: string, factorKeys: string[]) {
  if (factorKeys.length !== 1) return;
  const body = engineText(factorKeys[0]);
  if (!body) return;
  const sourceId = await engineSourceId();
  const [t] = await db<{ id: string }[]>`
    INSERT INTO astro_texts (org_id, source_id, source_ref, kind, tradition, body)
    VALUES (${ORG_ID}, ${sourceId}, ${factorKeys[0]}, 'engine', ${ENGINE_TRADITION}, ${body})
    ON CONFLICT (source_id, source_ref) DO UPDATE SET body = EXCLUDED.body
    RETURNING id
  `;
  await db`
    INSERT INTO astro_text_factors (text_id, factor_key, role, confidence)
    VALUES (${t.id}, ${factorKeys[0]}, 'primary', 'explicit') ON CONFLICT DO NOTHING
  `;
  await db`INSERT INTO astro_candidates (question_id, text_id) VALUES (${questionId}, ${t.id}) ON CONFLICT DO NOTHING`;
}

export async function loadDeckItem(questionId: string): Promise<DeckItem | null> {
  const [q] = await db<
    { id: string; type: string; prompt: string; original: string | null; tradition: string | null; factor_keys: string[]; source_title: string | null; is_test: boolean }[]
  >`
    SELECT q.id, q.type, q.prompt, q.original, q.tradition, q.factor_keys, s.title AS source_title,
      COALESCE(q.meta->>'evalSet' = ${EVAL_SET}, false) AS is_test
    FROM astro_questions q LEFT JOIN astro_sources s ON s.id = q.source_id
    WHERE q.id = ${questionId} AND q.org_id = ${ORG_ID}
  `;
  if (!q) return null;
  // A test question is answered blind: no candidates, no engine reading, no
  // earlier gold, so the reference answer is the reviewer's own.
  if (!q.is_test) await ensureEngineCandidate(q.id, q.factor_keys);

  const candidates = q.is_test ? [] : await db<DeckCandidate[]>`
    SELECT t.id, t.body, t.kind, t.tradition, s.title AS "sourceTitle", s.kind AS "sourceKind"
    FROM astro_candidates c
    JOIN astro_texts t ON t.id = c.text_id
    JOIN astro_sources s ON s.id = t.source_id
    WHERE c.question_id = ${q.id}
    ORDER BY c.added_at
  `;
  const gold = q.factor_keys.length && !q.is_test
    ? await db<{ id: string; body: string; kind: string; tradition: string | null }[]>`
        SELECT DISTINCT ON (t.id) t.id, t.body, t.kind, t.tradition
        FROM astro_text_factors tf JOIN astro_texts t ON t.id = tf.text_id
        WHERE t.kind IN ('own', 'edit') AND tf.factor_key = ANY (${q.factor_keys})
        ORDER BY t.id, t.created_at DESC
        LIMIT 5
      `
    : [];

  return {
    question: {
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      original: q.original,
      tradition: q.tradition,
      factorKeys: q.factor_keys,
      factorLabels: q.factor_keys.map((k) => FACTOR_BY_KEY.get(k)?.label ?? k),
      sourceTitle: q.source_title,
      isTest: q.is_test,
    },
    candidates,
    gold,
  };
}

export interface ReviewInput {
  reviewerId: string;
  /** null for the reasoning explorer's actions, which name their ids in the payload. */
  questionId: string | null;
  action: ReviewAction;
  candidateIds: string[];
  shownOrder: string[];
  stance: "preference" | "claim" | null;
  seconds: number | null;
  device: string | null;
  /**
   * pick:  { winner: textId | null (a tie), reasons: string[] }
   * rate:  { textId, scores: { faithful, specific, usable } } (1–5)
   * fix:   { fromTextId, body, tradition }
   * write: { body, tradition }
   * tag:   { add: string[], remove: string[] }
   * flag:  { reason, note? }
   * skip:  {}
   * pick, rate and fix may also carry `explanation` (src/explanation.ts).
   * chain-pick, chain-verdict, step-verdict, step-add, ref-mark: see src/reasoning-rules.ts.
   */
  payload: Record<string, unknown>;
}

export class ReviewError extends Error {}

/** Record one review. Returns the id of a text it created, if any. */
export async function recordReview(r: ReviewInput): Promise<{ reviewId: string; textId: string | null }> {
  if (isReasoningAction(r.action)) {
    try {
      const { reviewId } = await recordReasoningReview({ reviewerId: r.reviewerId, action: r.action, payload: r.payload, seconds: r.seconds, device: r.device });
      return { reviewId, textId: null };
    } catch (e) {
      if (e instanceof ReasoningError) throw new ReviewError(e.message);
      throw e;
    }
  }
  if (!r.questionId) throw new ReviewError("Question not found");
  const [q] = await db<{ id: string; factor_keys: string[] }[]>`
    SELECT id, factor_keys FROM astro_questions WHERE id = ${r.questionId} AND org_id = ${ORG_ID}
  `;
  if (!q) throw new ReviewError("Question not found");

  const candidateRows = await db<{ text_id: string }[]>`SELECT text_id FROM astro_candidates WHERE question_id = ${q.id}`;
  const onQuestion = new Set(candidateRows.map((c) => c.text_id));
  const mustBeCandidate = (id: unknown) => {
    if (typeof id !== "string" || !onQuestion.has(id)) throw new ReviewError("That text is not a candidate for this question");
    return id;
  };
  for (const id of [...r.candidateIds, ...r.shownOrder]) mustBeCandidate(id);

  const payload = { ...r.payload };
  let textId: string | null = null;

  // Checked before anything is written, so a bad explanation leaves no text behind.
  if (payload.explanation !== undefined) {
    const quote = (payload.explanation as { quote?: unknown } | null)?.quote;
    const shown = r.shownOrder.length ? r.shownOrder : r.candidateIds;
    const bodies =
      typeof quote === "string" && quote.trim() && shown.length
        ? (await db<{ body: string }[]>`SELECT body FROM astro_texts WHERE id = ANY (${shown})`).map((t) => t.body)
        : [];
    try {
      const explanation = cleanExplanation(payload.explanation, r.action, bodies);
      if (explanation) payload.explanation = explanation;
      else delete payload.explanation;
    } catch (e) {
      if (e instanceof ExplanationError) throw new ReviewError(e.message);
      throw e;
    }
  }

  const saveText = async (kind: "edit" | "own", body: string, tradition: string | null, derivedFrom: string | null) => {
    const clean = body.trim();
    if (clean.length < 10) throw new ReviewError("The text is too short");
    const sourceId = await ownSourceId();
    const [t] = await db<{ id: string }[]>`
      INSERT INTO astro_texts (org_id, source_id, kind, tradition, body, derived_from, created_by)
      VALUES (${ORG_ID}, ${sourceId}, ${kind}, ${tradition}, ${clean}, ${derivedFrom}, ${r.reviewerId})
      RETURNING id
    `;
    for (const key of q.factor_keys) {
      await db`
        INSERT INTO astro_text_factors (text_id, factor_key, role, confidence)
        VALUES (${t.id}, ${key}, 'primary', 'human') ON CONFLICT DO NOTHING
      `;
    }
    await db`INSERT INTO astro_candidates (question_id, text_id) VALUES (${q.id}, ${t.id}) ON CONFLICT DO NOTHING`;
    return t.id;
  };

  switch (r.action) {
    case "pick": {
      if (payload.winner !== null) mustBeCandidate(payload.winner);
      if (r.candidateIds.length < 2) throw new ReviewError("A pick needs two candidates");
      break;
    }
    case "rate": {
      mustBeCandidate(payload.textId);
      break;
    }
    case "fix": {
      const from = mustBeCandidate(payload.fromTextId);
      textId = await saveText("edit", String(payload.body ?? ""), (payload.tradition as string) ?? null, from);
      payload.textId = textId;
      delete payload.body;
      break;
    }
    case "write": {
      textId = await saveText("own", String(payload.body ?? ""), (payload.tradition as string) ?? null, null);
      payload.textId = textId;
      delete payload.body;
      break;
    }
    case "tag": {
      const add = ((payload.add as string[]) ?? []).filter((k) => FACTOR_BY_KEY.has(k));
      const remove = new Set((payload.remove as string[]) ?? []);
      const keys = [...new Set([...q.factor_keys.filter((k) => !remove.has(k)), ...add])];
      await db`UPDATE astro_questions SET factor_keys = ${keys} WHERE id = ${q.id} AND org_id = ${ORG_ID}`;
      payload.before = q.factor_keys;
      payload.after = keys;
      break;
    }
    case "flag": {
      await db`UPDATE astro_questions SET status = 'flagged' WHERE id = ${q.id} AND org_id = ${ORG_ID}`;
      break;
    }
    case "skip":
      break;
    default:
      throw new ReviewError("Unknown action");
  }

  const [rev] = await db<{ id: string }[]>`
    INSERT INTO astro_reviews (org_id, question_id, reviewer_id, action, payload, candidate_ids, shown_order, stance, seconds, device)
    VALUES (${ORG_ID}, ${q.id}, ${r.reviewerId}, ${r.action}, ${db.json(payload as never)}, ${r.candidateIds}, ${r.shownOrder},
            ${r.stance}, ${r.seconds}, ${r.device})
    RETURNING id
  `;
  return { reviewId: rev.id, textId };
}

export interface StudioStats {
  /** Test set: questions in it, and how many this reviewer has answered (write or fix). */
  test: { total: number; answered: number };
  /** Questions (outside the test set) with AI-drafted candidates: all, and those still open for this reviewer. */
  drafted: { total: number; waiting: number };
  queue: { kind: string; open: number }[];
  byOrigin: { origin: string; open: number }[];
  mine: { action: string; n: number }[];
  today: number;
  coverage: { kind: string; factors: number; with_gold: number; with_question: number }[];
  sources: { title: string; kind: string; licence: string; trainable: boolean; texts: number }[];
}

export async function studioStats(reviewerId: string): Promise<StudioStats> {
  const [test, drafted, queue, byOrigin, mine, today, coverage, sources] = await Promise.all([
    db<{ total: number; answered: number }[]>`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM astro_reviews r
          WHERE r.question_id = q.id AND r.reviewer_id = ${reviewerId} AND r.action IN ('write', 'fix')))::int AS answered
      FROM astro_questions q
      WHERE q.org_id = ${ORG_ID} AND q.meta->>'evalSet' = ${EVAL_SET}
    `,
    db<{ total: number; waiting: number }[]>`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE q.status = 'open'
          AND NOT EXISTS (SELECT 1 FROM astro_reviews r WHERE r.question_id = q.id AND r.reviewer_id = ${reviewerId})
          AND NOT EXISTS (SELECT 1 FROM astro_factors f WHERE f.impossible AND f.key = ANY (q.factor_keys)))::int AS waiting
      FROM astro_questions q
      WHERE q.org_id = ${ORG_ID} AND q.meta->>'evalSet' IS NULL AND ${hasDraft()}
    `,
    db<{ kind: string; open: number }[]>`
      SELECT COALESCE(split_part(q.factor_keys[1], ':', 1), 'general') AS kind, count(*)::int AS open
      FROM astro_questions q
      WHERE q.org_id = ${ORG_ID} AND q.status = 'open'
        AND NOT EXISTS (SELECT 1 FROM astro_reviews r WHERE r.question_id = q.id AND r.reviewer_id = ${reviewerId})
      GROUP BY 1 ORDER BY 2 DESC
    `,
    db<{ origin: string; open: number }[]>`
      SELECT q.origin, count(*)::int AS open
      FROM astro_questions q
      WHERE q.org_id = ${ORG_ID} AND q.status = 'open'
        AND NOT EXISTS (SELECT 1 FROM astro_reviews r WHERE r.question_id = q.id AND r.reviewer_id = ${reviewerId})
      GROUP BY 1 ORDER BY 2 DESC
    `,
    db<{ action: string; n: number }[]>`
      SELECT action, count(*)::int AS n FROM astro_reviews
      WHERE reviewer_id = ${reviewerId} AND org_id = ${ORG_ID}
      GROUP BY action ORDER BY n DESC
    `,
    db<{ n: number }[]>`
      SELECT count(*)::int AS n FROM astro_reviews
      WHERE reviewer_id = ${reviewerId} AND org_id = ${ORG_ID} AND created_at > now() - interval '24 hours'
    `,
    db<{ kind: string; factors: number; with_gold: number; with_question: number }[]>`
      SELECT f.kind, count(*)::int AS factors,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM astro_text_factors tf JOIN astro_texts t ON t.id = tf.text_id
          WHERE tf.factor_key = f.key AND t.kind IN ('own', 'edit')))::int AS with_gold,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM astro_questions q WHERE f.key = ANY (q.factor_keys)))::int AS with_question
      FROM astro_factors f WHERE NOT f.impossible
      GROUP BY f.kind ORDER BY f.kind
    `,
    db<{ title: string; kind: string; licence: string; trainable: boolean; texts: number }[]>`
      SELECT s.title, s.kind, s.licence, s.trainable, count(t.id)::int AS texts
      FROM astro_sources s LEFT JOIN astro_texts t ON t.source_id = s.id
      WHERE s.org_id = ${ORG_ID}
      GROUP BY s.id ORDER BY texts DESC
    `,
  ]);
  return { test: test[0] ?? { total: 0, answered: 0 }, drafted: drafted[0] ?? { total: 0, waiting: 0 }, queue, byOrigin, mine, today: today[0]?.n ?? 0, coverage, sources };
}
