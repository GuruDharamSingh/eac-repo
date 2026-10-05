/**
 * @elkdonis/astro-corpus/server — database access for the corpus tables
 * (migration 167). Server only: imports the shared postgres client.
 *
 * Every write here is idempotent on a natural key (factor key, source slug,
 * source + source_ref), so an importer can be re-run after a fix without
 * duplicating rows.
 */

import { db } from "@elkdonis/db";
import { FACTORS } from "./factors";
import type { FactorTag } from "./tagger";

export { ORG_ID, upsertSource, type SourceInput } from "./sources";
import { ORG_ID } from "./sources";

// ── factors ────────────────────────────────────────────────────────────────

/** Upsert the whole registry into astro_factors. Returns the row count. */
export async function seedFactors(): Promise<number> {
  const rows = FACTORS.map((f) => ({
    key: f.key,
    kind: f.kind,
    label: f.label,
    parts: f.parts,
    point_group: f.group,
    generational: f.generational,
    minor: f.minor,
    impossible: f.impossible,
    unobserved: f.unobserved,
    book_group: f.bookGroup,
  }));
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => ({ ...r, parts: db.json(r.parts) }));
    await db`
      INSERT INTO astro_factors ${db(chunk, "key", "kind", "label", "parts", "point_group", "generational", "minor", "impossible", "unobserved", "book_group")}
      ON CONFLICT (key) DO UPDATE SET
        kind = EXCLUDED.kind,
        label = EXCLUDED.label,
        parts = EXCLUDED.parts,
        point_group = EXCLUDED.point_group,
        generational = EXCLUDED.generational,
        minor = EXCLUDED.minor,
        impossible = EXCLUDED.impossible,
        unobserved = EXCLUDED.unobserved,
        book_group = EXCLUDED.book_group,
        updated_at = now()
    `;
  }
  return rows.length;
}

// ── questions with their imported answers ──────────────────────────────────

export interface ImportItem {
  sourceRef: string;
  prompt: string;
  original?: string | null;
  type: string;
  tradition?: string | null;
  tags: FactorTag[];
  /** The dataset's answer, imported as a candidate text (kind 'import'). */
  answer?: string | null;
  meta?: Record<string, unknown>;
}

/**
 * Insert questions (and their answers as candidate texts) for one source.
 * Existing rows (same source + source_ref) are left as they are, so reviews
 * already made against them keep pointing at the same ids.
 */
export async function importItems(sourceId: string, items: ImportItem[], opts: { priority?: number; origin?: string } = {}) {
  let questions = 0;
  let texts = 0;
  const CHUNK = 200;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    await db.begin(async (tx) => {
      for (const it of chunk) {
        const keys = it.tags.map((t) => t.key);
        const q = await tx<{ id: string }[]>`
          INSERT INTO astro_questions (org_id, type, prompt, factor_keys, tradition, priority, origin, source_id, source_ref, original, meta)
          VALUES (${ORG_ID}, ${it.type}, ${it.prompt}, ${keys}, ${it.tradition ?? null}, ${opts.priority ?? 0}, ${opts.origin ?? "import"},
                  ${sourceId}, ${it.sourceRef}, ${it.original ?? null}, ${tx.json((it.meta ?? {}) as never)})
          ON CONFLICT (source_id, source_ref) DO NOTHING
          RETURNING id
        `;
        if (!q.length) continue;
        questions++;
        if (!it.answer) continue;
        const t = await tx<{ id: string }[]>`
          INSERT INTO astro_texts (org_id, source_id, source_ref, kind, tradition, body)
          VALUES (${ORG_ID}, ${sourceId}, ${it.sourceRef}, 'import', ${it.tradition ?? null}, ${it.answer})
          ON CONFLICT (source_id, source_ref) DO NOTHING
          RETURNING id
        `;
        if (!t.length) continue;
        texts++;
        await tx`INSERT INTO astro_candidates (question_id, text_id) VALUES (${q[0].id}, ${t[0].id}) ON CONFLICT DO NOTHING`;
        for (const tag of it.tags) {
          await tx`
            INSERT INTO astro_text_factors (text_id, factor_key, role, confidence)
            VALUES (${t[0].id}, ${tag.key}, 'primary', ${tag.confidence})
            ON CONFLICT DO NOTHING
          `;
        }
      }
    });
  }
  return { questions, texts };
}

/** Coverage by factor kind: how many factors have at least one text, question, gold text. */
export async function coverage() {
  return db<{ kind: string; factors: number; with_text: number; with_question: number }[]>`
    SELECT f.kind,
           count(*)::int AS factors,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM astro_text_factors tf WHERE tf.factor_key = f.key))::int AS with_text,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM astro_questions q WHERE f.key = ANY (q.factor_keys)))::int AS with_question
    FROM astro_factors f
    WHERE NOT f.impossible
    GROUP BY f.kind
    ORDER BY f.kind
  `;
}

export * from "./studio";
export * from "./reasoning";
export * from "./ref-votes";
export * from "./claims";
export * from "./vocab";
export * from "./foundations";
export * from "./library";
export { engineText, ENGINE_SOURCE_SLUG } from "./engine";
