/** Source records (astro_sources). Server only. */

import { db } from "@elkdonis/db";

export const ORG_ID = "elastrocal";

// ── sources ────────────────────────────────────────────────────────────────

export interface SourceInput {
  slug: string;
  title: string;
  author?: string | null;
  kind: "book" | "dataset" | "compilation" | "own" | "generated" | "engine";
  licence: string;
  trainable: boolean;
  url?: string | null;
  notes?: string | null;
  meta?: Record<string, unknown>;
  importer: string;
}

/** `sql` may be a transaction; defaults to the shared client. */
export async function upsertSource(s: SourceInput, sql: typeof db = db): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO astro_sources (org_id, slug, title, author, kind, licence, trainable, url, notes, meta, importer)
    VALUES (${ORG_ID}, ${s.slug}, ${s.title}, ${s.author ?? null}, ${s.kind}, ${s.licence}, ${s.trainable},
            ${s.url ?? null}, ${s.notes ?? null}, ${sql.json((s.meta ?? {}) as never)}, ${s.importer})
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      author = EXCLUDED.author,
      kind = EXCLUDED.kind,
      notes = EXCLUDED.notes,
      meta = EXCLUDED.meta,
      importer = EXCLUDED.importer
    RETURNING id
  `;
  // Licence and trainable are deliberately not overwritten on re-import: once
  // a person has cleared a licence in the studio, an importer must not reset it.
  return row.id;
}

