// Register the sorted pictures in EAC_Network/<org>/Stops/<TOUR>/ where they sit (2026-11-21, ELK-stop-photos).
//
// Which tour and stop a picture is of comes from the stage itself: loadTourStageData calls stopFolderPhotos, which
// calls matchStopFolder, so the folder and file-name guess here is the one visitors see today, with the same stop list.
// Rows are written through registerInPlace (lib/media-folders.ts): nothing is moved, copied, renamed or deleted; a file
// that already has a row (live or archived) is left alone; a picture with a location stamp is refused.
//
// Rows are written HIDDEN (visible = false). A visible image row on a stop would also be drawn by the desktop tour
// story and the phone gallery (publicTourAssets) and, with a different URL spelling, a second time on the stage, so
// "what visitors see" would change. A hidden row is read by none of them. Show them with one UPDATE when the readers
// move to rows.
//
// Modes (first argument):
//   --dry        counts and the per-folder plan; writes nothing
//   --snapshot   JSON of what the tour pages draw (stage pictures + asset lists), for before/after comparison
//   --run        ONE transaction; checks the row count rose by exactly the plan and no existing row changed; else rolls back
//   --undo ids   delete exactly these rows by id (comma-separated), in a transaction
//   cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/apps/elktours admin node \
//     /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/register-stop-folders.mts --dry
import React from "react";
(globalThis as any).React = React;

const { db } = await import("@elkdonis/db");
const tours = await import("../src/lib/tours");
const stageData = await import("../src/lib/tour-stage-data");
const folders = await import("../src/lib/media-folders");

const ORG = "elktours";
const BASE = `EAC_Network/${ORG}`;
const mode = process.argv[2] ?? "--dry";

type Thread = { id: string; slug: string; title: string; status: string };
const threads = (await db`
  SELECT id, slug, title, status FROM threads WHERE org_id = ${ORG} AND kind = 'tour' AND status <> 'archived'
  ORDER BY (status = 'published') DESC, title
`) as unknown as Thread[];

async function stageFor(t: Thread) {
  const base = await tours.getTourById(t.id);
  if (!base) throw new Error(`tour ${t.slug} not found`);
  const full = await tours.loadTourFull(base, { upcomingOnly: true });
  const stage = await stageData.loadTourStageData(full, { takes: [] });
  return { full, stage };
}

// ── snapshot: everything the tour pages draw from pictures ───────────────
if (mode === "--snapshot") {
  const out: Record<string, unknown> = {};
  for (const t of threads.filter((x) => x.status === "published")) {
    const { full, stage } = await stageFor(t);
    out[t.slug] = {
      stops: stage.stops.map((s) => ({ id: s.id, stopPhotos: s.stopPhotos, placePhotos: s.placePhotos, cover: s.cover })),
      overviewPhotos: stage.overviewPhotos,
      stopImages: full.assets.stopImages,
      images: full.assets.images,
      stills: full.assets.stills,
      poster: full.assets.poster,
    };
  }
  process.stdout.write(JSON.stringify(out, null, 1) + "\n", () => process.exit(0));
  await new Promise(() => {});
}

// ── undo ─────────────────────────────────────────────────────────────────
if (mode === "--undo") {
  const ids = (process.argv[3] ?? "").split(",").filter(Boolean);
  if (!ids.length || !ids.every((i) => /^[0-9a-f-]{36}$/.test(i))) throw new Error("give the row ids, comma separated");
  const n = await db.begin(async (raw) => {
    const tx = raw as unknown as typeof db;
    const r = await tx`DELETE FROM tour_assets WHERE org_id = ${ORG} AND id = ANY(${ids}::uuid[]) AND source = 'folder' AND storage_key LIKE ${`${BASE}/Stops/%`} AND visible = false RETURNING id`;
    if (r.length !== ids.length) throw new Error(`would delete ${r.length}, expected ${ids.length}; rolled back`);
    return r.length;
  });
  console.log(`deleted ${n} rows`);
  process.exit(0);
}

// ── the plan ─────────────────────────────────────────────────────────────
interface Planned {
  item: Parameters<typeof folders.registerInPlace>[0][number];
  key: string;
}
const planned: Planned[] = [];
const claimed = new Map<string, string>(); // storage key -> tour slug
const unplaced: { folder: string; file: string; tour: string; reason: string }[] = [];
const sharedSkipped: { folder: string; file: string; tour: string; reason: string }[] = [];
const hasRow: { key: string; tour: string; stop: string }[] = [];
const perFolder = new Map<string, { tour: string; status: string; stops: Map<string, { title: string; files: number; rows: number }>; unplaced: number }>();

const rowKeys = new Set(
  ((await db`SELECT storage_key FROM tour_assets WHERE org_id = ${ORG} AND storage_key LIKE ${`${BASE}/Stops/%`}`) as unknown as { storage_key: string }[]).map((r) => r.storage_key)
);

const parse = (url: string) => {
  const m = url.match(/^\/api\/media\/(.+?)(\?.*)?$/);
  if (!m) return null;
  const segs = m[1]!.split("/").map(decodeURIComponent);
  const i = segs.indexOf("Stops");
  if (segs.slice(0, i).join("/") !== BASE || segs.length !== i + 3) return null;
  return { folder: segs[i + 1]!, file: segs[i + 2]! };
};

for (const t of threads) {
  const { stage } = await stageFor(t);
  for (const s of stage.stops) {
    let pos = 0;
    for (const p of s.stopPhotos) {
      const f = parse(p.url);
      if (!f) continue; // not a Stops/ picture (the stop's own image, Street View)
      const key = `${BASE}/Stops/${f.folder}/${f.file}`;
      const folderRec = perFolder.get(f.folder) ?? perFolder.set(f.folder, { tour: t.title, status: t.status, stops: new Map(), unplaced: 0 }).get(f.folder)!;
      const stopRec = folderRec.stops.get(s.id) ?? folderRec.stops.set(s.id, { title: s.title, files: 0, rows: 0 }).get(s.id)!;
      if (claimed.has(key)) {
        sharedSkipped.push({ folder: f.folder, file: f.file, tour: t.slug, reason: `also placed on tour ${claimed.get(key)}; one row per file` });
        continue;
      }
      claimed.set(key, t.slug);
      stopRec.files++;
      if (rowKeys.has(key)) {
        stopRec.rows++;
        hasRow.push({ key, tour: t.slug, stop: s.title });
        continue;
      }
      planned.push({
        key,
        item: {
          folder: f.folder, file: f.file, caption: p.caption, credit: p.credit ?? null, tourId: t.id, tourTitle: t.title,
          stopId: s.id, stopTitle: s.title, placeId: null, placeTitle: null, choice: "stop", position: pos,
        },
      });
      pos++;
    }
  }
  for (const p of stage.overviewPhotos) {
    const f = parse(p.url);
    if (!f) continue;
    const key = `${BASE}/Stops/${f.folder}/${f.file}`;
    if (claimed.has(key) && claimed.get(key) !== t.slug) continue;
    const folderRec = perFolder.get(f.folder) ?? perFolder.set(f.folder, { tour: t.title, status: t.status, stops: new Map(), unplaced: 0 }).get(f.folder)!;
    folderRec.unplaced++;
    unplaced.push({ folder: f.folder, file: f.file, tour: t.slug, reason: "its name matches no stop of the tour (the stage shows it in the overview)" });
  }
}
// Files in folders that no tour's stage shows at all.
const all = await folders.planStopsMove();
const total = all.items.length + (all.registered ?? 0);

// How many files sit in the folders no tour claims (read only).
const unclaimedFiles: Record<string, number> = {};
for (const name of all.unclaimed) {
  const base = (process.env.NEXTCLOUD_URL ?? "").replace(/\/$/, "");
  const user = encodeURIComponent(process.env.NEXTCLOUD_ADMIN_USER ?? "");
  const res = await fetch(`${base}/remote.php/dav/files/${user}/${`${BASE}/Stops/${name}`.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PROPFIND",
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.NEXTCLOUD_ADMIN_USER}:${process.env.NEXTCLOUD_ADMIN_PASSWORD}`).toString("base64")}`, Depth: "1" },
  });
  const xml = await res.text();
  unclaimedFiles[name] = Math.max(0, (xml.match(/<d:response>/gi)?.length ?? 1) - 1);
}

// A file name the url cannot carry cannot be registered: found by registerInPlace itself (reported as failed).
// Location stamps: the same check registerInPlace applies, run now so the plan can say who is refused.
const refused: { file: string; reason: string }[] = [];
const clean: Planned[] = [];
for (const p of planned) {
  try {
    if (await folders.hasGps(p.key)) refused.push({ file: `${p.item.folder}/${p.item.file}`, reason: "the picture records where it was taken (location stamp)" });
    else clean.push(p);
  } catch (err) {
    refused.push({ file: `${p.item.folder}/${p.item.file}`, reason: `could not read it (${err instanceof Error ? err.message : "storage error"})` });
  }
}

console.log(`Stops/ folders: ${perFolder.size} matched to a tour; ${all.unclaimed.length} unclaimed (${all.unclaimed.join(", ") || "none"})`);
console.log(`files in the unclaimed folders (no tour matches the folder name): ${JSON.stringify(unclaimedFiles)}`);
console.log(`files in claimed folders: ${total} (planStopsMove: ${all.items.length} without a row, ${all.registered ?? 0} with)`);
console.log(`placed on a stop by the stage: ${claimed.size}   already have a row: ${hasRow.length}   to register: ${clean.length}   refused: ${refused.length}   unplaced: ${unplaced.length}   shared (skipped): ${sharedSkipped.length}`);
for (const [folder, r] of perFolder) {
  console.log(`\n${folder}  ->  ${r.tour} [${r.status}]  (${[...r.stops.values()].reduce((a, s) => a + s.files, 0)} on stops, ${r.unplaced} unplaced)`);
  for (const s of r.stops.values()) console.log(`   stop "${s.title}": ${s.files} files, ${s.rows} already have rows`);
}
for (const r of refused) console.log(`REFUSED  ${r.file}: ${r.reason}`);
for (const u of unplaced) console.log(`UNPLACED ${u.folder}/${u.file}: ${u.reason}`);
for (const u of sharedSkipped) console.log(`SHARED   ${u.folder}/${u.file}: ${u.reason}`);

if (mode === "--dry") process.exit(0);
if (mode !== "--run") throw new Error(`unknown mode ${mode}`);

// ── the real run ─────────────────────────────────────────────────────────
class Rollback extends Error {}
const hashOf = async (tx: typeof db, ids: string[]) =>
  ((await tx`SELECT md5(COALESCE(string_agg(t::text, ',' ORDER BY t.id), '')) AS h FROM tour_assets t WHERE t.id = ANY(${ids}::uuid[])`) as unknown as { h: string }[])[0]!.h;
const countOf = async (tx: typeof db) => ((await tx`SELECT COUNT(*)::int AS n FROM tour_assets WHERE org_id = ${ORG}`) as unknown as { n: number }[])[0]!.n;

let report: Record<string, unknown> = {};
try {
  await db.begin(async (raw) => {
    const tx = raw as unknown as typeof db;
    const pre = ((await tx`SELECT id::text AS id FROM tour_assets`) as unknown as { id: string }[]).map((r) => r.id);
    const hashBefore = await hashOf(tx, pre);
    const nBefore = await countOf(tx);
    const res = await folders.registerInPlace(clean.map((c) => c.item), null, { sql: tx, visible: false });
    const nAfter = await countOf(tx);
    const hashAfter = await hashOf(tx, pre);
    const added = ((await tx`
      SELECT id::text AS id FROM tour_assets WHERE org_id = ${ORG} AND id <> ALL(${pre}::uuid[]) ORDER BY created_at, id
    `) as unknown as { id: string }[]).map((r) => r.id);
    report = { rowsBefore: nBefore, rowsAfter: nAfter, planned: clean.length, result: res, hashBefore, hashAfter, added };
    const problems: string[] = [];
    if (res.registered !== clean.length) problems.push(`registered ${res.registered}, planned ${clean.length}`);
    if (res.updated !== 0 || res.already !== 0 || res.failed.length) problems.push(`updated ${res.updated} already ${res.already} failed ${JSON.stringify(res.failed)}`);
    if (nAfter !== nBefore + clean.length) problems.push(`row count ${nBefore} -> ${nAfter}`);
    if (added.length !== clean.length) problems.push(`added ids ${added.length}`);
    if (hashBefore !== hashAfter) problems.push("an existing row changed");
    if (problems.length) {
      report.problems = problems;
      throw new Rollback();
    }
  });
  console.log("COMMITTED", JSON.stringify(report));
} catch (e) {
  if (e instanceof Rollback) {
    console.log("ROLLED BACK", JSON.stringify(report));
    process.exit(2);
  }
  throw e;
}
process.exit(0);
