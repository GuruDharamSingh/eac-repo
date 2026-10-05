/**
 * Import the Hugging Face datasets into the corpus tables (migration 167).
 *
 *   docker compose run --rm --no-deps -v ~/astro-corpus:/corpus -e CORPUS_DIR=/corpus \
 *     -w /app/packages/astro-corpus admin pnpm exec tsx scripts/import-hf.ts [--write]
 *
 * Without --write it only reports what it would insert. With --write it
 * upserts the sources and inserts questions (and the dialogs' answers as
 * candidate texts); rows already imported are left alone.
 */

import { db } from "@elkdonis/db";
import { coverage, importItems, upsertSource } from "../src/server";
import { compatibility, dialogs } from "./hf-datasets";

const CORPUS = process.env.CORPUS_DIR ?? "/corpus";
const write = process.argv.includes("--write");

async function main() {
  const batches = [dialogs(CORPUS), compatibility(CORPUS)];

  for (const b of batches) {
    const answers = b.items.filter((i) => i.answer).length;
    const tagged = b.items.filter((i) => i.tags.length).length;
    console.log(`${b.source.slug}: ${b.items.length} questions (${tagged} tagged), ${answers} answers as candidates`);
    if (!write) continue;
    const sourceId = await upsertSource(b.source);
    // Tagged questions first in the queue: they build factor coverage.
    const tagged_ = b.items.filter((i) => i.tags.length);
    const untagged = b.items.filter((i) => !i.tags.length);
    const r1 = await importItems(sourceId, tagged_, { priority: 1 });
    const r2 = await importItems(sourceId, untagged, { priority: 0 });
    console.log(`  inserted ${r1.questions + r2.questions} questions, ${r1.texts + r2.texts} texts`);
  }

  if (write) console.table(await coverage());
  else console.log("\nDry run. Re-run with --write to insert.");
  await db.end();
}

main().catch(async (e) => {
  console.error(e);
  await db.end();
  process.exit(1);
});
