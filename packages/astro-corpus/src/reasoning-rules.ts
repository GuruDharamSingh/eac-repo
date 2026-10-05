/**
 * The reasoning explorer's rules, with no database access: vocabularies,
 * sentence splitting and review-payload validation. Shared by
 * src/reasoning.ts and the smoke test.
 */

import { isFactorKey } from "./factors";

export const REASONING_ACTIONS = ["chain-pick", "chain-verdict", "step-verdict", "step-add", "ref-mark"] as const;
export type ReasoningAction = (typeof REASONING_ACTIONS)[number];
export const CHAIN_VERDICTS = ["plausible", "partly", "implausible"] as const;
/** A retrieved passage, marked by the owner: part of my thinking, related, or not it (retrieval relevance labels). */
export const REF_VERDICTS = ["mine", "related", "not"] as const;
export const CHUNK_ID_MAX = 200;
export const STEP_VERDICTS = ["right", "partly", "wrong", "wrong-reference", "irrelevant"] as const;
export const STEP_KINDS = ["observe", "cite", "infer", "conclude"] as const;
export const REASONING_TEXT_MAX = 2000;
export const INTERPRETATION_MIN = 20;
export const INTERPRETATION_MAX = 20000;
export const EXCERPT_CHARS = 600;

export class ReasoningError extends Error {}

export function isReasoningAction(a: string): a is ReasoningAction {
  return (REASONING_ACTIONS as readonly string[]).includes(a);
}

/** Sentences for display and for chains to target: split after . ! ? (and a closing quote) and at blank lines. */
export function splitSentences(body: string): string[] {
  return body
    .replace(/\r/g, "")
    .split(/(?<=[.!?]["'”’)]?)\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const text = (v: unknown, field: string, required: boolean): string | undefined => {
  if (v === undefined || v === null || (typeof v === "string" && !v.trim())) {
    if (required) throw new ReasoningError(`${field} is required`);
    return undefined;
  }
  if (typeof v !== "string") throw new ReasoningError(`${field} must be text`);
  const t = v.trim();
  if (t.length > REASONING_TEXT_MAX) throw new ReasoningError(`${field} is longer than ${REASONING_TEXT_MAX} characters`);
  return t;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown, field: string, required = true): string | undefined => {
  if (v === undefined || v === null || v === "") {
    if (required) throw new ReasoningError(`${field} is required`);
    return undefined;
  }
  if (typeof v !== "string" || !UUID.test(v)) throw new ReasoningError(`${field} is not a valid id`);
  return v;
};

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], field: string): T => {
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) throw new ReasoningError(`${field} must be one of ${allowed.join(", ")}`);
  return v as T;
};

/**
 * Shape, vocabulary and length checks for a reasoning review payload; unknown
 * fields are dropped. Whether the ids belong together is checked against the
 * database in recordReasoningReview.
 *
 *   chain-pick     {interpretationId, chainId, comment?}  the chain closest to how the owner reasons
 *   chain-verdict  {interpretationId, chainId, verdict: plausible | partly | implausible, comment?}
 *   step-verdict   {interpretationId, chainId, stepId, verdict: right | partly | wrong | wrong-reference | irrelevant, comment?}
 *   step-add       {interpretationId, chainId?, afterStepId?, kind: observe | cite | infer | conclude, body, comment?}
 *   ref-mark       {interpretationId, chunkId, statementOrdinal: number | null, verdict: mine | related | not, note?}
 *                  one of the passages the worker retrieved (meta.references), not only those cited
 */
export function cleanReasoningPayload(action: ReasoningAction, p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { interpretationId: uuid(p.interpretationId, "interpretationId") };
  const comment = text(p.comment, "comment", false);
  switch (action) {
    case "chain-pick":
      out.chainId = uuid(p.chainId, "chainId");
      break;
    case "chain-verdict":
      out.chainId = uuid(p.chainId, "chainId");
      out.verdict = oneOf(p.verdict, CHAIN_VERDICTS, "verdict");
      break;
    case "step-verdict":
      out.chainId = uuid(p.chainId, "chainId");
      out.stepId = uuid(p.stepId, "stepId");
      out.verdict = oneOf(p.verdict, STEP_VERDICTS, "verdict");
      break;
    case "step-add": {
      const chainId = uuid(p.chainId, "chainId", false);
      const afterStepId = uuid(p.afterStepId, "afterStepId", false);
      if (afterStepId && !chainId) throw new ReasoningError("afterStepId needs a chainId");
      if (chainId) out.chainId = chainId;
      if (afterStepId) out.afterStepId = afterStepId;
      out.kind = oneOf(p.kind, STEP_KINDS, "kind");
      out.body = text(p.body, "body", true);
      break;
    }
    case "ref-mark": {
      const chunkId = text(p.chunkId, "chunkId", true)!;
      if (chunkId.length > CHUNK_ID_MAX) throw new ReasoningError("chunkId is not a valid id");
      out.chunkId = chunkId;
      const ord = p.statementOrdinal;
      if (ord === undefined || ord === null) out.statementOrdinal = null;
      else if (typeof ord === "number" && Number.isInteger(ord) && ord >= 0) out.statementOrdinal = ord;
      else throw new ReasoningError("statementOrdinal must be a whole number or null");
      out.verdict = oneOf(p.verdict, REF_VERDICTS, "verdict");
      const note = text(p.note, "note", false);
      if (note) out.note = note;
      break;
    }
    default:
      throw new ReasoningError("Unknown action");
  }
  if (comment) out.comment = comment;
  return out;
}

/** A ref-mark's target: one passage, or one statement within it. */
export const refKey = (chunkId: string, statementOrdinal: number | null | undefined): string => `${chunkId}#${statementOrdinal ?? ""}`;

/**
 * A passage the worker retrieved for an interpretation (astro_interpretations
 * .meta.references, written by scripts/reasoning-jobs.ts store). `rid` is the
 * worker's own label for it in the prompt.
 */
export interface RetrievedReference {
  rid: string | null;
  chunkId: string;
  docHash: string | null;
  statementOrdinal: number | null;
  book: string | null;
  author: string | null;
  pages: number[];
  headings: string[];
  statement: string | null;
  excerpt: string | null;
  factors: string[];
}

const refStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : typeof v === "number" ? String(v) : null);
const refStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Read the worker's references leniently: entries without a chunkId are dropped, duplicates (same chunk and statement) kept once. */
export function cleanReferences(v: unknown): RetrievedReference[] {
  if (!Array.isArray(v)) return [];
  const out: RetrievedReference[] = [];
  const seen = new Set<string>();
  for (const r of v) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const chunkId = refStr(o.chunkId);
    if (!chunkId || chunkId.length > CHUNK_ID_MAX) continue;
    const ord = typeof o.statementOrdinal === "number" && Number.isInteger(o.statementOrdinal) && o.statementOrdinal >= 0 ? o.statementOrdinal : null;
    const key = refKey(chunkId, ord);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      rid: refStr(o.rid),
      chunkId,
      docHash: refStr(o.docHash),
      statementOrdinal: ord,
      book: refStr(o.book),
      author: refStr(o.author),
      pages: Array.isArray(o.pages) ? o.pages.filter((x): x is number => typeof x === "number") : [],
      headings: refStrings(o.headings),
      statement: refStr(o.statement),
      excerpt: refStr(o.excerpt),
      factors: refStrings(o.factors),
    });
  }
  return out;
}

// ── ref-vote: the chart explorer's helpful / not helpful marks ──────────────

/**
 * A vote on one book passage (astro_texts) shown as a reference for one factor
 * key in the chart explorer (apps/elastrocal /charts/<id>/explore). Stored in
 * astro_reviews with question_id NULL and action REF_VOTE_ACTION; append-only,
 * the latest vote per reviewer + passage + factor key wins, and "clear"
 * retracts an earlier vote. statementId is optional context (the claim the
 * passage was found by), not the target. Same checks as
 * cleanPassageVotePayload in src/ref-votes.ts, which records the votes.
 *
 *   ref-vote  {textId, factorKey, statementId?, chartId?, elementId?, verdict: helpful | not | clear, note?}
 *
 * factorKey is a registry key, or `pattern:<slug>` for a chart pattern
 * (REF_PATTERN_PHRASES), whose references come from full-text search.
 */
export const REF_VOTE_ACTION = "ref-vote" as const;
export const REF_VOTE_VERDICTS = ["helpful", "not", "clear"] as const;
export type RefVoteVerdict = (typeof REF_VOTE_VERDICTS)[number];
export const REF_VOTE_NOTE_MAX = 500;
export const ELEMENT_ID_MAX = 200;

/** Chart patterns the explorer detects, and the phrase their references are searched by. */
export const REF_PATTERN_PHRASES: Readonly<Record<string, string>> = {
  stellium: "stellium",
  "t-square": "T-square",
  "grand-trine": "grand trine",
  "grand-cross": "grand cross",
  yod: "yod",
  kite: "kite",
  "mutual-reception": "mutual reception",
};

/** The search phrase behind a `pattern:<slug>` key, or null when it is not one. */
export function patternPhraseOf(factorKey: string): string | null {
  const m = /^pattern:([a-z-]+)$/.exec(factorKey);
  return m ? (REF_PATTERN_PHRASES[m[1]] ?? null) : null;
}

export interface RefVotePayload {
  textId: string;
  statementId?: string;
  factorKey: string;
  chartId?: string;
  elementId?: string;
  verdict: RefVoteVerdict;
  note?: string;
}

const ELEMENT_ID = /^[a-z][a-z-]*:[A-Za-z0-9:_-]+$/;

/** Shape, vocabulary and length checks for a ref-vote; unknown fields dropped. The database checks are in recordRefVote. */
export function cleanRefVotePayload(p: Record<string, unknown>): RefVotePayload {
  const factorKey = text(p.factorKey, "factorKey", true)!;
  if (!isFactorKey(factorKey) && !patternPhraseOf(factorKey)) throw new ReasoningError("factorKey is not a known factor");
  const out: RefVotePayload = {
    textId: uuid(p.textId, "textId")!,
    factorKey,
    verdict: oneOf(p.verdict, REF_VOTE_VERDICTS, "verdict"),
  };
  const statementId = uuid(p.statementId, "statementId", false);
  if (statementId) out.statementId = statementId;
  const chartId = uuid(p.chartId, "chartId", false);
  if (chartId) out.chartId = chartId;
  const elementId = text(p.elementId, "elementId", false);
  if (elementId) {
    if (elementId.length > ELEMENT_ID_MAX || !ELEMENT_ID.test(elementId)) throw new ReasoningError("elementId is not a valid explorer element");
    out.elementId = elementId;
  }
  const note = text(p.note, "note", false);
  if (note) {
    if (note.length > REF_VOTE_NOTE_MAX) throw new ReasoningError(`note is longer than ${REF_VOTE_NOTE_MAX} characters`);
    if (out.verdict === "clear") throw new ReasoningError("A cleared vote has no note");
    out.note = note;
  }
  return out;
}

/** What a vote is about: one passage under one factor key. */
export const refVoteKey = (textId: string, factorKey: string): string => `${textId}|${factorKey}`;

/**
 * The standing votes in a list of ref-vote reviews: latest per passage +
 * factor key (per reviewer when `byReviewer`), with "clear" removing it.
 * Rows without a textId (none exist) are ignored.
 */
export function latestRefVotes<R extends { reviewerId: string; action: string; payload: Record<string, unknown>; createdAt: string }>(
  reviews: R[],
  byReviewer = false,
): Map<string, R & { payload: RefVotePayload }> {
  const latest = new Map<string, R & { payload: RefVotePayload }>();
  for (const r of [...reviews].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (r.action !== REF_VOTE_ACTION) continue;
    const p = r.payload as Partial<RefVotePayload>;
    if (typeof p.textId !== "string" || typeof p.factorKey !== "string") continue;
    const key = (byReviewer ? `${r.reviewerId}|` : "") + refVoteKey(p.textId, p.factorKey);
    if (p.verdict === "clear") latest.delete(key);
    else if (p.verdict === "helpful" || p.verdict === "not") latest.set(key, r as R & { payload: RefVotePayload });
  }
  return latest;
}
