/**
 * Import tagged books from the chunker pipeline (Ubuntu/WSL, Postgres
 * `chunker`; schema in the pipeline's SCHEMA.md) into the corpus tables.
 *
 * The chunker database is not reachable from this server, so the pipeline
 * exports a folder (export-for-studio.sh, shipped with astro-tagger):
 *
 *   documents.jsonl        one chunker_documents row per tagged book, plus "paths"
 *   chunks/<hash>.jsonl    id, doc_hash, chunk_index, title, source, headings, pages, n_tokens, norm_hash, text, body
 *   tags/<hash>.jsonl      id, factor_keys, factor_tags, tagger_version
 *
 *   docker compose run --rm --no-deps -v ~/astro-corpus:/corpus -e CORPUS_DIR=/corpus \
 *     -w /app/packages/astro-corpus admin pnpm exec tsx scripts/import-chunker.ts <folder> [--trial | --write]
 *
 * <folder> is relative to $CORPUS_DIR (e.g. inbox/chunker-2026-09-28).
 * Default is a dry run (counts only). --trial does every write inside one
 * transaction and rolls it back. --write commits.
 *
 * Mapping:
 *   book   → astro_sources: slug "book:<content_hash>", kind book, licence
 *            "unknown", trainable (owner decision 2026-09-27), meta with
 *            zodiac, file type, pages, quality, tagger version, paths
 *   chunk  → astro_texts: kind import, source_ref = chunk id, body without
 *            title and headings, tradition "vedic" for sidereal books,
 *            meta with chunkIndex, headings, pages (physical PDF pages),
 *            nTokens, normHash, zodiac, taggerVersion
 *   tag    → astro_text_factors: confidence as given; role "mentioned" for
 *            bare mentions, "primary" otherwise
 * Only books with status "tagged" are imported. A book is imported whole: its
 * chunks are upserted, and chunks no longer present are deleted unless a
 * review or candidate refers to them. A chunk whose normalised text is already
 * in the corpus from another book is skipped. Embeddings are not imported.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { db } from "@elkdonis/db";
import { deriveCompounds } from "../src/compounds";
import { FACTOR_BY_KEY } from "../src/factors";

/** Roles a claim's factor can play (the next digest pass sends `roles: {key: role}`); anything else is "subject". */
const CLAIM_ROLES = new Set(["subject", "required", "alternative", "context", "contrast", "condition"]);
const roleOf = (s: { roles?: Record<string, string> }, key: string) => (s.roles && CLAIM_ROLES.has(s.roles[key]) ? s.roles[key] : "subject");
import { ORG_ID, upsertSource } from "../src/sources";

const CORPUS = process.env.CORPUS_DIR ?? "/corpus";
const folderArg = process.argv[2];
const mode = process.argv.includes("--write") ? "write" : process.argv.includes("--trial") ? "trial" : "dry-run";

interface Doc {
  content_hash: string;
  title: string;
  author: string | null;
  zodiac: string;
  meta_source: string;
  file_type: string;
  n_pages: number | null;
  n_chunks: number | null;
  status: string;
  tagger_version: string | null;
  quality: unknown;
  paths?: string[];
  /** From the pipeline's classify stage (studio tradition vocabulary); may be absent in older exports. */
  tradition?: string | null;
  pub_year?: number | null;
  tradition_source?: string | null;
  book_note?: string | null;
}
interface Chunk {
  id: string;
  doc_hash: string;
  chunk_index: number;
  headings: string[];
  pages: number[];
  n_tokens: number;
  norm_hash: string | null;
  body: string;
  content_type?: string | null;
  text_quality?: string | null;
  /** From the pipeline's digest stage (Claude): the chunk's interpretive claims. */
  statements?: {
    claim: string;
    factors: string[];
    other_factors: string[];
    life_area: number;
    valence: string;
    certainty: string;
    condition: string;
    frame: string;
    /** digest-v3 and later: factor keys named in the condition, and the author's stated reason. */
    condition_factors?: string[];
    because?: string;
    keywords?: string[];
    /** From the pipeline's local post-pass. */
    dignities?: { point: string; sign: string; state: string }[];
    aspect_pairs?: string[];
  }[];
  digest_model?: string | null;
}
interface TagRow {
  id: string;
  factor_tags: { key: string; confidence: string }[];
  tagger_version: string;
}

const readJsonl = <T,>(p: string): T[] =>
  existsSync(p)
    ? readFileSync(p, "utf8")
        .split("\n")
        .filter((l) => l.trim())
        // Postgres text can't hold NUL characters, which some OCR output carries.
        .map((l) => JSON.parse(l, (_k, v) => (typeof v === "string" ? v.replace(/\0/g, "") : v)) as T)
    : [];

class Rollback extends Error {}

async function main() {
  if (!folderArg) throw new Error("usage: import-chunker.ts <folder under CORPUS_DIR> [--trial | --write]");
  const dir = path.resolve(CORPUS, folderArg);
  const docs = readJsonl<Doc>(path.join(dir, "documents.jsonl"));
  const tagged = docs.filter((d) => d.status === "tagged");
  console.log(`${docs.length} books in documents.jsonl, ${tagged.length} with status tagged; mode ${mode}`);

  const plan = tagged.map((d) => {
    const chunks = readJsonl<Chunk>(path.join(dir, "chunks", `${d.content_hash}.jsonl`));
    const tags = new Map(readJsonl<TagRow>(path.join(dir, "tags", `${d.content_hash}.jsonl`)).map((t) => [t.id, t]));
    const unknownKeys = new Set<string>();
    let tagCount = 0;
    for (const c of chunks) {
      for (const t of tags.get(c.id)?.factor_tags ?? []) {
        if (FACTOR_BY_KEY.has(t.key)) tagCount++;
        else unknownKeys.add(t.key);
      }
    }
    return { d, chunks, tags, tagCount, unknownKeys, untagged: chunks.filter((c) => !tags.has(c.id)).length };
  });
  for (const p of plan) {
    console.log(
      `  ${p.d.title.slice(0, 50).padEnd(50)} ${p.d.zodiac.padEnd(9)} ${String(p.chunks.length).padStart(5)} chunks ${String(p.tagCount).padStart(6)} tags` +
        (p.untagged ? `  ${p.untagged} chunks without tags` : "") +
        (p.unknownKeys.size ? `  unknown keys: ${[...p.unknownKeys].slice(0, 3).join(", ")}` : "") +
        (p.chunks.length ? "" : "  (no chunk file)"),
    );
  }
  if (mode === "dry-run") {
    console.log("\nDry run. --trial writes inside a transaction and rolls back; --write commits.");
    await db.end();
    return;
  }

  const totals = { books: 0, texts: 0, duplicates: 0, tags: 0, statements: 0, removed: 0, keptReferenced: 0 };
  try {
    await db.begin(async (tx) => {
      // Migration 176 adds astro_texts.meta. In a trial the column is added
      // inside the transaction if it is missing, and rolled back with it.
      const [{ has }] = await tx<{ has: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'astro_texts' AND column_name = 'meta') AS has`;
      if (!has) {
        if (mode === "write") throw new Error("astro_texts.meta is missing: apply migration 176 first");
        await tx`ALTER TABLE astro_texts ADD COLUMN meta JSONB NOT NULL DEFAULT '{}'::jsonb`;
      }

      for (const { d, chunks, tags } of plan) {
        if (!chunks.length) continue;
        const sourceId = await upsertSource(
          {
            slug: `book:${d.content_hash}`,
            title: d.title,
            author: d.author,
            kind: "book",
            licence: "unknown",
            trainable: true,
            notes: `Imported from the chunker pipeline: ${d.file_type}, ${d.n_pages ?? "?"} pages, ${chunks.length} chunks.`,
            meta: {
              contentHash: d.content_hash,
              zodiac: d.zodiac,
              fileType: d.file_type,
              nPages: d.n_pages,
              nChunks: d.n_chunks,
              tradition: d.tradition ?? null,
              pubYear: d.pub_year ?? null,
              traditionSource: d.tradition_source ?? null,
              bookNote: d.book_note ?? null,
              metaSource: d.meta_source,
              quality: d.quality,
              taggerVersion: d.tagger_version,
              paths: d.paths ?? [],
            },
            importer: "astro-corpus/import-chunker.ts",
          },
          tx,
        );
        totals.books++;
        const tradition = d.zodiac === "sidereal" ? "vedic" : (d.tradition ?? null);
        const keep: string[] = [];

        for (const c of chunks) {
          if (c.norm_hash) {
            const [dup] = await tx<{ id: string }[]>`
              SELECT id FROM astro_texts
              WHERE meta->>'normHash' = ${c.norm_hash} AND source_id <> ${sourceId} LIMIT 1`;
            if (dup) {
              totals.duplicates++;
              continue;
            }
          }
          const t = tags.get(c.id);
          const meta = {
            docHash: d.content_hash,
            chunkIndex: c.chunk_index,
            headings: c.headings,
            pages: c.pages,
            nTokens: c.n_tokens,
            normHash: c.norm_hash,
            zodiac: d.zodiac,
            taggerVersion: t?.tagger_version ?? d.tagger_version,
            contentType: c.content_type ?? null,
            textQuality: c.text_quality ?? null,
          };
          const [row] = await tx<{ id: string }[]>`
            INSERT INTO astro_texts (org_id, source_id, source_ref, kind, tradition, author, body, meta)
            VALUES (${ORG_ID}, ${sourceId}, ${c.id}, 'import', ${tradition}, ${d.author}, ${c.body}, ${tx.json(meta as never)})
            ON CONFLICT (source_id, source_ref) DO UPDATE SET
              body = EXCLUDED.body, author = EXCLUDED.author, tradition = EXCLUDED.tradition, meta = EXCLUDED.meta
            RETURNING id
          `;
          keep.push(c.id);
          totals.texts++;
          await tx`DELETE FROM astro_text_factors WHERE text_id = ${row.id}`;
          const rows = (t?.factor_tags ?? [])
            .filter((g) => FACTOR_BY_KEY.has(g.key))
            .map((g) => ({ text_id: row.id, factor_key: g.key, role: g.confidence === "mentioned" ? "mentioned" : "primary", confidence: g.confidence }));
          if (rows.length) {
            await tx`INSERT INTO astro_text_factors ${tx(rows, "text_id", "factor_key", "role", "confidence")} ON CONFLICT DO NOTHING`;
            totals.tags += rows.length;
          }

          // Digest statements (migration 178): the chunk's claims with their factors. Updated in
          // place by position, so reasoning steps that cite a statement keep pointing at it.
          const statements = c.statements ?? [];
          await tx`DELETE FROM astro_statements
                   WHERE text_id = ${row.id} AND labelled_by = 'chunker-digest' AND ordinal >= ${statements.length}`;
          for (const [ordinal, s] of statements.entries()) {
            const [st] = await tx<{ id: string }[]>`
              INSERT INTO astro_statements (org_id, text_id, ordinal, body, life_area, valence, certainty, condition, condition_keys,
                                            frame, register, other_factors, labelled_by, model, meta)
              VALUES (${ORG_ID}, ${row.id}, ${ordinal}, ${s.claim}, ${s.life_area || null}, ${s.valence},
                      ${s.certainty === "asserted" ? "usually" : "may"}, ${s.condition || null},
                      ${(s.condition_factors ?? []).filter((k) => FACTOR_BY_KEY.has(k))}, ${tx.json({ zodiac: d.zodiac } as never)},
                      ${s.frame}, ${s.other_factors}, 'chunker-digest', ${c.digest_model ?? null},
                      ${tx.json({ digestCertainty: s.certainty, because: s.because || null, keywords: s.keywords ?? [],
                                  dignities: s.dignities ?? [], aspectPairs: s.aspect_pairs ?? [] } as never)})
              ON CONFLICT (text_id, ordinal, labelled_by) DO UPDATE SET
                body = EXCLUDED.body, life_area = EXCLUDED.life_area, valence = EXCLUDED.valence, certainty = EXCLUDED.certainty,
                condition = EXCLUDED.condition, condition_keys = EXCLUDED.condition_keys, frame = EXCLUDED.frame, register = EXCLUDED.register,
                other_factors = EXCLUDED.other_factors, model = EXCLUDED.model, meta = EXCLUDED.meta
              RETURNING id`;
            await tx`DELETE FROM astro_statement_factors WHERE statement_id = ${st.id}`;
            totals.statements++;
            const factorRows = s.factors
              .map((key) => FACTOR_BY_KEY.get(key))
              .filter((f): f is NonNullable<typeof f> => Boolean(f))
              .map((f) => ({
                statement_id: st.id,
                factor_key: f.key,
                role: roleOf(s as { roles?: Record<string, string> }, f.key),
                kind: f.kind,
                point: f.parts.point ?? null,
                other_point: f.parts.other ?? null,
                sign: f.parts.sign ?? null,
                house: f.parts.house ?? null,
                aspect: f.parts.aspect ?? null,
              }));
            if (factorRows.length) {
              await tx`INSERT INTO astro_statement_factors ${tx(factorRows, "statement_id", "factor_key", "role", "kind", "point", "other_point", "sign", "house", "aspect")} ON CONFLICT DO NOTHING`;
            }
            // Compounds and layers the claim carries without being tagged with them (src/compounds.ts), role "derived".
            const derived = deriveCompounds(factorRows.map((r) => r.factor_key), s.claim)
              .map((key) => FACTOR_BY_KEY.get(key)!)
              .map((f) => ({ statement_id: st.id, factor_key: f.key, role: "derived", kind: f.kind, point: f.parts.point ?? null, other_point: null, sign: f.parts.sign ?? null, house: f.parts.house ?? null, aspect: null }));
            if (derived.length) {
              await tx`INSERT INTO astro_statement_factors ${tx(derived, "statement_id", "factor_key", "role", "kind", "point", "other_point", "sign", "house", "aspect")} ON CONFLICT DO NOTHING`;
              await tx`INSERT INTO astro_text_factors ${tx(derived.map((d) => ({ text_id: row.id, factor_key: d.factor_key, role: "mentioned", confidence: "inferred" })), "text_id", "factor_key", "role", "confidence")} ON CONFLICT DO NOTHING`;
            }
          }
        }

        // Chunks from an earlier import of this book that are gone now,
        // unless something in the studio points at them.
        const stale = await tx<{ id: string; referenced: boolean }[]>`
          SELECT t.id,
            (EXISTS (SELECT 1 FROM astro_candidates c WHERE c.text_id = t.id)
              OR EXISTS (SELECT 1 FROM astro_reviews r WHERE t.id = ANY (r.candidate_ids))
              OR EXISTS (SELECT 1 FROM astro_reasoning_steps s WHERE s.text_id = t.id)) AS referenced
          FROM astro_texts t
          WHERE t.source_id = ${sourceId} AND NOT (t.source_ref = ANY (${keep}))
        `;
        const removable = stale.filter((s) => !s.referenced).map((s) => s.id);
        totals.keptReferenced += stale.length - removable.length;
        if (removable.length) {
          await tx`DELETE FROM astro_texts WHERE id = ANY (${removable})`;
          totals.removed += removable.length;
        }
      }

      console.log(JSON.stringify(totals, null, 2));
      if (mode === "trial") throw new Rollback();
    });
    console.log("Committed.");
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
    console.log("Trial: rolled back, nothing written.");
  }
  await db.end();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await db.end();
  process.exit(1);
});
