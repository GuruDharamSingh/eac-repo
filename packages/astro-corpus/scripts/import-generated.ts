/**
 * Import generated questions, each with several candidate answers, from the
 * chunker's Q&A generator (chunker/qa.py in the WSL pipeline).
 *
 *   docker compose run --rm --no-deps -v ~/astro-corpus:/corpus -e CORPUS_DIR=/corpus \
 *     -w /app/packages/astro-corpus admin pnpm exec tsx scripts/import-generated.ts <file> [--trial | --write]
 *
 * <file> is relative to $CORPUS_DIR, e.g. inbox/qa-pilot-2026-09-27/qa-pilot-2026-09-27.jsonl.
 * Default is a dry run (screening counts only). --trial writes inside one
 * transaction and rolls it back. --write commits.
 *
 * Each line: {ref, prompt, type, angle, level, tradition, factor_tags, seed, generation, candidates[]}.
 *   question  → astro_questions: origin 'generated', source "generated:<run>", source_ref = ref,
 *               priority 1, meta {run, angle, level, seed, generation}
 *   generated → astro_texts kind 'generated' under the same source, with model, prompt_hash and
 *               generated_from {run, questionRef, design, designNote, promptVersion, batchId, references}.
 *               design is "strong" or a deliberate weakness (generic, subtle_error, fatalistic,
 *               keyword_list); it is for analysis and export, never shown while reviewing.
 *   book      → astro_texts kind 'import' under the book's own source "book:<content_hash>" (the slug
 *               import-chunker uses), source_ref "<chunk id>#<question ref>", author from the book.
 *               import-chunker keeps these on re-import because a question refers to them.
 * Screening against the studio: questionViability, known and possible factors, exact duplicates of
 * existing questions, and near-copies of test-set questions (a shared factor key plus word overlap).
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "@elkdonis/db";
import { FACTOR_BY_KEY } from "../src/factors";
import { normalizeQuestion, questionViability, QUESTION_TYPES } from "../src/questions";
import { ORG_ID, upsertSource } from "../src/sources";

const CORPUS = process.env.CORPUS_DIR ?? "/corpus";
const fileArg = process.argv[2];
const mode = process.argv.includes("--write") ? "write" : process.argv.includes("--trial") ? "trial" : "dry-run";

const TRADITIONS = new Set(["modern", "psychological", "rosicrucian", "hellenistic", "medieval", "vedic", "evolutionary"]);
const NEAR_TEST_OVERLAP = 0.5;
const STOPWORDS = new Set(
  "the and for are with what how does this that you your from into can when which who why was were has have had its not but about there their they them his her she him".split(" "),
);

interface Tag {
  key: string;
  confidence: string;
  match: string;
}
interface Candidate {
  ref: string;
  kind: "generated" | "book";
  design: string;
  design_note: string;
  body: string;
  tradition: string | null;
  model?: string;
  prompt_version?: string;
  prompt_hash?: string;
  batch_id?: string;
  references?: string[];
  book?: { doc_hash: string; title: string; author: string | null; chunk_id: string; pages: number[]; headings: string[]; zodiac: string };
}
interface Line {
  ref: string;
  /** Attach the candidates to this existing question instead of creating one (drafts for imported questions). */
  question_id?: string;
  prompt: string;
  type: string;
  angle: string;
  level: string;
  tradition: string | null;
  factor_tags: Tag[];
  seed: unknown;
  generation: { model: string; prompt_version: string; prompt_hash: string; batch_id: string };
  candidates: Candidate[];
}

class Rollback extends Error {}

const words = (t: string) => new Set(normalizeQuestion(t).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w)));
const overlap = (a: Set<string>, b: Set<string>) => {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / (a.size + b.size - shared || 1);
};

async function main() {
  if (!fileArg || fileArg.startsWith("--")) throw new Error("usage: import-generated.ts <file under $CORPUS_DIR> [--trial | --write]");
  const file = path.join(CORPUS, fileArg);
  const run = path.basename(file, ".jsonl");
  const lines: Line[] = readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Line);

  const existing = await db<{ prompt: string; factor_keys: string[]; eval: boolean }[]>`
    SELECT prompt, factor_keys, (meta ? 'evalSet') AS eval FROM astro_questions WHERE org_id = ${ORG_ID}`;
  const seen = new Set(existing.map((q) => normalizeQuestion(q.prompt)));
  const testSet = existing.filter((q) => q.eval).map((q) => ({ keys: new Set(q.factor_keys), words: words(q.prompt) }));

  const skipped: Record<string, number> = {};
  const skip = (reason: string) => (skipped[reason] = (skipped[reason] ?? 0) + 1);
  const accepted: Line[] = [];
  for (const l of lines) {
    const v = questionViability(l.prompt);
    if (!v.ok) {
      skip(v.reason);
      continue;
    }
    if (!(QUESTION_TYPES as readonly string[]).includes(l.type)) {
      skip("unknown-type");
      continue;
    }
    if (l.tradition && !TRADITIONS.has(l.tradition)) {
      skip("unknown-tradition");
      continue;
    }
    const tags = l.factor_tags.filter((t) => FACTOR_BY_KEY.has(t.key));
    if (!tags.length) {
      skip("no-known-factor");
      continue;
    }
    if (tags.some((t) => FACTOR_BY_KEY.get(t.key)!.impossible || FACTOR_BY_KEY.get(t.key)!.unobserved)) {
      skip("impossible-or-unobserved-factor");
      continue;
    }
    const norm = normalizeQuestion(l.prompt);
    if (!l.question_id && seen.has(norm)) {  // drafts attached to an existing question share its prompt by design
      skip("duplicate-of-existing");
      continue;
    }
    const keys = tags.map((t) => t.key);
    const w = words(l.prompt);
    if (testSet.some((t) => keys.some((k) => t.keys.has(k)) && overlap(w, t.words) >= NEAR_TEST_OVERLAP)) {
      skip("near-test-set");
      continue;
    }
    const candidates = l.candidates.filter((c) => c.body?.trim());
    if (candidates.length < 2) {
      skip("fewer-than-two-candidates");
      continue;
    }
    seen.add(norm);
    accepted.push({ ...l, factor_tags: tags, candidates });
  }

  const designs: Record<string, number> = {};
  for (const l of accepted) for (const c of l.candidates) designs[c.design] = (designs[c.design] ?? 0) + 1;
  console.log(`${lines.length} questions in ${fileArg}, ${accepted.length} pass screening; mode ${mode}`);
  console.log("skipped:", Object.keys(skipped).length ? skipped : "none");
  console.log("candidates by design:", designs);
  if (mode === "dry-run") {
    console.log("\nDry run. --trial writes inside a transaction and rolls back; --write commits.");
    await db.end();
    return;
  }

  const totals: Record<string, number> = { questions: 0, attached: 0, generatedTexts: 0, bookTexts: 0, candidates: 0, tags: 0 };
  try {
    await db.begin(async (tx) => {
      const models = [...new Set(accepted.flatMap((l) => l.candidates.map((c) => c.model).filter(Boolean)))];
      const generatedSource = await upsertSource(
        {
          slug: `generated:${run}`,
          title: `Generated Q&A: ${run}`,
          author: `${models.join(", ") || "Claude"} via chunker qa.py`,
          kind: "generated",
          licence: "owner",
          trainable: true,
          notes: "Questions seeded by corpus passages; one strong candidate and deliberately weaker ones per question (design in astro_texts.generated_from).",
          meta: { run, models, questions: accepted.length },
          importer: "astro-corpus/import-generated.ts",
        },
        tx,
      );
      const bookSources = new Map<string, string>();

      for (const l of accepted) {
        let q: { id: string } | undefined;
        if (l.question_id) {
          // Drafts for an existing question; test-set questions stay blind and never get candidates.
          [q] = await tx<{ id: string }[]>`
            SELECT id FROM astro_questions WHERE id = ${l.question_id} AND coalesce(meta->>'evalSet', '') = ''
          `;
          if (!q) continue;
          totals.attached = (totals.attached ?? 0) + 1;
        } else {
          [q] = await tx<{ id: string }[]>`
            INSERT INTO astro_questions (org_id, type, prompt, factor_keys, tradition, priority, origin, source_id, source_ref, meta)
            VALUES (${ORG_ID}, ${l.type}, ${l.prompt}, ${l.factor_tags.map((t) => t.key)}, ${l.tradition}, 1, 'generated',
                    ${generatedSource}, ${l.ref}, ${tx.json({ run, angle: l.angle, level: l.level, seed: l.seed, generation: l.generation } as never)})
            ON CONFLICT (source_id, source_ref) DO NOTHING
            RETURNING id
          `;
          if (!q) continue;
          totals.questions++;
        }

        for (const c of l.candidates) {
          let sourceId = generatedSource;
          let sourceRef = c.ref;
          let kind = "generated";
          let author: string | null = null;
          let generatedFrom: unknown = null;
          if (c.kind === "book" && c.book) {
            const b = c.book;
            let id = bookSources.get(b.doc_hash);
            if (!id) {
              id = await upsertSource(
                {
                  slug: `book:${b.doc_hash}`,
                  title: b.title,
                  author: b.author,
                  kind: "book",
                  licence: "unknown",
                  trainable: true,
                  notes: "Created by import-generated.ts for a book excerpt used as a candidate answer.",
                  meta: { contentHash: b.doc_hash, zodiac: b.zodiac },
                  importer: "astro-corpus/import-generated.ts",
                },
                tx,
              );
              bookSources.set(b.doc_hash, id);
            }
            sourceId = id;
            sourceRef = `${b.chunk_id}#${l.ref}`;
            kind = "import";
            author = b.author;
          } else {
            generatedFrom = {
              run,
              questionRef: l.ref,
              design: c.design,
              designNote: c.design_note,
              promptVersion: c.prompt_version,
              batchId: c.batch_id,
              references: c.references ?? [],
            };
          }

          const [t] = await tx<{ id: string }[]>`
            INSERT INTO astro_texts (org_id, source_id, source_ref, kind, tradition, author, body, model, prompt_hash, generated_from)
            VALUES (${ORG_ID}, ${sourceId}, ${sourceRef}, ${kind}, ${l.tradition}, ${author}, ${c.body.trim()},
                    ${c.model ?? null}, ${c.prompt_hash ?? null}, ${generatedFrom ? tx.json(generatedFrom as never) : null})
            ON CONFLICT (source_id, source_ref) DO NOTHING
            RETURNING id
          `;
          if (!t) continue;
          if (kind === "import") totals.bookTexts++;
          else totals.generatedTexts++;
          await tx`INSERT INTO astro_candidates (question_id, text_id) VALUES (${q.id}, ${t.id}) ON CONFLICT DO NOTHING`;
          totals.candidates++;

          const rows = l.factor_tags.map((g) => ({
            text_id: t.id,
            factor_key: g.key,
            role: g.confidence === "mentioned" ? "mentioned" : "primary",
            confidence: g.confidence,
          }));
          await tx`INSERT INTO astro_text_factors ${tx(rows, "text_id", "factor_key", "role", "confidence")} ON CONFLICT DO NOTHING`;
          totals.tags += rows.length;
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
