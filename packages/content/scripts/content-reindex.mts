// Backfill (and optionally reconcile) content_index. Writes only content_index.
//   npx tsx scripts/content-reindex.mts [--stores=thread,artwork] [--reconcile] [--fix]
// Run in the admin container, cwd packages/content.
import { reindexAll, reconcileContentIndex, drainContentQueue } from "@elkdonis/services";

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}`));
const stores = (arg("stores")?.split("=")[1]?.split(",").filter(Boolean) ?? []) as Array<"thread" | "artwork">;

if (arg("reconcile") || arg("fix")) {
  const r = await reconcileContentIndex({ fix: Boolean(arg("fix")) });
  console.log(JSON.stringify(r, null, 2));
} else {
  const r = await reindexAll({ stores });
  console.log("reindexed", JSON.stringify(r));
  console.log("drift after:", JSON.stringify(await reconcileContentIndex()));
}
console.log("queue drained:", JSON.stringify(await drainContentQueue({ all: true })));
process.exit(0);
