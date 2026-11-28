// Index Nextcloud files into content_index (store 'file'). Listings only, never file bytes. Writes only content_index.
//   npx tsx scripts/content-files-reindex.mts --user <users.id> [--org <org id>] [--all] [--limit N]
// --user and --org may repeat; --all does every organization and every account with a storage folder.
// --limit caps the files taken per root (default 5000). Run in the admin container, cwd packages/content.
import { db } from "@elkdonis/db";
import { indexFilesUnder, orgStorageRoot, userStorageRoot } from "@elkdonis/services";

const args = process.argv.slice(2);
const all = args.includes("--all");
const many = (flag: string) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]!] : []));
const limit = Number(many("--limit")[0] ?? 5000) || 5000;

type Job = { label: string; root: string; principal: { kind: "user"; userId: string } | { kind: "org"; orgId: string } };
const jobs: Job[] = [];

const users = all
  ? await db<Array<{ id: string; storage_folder: string }>>`SELECT id, storage_folder FROM users WHERE storage_folder IS NOT NULL`
  : many("--user").length
    ? await db<Array<{ id: string; storage_folder: string }>>`SELECT id, storage_folder FROM users WHERE id = ANY(${many("--user")}::uuid[]) AND storage_folder IS NOT NULL`
    : [];
for (const u of users) jobs.push({ label: `user ${u.storage_folder}`, root: userStorageRoot(u.storage_folder), principal: { kind: "user", userId: u.id } });

const orgIds = all ? (await db<Array<{ id: string }>>`SELECT id FROM organizations`).map((o) => o.id) : many("--org");
for (const id of orgIds) if (id && id.toLowerCase() !== "users" && !id.includes("/")) jobs.push({ label: `org ${id}`, root: orgStorageRoot(id), principal: { kind: "org", orgId: id } });

if (!jobs.length) { console.error("Nothing to do: pass --user <id>, --org <id> or --all."); process.exit(2); }

const t0 = Date.now();
const total = { listed: 0, upserted: 0, skipped: 0, removed: 0 };
for (const j of jobs) {
  const r = await indexFilesUnder(j.root, { principal: j.principal, limit });
  total.listed += r.listed; total.upserted += r.upserted; total.skipped += r.skipped; total.removed += r.removed;
  console.log(`${j.label.padEnd(34)} listed ${String(r.listed).padStart(5)}  upserted ${String(r.upserted).padStart(5)}  skipped ${String(r.skipped).padStart(5)}  removed ${r.removed}${r.truncated ? "  TRUNCATED" : ""}  ${r.ms} ms`);
}
const [c] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM content_index WHERE store = 'file'`;
console.log(`roots ${jobs.length}  ${JSON.stringify(total)}  file rows now ${c!.n}  total ${Date.now() - t0} ms`);
process.exit(0);
