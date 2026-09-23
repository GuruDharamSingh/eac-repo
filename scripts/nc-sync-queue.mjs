#!/usr/bin/env node
/**
 * nc-sync-queue.mjs
 * =================
 * The queue half of "ask for a Nextcloud sync". Apps can't run
 * scripts/sync-nextcloud-access.sh (it needs `occ`, i.e. the Docker host), so
 * they write nextcloud_sync_requests rows (migration 139): an org owner's
 * "Sync now", an approved profile claim. sync-nextcloud-access.sh — on its
 * every-10-minutes cron — calls this twice per run:
 *
 *   node scripts/nc-sync-queue.mjs claim
 *       pending → running; prints the claimed ids, comma-separated. Rows
 *       queued after this moment stay pending for the next run.
 *   node scripts/nc-sync-queue.mjs finish <done|failed> <ids> [detail]
 *       records the outcome on exactly those rows.
 *
 * Also hands back as failed any row left "running" by a run that died
 * (host reboot, killed cron), so an owner isn't told "running" forever.
 * Queue errors never fail the sync itself — the caller ignores our exit code.
 */
import { createRequire } from "module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromDb = createRequire(new URL("../packages/db/package.json", import.meta.url));
const postgres = requireFromDb("postgres");

const STALE_MINUTES = 30;

function envFromDotenv(key) {
  const file = path.join(REPO, ".env");
  if (!existsSync(file)) return undefined;
  const line = readFileSync(file, "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
  return line?.slice(key.length + 1);
}

const DATABASE_URL =
  process.env.DATABASE_URL ||
  `postgres://postgres:${envFromDotenv("POSTGRES_PASSWORD")}@127.0.0.1:5432/elkdonis_dev`;
const sql = postgres(DATABASE_URL, { max: 1 });

async function claim() {
  await sql`
    UPDATE nextcloud_sync_requests
    SET status = 'failed', finished_at = NOW(), detail = 'The run did not finish (process ended).'
    WHERE status = 'running' AND started_at < NOW() - make_interval(mins => ${STALE_MINUTES})
  `;
  const rows = await sql`
    UPDATE nextcloud_sync_requests
    SET status = 'running', started_at = NOW()
    WHERE status = 'pending'
    RETURNING id, org_id
  `;
  if (rows.length) {
    const orgs = [...new Set(rows.map((r) => r.org_id))].join(", ");
    console.error(`[nc-sync-queue] claimed ${rows.length} request(s) for ${orgs}`);
  }
  process.stdout.write(rows.map((r) => r.id).join(","));
}

async function finish(status, idList, detail) {
  if (status !== "done" && status !== "failed") throw new Error(`bad status ${status}`);
  const ids = (idList || "").split(",").filter((s) => /^\d+$/.test(s));
  if (!ids.length) return;
  await sql`
    UPDATE nextcloud_sync_requests
    SET status = ${status}, finished_at = NOW(),
        detail = ${status === "failed" ? (detail || "Sync failed.").slice(-2000) : null}
    WHERE id = ANY(${ids}) AND status = 'running'
  `;
  console.error(`[nc-sync-queue] marked ${ids.length} request(s) ${status}`);
}

const [cmd, ...rest] = process.argv.slice(2);
(cmd === "claim" ? claim() : cmd === "finish" ? finish(...rest) : Promise.reject(new Error("usage: claim | finish <done|failed> <ids> [detail]")))
  .catch((err) => {
    console.error("[nc-sync-queue]", err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
