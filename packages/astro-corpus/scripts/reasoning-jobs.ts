/**
 * Worker side of the reasoning explorer (migrations 178, 179). The worker runs on the
 * pipeline machine (chunker/reasoning.py) and uses Claude through the owner's subscription;
 * this script is its only door into the studio database.
 *
 *   docker compose run --rm --no-deps -v ~/astro-corpus:/corpus -e CORPUS_DIR=/corpus \
 *     -w /app/packages/astro-corpus admin pnpm exec tsx scripts/reasoning-jobs.ts <command>
 *
 *   claim [n]          mark up to n queued interpretations (default 3) as running and print
 *                      them as one line: JOBS <json>, each {id, body, sentences, factorKeys,
 *                      chartName, questionPrompt, existingChains}. Jobs left running for 30
 *                      minutes are claimed again (the worker stopped). An interpretation
 *                      started from a deck question (migration 181) has no chart: chartName
 *                      is then the question's prompt and questionPrompt is set.
 *   store <file>       store a worker result (file relative to $CORPUS_DIR):
 *                      {id, model, promptVersion, promptHash, chains: [{sentences, summary,
 *                       steps: [{kind, body, basedOn, factorKeys, cite?}]}], references?}
 *                      cite = {chunkId, docHash, statementOrdinal, book, author, pages,
 *                              headings, statement, excerpt}
 *                      references = every passage retrieved, cited or not: [{rid, chunkId,
 *                              docHash, statementOrdinal, book, author, pages, headings,
 *                              statement, excerpt, factors}], kept in meta.references for the
 *                              owner to mark (ref-mark). Optional; a later result's passages
 *                              are added to the earlier ones, so marks keep their target.
 *   fail <id> <message>
 *
 * New chains are appended after existing ones, so "generate more" keeps the earlier chains and
 * the owner's reviews of them.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "@elkdonis/db";
import { FACTOR_BY_KEY } from "../src/factors";
import { cleanReferences } from "../src/reasoning-rules";

const CORPUS = process.env.CORPUS_DIR ?? "/corpus";
const [command, ...rest] = process.argv.slice(2);
const KINDS = new Set(["observe", "cite", "infer", "conclude"]);
const STALE_MINUTES = 30;

interface Cite {
  chunkId: string;
  docHash: string;
  statementOrdinal: number | null;
  book: string;
  author: string | null;
  pages: number[];
  headings: string[];
  statement: string | null;
  excerpt: string;
}
interface Step {
  kind: string;
  body: string;
  basedOn: number[];
  factorKeys: string[];
  cite?: Cite | null;
}
interface Result {
  id: string;
  model: string;
  promptVersion: string;
  promptHash: string;
  chains: { sentences: number[]; summary: string; steps: Step[] }[];
  references?: unknown[];
}

async function claim(n: number) {
  const rows = await db<{ id: string; body: string; sentences: string[]; factor_keys: string[]; chart_name: string | null; question_prompt: string | null }[]>`
    WITH picked AS (
      SELECT id FROM astro_interpretations
      WHERE status = 'queued'
         OR (status = 'running' AND updated_at < now() - make_interval(mins => ${STALE_MINUTES}))
      ORDER BY created_at
      LIMIT ${n}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE astro_interpretations i SET status = 'running', error = NULL, updated_at = now()
    FROM picked
    WHERE i.id = picked.id
    RETURNING i.id, i.body, i.sentences, i.factor_keys,
      (SELECT c.name FROM astro_charts c WHERE c.id = i.chart_id) AS chart_name,
      (SELECT q.prompt FROM astro_questions q WHERE q.id = i.question_id) AS question_prompt
  `;
  const jobs = [];
  for (const r of rows) {
    const [{ count }] = await db<{ count: number }[]>`
      SELECT count(*)::int AS count FROM astro_reasoning_chains WHERE interpretation_id = ${r.id}`;
    jobs.push({
      id: r.id,
      body: r.body,
      sentences: r.sentences,
      factorKeys: r.factor_keys,
      chartName: r.chart_name ?? r.question_prompt,
      questionPrompt: r.question_prompt,
      existingChains: count,
    });
  }
  console.log("JOBS " + JSON.stringify(jobs));
}

async function store(file: string) {
  const result = JSON.parse(readFileSync(path.join(CORPUS, file), "utf8")) as Result;
  const references = cleanReferences(result.references);
  const counts = { chains: 0, steps: 0, linkedTexts: 0, linkedStatements: 0, droppedKeys: 0, references: references.length };
  await db.begin(async (tx) => {
    const [{ next }] = await tx<{ next: number }[]>`
      SELECT coalesce(max(ordinal), 0)::int + 1 AS next FROM astro_reasoning_chains WHERE interpretation_id = ${result.id}`;
    let ordinal = next;
    for (const chain of result.chains) {
      const [c] = await tx<{ id: string }[]>`
        INSERT INTO astro_reasoning_chains (interpretation_id, ordinal, sentences, summary, model, prompt_version, prompt_hash)
        VALUES (${result.id}, ${ordinal++}, ${chain.sentences}, ${chain.summary}, ${result.model}, ${result.promptVersion}, ${result.promptHash})
        RETURNING id`;
      counts.chains++;
      for (const [i, step] of chain.steps.entries()) {
        if (!KINDS.has(step.kind)) throw new Error(`unknown step kind ${step.kind}`);
        const keys = step.factorKeys.filter((k) => FACTOR_BY_KEY.has(k));
        counts.droppedKeys += step.factorKeys.length - keys.length;
        let textId: string | null = null;
        let statementId: string | null = null;
        if (step.cite) {
          const [t] = await tx<{ id: string }[]>`
            SELECT t.id FROM astro_texts t JOIN astro_sources s ON s.id = t.source_id
            WHERE s.slug = ${"book:" + step.cite.docHash} AND t.source_ref = ${step.cite.chunkId} LIMIT 1`;
          textId = t?.id ?? null;
          if (textId) counts.linkedTexts++;
          if (textId && step.cite.statementOrdinal != null) {
            const [s] = await tx<{ id: string }[]>`
              SELECT id FROM astro_statements
              WHERE text_id = ${textId} AND ordinal = ${step.cite.statementOrdinal} AND labelled_by = 'chunker-digest' LIMIT 1`;
            statementId = s?.id ?? null;
            if (statementId) counts.linkedStatements++;
          }
        }
        await tx`
          INSERT INTO astro_reasoning_steps (chain_id, ordinal, kind, body, based_on, factor_keys, statement_id, text_id, source)
          VALUES (${c.id}, ${i + 1}, ${step.kind}, ${step.body}, ${step.basedOn}, ${keys}, ${statementId}, ${textId},
                  ${tx.json((step.cite ?? {}) as never)})`;
        counts.steps++;
      }
    }
    if (references.length) {
      const [prev] = await tx<{ refs: unknown }[]>`SELECT meta->'references' AS refs FROM astro_interpretations WHERE id = ${result.id}`;
      const merged = cleanReferences([...(Array.isArray(prev?.refs) ? prev.refs : []), ...references]);
      await tx`UPDATE astro_interpretations SET meta = meta || ${tx.json({ references: merged } as never)} WHERE id = ${result.id}`;
    }
    await tx`UPDATE astro_interpretations SET status = 'ready', error = NULL, updated_at = now() WHERE id = ${result.id}`;
  });
  console.log("STORED " + JSON.stringify({ id: result.id, ...counts }));
}

async function fail(id: string, message: string) {
  await db`UPDATE astro_interpretations SET status = 'failed', error = ${message.slice(0, 2000)}, updated_at = now() WHERE id = ${id}`;
  console.log("FAILED " + id);
}

async function main() {
  if (command === "claim") await claim(Number(rest[0] ?? 3));
  else if (command === "store" && rest[0]) await store(rest[0]);
  else if (command === "fail" && rest[0]) await fail(rest[0], rest.slice(1).join(" ") || "worker error");
  else throw new Error("usage: reasoning-jobs.ts claim [n] | store <file> | fail <id> <message>");
  await db.end();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await db.end();
  process.exit(1);
});
