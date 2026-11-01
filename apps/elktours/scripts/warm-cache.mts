// Run: docker compose exec -T elktours sh -c "cd /app/apps/elktours && node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/warm-cache.mts"
// Warm the caches for every tour on the site: route geometry + stills (one-off, run in the elktours container).
import { db } from "@elkdonis/db";
const { ensureStopStills, refreshTourRoute } = await import("../src/lib/tour-cache");
const rows = (await db`SELECT id, slug FROM threads WHERE org_id = 'elktours' AND kind = 'tour' AND status <> 'archived'`) as unknown as { id: string; slug: string }[];
for (const t of rows) {
  const route = await refreshTourRoute(t.id);
  const stills = await ensureStopStills(t.id);
  console.log(t.slug, "route:", route ? `${route.source} ${route.legs.length} legs` : "none", "stills:", JSON.stringify(stills));
}
await db.end();
