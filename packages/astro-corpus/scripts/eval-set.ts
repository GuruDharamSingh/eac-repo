/**
 * Mark the fixed test set: EVAL_ALLOCATION curated questions per pattern,
 * chosen deterministically (ordered by md5 of set name + question id), and
 * only from questions nobody has reviewed yet, so no test answer was written
 * with a model draft in view.
 *
 *   docker compose run --rm --no-deps -w /app/packages/astro-corpus admin \
 *     pnpm exec tsx scripts/eval-set.ts [--write]
 *
 * Re-running adds members only where a pattern is short of its allocation;
 * it never removes one.
 */

import { db } from "@elkdonis/db";
import { EVAL_ALLOCATION, EVAL_SET } from "../src/eval-set";
import { ORG_ID } from "../src/sources";

const write = process.argv.includes("--write");

async function main() {
  let added = 0;
  for (const [pattern, n] of Object.entries(EVAL_ALLOCATION)) {
    const [{ have }] = await db<{ have: number }[]>`
      SELECT count(*)::int AS have FROM astro_questions
      WHERE org_id = ${ORG_ID} AND meta->>'evalSet' = ${EVAL_SET} AND meta->>'pattern' = ${pattern}
    `;
    const need = n - have;
    if (need <= 0) {
      console.log(`${pattern}: ${have}/${n}`);
      continue;
    }
    const rows = await db<{ id: string; prompt: string }[]>`
      SELECT q.id, q.prompt FROM astro_questions q
      WHERE q.org_id = ${ORG_ID} AND q.origin = 'curated' AND q.status = 'open'
        AND q.meta->>'pattern' = ${pattern} AND q.meta->>'evalSet' IS NULL
        AND NOT EXISTS (SELECT 1 FROM astro_reviews r WHERE r.question_id = q.id)
      ORDER BY md5(${EVAL_SET} || q.id::text)
      LIMIT ${need}
    `;
    console.log(`${pattern}: ${have}/${n}, adding ${rows.length}  e.g. "${rows[0]?.prompt ?? ""}"`);
    if (write && rows.length) {
      await db`
        UPDATE astro_questions
        SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('evalSet', ${EVAL_SET}::text)
        WHERE org_id = ${ORG_ID} AND id = ANY (${rows.map((r) => r.id)})
      `;
    }
    added += rows.length;
  }
  console.log(write ? `\nAdded ${added} questions to test set ${EVAL_SET}.` : `\nDry run: would add ${added}. Re-run with --write.`);
  await db.end();
}

main().catch(async (e) => {
  console.error(e);
  await db.end();
  process.exit(1);
});
