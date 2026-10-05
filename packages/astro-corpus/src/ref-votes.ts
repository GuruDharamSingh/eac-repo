/**
 * Chart-explorer reference votes (action "ref-vote"): the owner marks a book
 * PASSAGE shown for a factor key as helpful or not. Rows are astro_reviews
 * with question_id NULL; append-only, the latest vote per reviewer + passage
 * (textId) + factor key wins, "clear" retracts.
 *
 *   ref-vote  {textId, factorKey, statementId?, chartId?, elementId?, verdict: helpful | not | clear, note?}
 *
 * The passage is the target (the explorer shows passages, not the AI's
 * digested statements); statementId is optional context. Validation here is
 * self-contained (cleanPassageVotePayload) — reasoning-rules.ts still has the
 * older statement-keyed cleanRefVotePayload / latestRefVotes used by the
 * export; see the explorer report for the export change this implies.
 *
 * Server only (shared postgres client). The explorer's API routes call these
 * after checking the viewer is an owner.
 */

import { db } from "@elkdonis/db";
import { FACTOR_BY_KEY, isFactorKey } from "./factors";
import { patternPhraseOf, REF_VOTE_ACTION, REF_VOTE_NOTE_MAX, REF_VOTE_VERDICTS, ReasoningError, type RefVoteVerdict } from "./reasoning-rules";
import { ORG_ID } from "./sources";

export interface PassageVotePayload {
  textId: string;
  factorKey: string;
  statementId?: string;
  chartId?: string;
  elementId?: string;
  verdict: RefVoteVerdict;
  note?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ELEMENT_ID = /^[a-z][a-z-]*:[A-Za-z0-9:_-]+$/;

function optUuid(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || !UUID.test(v)) throw new ReasoningError(`${field} is not a valid id`);
  return v;
}
function optText(v: unknown, field: string, max: number): string | undefined {
  if (v === undefined || v === null || (typeof v === "string" && !v.trim())) return undefined;
  if (typeof v !== "string") throw new ReasoningError(`${field} must be text`);
  const t = v.trim();
  if (t.length > max) throw new ReasoningError(`${field} is longer than ${max} characters`);
  return t;
}

/** Shape, vocabulary and length checks for a passage vote; unknown fields dropped. */
export function cleanPassageVotePayload(p: Record<string, unknown>): PassageVotePayload {
  const textId = optUuid(p.textId, "textId");
  if (!textId) throw new ReasoningError("textId is required");
  const factorKey = optText(p.factorKey, "factorKey", 200);
  if (!factorKey) throw new ReasoningError("factorKey is required");
  if (!isFactorKey(factorKey) && !patternPhraseOf(factorKey)) throw new ReasoningError("factorKey is not a known factor");
  if (typeof p.verdict !== "string" || !(REF_VOTE_VERDICTS as readonly string[]).includes(p.verdict))
    throw new ReasoningError(`verdict must be one of ${REF_VOTE_VERDICTS.join(", ")}`);
  const out: PassageVotePayload = { textId, factorKey, verdict: p.verdict as RefVoteVerdict };
  const statementId = optUuid(p.statementId, "statementId");
  if (statementId) out.statementId = statementId;
  const chartId = optUuid(p.chartId, "chartId");
  if (chartId) out.chartId = chartId;
  const elementId = optText(p.elementId, "elementId", 200);
  if (elementId) {
    if (!ELEMENT_ID.test(elementId)) throw new ReasoningError("elementId is not a valid explorer element");
    out.elementId = elementId;
  }
  const note = optText(p.note, "note", REF_VOTE_NOTE_MAX);
  if (note) {
    if (out.verdict === "clear") throw new ReasoningError("A cleared vote has no note");
    out.note = note;
  }
  return out;
}

/** A general key (planet:, zodiac:, realm:, aspect-type:) is "placed" by a key that names its subject. */
function places(k: string, general: string): boolean {
  const f = FACTOR_BY_KEY.get(k);
  const g = FACTOR_BY_KEY.get(general);
  if (!f || !g) return false;
  const p = f.parts as Record<string, unknown>;
  const q = g.parts as Record<string, unknown>;
  if (g.kind === "planet") return p.point === q.point || p.other === q.point;
  if (g.kind === "zodiac") return p.sign === q.sign || p.otherSign === q.sign;
  if (g.kind === "realm") return p.house !== undefined && Number(p.house) === Number(q.house);
  if (g.kind === "aspect-type") return p.aspect === q.aspect;
  return false;
}

/** Validate a vote against the database, then store it. */
export async function recordRefVote(r: {
  reviewerId: string;
  payload: Record<string, unknown>;
  seconds?: number | null;
  device?: string | null;
}): Promise<{ reviewId: string; payload: PassageVotePayload }> {
  const payload = cleanPassageVotePayload(r.payload);
  const phrase = patternPhraseOf(payload.factorKey);
  const [t] = await db<{ id: string; matches: boolean; keys: string[] }[]>`
    SELECT t.id,
           ${phrase ? db`t.search @@ phraseto_tsquery('english', ${phrase})` : db`FALSE`} AS matches,
           ARRAY(SELECT x.factor_key FROM astro_text_factors x WHERE x.text_id = t.id
                 UNION SELECT sf.factor_key FROM astro_statements s JOIN astro_statement_factors sf ON sf.statement_id = s.id WHERE s.text_id = t.id) AS keys
    FROM astro_texts t
    WHERE t.id = ${payload.textId} AND t.kind = 'import' AND t.org_id = ${ORG_ID}
  `;
  if (!t) throw new ReasoningError("That passage is not in the corpus");
  const related = phrase ? t.matches : t.keys.includes(payload.factorKey) || t.keys.some((k) => places(k, payload.factorKey));
  if (!related) throw new ReasoningError("That passage is not tagged with this factor");
  if (payload.statementId) {
    const [s] = await db<{ id: string }[]>`SELECT id FROM astro_statements WHERE id = ${payload.statementId} AND text_id = ${payload.textId}`;
    if (!s) throw new ReasoningError("That statement is not from this passage");
  }
  if (payload.chartId) {
    const [c] = await db<{ id: string }[]>`
      SELECT id FROM astro_charts WHERE id = ${payload.chartId} AND owner_id = ${r.reviewerId} AND org_id = ${ORG_ID}
    `;
    if (!c) throw new ReasoningError("Chart not found");
  }
  const [rev] = await db<{ id: string }[]>`
    INSERT INTO astro_reviews (org_id, question_id, reviewer_id, action, payload, candidate_ids, shown_order, stance, seconds, device)
    VALUES (${ORG_ID}, NULL, ${r.reviewerId}, ${REF_VOTE_ACTION}, ${db.json(payload as never)}, ${[]}, ${[]}, NULL, ${r.seconds ?? null}, ${r.device ?? null})
    RETURNING id
  `;
  return { reviewId: rev.id, payload };
}

/**
 * The reviewer's standing votes as a SQL fragment (a subquery usable in FROM):
 * text_id, statement_id (nullable), factor_key, verdict, note, chart_id,
 * element_id, created_at — latest per passage + key, "clear" rows dropped.
 * Optionally limited to some factor keys.
 */
export function standingRefVotes(reviewerId: string, factorKeys?: string[]) {
  return db`(
    SELECT * FROM (
      SELECT DISTINCT ON (r.payload->>'textId', r.payload->>'factorKey')
             (r.payload->>'textId')::uuid AS text_id, (r.payload->>'statementId')::uuid AS statement_id,
             r.payload->>'factorKey' AS factor_key, r.payload->>'verdict' AS verdict, r.payload->>'note' AS note,
             r.payload->>'chartId' AS chart_id, r.payload->>'elementId' AS element_id, r.created_at
      FROM astro_reviews r
      WHERE r.org_id = ${ORG_ID} AND r.reviewer_id = ${reviewerId} AND r.question_id IS NULL AND r.action = ${REF_VOTE_ACTION}
        AND r.payload ? 'textId'
        ${factorKeys ? db`AND r.payload->>'factorKey' = ANY (${factorKeys}::text[])` : db``}
      ORDER BY r.payload->>'textId', r.payload->>'factorKey', r.created_at DESC
    ) latest WHERE verdict IN ('helpful', 'not')
  )`;
}

export interface RefVoteListItem {
  textId: string;
  statementId: string | null;
  factorKey: string;
  /** The factor's registry label (or the pattern phrase). */
  factorLabel: string | null;
  verdict: "helpful" | "not";
  note: string | null;
  chartId: string | null;
  elementId: string | null;
  votedAt: string;
  pages: number[] | null;
  book: { id: string; title: string; author: string | null };
}

/** The reviewer's standing votes with their passages' books: the Favourites list (and the toss list). */
export async function listRefVotes(reviewerId: string, opts: { chartId?: string; verdict?: "helpful" | "not" } = {}): Promise<RefVoteListItem[]> {
  const rows = await db<
    {
      text_id: string;
      statement_id: string | null;
      factor_key: string;
      verdict: "helpful" | "not";
      note: string | null;
      chart_id: string | null;
      element_id: string | null;
      created_at: Date;
      pages: number[] | null;
      source_id: string;
      title: string;
      author: string | null;
    }[]
  >`
    SELECT v.text_id, v.statement_id, v.factor_key, v.verdict, v.note, v.chart_id, v.element_id, v.created_at,
           t.meta->'pages' AS pages, so.id AS source_id, so.title, so.author
    FROM ${standingRefVotes(reviewerId)} v
    JOIN astro_texts t ON t.id = v.text_id
    JOIN astro_sources so ON so.id = t.source_id
    WHERE TRUE
      ${opts.chartId ? db`AND v.chart_id = ${opts.chartId}` : db``}
      ${opts.verdict ? db`AND v.verdict = ${opts.verdict}` : db``}
    ORDER BY v.factor_key, v.created_at DESC
    LIMIT 2000
  `;
  return rows.map((r) => ({
    textId: r.text_id,
    statementId: r.statement_id,
    factorKey: r.factor_key,
    factorLabel: FACTOR_BY_KEY.get(r.factor_key)?.label ?? patternPhraseOf(r.factor_key),
    verdict: r.verdict,
    note: r.note,
    chartId: r.chart_id,
    elementId: r.element_id,
    votedAt: r.created_at.toISOString(),
    pages: Array.isArray(r.pages) ? r.pages : null,
    book: { id: r.source_id, title: r.title, author: r.author },
  }));
}
