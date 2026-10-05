/**
 * The helper AI: drafts candidate answers for questions in the queue, so the
 * reviewer judges and corrects instead of composing from nothing.
 *
 * Drafting runs through the Message Batches API (asynchronous, half price):
 * `buildDraftRequests` makes the requests and a job record, `storeDraft`
 * writes each result as a candidate text with its provenance (model, prompt
 * hash, the reference texts it was shown, the batch id, token usage).
 * Server only.
 *
 * The system prompt is a first rubric. It is expected to be rewritten from the
 * reviewer's own Pick reasons and Mark notes once there are a few hundred
 * reviews (brief, section H).
 */

import { createHash } from "node:crypto";
import { db } from "@elkdonis/db";
import { EVAL_SET } from "./eval-set";
import { FACTOR_BY_KEY } from "./factors";
import { ORG_ID, upsertSource } from "./sources";
import { TRADITIONS } from "./studio";

export const HELPER_MODEL = "claude-opus-5";
export const HELPER_PROMPT_VERSION = "draft-v1";

export const SYSTEM_PROMPT = `You draft candidate answers for an astrology interpretation corpus. An astrologer reviews every draft: picks between drafts, rates them, corrects them or rewrites them. The reviewed data is used to train and test an astrology interpretation model, so a draft is useful when it gives the reviewer something specific to judge.

Write within the astrological tradition the question assumes. Do not add remarks about whether astrology is valid; the reviewer knows the context.

- Answer the question that was asked, directly, in 60 to 180 words.
- Be specific to the factor: say what this placement, aspect or transit does that a neighbouring one (another sign, house or aspect) would not.
- Prefer concrete statements about temperament, behaviour and circumstances over lists of adjectives.
- Avoid fatalism, and avoid medical, legal or financial prescriptions.
- Reference passages, when given, come from other sources of mixed quality. Use them as material, not as authority, and do not copy their wording.
- If the question is badly formed or rests on a false premise (an aspect that cannot occur, a factual error), say so in the answer instead of playing along.
- Report the tradition your answer draws on.`;

export const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    tradition: { type: "string", enum: [...TRADITIONS] },
    answer: { type: "string" },
  },
  required: ["tradition", "answer"],
  additionalProperties: false,
} as const;

export interface DraftJobItem {
  questionId: string;
  promptHash: string;
  referenceIds: string[];
}

interface Reference {
  id: string;
  body: string;
  source: string;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + " …" : s);

/** Questions that have no draft from the helper yet, a mix across kinds. */
export async function pickQuestionsToDraft(perKind: Record<string, number>): Promise<{ id: string; prompt: string; factor_keys: string[]; tradition: string | null }[]> {
  const out: { id: string; prompt: string; factor_keys: string[]; tradition: string | null }[] = [];
  for (const [kind, n] of Object.entries(perKind)) {
    if (n <= 0) continue;
    const kindFilter =
      kind === "general"
        ? db`AND cardinality(q.factor_keys) = 0`
        : db`AND EXISTS (SELECT 1 FROM unnest(q.factor_keys) k WHERE split_part(k, ':', 1) = ${kind})`;
    // Curated questions have no answers of their own, so they are drafted first.
    const rows = await db<{ id: string; prompt: string; factor_keys: string[]; tradition: string | null }[]>`
      SELECT q.id, q.prompt, q.factor_keys, q.tradition
      FROM astro_questions q
      WHERE q.org_id = ${ORG_ID} AND q.status = 'open'
        AND NOT EXISTS (SELECT 1 FROM astro_factors f WHERE f.impossible AND f.key = ANY (q.factor_keys))
        AND (q.meta->>'evalSet') IS DISTINCT FROM ${EVAL_SET}
        AND NOT EXISTS (
          SELECT 1 FROM astro_candidates c JOIN astro_texts t ON t.id = c.text_id
          WHERE c.question_id = q.id AND t.kind = 'generated')
        ${kindFilter}
      ORDER BY (q.origin = 'curated') DESC, q.priority DESC, random()
      LIMIT ${n}
    `;
    out.push(...rows);
  }
  return out;
}

/**
 * Texts about the same factors from other questions, or a full-text match for
 * general questions. Never a text attached to a test-set question: the owners'
 * answers there are the standard a model is scored against.
 */
export async function referencesFor(q: { id: string; prompt: string; factor_keys: string[] }): Promise<Reference[]> {
  // Imported books (source kind 'book', from the chunker pipeline) are never
  // given to the helper (owner decision, 2026-09-27).
  if (q.factor_keys.length) {
    return db<Reference[]>`
      SELECT DISTINCT ON (t.id) t.id, t.body, s.title AS source
      FROM astro_text_factors tf
      JOIN astro_texts t ON t.id = tf.text_id
      JOIN astro_sources s ON s.id = t.source_id
      WHERE tf.factor_key = ANY (${q.factor_keys})
        AND t.kind IN ('import', 'engine', 'own', 'edit')
        AND s.kind <> 'book'
        AND NOT EXISTS (SELECT 1 FROM astro_candidates c WHERE c.question_id = ${q.id} AND c.text_id = t.id)
        AND NOT EXISTS (
          SELECT 1 FROM astro_candidates tc JOIN astro_questions tq ON tq.id = tc.question_id
          WHERE tc.text_id = t.id AND tq.meta->>'evalSet' IS NOT NULL)
      ORDER BY t.id
      LIMIT 6
    `;
  }
  return db<Reference[]>`
    SELECT t.id, t.body, s.title AS source
    FROM astro_texts t JOIN astro_sources s ON s.id = t.source_id
    WHERE t.org_id = ${ORG_ID} AND t.kind IN ('import', 'own', 'edit')
      AND t.search @@ plainto_tsquery('english', ${q.prompt})
      AND s.kind <> 'book'
      AND NOT EXISTS (SELECT 1 FROM astro_candidates c WHERE c.question_id = ${q.id} AND c.text_id = t.id)
      AND NOT EXISTS (
        SELECT 1 FROM astro_candidates tc JOIN astro_questions tq ON tq.id = tc.question_id
        WHERE tc.text_id = t.id AND tq.meta->>'evalSet' IS NOT NULL)
    ORDER BY ts_rank(t.search, plainto_tsquery('english', ${q.prompt})) DESC
    LIMIT 4
  `;
}

export function userMessage(q: { prompt: string; factor_keys: string[]; tradition: string | null }, refs: Reference[]): string {
  const lines = [`Question: ${q.prompt}`];
  if (q.factor_keys.length) lines.push(`Factors: ${q.factor_keys.map((k) => FACTOR_BY_KEY.get(k)?.label ?? k).join("; ")}`);
  if (q.tradition) lines.push(`Tradition asked for: ${q.tradition}`);
  if (refs.length) {
    lines.push("", "Reference passages:");
    refs.forEach((r, i) => lines.push(`[${i + 1}] (${r.source}) ${clip(r.body.replace(/\s+/g, " "), 700)}`));
  }
  return lines.join("\n");
}

/** Batch requests (Messages API params) plus the job record needed to store results. */
export async function buildDraftRequests(questions: { id: string; prompt: string; factor_keys: string[]; tradition: string | null }[]) {
  const requests: { custom_id: string; params: Record<string, unknown> }[] = [];
  const items: DraftJobItem[] = [];
  for (const q of questions) {
    const refs = await referencesFor(q);
    const content = userMessage(q, refs);
    const promptHash = createHash("sha256").update(`${HELPER_PROMPT_VERSION}\n${SYSTEM_PROMPT}\n${content}`).digest("hex").slice(0, 16);
    requests.push({
      custom_id: q.id,
      params: {
        model: HELPER_MODEL,
        max_tokens: 16000,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
        output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      },
    });
    items.push({ questionId: q.id, promptHash, referenceIds: refs.map((r) => r.id) });
  }
  return { requests, items };
}

let generatedSource: string | null = null;

async function generatedSourceId() {
  generatedSource ??= await upsertSource({
    slug: `generated:${HELPER_MODEL}`,
    title: `Helper drafts (${HELPER_MODEL})`,
    author: "Anthropic Claude, prompted by astro-corpus/helper.ts",
    kind: "generated",
    licence: "model-output",
    trainable: false,
    notes: "Candidate answers drafted by the helper AI for review. Training use is subject to Anthropic's terms; cleared per decision by the owners.",
    importer: "astro-corpus/helper.ts",
  });
  return generatedSource;
}

/** Store one successful draft as a candidate text. Returns false if it was already stored. */
export async function storeDraft(
  item: DraftJobItem,
  draft: { tradition: string; answer: string },
  meta: { batchId: string; usage: unknown; model: string },
): Promise<boolean> {
  const sourceId = await generatedSourceId();
  const [q] = await db<{ factor_keys: string[] }[]>`SELECT factor_keys FROM astro_questions WHERE id = ${item.questionId} AND org_id = ${ORG_ID}`;
  if (!q) return false;
  const [t] = await db<{ id: string }[]>`
    INSERT INTO astro_texts (org_id, source_id, source_ref, kind, tradition, body, model, prompt_hash, generated_from)
    VALUES (${ORG_ID}, ${sourceId}, ${`${item.questionId}:${HELPER_PROMPT_VERSION}`}, 'generated', ${draft.tradition}, ${draft.answer.trim()},
            ${meta.model}, ${item.promptHash},
            ${db.json({ references: item.referenceIds, batch: meta.batchId, promptVersion: HELPER_PROMPT_VERSION, usage: meta.usage } as never)})
    ON CONFLICT (source_id, source_ref) DO NOTHING
    RETURNING id
  `;
  if (!t) return false;
  for (const key of q.factor_keys) {
    await db`INSERT INTO astro_text_factors (text_id, factor_key, role, confidence) VALUES (${t.id}, ${key}, 'primary', 'explicit') ON CONFLICT DO NOTHING`;
  }
  await db`INSERT INTO astro_candidates (question_id, text_id) VALUES (${item.questionId}, ${t.id}) ON CONFLICT DO NOTHING`;
  return true;
}
