/**
 * Import the curated question sets (src/question-sets.ts) as origin 'curated',
 * which the review deck draws three times for every imported question.
 *
 *   docker compose run --rm --no-deps -v ~/astro-corpus:/corpus -e CORPUS_DIR=/corpus \
 *     -w /app/packages/astro-corpus admin pnpm exec tsx scripts/import-curated.ts [--write]
 *
 * Without --write it writes the list to $CORPUS_DIR/derived/curated-questions.jsonl
 * and reports counts. With --write it also seeds the registry (for the new
 * factor kinds) and inserts the questions; re-running inserts nothing new.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { db } from "@elkdonis/db";
import { combinationQuestions, realmQuestions } from "../src/question-sets";
import { importItems, seedFactors, upsertSource, type ImportItem } from "../src/server";

const CORPUS = process.env.CORPUS_DIR ?? "/corpus";
const write = process.argv.includes("--write");

async function main() {
  const sets = [
    {
      slug: "curated:combinations-2026-09-26",
      title: "Curated: factor combinations",
      notes: "Generated from the factor registry: planets, signs, houses and aspects in varying combinations, attitude and compare questions. Only combinations that can occur.",
      questions: combinationQuestions(),
    },
    {
      slug: "curated:house-realms-2026-09-26",
      title: "Curated: the twelve houses as areas of life",
      notes: "Ten questions per house, written 2026-09-26.",
      questions: realmQuestions(),
    },
  ];

  mkdirSync(path.join(CORPUS, "derived"), { recursive: true });
  const lines = sets.flatMap((s) => s.questions.map((q) => JSON.stringify({ set: s.slug, ...q })));
  writeFileSync(path.join(CORPUS, "derived", "curated-questions.jsonl"), lines.join("\n") + "\n");

  for (const s of sets) {
    const byPattern: Record<string, number> = {};
    for (const q of s.questions) byPattern[q.pattern] = (byPattern[q.pattern] ?? 0) + 1;
    console.log(`${s.slug}: ${s.questions.length}`, byPattern);
  }
  if (!write) {
    console.log("\nDry run. Re-run with --write to insert.");
    await db.end();
    return;
  }

  console.log(`astro_factors: ${await seedFactors()} rows upserted`);
  for (const s of sets) {
    const sourceId = await upsertSource({
      slug: s.slug,
      title: s.title,
      author: "Astro Studio (astro-corpus/question-sets.ts)",
      kind: "own",
      licence: "owner",
      trainable: true,
      notes: s.notes,
      importer: "astro-corpus/import-curated.ts",
    });
    const items: ImportItem[] = s.questions.map((q) => ({
      sourceRef: q.ref,
      prompt: q.prompt,
      type: "interpret",
      tradition: null,
      tags: q.factorKeys.map((key) => ({ key, confidence: "explicit" as const, match: q.pattern })),
      answer: null,
      meta: { pattern: q.pattern },
    }));
    const r = await importItems(sourceId, items, { priority: 1, origin: "curated" });
    console.log(`  ${s.slug}: inserted ${r.questions} questions`);
  }
  await db.end();
}

main().catch(async (e) => {
  console.error(e);
  await db.end();
  process.exit(1);
});
