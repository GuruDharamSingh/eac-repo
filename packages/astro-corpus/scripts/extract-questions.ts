/**
 * Strip the reusable questions out of the imported Hugging Face datasets into
 * a file, without touching the database.
 *
 *   CORPUS_DIR=~/astro-corpus pnpm --filter @elkdonis/astro-corpus extract:questions
 *
 * Writes $CORPUS_DIR/derived/questions.jsonl (one question per line, tagged
 * with factor keys) and questions-report.json. Screening rules are in
 * hf-datasets.ts.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compatibility, dialogs } from "./hf-datasets";

const CORPUS = process.env.CORPUS_DIR ?? "/corpus";
const out = path.join(CORPUS, "derived");
mkdirSync(out, { recursive: true });

const batches = [dialogs(CORPUS), compatibility(CORPUS)];
const lines: string[] = [];
const report: Record<string, unknown> = {};

for (const b of batches) {
  report[b.source.slug] = b.report;
  for (const it of b.items) {
    lines.push(
      JSON.stringify({
        id: `${b.source.slug}#${it.sourceRef}`,
        prompt: it.prompt,
        type: it.type,
        factorKeys: it.tags.map((t) => t.key),
        tagConfidence: Object.fromEntries(it.tags.map((t) => [t.key, t.confidence])),
        tradition: it.tradition ?? null,
        ...(it.original ? { original: it.original } : {}),
      }),
    );
  }
}

const covered = new Set(batches.flatMap((b) => b.items.flatMap((i) => i.tags.map((t) => t.key))));
const byKind: Record<string, number> = {};
for (const k of covered) byKind[k.split(":")[0]] = (byKind[k.split(":")[0]] ?? 0) + 1;
Object.assign(report, { total: lines.length, distinctFactorsCovered: covered.size, distinctFactorsCoveredByKind: byKind, generated: new Date().toISOString() });

writeFileSync(path.join(out, "questions.jsonl"), lines.join("\n") + "\n");
writeFileSync(path.join(out, "questions-report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ total: report.total, distinctFactorsCovered: covered.size, distinctFactorsCoveredByKind: byKind }, null, 2));
