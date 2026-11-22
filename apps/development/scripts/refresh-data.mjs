// Copies the catalogue files published by the C and D workers into src/data/.
// Usage (from apps/development):  node scripts/refresh-data.mjs [sourceDir]
// Default source: docs/open/DEVELOPMENT_APP_2026-11-20 (blocks.json, themes.json, design-system.json).
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(process.argv[2] ?? join(here, "../../../docs/open/DEVELOPMENT_APP_2026-11-20"));
const dest = join(here, "../src/data");
for (const f of ["blocks.json", "themes.json", "design-system.json"]) {
  const from = join(src, f);
  if (!existsSync(from)) {
    console.warn(`skip ${f}: not in ${src}`);
    continue;
  }
  copyFileSync(from, join(dest, f));
  console.log(`copied ${f}`);
}
