/**
 * Bundle the tagger into one file that runs with plain Node (18+) anywhere,
 * for text pipelines outside this monorepo (e.g. the book ingestion pipeline
 * under Ubuntu/WSL). No workspace, database or native dependency.
 *
 *   pnpm --filter @elkdonis/astro-corpus build:tagger
 *
 * Writes dist/astro-tagger.mjs. Its version is the build date plus a hash of
 * the sources it contains, so tagged output records exactly which tagger
 * produced it.
 */

import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const sources = ["src/tagger.ts", "src/factors.ts", "src/aspect-occurrence.ts", "src/registry-json.ts", "scripts/tag-jsonl.ts"];
const hash = createHash("sha256");
for (const f of sources) hash.update(readFileSync(f));
const version = `${new Date().toISOString().slice(0, 10)}+${hash.digest("hex").slice(0, 10)}`;

await build({
  entryPoints: ["scripts/tag-jsonl.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  outfile: "dist/astro-tagger.mjs",
  define: { __TAGGER_VERSION__: JSON.stringify(version) },
  banner: { js: `// astro-tagger ${version}. Built from packages/astro-corpus (EAC monorepo). Do not edit; rebuild.` },
  legalComments: "none",
});
console.log(`dist/astro-tagger.mjs ${version}`);
