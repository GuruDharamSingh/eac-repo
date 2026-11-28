// Refreshes the data the Rails and Map screens read, into src/data/rails/.
//   readiness.json       a copy of packages/actions/atlas/reports/readiness.json (written by `atlas:readiness`)
//   workspace-graph.json the apps/packages dependency graph, from scripts/workspace-graph/extract.mjs
// Usage (from apps/development, or in the container):  node scripts/refresh-rails.mjs
// Needs a rebuild to show. The graph has no running state: there is no docker in the container,
// so whether an app is running is simply not part of this data.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const dest = join(here, "../src/data/rails");
mkdirSync(dest, { recursive: true });

const readiness = join(root, "packages/actions/atlas/reports/readiness.json");
if (existsSync(readiness)) {
  copyFileSync(readiness, join(dest, "readiness.json"));
  const r = JSON.parse(readFileSync(readiness, "utf8"));
  console.log(`copied readiness.json (${r.capabilities?.length ?? "?"} capabilities, ${r.courses?.length ?? "?"} courses, made ${r.generated ?? "?"}, ${Math.round(statSync(readiness).size / 1024)} KB)`);
} else {
  console.warn(`skip readiness.json: ${readiness} does not exist yet (run the atlas:readiness script in packages/actions first)`);
}

const { extract } = await import(pathToFileURL(join(root, "scripts/workspace-graph/extract.mjs")).href);
const g = extract(root);
writeFileSync(join(dest, "workspace-graph.json"), JSON.stringify({ generated: new Date().toISOString(), running: null, nodes: g.nodes, edges: g.edges, cycles: g.cycles }));
console.log(`wrote workspace-graph.json (${g.nodes.length} workspaces, ${g.edges.length} edges, ${g.cycles.length} loops)`);
