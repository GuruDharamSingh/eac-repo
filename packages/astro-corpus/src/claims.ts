/**
 * "Check AI claims" (/hub/studio/claims): the queue, one passage with every
 * claim the digest made from it, and recording the owner's judgements. Rules
 * and payload shapes are in src/claims-rules.ts; no schema of its own — the
 * claims are astro_statements (migration 178) and the judgements are
 * astro_reviews rows with question_id NULL.
 *
 * The queue serves imported passages (astro_texts kind 'import') that have
 * digest claims and that the reviewer has not judged or skipped: passages
 * whose claims touch a factor of one of the reviewer's own charts first, then
 * those with the most claims, then at random.
 */

import { db } from "@elkdonis/db";
import type { ChartResult, HouseSystemCode } from "@elkdonis/astro";
import { calculateChart, ENGINE_VERSION } from "@elkdonis/astro/server";
import {
  CLAIM_ACTIONS,
  CLAIM_LABELLER,
  ClaimError,
  cleanClaimPayload,
  matchClaimSentences,
  passageSentences,
  type ClaimAction,
} from "./claims-rules";
import { FACTOR_BY_KEY, factorsOf } from "./factors";
import { ORG_ID } from "./sources";
import { tagText } from "./tagger";

export * from "./claims-rules";

// ── the reviewer's chart factors ───────────────────────────────────────────

const CHART_KEYS_TTL_MS = 5 * 60_000;
const chartKeysCache = new Map<string, { at: number; keys: string[] }>();

/**
 * Every natal factor key across the reviewer's own saved charts (cached
 * charts reused; recomputed in memory when the engine has moved on). Kept
 * for five minutes per reviewer.
 */
export async function ownerChartKeys(ownerId: string): Promise<string[]> {
  const hit = chartKeysCache.get(ownerId);
  if (hit && Date.now() - hit.at < CHART_KEYS_TTL_MS) return hit.keys;
  const rows = await db<
    {
      birth_date: string;
      birth_time: string;
      timezone: string;
      latitude: number;
      longitude: number;
      house_system: HouseSystemCode;
      time_known: boolean;
      computed: ChartResult | null;
      computed_version: string | null;
    }[]
  >`
    SELECT to_char(birth_date, 'YYYY-MM-DD') AS birth_date, to_char(birth_time, 'HH24:MI:SS') AS birth_time,
           timezone, latitude, longitude, house_system, time_known, computed, computed_version
    FROM astro_charts WHERE owner_id = ${ownerId} AND org_id = ${ORG_ID}
  `;
  const keys = new Set<string>();
  for (const row of rows) {
    let chart = row.computed;
    if (!chart || row.computed_version !== ENGINE_VERSION) {
      try {
        chart = calculateChart({
          date: row.birth_date,
          time: row.birth_time.endsWith(":00") ? row.birth_time.slice(0, 5) : row.birth_time,
          timezone: row.timezone,
          latitude: row.latitude,
          longitude: row.longitude,
          houseSystem: row.house_system,
          timeKnown: row.time_known,
        });
      } catch (err) {
        console.error("[astro-corpus] chart for claim queue failed", err);
        continue;
      }
    }
    for (const k of factorsOf(chart)) keys.add(k);
  }
  const out = [...keys];
  chartKeysCache.set(ownerId, { at: Date.now(), keys: out });
  return out;
}

// ── the queue ──────────────────────────────────────────────────────────────

async function judgedTextIds(reviewerId: string): Promise<string[]> {
  const rows = await db<{ text_id: string }[]>`
    SELECT DISTINCT payload->>'textId' AS text_id FROM astro_reviews
    WHERE org_id = ${ORG_ID} AND reviewer_id = ${reviewerId} AND question_id IS NULL AND action = ANY (${[...CLAIM_ACTIONS]})
  `;
  return rows.map((r) => r.text_id).filter(Boolean);
}

/** The next passage to check for this reviewer, or null when every passage with claims has been seen. */
export async function nextClaimTextId(reviewerId: string): Promise<string | null> {
  const [judged, mine] = await Promise.all([judgedTextIds(reviewerId), ownerChartKeys(reviewerId)]);
  if (mine.length) {
    const [row] = await db<{ text_id: string }[]>`
      WITH touched AS (
        SELECT DISTINCT s.text_id
        FROM astro_statement_factors f JOIN astro_statements s ON s.id = f.statement_id
        WHERE f.factor_key = ANY (${mine}) AND s.labelled_by = ${CLAIM_LABELLER}
      )
      SELECT x.text_id FROM touched x JOIN astro_texts t ON t.id = x.text_id
      WHERE t.kind = 'import' AND t.org_id = ${ORG_ID} AND NOT (x.text_id = ANY (${judged}::uuid[]))
      ORDER BY (SELECT count(*) FROM astro_statements s WHERE s.text_id = x.text_id AND s.labelled_by = ${CLAIM_LABELLER}) DESC, random()
      LIMIT 1
    `;
    if (row) return row.text_id;
  }
  const [row] = await db<{ text_id: string }[]>`
    SELECT s.text_id FROM astro_statements s JOIN astro_texts t ON t.id = s.text_id
    WHERE s.labelled_by = ${CLAIM_LABELLER} AND t.kind = 'import' AND t.org_id = ${ORG_ID} AND NOT (s.text_id = ANY (${judged}::uuid[]))
    GROUP BY s.text_id
    ORDER BY count(*) DESC, random()
    LIMIT 1
  `;
  return row?.text_id ?? null;
}

export interface ClaimStats {
  /** Passages with digest claims. */
  passages: number;
  /** Of those, passages whose claims touch a factor of the reviewer's charts. */
  touchingMine: number;
  /** Passages the reviewer has judged or skipped. */
  checked: number;
}

export async function claimStats(reviewerId: string): Promise<ClaimStats> {
  const mine = await ownerChartKeys(reviewerId);
  const [[all], [touching], judged] = await Promise.all([
    db<{ n: number }[]>`SELECT count(DISTINCT text_id)::int AS n FROM astro_statements WHERE labelled_by = ${CLAIM_LABELLER}`,
    mine.length
      ? db<{ n: number }[]>`
          SELECT count(DISTINCT s.text_id)::int AS n
          FROM astro_statement_factors f JOIN astro_statements s ON s.id = f.statement_id
          WHERE f.factor_key = ANY (${mine}) AND s.labelled_by = ${CLAIM_LABELLER}`
      : Promise.resolve([{ n: 0 }]),
    judgedTextIds(reviewerId),
  ]);
  return { passages: all?.n ?? 0, touchingMine: touching?.n ?? 0, checked: judged.length };
}

// ── one passage ────────────────────────────────────────────────────────────

export interface ClaimFactor {
  key: string;
  label: string;
  role: string;
  /** A factor of one of the reviewer's charts. */
  mine: boolean;
}

export interface ClaimItem {
  id: string;
  ordinal: number;
  body: string;
  factors: ClaimFactor[];
  conditionKeys: { key: string; label: string }[];
  condition: string | null;
  valence: string | null;
  certainty: string | null;
  /** The digest's own certainty label, before mapping to the brief's vocabulary. */
  digestCertainty: string | null;
  register: string | null;
  frame: Record<string, unknown>;
  lifeArea: number | null;
  otherFactors: string[];
  because: string | null;
  keywords: string[];
  /** Passage sentence indexes this claim most likely came from (word overlap; approximate). */
  sentences: number[];
}

export interface ClaimReviewRow {
  id: string;
  action: ClaimAction;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ClaimPassage {
  textId: string;
  body: string;
  sentences: string[];
  /** Heading path above the passage, outermost first, each with the factors it names (the scope the passage sits in). */
  headings: { text: string; scope: { key: string; label: string }[] }[];
  pages: number[];
  book: string | null;
  author: string | null;
  zodiac: string | null;
  trainable: boolean;
  claims: ClaimItem[];
  /** This reviewer's claim reviews on the passage, oldest first. */
  reviews: ClaimReviewRow[];
}

const label = (k: string) => FACTOR_BY_KEY.get(k)?.label ?? k;
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function loadClaimPassage(textId: string, reviewerId: string): Promise<ClaimPassage | null> {
  let t:
    | { id: string; body: string; meta: Record<string, unknown>; title: string | null; author: string | null; trainable: boolean }
    | undefined;
  try {
    [t] = await db<NonNullable<typeof t>[]>`
      SELECT t.id, t.body, t.meta, s.title, s.author, s.trainable
      FROM astro_texts t JOIN astro_sources s ON s.id = t.source_id
      WHERE t.id = ${textId} AND t.org_id = ${ORG_ID} AND t.kind = 'import'
    `;
  } catch {
    return null; // a malformed id in the URL
  }
  if (!t) return null;

  const [rows, factorRows, reviews, mine] = await Promise.all([
    db<
      {
        id: string;
        ordinal: number;
        body: string;
        condition: string | null;
        condition_keys: string[];
        valence: string | null;
        certainty: string | null;
        register: string | null;
        frame: Record<string, unknown>;
        life_area: number | null;
        other_factors: string[];
        meta: Record<string, unknown>;
      }[]
    >`
      SELECT id, ordinal, body, condition, condition_keys, valence, certainty, register, frame, life_area, other_factors, meta
      FROM astro_statements WHERE text_id = ${t.id} AND labelled_by = ${CLAIM_LABELLER}
      ORDER BY ordinal
    `,
    db<{ statement_id: string; factor_key: string; role: string }[]>`
      SELECT f.statement_id, f.factor_key, f.role
      FROM astro_statement_factors f JOIN astro_statements s ON s.id = f.statement_id
      WHERE s.text_id = ${t.id} AND s.labelled_by = ${CLAIM_LABELLER}
      ORDER BY f.factor_key
    `,
    db<{ id: string; action: string; payload: Record<string, unknown>; created_at: Date }[]>`
      SELECT id, action, payload, created_at FROM astro_reviews
      WHERE org_id = ${ORG_ID} AND reviewer_id = ${reviewerId} AND question_id IS NULL
        AND action = ANY (${[...CLAIM_ACTIONS]}) AND payload->>'textId' = ${t.id}
      ORDER BY created_at
    `,
    ownerChartKeys(reviewerId),
  ]);
  const mineSet = new Set(mine);
  const sentences = passageSentences(t.body);
  const matches = matchClaimSentences(sentences, rows.map((r) => r.body));
  const byStatement = new Map<string, ClaimFactor[]>();
  for (const f of factorRows) {
    const list = byStatement.get(f.statement_id) ?? [];
    list.push({ key: f.factor_key, label: label(f.factor_key), role: f.role, mine: mineSet.has(f.factor_key) });
    byStatement.set(f.statement_id, list);
  }
  const meta = t.meta ?? {};

  return {
    textId: t.id,
    body: t.body,
    sentences,
    headings: strings(meta.headings).map((h) => ({
      text: h,
      scope: [...new Set(tagText(h, { mentions: true }).map((x) => x.key))].map((k) => ({ key: k, label: label(k) })),
    })),
    pages: Array.isArray(meta.pages) ? meta.pages.filter((x): x is number => typeof x === "number") : [],
    book: t.title,
    author: t.author,
    zodiac: typeof meta.zodiac === "string" ? meta.zodiac : null,
    trainable: t.trainable,
    claims: rows.map((r, i) => ({
      id: r.id,
      ordinal: r.ordinal,
      body: r.body,
      factors: byStatement.get(r.id) ?? [],
      conditionKeys: (r.condition_keys ?? []).map((k) => ({ key: k, label: label(k) })),
      condition: r.condition,
      valence: r.valence,
      certainty: r.certainty,
      digestCertainty: typeof r.meta?.digestCertainty === "string" ? r.meta.digestCertainty : null,
      register: r.register,
      frame: r.frame ?? {},
      lifeArea: r.life_area,
      otherFactors: r.other_factors ?? [],
      because: typeof r.meta?.because === "string" && r.meta.because.trim() ? r.meta.because : null,
      keywords: strings(r.meta?.keywords),
      sentences: matches[i] ?? [],
    })),
    reviews: reviews.map((r) => ({ id: r.id, action: r.action as ClaimAction, payload: r.payload, createdAt: r.created_at.toISOString() })),
  };
}

// ── recording ──────────────────────────────────────────────────────────────

/** Check a claim review against the passage and its claims, then store it. */
export async function recordClaimReview(r: {
  reviewerId: string;
  action: ClaimAction;
  payload: Record<string, unknown>;
  seconds: number | null;
  device: string | null;
}): Promise<{ reviewId: string }> {
  const payload = cleanClaimPayload(r.action, r.payload);
  const [text] = await db<{ id: string }[]>`
    SELECT id FROM astro_texts WHERE id = ${payload.textId as string} AND org_id = ${ORG_ID} AND kind = 'import'
  `;
  if (!text) throw new ClaimError("Passage not found");
  if (r.action === "claim-verdict") {
    const [s] = await db<{ id: string; keys: string[] }[]>`
      SELECT s.id, s.condition_keys || COALESCE((SELECT array_agg(f.factor_key) FROM astro_statement_factors f WHERE f.statement_id = s.id), '{}') AS keys
      FROM astro_statements s WHERE s.id = ${payload.statementId as string} AND s.text_id = ${text.id} AND s.labelled_by = ${CLAIM_LABELLER}
    `;
    if (!s) throw new ClaimError("That claim is not one of this passage's");
    const onClaim = new Set(s.keys);
    for (const k of (payload.tagsRemove as string[] | undefined) ?? []) if (!onClaim.has(k)) throw new ClaimError(`${k} is not on this claim`);
    for (const k of (payload.tagsAdd as string[] | undefined) ?? []) if (onClaim.has(k)) throw new ClaimError(`${k} is already on this claim`);
  }
  const [rev] = await db<{ id: string }[]>`
    INSERT INTO astro_reviews (org_id, question_id, reviewer_id, action, payload, candidate_ids, shown_order, stance, seconds, device)
    VALUES (${ORG_ID}, NULL, ${r.reviewerId}, ${r.action}, ${db.json(payload as never)}, ${[]}, ${[]}, NULL, ${r.seconds}, ${r.device})
    RETURNING id
  `;
  return { reviewId: rev.id };
}
