/**
 * The reasoning explorer (migrations 178, 179): an owner writes an
 * interpretation of one of their charts; a worker (Claude via the owner's
 * subscription, on the pipeline machine, scripts/reasoning-jobs.ts) proposes
 * alternative chains of reasoning that would lead to it. Each chain is a list
 * of steps — observe a chart factor, cite a statement or passage, infer,
 * conclude — and every step names the earlier steps it rests on (`based_on`),
 * so any conclusion can be traced back to its evidence.
 *
 * The owner's judgements are astro_reviews rows with question_id NULL and the
 * ids in the payload (actions in REASONING_ACTIONS), so they join the same
 * append-only history and export as the deck's reviews.
 *
 * An interpretation can also start from a deck question ("Explain my
 * thinking", migration 181): chart_id is NULL, question_id names the question
 * and factor_keys are the question's. The worker keeps every passage it
 * retrieved in meta.references; the owner marks them (ref-mark) as part of his
 * thinking, related, or not it.
 */

import { db } from "@elkdonis/db";
import type { ChartResult, HouseSystemCode } from "@elkdonis/astro";
import { calculateChart, ENGINE_VERSION } from "@elkdonis/astro/server";
import { EVAL_SET } from "./eval-set";
import { FACTOR_BY_KEY, factorsOf } from "./factors";
import { ORG_ID } from "./sources";

import {
  cleanReasoningPayload,
  cleanReferences,
  EXCERPT_CHARS,
  INTERPRETATION_MAX,
  INTERPRETATION_MIN,
  isReasoningAction,
  ReasoningError,
  refKey,
  splitSentences,
  type ReasoningAction,
  type RetrievedReference,
} from "./reasoning-rules";

export * from "./reasoning-rules";

/** Check that the ids in a cleaned payload belong together, then store the review. */
export async function recordReasoningReview(r: {
  reviewerId: string;
  action: ReasoningAction;
  payload: Record<string, unknown>;
  seconds: number | null;
  device: string | null;
}): Promise<{ reviewId: string }> {
  const payload = cleanReasoningPayload(r.action, r.payload);
  const [interp] = await db<{ id: string; meta: Record<string, unknown> | null }[]>`
    SELECT id, meta FROM astro_interpretations WHERE id = ${payload.interpretationId as string} AND org_id = ${ORG_ID}
  `;
  if (!interp) throw new ReasoningError("Interpretation not found");
  if (r.action === "ref-mark") {
    const key = refKey(payload.chunkId as string, payload.statementOrdinal as number | null);
    if (!cleanReferences(interp.meta?.references).some((ref) => refKey(ref.chunkId, ref.statementOrdinal) === key))
      throw new ReasoningError("That passage is not among the ones the AI looked at");
  }
  if (payload.chainId) {
    const [c] = await db<{ id: string }[]>`
      SELECT id FROM astro_reasoning_chains WHERE id = ${payload.chainId as string} AND interpretation_id = ${interp.id}
    `;
    if (!c) throw new ReasoningError("That chain is not part of this interpretation");
  }
  for (const key of ["stepId", "afterStepId"] as const) {
    if (!payload[key]) continue;
    const [s] = await db<{ id: string }[]>`
      SELECT id FROM astro_reasoning_steps WHERE id = ${payload[key] as string} AND chain_id = ${payload.chainId as string}
    `;
    if (!s) throw new ReasoningError("That step is not part of this chain");
  }
  const [rev] = await db<{ id: string }[]>`
    INSERT INTO astro_reviews (org_id, question_id, reviewer_id, action, payload, candidate_ids, shown_order, stance, seconds, device)
    VALUES (${ORG_ID}, NULL, ${r.reviewerId}, ${r.action}, ${db.json(payload as never)}, ${[]}, ${[]}, NULL, ${r.seconds}, ${r.device})
    RETURNING id
  `;
  return { reviewId: rev.id };
}

// ── charts ─────────────────────────────────────────────────────────────────

interface ChartRow {
  id: string;
  name: string;
  birth_date: string;
  birth_time: string;
  timezone: string;
  latitude: number;
  longitude: number;
  house_system: HouseSystemCode;
  time_known: boolean;
  computed: ChartResult | null;
  computed_version: string | null;
}

/** An owner's chart, recomputed (and the cache refreshed) when the engine version has moved on. */
async function ownedChart(chartId: string, ownerId: string): Promise<{ name: string; chart: ChartResult } | null> {
  const [row] = await db<ChartRow[]>`
    SELECT id, name, to_char(birth_date, 'YYYY-MM-DD') AS birth_date, to_char(birth_time, 'HH24:MI:SS') AS birth_time,
           timezone, latitude, longitude, house_system, time_known, computed, computed_version
    FROM astro_charts WHERE id = ${chartId} AND owner_id = ${ownerId} AND org_id = ${ORG_ID}
  `;
  if (!row) return null;
  let chart = row.computed;
  if (!chart || row.computed_version !== ENGINE_VERSION) {
    chart = calculateChart({
      date: row.birth_date,
      time: row.birth_time.endsWith(":00") ? row.birth_time.slice(0, 5) : row.birth_time,
      timezone: row.timezone,
      latitude: row.latitude,
      longitude: row.longitude,
      houseSystem: row.house_system,
      timeKnown: row.time_known,
    });
    await db`UPDATE astro_charts SET computed = ${db.json(chart as never)}, computed_version = ${ENGINE_VERSION} WHERE id = ${row.id}`.catch(
      (err) => console.error("[astro-corpus] chart cache refresh failed", err),
    );
  }
  return { name: row.name, chart };
}

// ── interpretations ────────────────────────────────────────────────────────

export async function createInterpretation(input: { chartId: string; authorId: string; body: string }): Promise<string> {
  const body = input.body.trim();
  if (body.length < INTERPRETATION_MIN) throw new ReasoningError("Write a little more of your interpretation");
  if (body.length > INTERPRETATION_MAX) throw new ReasoningError(`Keep it under ${INTERPRETATION_MAX.toLocaleString()} characters`);
  const owned = await ownedChart(input.chartId, input.authorId);
  if (!owned) throw new ReasoningError("Chart not found");
  const factorKeys = factorsOf(owned.chart);
  const [row] = await db<{ id: string }[]>`
    INSERT INTO astro_interpretations (org_id, chart_id, author_id, body, sentences, factor_keys, status, meta)
    VALUES (${ORG_ID}, ${input.chartId}, ${input.authorId}, ${body}, ${splitSentences(body)}, ${factorKeys}, 'queued',
            ${db.json({ chartName: owned.name, approximate: owned.chart.approximate } as never)})
    RETURNING id
  `;
  return row.id;
}

/** A deck question as the "Explain my thinking" page shows it. */
export interface ExplainQuestion {
  id: string;
  prompt: string;
  factorKeys: string[];
  factorLabels: string[];
  /** In the fixed test set: answered blind, so it can't be explained (it would leak into training). */
  isTest: boolean;
}

export async function getExplainQuestion(questionId: string): Promise<ExplainQuestion | null> {
  let q: { id: string; prompt: string; factor_keys: string[]; is_test: boolean } | undefined;
  try {
    [q] = await db<NonNullable<typeof q>[]>`
      SELECT id, prompt, factor_keys, COALESCE(meta->>'evalSet' = ${EVAL_SET}, false) AS is_test
      FROM astro_questions WHERE id = ${questionId} AND org_id = ${ORG_ID}
    `;
  } catch {
    return null; // a malformed id in the URL
  }
  if (!q) return null;
  return {
    id: q.id,
    prompt: q.prompt,
    factorKeys: q.factor_keys,
    factorLabels: q.factor_keys.map((k) => FACTOR_BY_KEY.get(k)?.label ?? k),
    isTest: q.is_test,
  };
}

/** "Explain my thinking" on a deck question: the owner's answer or description, queued for the worker like a chart interpretation. */
export async function createQuestionInterpretation(input: { questionId: string; authorId: string; body: string }): Promise<string> {
  const body = input.body.trim();
  if (body.length < INTERPRETATION_MIN) throw new ReasoningError("Write a little more about your thinking");
  if (body.length > INTERPRETATION_MAX) throw new ReasoningError(`Keep it under ${INTERPRETATION_MAX.toLocaleString()} characters`);
  const q = await getExplainQuestion(input.questionId);
  if (!q) throw new ReasoningError("Question not found");
  if (q.isTest) throw new ReasoningError("Test-set questions are answered blind and can't be explained here");
  const [row] = await db<{ id: string }[]>`
    INSERT INTO astro_interpretations (org_id, chart_id, question_id, author_id, body, sentences, factor_keys, status, meta)
    VALUES (${ORG_ID}, NULL, ${q.id}, ${input.authorId}, ${body}, ${splitSentences(body)}, ${q.factorKeys}, 'queued',
            ${db.json({ questionPrompt: q.prompt } as never)})
    RETURNING id
  `;
  return row.id;
}

export interface InterpretationListItem {
  id: string;
  /** null when the interpretation started from a deck question. */
  chartName: string | null;
  questionPrompt: string | null;
  status: string;
  excerpt: string;
  chains: number;
  createdAt: string;
}

export async function listInterpretations(authorId: string, opts: { questionId?: string } = {}): Promise<InterpretationListItem[]> {
  const rows = await db<{ id: string; chart_name: string | null; question_prompt: string | null; status: string; body: string; chains: number; created_at: Date }[]>`
    SELECT i.id, c.name AS chart_name, q.prompt AS question_prompt, i.status, i.body, i.created_at,
           (SELECT count(*)::int FROM astro_reasoning_chains ch WHERE ch.interpretation_id = i.id) AS chains
    FROM astro_interpretations i
    LEFT JOIN astro_charts c ON c.id = i.chart_id
    LEFT JOIN astro_questions q ON q.id = i.question_id
    WHERE i.author_id = ${authorId} AND i.org_id = ${ORG_ID}
      ${opts.questionId ? db`AND i.question_id = ${opts.questionId}` : db``}
    ORDER BY i.created_at DESC
    LIMIT 100
  `;
  return rows.map((r) => ({
    id: r.id,
    chartName: r.chart_name,
    questionPrompt: r.question_prompt,
    status: r.status,
    excerpt: r.body.length > 160 ? `${r.body.slice(0, 157)}…` : r.body,
    chains: r.chains,
    createdAt: r.created_at.toISOString(),
  }));
}

/** Where a cite step's passage came from: studio rows when imported, else the worker's snapshot (migration 179). */
export interface StepSource {
  /** The worker's chunk id and statement ordinal, matching a reference in meta.references. */
  chunkId: string | null;
  statementOrdinal: number | null;
  statement: string | null;
  statementFactors: string[];
  book: string | null;
  author: string | null;
  pages: number[];
  headings: string[];
  excerpt: string | null;
  trainable: boolean | null;
}

export interface ReasoningStep {
  id: string;
  ordinal: number;
  kind: string;
  body: string;
  basedOn: number[];
  factorKeys: string[];
  statementId: string | null;
  textId: string | null;
  source: StepSource | null;
}

export interface ReasoningChain {
  id: string;
  ordinal: number;
  sentences: number[];
  summary: string;
  model: string | null;
  steps: ReasoningStep[];
}

export interface ReasoningReview {
  id: string;
  action: ReasoningAction;
  payload: Record<string, unknown>;
  createdAt: string;
}

/** A retrieved passage with the chains that cite it. */
export interface InterpretationReference extends RetrievedReference {
  key: string;
  citedBy: { chainOrdinal: number; stepOrdinal: number }[];
}

export interface InterpretationDetail {
  id: string;
  /** null when the interpretation started from a deck question (then `question` is set). */
  chartName: string | null;
  question: { id: string; prompt: string; factorLabels: string[] } | null;
  body: string;
  sentences: string[];
  factorKeys: string[];
  status: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  chains: ReasoningChain[];
  /** Every passage the worker retrieved (not only those cited); empty for results stored before it sent them. */
  references: InterpretationReference[];
  reviews: ReasoningReview[];
}

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const asNumbers = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

export async function getInterpretation(id: string, authorId: string): Promise<InterpretationDetail | null> {
  let i:
    | {
        id: string;
        chart_name: string | null;
        question_id: string | null;
        question_prompt: string | null;
        question_keys: string[] | null;
        body: string;
        sentences: string[];
        factor_keys: string[];
        status: string;
        error: string | null;
        meta: Record<string, unknown> | null;
        created_at: Date;
        updated_at: Date;
      }
    | undefined;
  try {
    [i] = await db<NonNullable<typeof i>[]>`
      SELECT i.id, c.name AS chart_name, q.id AS question_id, q.prompt AS question_prompt, q.factor_keys AS question_keys,
             i.body, i.sentences, i.factor_keys, i.status, i.error, i.meta, i.created_at, i.updated_at
      FROM astro_interpretations i
      LEFT JOIN astro_charts c ON c.id = i.chart_id
      LEFT JOIN astro_questions q ON q.id = i.question_id
      WHERE i.id = ${id} AND i.author_id = ${authorId} AND i.org_id = ${ORG_ID}
    `;
  } catch {
    return null; // a malformed id in the URL
  }
  if (!i) return null;

  const chains = await db<{ id: string; ordinal: number; sentences: number[]; summary: string; model: string | null }[]>`
    SELECT id, ordinal, sentences, summary, model FROM astro_reasoning_chains WHERE interpretation_id = ${i.id} ORDER BY ordinal
  `;
  const steps = chains.length
    ? await db<
        {
          id: string;
          chain_id: string;
          ordinal: number;
          kind: string;
          body: string;
          based_on: number[];
          factor_keys: string[];
          statement_id: string | null;
          text_id: string | null;
          source: Record<string, unknown>;
          st_body: string | null;
          st_factors: string[] | null;
          tx_body: string | null;
          tx_meta: Record<string, unknown> | null;
          src_title: string | null;
          src_author: string | null;
          src_trainable: boolean | null;
        }[]
      >`
        SELECT s.id, s.chain_id, s.ordinal, s.kind, s.body, s.based_on, s.factor_keys, s.statement_id, s.text_id, s.source,
               st.body AS st_body,
               (SELECT array_agg(f.factor_key ORDER BY f.factor_key) FROM astro_statement_factors f WHERE f.statement_id = st.id) AS st_factors,
               t.body AS tx_body, t.meta AS tx_meta, src.title AS src_title, src.author AS src_author, src.trainable AS src_trainable
        FROM astro_reasoning_steps s
        LEFT JOIN astro_statements st ON st.id = s.statement_id
        LEFT JOIN astro_texts t ON t.id = COALESCE(s.text_id, st.text_id)
        LEFT JOIN astro_sources src ON src.id = t.source_id
        WHERE s.chain_id = ANY (${chains.map((c) => c.id)})
        ORDER BY s.chain_id, s.ordinal
      `
    : [];

  const byChain = new Map<string, ReasoningStep[]>();
  for (const s of steps) {
    const snap = s.source ?? {};
    const hasStudio = Boolean(s.st_body || s.tx_body);
    const hasSnap = Object.keys(snap).length > 0;
    const source: StepSource | null =
      hasStudio || hasSnap
        ? {
            chunkId: str(snap.chunkId),
            statementOrdinal: typeof snap.statementOrdinal === "number" ? snap.statementOrdinal : null,
            statement: s.st_body ?? str(snap.statement),
            statementFactors: s.st_factors ?? [],
            book: s.src_title ?? str(snap.book),
            author: s.src_author ?? str(snap.author),
            pages: hasStudio && s.tx_meta ? asNumbers(s.tx_meta.pages) : asNumbers(snap.pages),
            headings: hasStudio && s.tx_meta ? asStrings(s.tx_meta.headings) : asStrings(snap.headings),
            excerpt: s.tx_body
              ? s.tx_body.length > EXCERPT_CHARS
                ? `${s.tx_body.slice(0, EXCERPT_CHARS - 1)}…`
                : s.tx_body
              : str(snap.excerpt),
            trainable: s.src_trainable,
          }
        : null;
    const list = byChain.get(s.chain_id) ?? [];
    list.push({
      id: s.id,
      ordinal: s.ordinal,
      kind: s.kind,
      body: s.body,
      basedOn: s.based_on ?? [],
      factorKeys: s.factor_keys ?? [],
      statementId: s.statement_id,
      textId: s.text_id,
      source,
    });
    byChain.set(s.chain_id, list);
  }

  const reviews = await db<{ id: string; action: string; payload: Record<string, unknown>; created_at: Date }[]>`
    SELECT id, action, payload, created_at FROM astro_reviews
    WHERE org_id = ${ORG_ID} AND question_id IS NULL AND payload->>'interpretationId' = ${i.id}
    ORDER BY created_at
  `;

  // Which chains cite each retrieved passage: same chunk, and the same
  // statement when both name one.
  const chainList = chains.map((c) => ({ ordinal: c.ordinal, steps: byChain.get(c.id) ?? [] }));
  const references: InterpretationReference[] = cleanReferences(i.meta?.references).map((ref) => ({
    ...ref,
    key: refKey(ref.chunkId, ref.statementOrdinal),
    citedBy: chainList.flatMap((c) =>
      c.steps
        .filter(
          (st) =>
            st.source?.chunkId === ref.chunkId &&
            (ref.statementOrdinal === null || st.source.statementOrdinal === null || st.source.statementOrdinal === ref.statementOrdinal),
        )
        .map((st) => ({ chainOrdinal: c.ordinal, stepOrdinal: st.ordinal })),
    ),
  }));

  return {
    id: i.id,
    chartName: i.chart_name,
    question: i.question_id
      ? {
          id: i.question_id,
          prompt: i.question_prompt ?? "",
          factorLabels: (i.question_keys ?? []).map((k) => FACTOR_BY_KEY.get(k)?.label ?? k),
        }
      : null,
    body: i.body,
    sentences: i.sentences.length ? i.sentences : splitSentences(i.body),
    factorKeys: i.factor_keys,
    status: i.status,
    error: i.error,
    createdAt: i.created_at.toISOString(),
    updatedAt: i.updated_at.toISOString(),
    chains: chains.map((c) => ({ id: c.id, ordinal: c.ordinal, sentences: c.sentences ?? [], summary: c.summary, model: c.model, steps: byChain.get(c.id) ?? [] })),
    references,
    reviews: reviews
      .filter((r) => isReasoningAction(r.action))
      .map((r) => ({ id: r.id, action: r.action as ReasoningAction, payload: r.payload, createdAt: r.created_at.toISOString() })),
  };
}

/** Ask the worker for (more) chains; it appends them with higher ordinals. */
export async function requeueInterpretation(id: string, authorId: string): Promise<boolean> {
  const rows = await db`
    UPDATE astro_interpretations SET status = 'queued', error = NULL, updated_at = now()
    WHERE id = ${id} AND author_id = ${authorId} AND org_id = ${ORG_ID} AND status IN ('ready', 'failed')
    RETURNING id
  `;
  return rows.length > 0;
}
