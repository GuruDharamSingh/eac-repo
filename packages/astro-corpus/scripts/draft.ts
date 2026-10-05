/**
 * Helper-AI drafting through the Message Batches API.
 *
 *   # submit: pick questions, write a job file, create the batch
 *   docker compose run --rm --no-deps -v ~/astro-corpus:/corpus -e CORPUS_DIR=/corpus \
 *     -w /app/packages/astro-corpus admin pnpm exec tsx scripts/draft.ts submit \
 *     --aspect 6 --transit 6 --sign 4 --general 4 --compat 4
 *
 *   # collect: wait for the batch to end and store each draft as a candidate
 *   … scripts/draft.ts collect <batch id> [--wait]
 *
 * Job files live in $CORPUS_DIR/batches/<batch id>.json (question id, prompt
 * hash and reference ids per request), so collect can run in a later session.
 * Batches reject the server-side refusal fallback, so a refused request is
 * reported and skipped rather than retried on another model.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@elkdonis/db";
import { anthropicClient, costUsd } from "../src/anthropic";
import { buildDraftRequests, HELPER_MODEL, pickQuestionsToDraft, storeDraft, type DraftJobItem } from "../src/helper";

const CORPUS = process.env.CORPUS_DIR ?? "/corpus";
const jobs = path.join(CORPUS, "batches");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function submit(client: Anthropic) {
  const perKind: Record<string, number> = {};
  for (const k of ["sign", "house", "aspect", "transit", "transit-house", "transit-sign", "compat", "general"]) {
    const v = Number(arg(k) ?? 0);
    if (v > 0) perKind[k] = v;
  }
  if (!Object.keys(perKind).length) throw new Error("Say how many per kind, e.g. --aspect 6 --general 4");
  const questions = await pickQuestionsToDraft(perKind);
  if (!questions.length) {
    console.log("Nothing to draft.");
    return;
  }
  const { requests, items } = await buildDraftRequests(questions);
  const batch = await client.messages.batches.create({ requests: requests as never });
  mkdirSync(jobs, { recursive: true });
  writeFileSync(
    path.join(jobs, `${batch.id}.json`),
    JSON.stringify({ batchId: batch.id, model: HELPER_MODEL, createdAt: new Date().toISOString(), perKind, items }, null, 2),
  );
  console.log(`batch ${batch.id}: ${requests.length} requests, status ${batch.processing_status}`);
}

async function collect(client: Anthropic, batchId: string, wait: boolean) {
  const job = JSON.parse(readFileSync(path.join(jobs, `${batchId}.json`), "utf8")) as { items: DraftJobItem[] };
  const byQuestion = new Map(job.items.map((i) => [i.questionId, i]));

  let batch = await client.messages.batches.retrieve(batchId);
  while (batch.processing_status !== "ended") {
    console.log(`status ${batch.processing_status}: ${JSON.stringify(batch.request_counts)}`);
    if (!wait) return;
    await new Promise((r) => setTimeout(r, 30_000));
    batch = await client.messages.batches.retrieve(batchId);
  }

  const tally = { stored: 0, duplicate: 0, refused: 0, errored: 0, unparsed: 0 };
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for await (const result of await client.messages.batches.results(batchId)) {
    const item = byQuestion.get(result.custom_id);
    if (!item) continue;
    if (result.result.type !== "succeeded") {
      tally.errored++;
      console.log(`  ${result.custom_id}: ${result.result.type}`);
      continue;
    }
    const msg = result.result.message;
    usage.input += msg.usage.input_tokens;
    usage.output += msg.usage.output_tokens;
    usage.cacheRead += msg.usage.cache_read_input_tokens ?? 0;
    usage.cacheWrite += msg.usage.cache_creation_input_tokens ?? 0;
    if (msg.stop_reason === "refusal") {
      tally.refused++;
      continue;
    }
    const text = msg.content.find((b) => b.type === "text");
    let draft: { tradition: string; answer: string } | null = null;
    try {
      draft = text && text.type === "text" ? JSON.parse(text.text) : null;
    } catch {
      draft = null;
    }
    if (!draft?.answer) {
      tally.unparsed++;
      continue;
    }
    const ok = await storeDraft(item, draft, { batchId, usage: msg.usage, model: msg.model });
    ok ? tally.stored++ : tally.duplicate++;
  }
  const cost = costUsd(HELPER_MODEL, { input_tokens: usage.input, output_tokens: usage.output, cache_read_input_tokens: usage.cacheRead, cache_creation_input_tokens: usage.cacheWrite }, true);
  const done = tally.stored + tally.duplicate;
  console.log(JSON.stringify({ batchId, ...tally, usage, costUsd: cost, costPerDraftUsd: cost && done ? cost / done : null }, null, 2));
}

async function main() {
  const client = anthropicClient();
  const [cmd, id] = process.argv.slice(2);
  if (cmd === "submit") await submit(client);
  else if (cmd === "collect" && id) await collect(client, id, process.argv.includes("--wait"));
  else throw new Error("usage: draft.ts submit --<kind> <n> … | collect <batch id> [--wait]");
  await db.end();
}

main().catch(async (e) => {
  if (e instanceof Anthropic.BadRequestError && /workspace/i.test(e.message))
    console.error("This key is not scoped to a workspace: set ANTHROPIC_WORKSPACE_ID in .env (Console → Settings → Workspaces), or use a workspace key.");
  else if (e instanceof Anthropic.AuthenticationError) console.error("Anthropic key rejected (401). Check ANTHROPIC_API_KEY in .env.");
  else if (e instanceof Anthropic.RateLimitError) console.error("Rate limited; try again later.");
  else if (e instanceof Anthropic.APIError) console.error(`Anthropic API error ${e.status}: ${e.message}`);
  else console.error(e);
  await db.end();
  process.exit(1);
});
