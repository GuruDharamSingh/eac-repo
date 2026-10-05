/**
 * Tag chunks from any pipeline. Reads JSON lines on stdin, writes JSON lines on
 * stdout, one output line per input line, in order.
 *
 *   in:  {"id": "...", "text": "...", "headings": ["Chapter 3", "Natal Sun in Aries"]}
 *        (headings optional, outermost first; any other fields are passed through)
 *   out: the input fields plus
 *        "factor_tags": [{"key", "confidence", "match", "kind", "point", "other",
 *                         "sign", "other_sign", "house", "aspect"}],
 *        "factor_keys": ["sign:sun:aries", ...]   (strongest first)
 *
 *   docker run --rm -i --user 3003:3003 -e HOME=/tmp -v ~/eac:/app -w /app/packages/astro-corpus \
 *     eac-dev pnpm exec tsx scripts/tag-jsonl.ts [--no-mentions] < chunks.jsonl > tagged.jsonl
 *
 * Confidence, strongest first: explicit, heading, inferred, mentioned.
 * --version prints the tagger version; --registry prints the registry as JSON.
 * A line that is not JSON is echoed with "factor_error".
 */

import { createInterface } from "node:readline";
import { FACTOR_BY_KEY } from "../src/factors";
import { registryJson } from "../src/registry-json";
import { tagWithHeadings } from "../src/tagger";

/** Set by the bundler (build-tagger.mjs): date and a hash of the tagger's sources. */
declare const __TAGGER_VERSION__: string | undefined;
const TAGGER_VERSION = typeof __TAGGER_VERSION__ === "string" ? __TAGGER_VERSION__ : "source";

const RANK = { explicit: 3, heading: 2, inferred: 1, mentioned: 0 } as const;
const mentions = !process.argv.includes("--no-mentions");

async function main() {
  if (process.argv.includes("--version")) {
    process.stdout.write(TAGGER_VERSION + "\n");
    return;
  }
  if (process.argv.includes("--registry")) {
    process.stdout.write(JSON.stringify({ taggerVersion: TAGGER_VERSION, ...registryJson() }, null, 2) + "\n");
    return;
  }
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line);
    } catch {
      process.stdout.write(JSON.stringify({ raw: line, factor_error: "not JSON" }) + "\n");
      continue;
    }
    const text = typeof row.text === "string" ? row.text : "";
    const headings = Array.isArray(row.headings) ? (row.headings as unknown[]).filter((h): h is string => typeof h === "string") : [];
    const tags = tagWithHeadings(text, headings, { mentions })
      .sort((a, b) => RANK[b.confidence] - RANK[a.confidence])
      .map((t) => {
        const f = FACTOR_BY_KEY.get(t.key)!;
        return {
          key: t.key,
          confidence: t.confidence,
          match: t.match,
          kind: f.kind,
          point: f.parts.point ?? null,
          other: f.parts.other ?? null,
          sign: f.parts.sign ?? null,
          other_sign: f.parts.otherSign ?? null,
          house: f.parts.house ?? null,
          aspect: f.parts.aspect ?? null,
        };
      });
    process.stdout.write(JSON.stringify({ ...row, factor_tags: tags, factor_keys: tags.map((t) => t.key), tagger_version: TAGGER_VERSION }) + "\n");
  }
}

main();
