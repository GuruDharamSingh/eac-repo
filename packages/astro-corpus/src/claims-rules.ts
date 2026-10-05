/**
 * "Check AI claims": the rules, with no database access — vocabularies,
 * payload validation, which passage sentences a claim was most likely made
 * from, and the latest verdict per claim. Shared by src/claims.ts, the export
 * and the smoke test.
 *
 * The claims are astro_statements labelled 'chunker-digest' (migration 178):
 * an AI first pass over each imported passage. The owner judges them next to
 * the passage; his judgements are astro_reviews rows with question_id NULL
 * and the ids in the payload:
 *
 *   claim-verdict  {statementId, textId, verdict: accurate | partly | wrong,
 *                   fixes?: (placement | missing-condition | not-in-passage)[],
 *                   tagsAdd?: factorKey[], tagsRemove?: factorKey[],
 *                   condition?: text (what the missing condition is), note?}
 *                  Each row is the claim's whole current judgement: the latest wins.
 *   claim-add      {textId, body, factorKeys: factorKey[], note?}
 *                  a claim the AI missed, in the owner's words
 *   claim-skip     {textId, note?}  passage passed over without judging it
 */

import { isFactorKey } from "./factors";
import { splitSentences } from "./reasoning-rules";

export const CLAIM_ACTIONS = ["claim-verdict", "claim-add", "claim-skip"] as const;
export type ClaimAction = (typeof CLAIM_ACTIONS)[number];
export const CLAIM_VERDICTS = ["accurate", "partly", "wrong"] as const;
export type ClaimVerdict = (typeof CLAIM_VERDICTS)[number];
export const CLAIM_FIXES = ["placement", "missing-condition", "not-in-passage"] as const;
export type ClaimFix = (typeof CLAIM_FIXES)[number];
export const CLAIM_TEXT_MAX = 2000;
export const CLAIM_TAGS_MAX = 20;
/** The producer whose statements this mode checks. */
export const CLAIM_LABELLER = "chunker-digest";

export class ClaimError extends Error {}

export function isClaimAction(a: string): a is ClaimAction {
  return (CLAIM_ACTIONS as readonly string[]).includes(a);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown, field: string): string => {
  if (typeof v !== "string" || !UUID.test(v)) throw new ClaimError(`${field} is not a valid id`);
  return v;
};
const text = (v: unknown, field: string, required: boolean): string | undefined => {
  if (v === undefined || v === null || (typeof v === "string" && !v.trim())) {
    if (required) throw new ClaimError(`${field} is required`);
    return undefined;
  }
  if (typeof v !== "string") throw new ClaimError(`${field} must be text`);
  const t = v.trim();
  if (t.length > CLAIM_TEXT_MAX) throw new ClaimError(`${field} is longer than ${CLAIM_TEXT_MAX} characters`);
  return t;
};
const keys = (v: unknown, field: string): string[] => {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new ClaimError(`${field} must be a list`);
  if (v.length > CLAIM_TAGS_MAX) throw new ClaimError(`${field} has more than ${CLAIM_TAGS_MAX} keys`);
  const out: string[] = [];
  for (const k of v) {
    if (typeof k !== "string" || !isFactorKey(k)) throw new ClaimError(`${field}: ${String(k).slice(0, 60)} is not a factor key`);
    if (!out.includes(k)) out.push(k);
  }
  return out;
};

/**
 * The reviewer's strength of conviction (0 = no real reason, 5 = a strong
 * feeling of why) and the voice memo of their reasoning, both optional. Added
 * for the phone app (Jerusalem); the web studio simply does not send them.
 */
export function cleanConviction(p: Record<string, unknown>, fail: (msg: string) => never): { conviction?: number; voice?: string } {
  const out: { conviction?: number; voice?: string } = {};
  if (p.conviction !== undefined && p.conviction !== null) {
    if (typeof p.conviction !== "number" || !Number.isInteger(p.conviction) || p.conviction < 0 || p.conviction > 5) fail("conviction must be a whole number from 0 to 5");
    out.conviction = p.conviction as number;
  }
  if (p.voice !== undefined && p.voice !== null && p.voice !== "") {
    if (typeof p.voice !== "string" || !p.voice.startsWith("Private/Jerusalem/") || p.voice.includes("..") || p.voice.length > 300) fail("voice must be an uploaded recording");
    out.voice = p.voice as string;
  }
  return out;
}

/**
 * Shape, vocabulary and length checks for a claim review; unknown fields are
 * dropped, empty lists left out. That the statement belongs to the passage,
 * and that removed tags were on the claim, is checked in src/claims.ts.
 */
export function cleanClaimPayload(action: ClaimAction, p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  switch (action) {
    case "claim-verdict": {
      out.statementId = uuid(p.statementId, "statementId");
      out.textId = uuid(p.textId, "textId");
      const verdict = p.verdict;
      if (typeof verdict !== "string" || !(CLAIM_VERDICTS as readonly string[]).includes(verdict))
        throw new ClaimError(`verdict must be one of ${CLAIM_VERDICTS.join(", ")}`);
      out.verdict = verdict;
      const fixes: ClaimFix[] = [];
      if (p.fixes !== undefined && p.fixes !== null) {
        if (!Array.isArray(p.fixes)) throw new ClaimError("fixes must be a list");
        for (const f of p.fixes) {
          if (typeof f !== "string" || !(CLAIM_FIXES as readonly string[]).includes(f)) throw new ClaimError(`fixes must be among ${CLAIM_FIXES.join(", ")}`);
          if (!fixes.includes(f as ClaimFix)) fixes.push(f as ClaimFix);
        }
      }
      const tagsAdd = keys(p.tagsAdd, "tagsAdd");
      const tagsRemove = keys(p.tagsRemove, "tagsRemove");
      if (tagsAdd.some((k) => tagsRemove.includes(k))) throw new ClaimError("A key can't be both added and removed");
      if ((tagsAdd.length || tagsRemove.length) && !fixes.includes("placement")) fixes.push("placement");
      const condition = text(p.condition, "condition", false);
      if (condition && !fixes.includes("missing-condition")) fixes.push("missing-condition");
      if (fixes.includes("not-in-passage") && verdict !== "wrong") throw new ClaimError("A claim that is not in the passage is wrong");
      if (fixes.length && verdict === "accurate") throw new ClaimError("An accurate claim needs no fix: choose Partly or Wrong");
      if (fixes.length) out.fixes = fixes;
      if (tagsAdd.length) out.tagsAdd = tagsAdd;
      if (tagsRemove.length) out.tagsRemove = tagsRemove;
      if (condition) out.condition = condition;
      break;
    }
    case "claim-add":
      out.textId = uuid(p.textId, "textId");
      out.body = text(p.body, "body", true);
      out.factorKeys = keys(p.factorKeys, "factorKeys");
      break;
    case "claim-skip":
      out.textId = uuid(p.textId, "textId");
      break;
    default:
      throw new ClaimError("Unknown action");
  }
  const note = text(p.note, "note", false);
  if (note) out.note = note;
  Object.assign(out, cleanConviction(p, (m) => { throw new ClaimError(m); }));
  return out;
}

// ── which sentences a claim came from (approximate) ─────────────────────────

const STOP = new Set(
  (
    "a an the and or but if then than that this these those there their they them he she his her its it is are was were be been being " +
    "to of in on at by for with from as into about over under not no so such can may might will would should could do does did has have had " +
    "who whom which what when where while how all any each more most other some very also often one ones person people native natives someone " +
    "chart planet planets sign signs house houses aspect aspects"
  ).split(" "),
);

/** Content words, lower-cased, crudely stemmed (plural and -ing/-ed endings). */
export function contentWords(s: string): string[] {
  return (s.toLowerCase().match(/[a-z][a-z'-]+/g) ?? [])
    .map((w) => w.replace(/'s$/, ""))
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.replace(/(?:ies)$/, "y").replace(/(?:ing|ed|es|s)$/, "") || w);
}

/**
 * For each claim, the passage sentences it most likely came from: those
 * sharing the most content words with the claim (at least two, and at least
 * a fifth of the claim's words), best first, at most `max`. Word overlap only
 * — a paraphrase can miss, so the page labels it approximate.
 */
export function matchClaimSentences(sentences: string[], claims: string[], max = 2): number[][] {
  const bags = sentences.map((s) => new Set(contentWords(s)));
  return claims.map((c) => {
    const words = [...new Set(contentWords(c))];
    if (!words.length) return [];
    const need = Math.max(2, Math.ceil(words.length / 5));
    return bags
      .map((bag, i) => ({ i, n: words.filter((w) => bag.has(w)).length }))
      .filter((x) => x.n >= need)
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .slice(0, max)
      .map((x) => x.i);
  });
}

/** The passage split for display and matching (the reasoning explorer's splitter). */
export const passageSentences = (body: string): string[] => splitSentences(body);

/** The latest claim-verdict per statement, oldest reviews first in the input. */
export function latestClaimVerdicts<R extends { action: string; payload: Record<string, unknown>; createdAt: string }>(reviews: R[]): Map<string, R> {
  const out = new Map<string, R>();
  for (const r of [...reviews].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (r.action !== "claim-verdict" || typeof r.payload.statementId !== "string") continue;
    out.set(r.payload.statementId, r);
  }
  return out;
}

