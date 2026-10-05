/**
 * Mirror the factor registry into astro_factors (migration 167).
 *
 *   docker compose run --rm --no-deps -w /app/packages/astro-corpus admin pnpm exec tsx scripts/seed-factors.ts
 *
 * Idempotent: upserts by key. Re-run after the registry changes.
 */

import { db } from "@elkdonis/db";
import { registryCounts } from "../src/factors";
import { seedFactors } from "../src/server";

async function main() {
  const n = await seedFactors();
  console.log(`astro_factors: ${n} rows upserted`, registryCounts());
  await db.end();
}

main().catch(async (e) => {
  console.error(e);
  await db.end();
  process.exit(1);
});
