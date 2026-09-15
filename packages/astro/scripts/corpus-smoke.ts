/**
 * Parses a delineation compilation (the SUN.txt format) and reports what it
 * found. Run with a path: `tsx scripts/corpus-smoke.ts ../../astrologychart2/examples/SUN.txt`.
 * Skips quietly when the file is absent — the corpus is the user's, not the repo's.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseDelineations, passagesFor } from "../src/keywords/corpus";

const file = process.argv[2] ?? "../../astrologychart2/examples/SUN.txt";
if (!existsSync(file)) {
  console.log(`corpus: ${file} not present, skipping`);
  process.exit(0);
}

const passages = parseDelineations(readFileSync(file, "utf8"), { file: "SUN" });
const byKind = { sign: 0, house: 0, aspect: 0 };
for (const p of passages) byKind[p.kind]++;
const authors = new Set(passages.map((p) => p.author));
console.log(`corpus: ${passages.length} passages (${byKind.sign} sign, ${byKind.house} house, ${byKind.aspect} aspect) by ${authors.size} authors`);

assert.ok(byKind.sign >= 12, "twelve signs");
assert.ok(byKind.house >= 12, "twelve houses");
assert.ok(byKind.aspect >= 20, "aspects");
assert.ok(passages.every((p) => p.planet === "Sun"));
assert.ok(authors.has("Robert Pelletier"));

const sample = passages.find((p) => p.kind === "house" && p.key === "7");
console.log(`\nSun in the 7th (${sample?.author}): ${sample?.text.slice(0, 160).replace(/\n/g, " ")}…`);
console.log("  topics: " + Object.entries(sample?.domains ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([d, w]) => `${d}:${w.toFixed(2)}`).join(" "));

// A chart with Sun in Taurus in the 9th, trine Saturn — as in keywords-smoke.
const chart = {
  bodies: [{ key: "sun", sign: "taurus", house: 9 }],
  aspects: [{ a: "sun", b: "saturn", type: "trine" }],
} as unknown as Parameters<typeof passagesFor>[1];
const hits = passagesFor(passages, chart, "what about my career and money", 4);
console.log("\nfor Sun in Taurus in the 9th trine Saturn, asked about career/money:");
for (const h of hits) console.log(`  ${h.because} (${h.passage.author}) ${h.score.toFixed(2)}: ${h.passage.text.slice(0, 100).replace(/\n/g, " ")}…`);
assert.ok(hits.length > 0);
assert.ok(hits.every((h) => /Sun in Taurus|Sun in the 9th|Sun trine Saturn/.test(h.because)));
console.log("\ncorpus checks passed");
