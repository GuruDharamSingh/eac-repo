/**
 * Score the system under test on the fixed test set.
 *
 *   docker compose run --rm --no-deps -v ~/astro-corpus:/corpus -e CORPUS_DIR=/corpus \
 *     -w /app/packages/astro-corpus admin pnpm exec tsx scripts/eval.ts [mode] [--limit N] [--reps R]
 *
 * Modes:
 *   --dry-run     build the cases and one full prompt, call nothing
 *   --calibrate   grade the owners' own answers (should pass and tie) and three
 *                 junk answers per case (should fail): run before any paid
 *                 model pass, and after any change to the judge
 *   (default)     answer every case with the assistant and grade it
 *
 * Writes $CORPUS_DIR/evals/<timestamp>-<mode>/: cases.jsonl (inputs),
 * results.jsonl (one row per case and rep: prompts, answers, judge outputs,
 * usage, cost), errors.jsonl (calls that produced nothing gradable, by kind),
 * summary.json; and records the run in astro_snapshots (manifest.type "eval").
 * Errors are never scored as failures; truncated and refused answers are
 * counted separately.
 */

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { db } from "@elkdonis/db";
import { anthropicClient } from "../src/anthropic";
import { EVAL_SET } from "../src/eval-set";
import {
  answer,
  ASSISTANT_MODEL,
  ASSISTANT_PROMPT,
  ASSISTANT_PROMPT_VERSION,
  CallError,
  comparePair,
  gradeAgainstStandard,
  JUDGE_MODEL,
  JUDGE_PROMPT_VERSION,
  meanCi,
  pairScore,
  passes,
  POINTS,
  wilson,
  type EvalCase,
} from "../src/evaluate";
import { referencesFor, userMessage } from "../src/helper";
import { ORG_ID } from "../src/sources";

const CORPUS = process.env.CORPUS_DIR ?? "/corpus";
const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const mode = process.argv.includes("--dry-run") ? "dry-run" : process.argv.includes("--calibrate") ? "calibrate" : "run";
const limit = Number(arg("limit") ?? 0) || undefined;
const reps = Math.max(1, Number(arg("reps") ?? 1));
const CONCURRENCY = 4;

async function loadCases(): Promise<EvalCase[]> {
  // The latest answer an owner wrote or corrected for each test question.
  const rows = await db<{ question_id: string; prompt: string; factor_keys: string[]; tradition: string | null; text_id: string; body: string }[]>`
    SELECT DISTINCT ON (r.question_id) r.question_id, q.prompt, q.factor_keys, q.tradition, t.id AS text_id, t.body
    FROM astro_reviews r
    JOIN astro_questions q ON q.id = r.question_id
    JOIN astro_texts t ON t.id = (r.payload->>'textId')::uuid
    WHERE q.org_id = ${ORG_ID} AND q.meta->>'evalSet' = ${EVAL_SET} AND r.action IN ('write', 'fix')
    ORDER BY r.question_id, r.created_at DESC
  `;
  const cases = rows
    .sort((a, b) => a.question_id.localeCompare(b.question_id))
    .map((r) => ({ questionId: r.question_id, prompt: r.prompt, factorKeys: r.factor_keys, tradition: r.tradition, goldTextId: r.text_id, gold: r.body }));
  return limit ? cases.slice(0, limit) : cases;
}

async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

async function main() {
  const cases = await loadCases();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(CORPUS, "evals", `${stamp}-${mode}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "cases.jsonl"), cases.map((c) => JSON.stringify(c)).join("\n") + (cases.length ? "\n" : ""));
  console.log(`${cases.length} test cases with an owner's answer (set ${EVAL_SET}); mode ${mode}; reps ${reps}`);
  if (!cases.length) {
    console.log("Nothing to score yet: answer test questions in the studio first.");
    await db.end();
    return;
  }

  if (mode === "dry-run") {
    const refs = await referencesFor({ id: cases[0].questionId, prompt: cases[0].prompt, factor_keys: cases[0].factorKeys });
    const leaked = refs.some((r) => r.id === cases[0].goldTextId);
    console.log(`--- system (${ASSISTANT_PROMPT_VERSION}) ---\n${ASSISTANT_PROMPT}\n--- user ---\n${userMessage({ prompt: cases[0].prompt, factor_keys: cases[0].factorKeys, tradition: cases[0].tradition }, refs)}`);
    console.log(`\nreferences: ${refs.length}; gold among them: ${leaked}`);
    await db.end();
    return;
  }

  const client = anthropicClient();
  const results = path.join(dir, "results.jsonl");
  const errors = path.join(dir, "errors.jsonl");
  const rows: Record<string, unknown>[] = [];
  const logError = (c: EvalCase, rep: number, stage: string, e: unknown) => {
    const kind = e instanceof CallError ? e.kind : "harness";
    appendFileSync(errors, JSON.stringify({ questionId: c.questionId, rep, stage, kind, message: e instanceof Error ? e.message : String(e) }) + "\n");
  };

  const jobs: { c: EvalCase; rep: number; variant: string; text?: string }[] = [];
  for (const c of cases) {
    for (let rep = 0; rep < reps; rep++) {
      if (mode === "calibrate") {
        const other = cases[(cases.indexOf(c) + 1) % cases.length];
        jobs.push({ c, rep, variant: "oracle", text: c.gold });
        jobs.push({ c, rep, variant: "null:dont-know", text: "I don't know." });
        jobs.push({ c, rep, variant: "null:empty", text: "" });
        if (other !== c) jobs.push({ c, rep, variant: "null:wrong-question", text: other.gold });
      } else jobs.push({ c, rep, variant: "system" });
    }
  }

  await pool(jobs, CONCURRENCY, async ({ c, rep, variant, text }) => {
    const row: Record<string, unknown> = { questionId: c.questionId, rep, variant, prompt: c.prompt, factorKeys: c.factorKeys, gold: c.gold };
    try {
      let candidate = text ?? "";
      if (variant === "system") {
        const refs = await referencesFor({ id: c.questionId, prompt: c.prompt, factor_keys: c.factorKeys });
        row.references = refs.map((r) => r.id);
        const a = await answer(client, c, refs);
        row.answerCall = { status: a.status, model: a.model, usage: a.usage, costUsd: a.costUsd };
        if (a.status !== "ok" || !a.value) {
          row.status = a.status;
          rows.push(row);
          appendFileSync(results, JSON.stringify(row) + "\n");
          return;
        }
        candidate = a.value.answer;
        row.tradition = a.value.tradition;
      }
      row.candidate = candidate;
      const [ref, p1, p2] = await Promise.all([
        gradeAgainstStandard(client, c, candidate),
        comparePair(client, c.prompt, candidate, c.gold),
        comparePair(client, c.prompt, c.gold, candidate),
      ]);
      row.judge = {
        model: ref.model,
        reference: ref.value,
        pairwise: [p1.value, p2.value],
        usage: [ref.usage, p1.usage, p2.usage],
        costUsd: [ref.costUsd, p1.costUsd, p2.costUsd].reduce<number>((a, b) => a + (b ?? 0), 0),
      };
      if (!ref.value || !p1.value || !p2.value) {
        row.status = "judge-" + [ref, p1, p2].find((x) => x.status !== "ok")?.status;
      } else {
        row.status = "ok";
        row.pass = passes(ref.value);
        row.points = POINTS[ref.value.main_points];
        row.pairScore = pairScore(p1.value.winner, p2.value.winner);
      }
      rows.push(row);
      appendFileSync(results, JSON.stringify(row) + "\n");
    } catch (e) {
      logError(c, rep, variant === "system" ? "answer-or-judge" : "judge", e);
    }
    process.stdout.write(".");
  });
  console.log("");

  const summarise = (variant: string) => {
    const vs = rows.filter((r) => r.variant === variant);
    const ok = vs.filter((r) => r.status === "ok");
    const pass = ok.filter((r) => r.pass).length;
    return {
      rows: vs.length,
      graded: ok.length,
      passRate: ok.length ? pass / ok.length : null,
      passCi: wilson(pass, ok.length),
      mainPoints: meanCi(ok.map((r) => r.points as number)),
      pairwiseVsOwner: meanCi(ok.map((r) => r.pairScore as number)),
      contradictions: ok.filter((r) => (r.judge as { reference: { contradicts_standard: boolean } }).reference.contradicts_standard).length,
      fatalistic: ok.filter((r) => (r.judge as { reference: { fatalistic_or_prescriptive: boolean } }).reference.fatalistic_or_prescriptive).length,
      specific: meanCi(ok.map((r) => (r.judge as { reference: { specific: number } }).reference.specific)),
      truncated: vs.filter((r) => String(r.status).includes("truncated")).length,
      refused: vs.filter((r) => String(r.status).includes("refused")).length,
    };
  };
  const variants = [...new Set(rows.map((r) => r.variant as string))];
  const cost = rows.reduce<{ answer: number; judge: number }>(
    (acc, r) => ({
      answer: acc.answer + (((r.answerCall as { costUsd?: number } | undefined)?.costUsd) ?? 0),
      judge: acc.judge + (((r.judge as { costUsd?: number } | undefined)?.costUsd) ?? 0),
    }),
    { answer: 0, judge: 0 },
  );
  const summary = {
    type: "eval",
    mode,
    evalSet: EVAL_SET,
    cases: cases.length,
    reps,
    system: mode === "run" ? { model: ASSISTANT_MODEL, prompt: ASSISTANT_PROMPT_VERSION } : null,
    judge: { model: JUDGE_MODEL, prompt: JUDGE_PROMPT_VERSION },
    byVariant: Object.fromEntries(variants.map((v) => [v, summarise(v)])),
    errors: jobs.length - rows.length,
    costUsd: cost,
    limits: [
      "Judge and assistant are both Claude models: expect some self-preference; calibrate against the owners' Picks.",
      "Pass-rate interval half-width is roughly 1/sqrt(cases x reps).",
    ],
    finishedAt: new Date().toISOString(),
  };
  writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  await db`INSERT INTO astro_snapshots (org_id, path, manifest) VALUES (${ORG_ID}, ${dir}, ${db.json(summary as never)})`;
  console.log(dir);
  console.log(JSON.stringify(summary.byVariant, null, 2));
  console.log(`errors ${summary.errors}; cost $${(cost.answer + cost.judge).toFixed(2)} (answers $${cost.answer.toFixed(2)}, judge $${cost.judge.toFixed(2)})`);
  await db.end();
}

main().catch(async (e) => {
  console.error(e);
  await db.end();
  process.exit(1);
});
