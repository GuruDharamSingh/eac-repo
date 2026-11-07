/**
 * Worker door for elktours fly-over renders (migration 234). The worker is Justin's PC
 * (ElkTourUnity, Tools/autorender.mjs); it reaches this script over SSH, like the astro
 * reasoning worker. No HTTP surface. Lifecycle and rules live in src/lib/render-requests.ts.
 *
 *   T=/app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs
 *   sudo -n docker exec eac-elktours sh -c "cd /app/apps/elktours && node $T --tsconfig tsconfig.json scripts/render-jobs.mts <command>"
 *
 *   claim [--worker justin-pc]
 *        Take the next accepted request (or one whose worker stopped heartbeating for 20 min).
 *        Prints one line: JOB {"id","threadId","attempts","payloadSha256","payload"} or JOB null.
 *   heartbeat <id> [progress 0..1] [--rendering] [--worker justin-pc]
 *        Keeps the claim alive; --rendering moves claimed -> rendering. Prints OK or LOST
 *        (LOST = no longer this worker's job: stop rendering).
 *   complete <id> <dir> [--worker justin-pc]
 *        <dir> holds film-1080.mp4, film-720.mp4 (optional), poster.jpg and manifest.json
 *        {payloadSha256, seconds, checks: {name: boolean}, metrics?, ...}. Re-checks the gates
 *        (hash matches the accepted snapshot, seconds <= 30, every check true, files are real
 *        mp4/jpg of sane size), uploads to EAC_Network/elktours/Private/Media/{Videos,Images}/,
 *        registers the files as HIDDEN tour_assets (render_request_id set), status -> delivered.
 *        With auto_publish the 1080 film is made the visible hero (copied to public Media/).
 *        A failed gate marks the request failed (gate_failed) and uploads nothing.
 *        Getting files into the container: scp to eris, then
 *          sudo -n docker cp ~/elktours-renders/<id> eac-elktours:/tmp/render-<id>
 *   fail <id> <code> <message...> [--worker justin-pc]
 *        Codes: bad_input | network | tiles_timeout | gate_failed | gpu | encode | other.
 *        network, tiles_timeout, gpu and encode go back to the queue while attempts remain.
 *   show <id>      print the request (status, attempts, error) as JSON.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { db } from "@elkdonis/db";
import { createOrgFolders, uploadFile } from "@elkdonis/services";
const rr = await import("../src/lib/render-requests");
const assets = await import("../src/lib/assets");

const ORG = "elktours";
const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const opt = (name: string, dflt: string) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : dflt;
};
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1] === "--worker"));
const [command, ...args] = positional;
const WORKER = opt("--worker", "justin-pc").replace(/[^\w.-]/g, "").slice(0, 40) || "justin-pc";

function die(msg: string, code = 1): never {
  console.error(`ERROR ${msg}`);
  process.exit(code);
}

const MIN_MP4 = 100 * 1024;
const MAX_MP4 = 200 * 1024 * 1024;

function sniff(file: string, kind: "mp4" | "jpg"): string | null {
  if (!existsSync(file)) return `${path.basename(file)} is missing`;
  const size = statSync(file).size;
  const head = readFileSync(file).subarray(0, 12);
  if (kind === "mp4") {
    if (size < MIN_MP4 || size > MAX_MP4) return `${path.basename(file)} is ${size} bytes`;
    if (head.subarray(4, 8).toString("latin1") !== "ftyp") return `${path.basename(file)} is not an mp4`;
  } else {
    if (size < 5 * 1024 || size > 20 * 1024 * 1024) return `${path.basename(file)} is ${size} bytes`;
    if (!(head[0] === 0xff && head[1] === 0xd8)) return `${path.basename(file)} is not a jpeg`;
  }
  return null;
}

async function complete(id: string, dir: string) {
  const req = await rr.getRenderRequest(id);
  if (!req) die("request not found");
  if (req.workerId !== WORKER || !["claimed", "rendering"].includes(req.status)) die(`request is ${req.status} (worker ${req.workerId ?? "none"})`);
  const failGate = async (why: string) => {
    await db`
      UPDATE tour_render_requests SET status = 'failed', error_code = 'gate_failed', error = ${why.slice(0, 2000)},
        finished_at = NOW(), updated_at = NOW()
      WHERE id = ${id} AND worker_id = ${WORKER}
    `;
    die(`gate_failed: ${why}`, 5);
  };

  const manifestPath = path.join(dir, "manifest.json");
  if (!existsSync(manifestPath)) await failGate("manifest.json is missing");
  let manifest: { payloadSha256?: unknown; seconds?: unknown; checks?: unknown; metrics?: unknown };
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return failGate("manifest.json is not JSON");
  }
  if (manifest.payloadSha256 !== req.payloadSha256) await failGate("the film was rendered from a different snapshot than the accepted one");
  const seconds = Number(manifest.seconds);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > rr.MAX_SECONDS) await failGate(`film length ${String(manifest.seconds)} s is over the ${rr.MAX_SECONDS} s limit`);
  const checks = (manifest.checks ?? {}) as Record<string, unknown>;
  const failed = Object.entries(checks).filter(([, v]) => v !== true).map(([k]) => k);
  if (Object.keys(checks).length === 0) await failGate("manifest has no checks");
  if (failed.length > 0) await failGate(`checks failed: ${failed.join(", ")}`);

  const files = [
    { name: "film-1080.mp4", kind: "film" as const, variant: "1080", mime: "video/mp4", folder: "Videos", required: true },
    { name: "film-720.mp4", kind: "film" as const, variant: "720", mime: "video/mp4", folder: "Videos", required: false },
    { name: "poster.jpg", kind: "poster" as const, variant: "poster", mime: "image/jpeg", folder: "Images", required: true },
  ].filter((f) => f.required || existsSync(path.join(dir, f.name)));
  for (const f of files) {
    const why = sniff(path.join(dir, f.name), f.name.endsWith(".mp4") ? "mp4" : "jpg");
    if (why) await failGate(why);
  }

  await createOrgFolders(ORG).catch(() => false);
  const stamp = Date.now().toString(36);
  const uploaded: { f: (typeof files)[number]; key: string; bytes: number; sha256: string }[] = [];
  for (const f of files) {
    const buf = readFileSync(path.join(dir, f.name));
    const ext = f.name.split(".").pop();
    const key = `EAC_Network/${ORG}/Private/Media/${f.folder}/tour-${req.threadId}-${id.slice(0, 8)}-${f.variant}-${stamp}.${ext}`;
    const ok = await uploadFile(key, buf, f.mime);
    if (!ok) {
      await rr.failJob(id, WORKER, "network", `upload of ${f.name} failed`);
      die(`upload of ${f.name} failed; request re-queued if attempts remain`, 3);
    }
    uploaded.push({ f, key, bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") });
  }

  const ids: string[] = [];
  await db.begin(async (tx) => {
    for (const u of uploaded) {
      const [row] = (await tx`
        INSERT INTO tour_assets (org_id, thread_id, kind, role, variant, storage, storage_key, url, mime_type, bytes, seconds, sha256,
                                 source, attribution, licence_note, visible, meta, render_request_id)
        VALUES (${ORG}, ${req.threadId}, ${u.f.kind}, 'hero', ${u.f.variant}, 'nextcloud', ${u.key}, ${`/api/media/${u.key}`}, ${u.f.mime},
                ${u.bytes}, ${u.f.kind === "film" ? seconds : null}, ${u.sha256}, 'elktour-unity', 'Google, Cesium',
                'Google Maps Platform 3D Tiles: promotional use only, <=30 s, uncropped, credit kept', false,
                ${tx.json({ payload_sha256: req.payloadSha256, checks, metrics: (manifest.metrics ?? null) as never, style: req.style as never } as never)},
                ${id})
        RETURNING id
      `) as unknown as { id: string }[];
      ids.push(row!.id);
    }
    await tx`
      UPDATE tour_render_requests SET status = 'delivered', progress = 1, finished_at = NOW(), updated_at = NOW(),
        result = ${tx.json(manifest as never)}, delivered_asset_ids = ${ids}::uuid[], error_code = NULL, error = NULL
      WHERE id = ${id}
    `;
  });
  if (req.autoPublish) {
    await assets.setAssetVisible(ids[0]!, true).catch((err) => console.error(`WARN auto-publish failed: ${String(err)}`));
  }
  console.log(`DELIVERED ${JSON.stringify({ id, assetIds: ids, autoPublished: req.autoPublish })}`);
}

try {
  switch (command) {
    case "claim": {
      const job = await rr.claimNext(WORKER);
      console.log(`JOB ${JSON.stringify(job)}`);
      break;
    }
    case "heartbeat": {
      const [id, progress] = args;
      if (!id) die("usage: heartbeat <id> [progress] [--rendering]");
      const ok = await rr.heartbeat(id, WORKER, progress != null ? Number(progress) : null, flag("--rendering"));
      console.log(ok ? "OK" : "LOST");
      break;
    }
    case "complete": {
      const [id, dir] = args;
      if (!id || !dir) die("usage: complete <id> <dir>");
      await complete(id, dir);
      break;
    }
    case "fail": {
      const [id, code, ...words] = args;
      if (!id || !code) die("usage: fail <id> <code> <message>");
      const status = await rr.failJob(id, WORKER, code, words.join(" ") || code);
      console.log(status ? `STATUS ${status}` : "LOST");
      break;
    }
    case "show": {
      const req = args[0] ? await rr.getRenderRequest(args[0]) : null;
      console.log(JSON.stringify(req && { ...req, payload: req.payload ? { stops: req.payload.stops.length } : null }, null, 2));
      break;
    }
    default:
      die("commands: claim | heartbeat | complete | fail | show", 2);
  }
} finally {
  await db.end({ timeout: 5 });
}
