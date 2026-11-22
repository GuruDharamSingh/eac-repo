// Server only. Nextcloud folders that mirror the catalogue (developer, 2026-11-20: option C).
//
//   EAC_Network/<org>/Tours/<slug>/           cover, hero, the tour's own pictures
//   EAC_Network/<org>/Tours/<slug>/Private/   guide notes, documents, copy drafts: never registered, never served publicly
//   EAC_Network/<org>/Places/<slug>/          a place's pictures, usable by every tour that stops there
//
// The database decides what a file belongs to (tour_assets.thread_id / stop_id / place_id); the folder is filing.
// A folder's name is fixed when it is made (threads.metadata.mediaFolder, places.media_folder, migration 280), so
// renaming a tour or place keeps its folder and every row that points into it.
//
// Files in Tours/<slug>/ and Places/<slug>/ have no Private/ segment: anyone who knows a path can fetch it, before or
// after a row exists. Scan therefore refuses pictures that carry a GPS location (put those under Private/ or use the
// place photo upload, which strips it).

import { db } from "@elkdonis/db";
import { siteConfig } from "@/config/site";
import { getAsset, upsertAsset } from "@/lib/assets";
import { credits, captionOf, matchStopFolder } from "@/lib/stop-folder-photos";
import { allowedChoices, type MoveChoice } from "@/lib/media-folder-choices";

export { allowedChoices, moveItemKey, type MoveChoice } from "@/lib/media-folder-choices";

const ORG = siteConfig.orgId;
const BASE = `EAC_Network/${ORG}`;
const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;
const DOC = /\.(pdf|docx?|odt|txt|md|rtf|pages|xlsx?|pptx?)$/i;
type Row = Record<string, unknown>;

// ── WebDAV ───────────────────────────────────────────────────────────────

function davUrl(key: string): string {
  const base = (process.env.NEXTCLOUD_URL ?? "").replace(/\/$/, "");
  const user = process.env.NEXTCLOUD_ADMIN_USER ?? "";
  return `${base}/remote.php/dav/files/${encodeURIComponent(user)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
function davAuth(): string {
  return `Basic ${Buffer.from(`${process.env.NEXTCLOUD_ADMIN_USER ?? ""}:${process.env.NEXTCLOUD_ADMIN_PASSWORD ?? ""}`).toString("base64")}`;
}
function needStorage() {
  if (!process.env.NEXTCLOUD_URL) throw new Error("File storage is not configured.");
}

/** MKCOL; an existing folder (405) counts as made. */
async function mkcol(key: string): Promise<void> {
  const res = await fetch(davUrl(key), { method: "MKCOL", headers: { Authorization: davAuth() }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok && res.status !== 405) throw new Error(`Could not make the folder ${key} (storage answered ${res.status}).`);
}

interface DavEntry {
  name: string;
  dir: boolean;
  bytes: number | null;
}

/** One level of a folder. Null when the folder does not exist. */
async function listDav(key: string): Promise<DavEntry[] | null> {
  const res = await fetch(davUrl(key), {
    method: "PROPFIND",
    headers: { Authorization: davAuth(), Depth: "1", "Content-Type": "application/xml" },
    body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/></d:prop></d:propfind>',
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Could not read ${key} (storage answered ${res.status}).`);
  const xml = await res.text();
  const out: DavEntry[] = [];
  for (const block of xml.split(/<d:response>/i).slice(1)) {
    const href = block.match(/<d:href>([^<]+)<\/d:href>/i)?.[1];
    if (!href) continue;
    const path = decodeURIComponent(href.replace(/\/$/, ""));
    if (path.endsWith(`/${key}`)) continue;
    const name = path.split("/").pop() ?? "";
    if (!name) continue;
    const len = block.match(/<d:getcontentlength>(\d+)<\/d:getcontentlength>/i)?.[1];
    out.push({ name, dir: /<d:collection\s*\/>/i.test(block), bytes: len ? Number(len) : null });
  }
  return out;
}

/** MOVE without overwriting. "exists" when the target is already there. */
async function moveDav(from: string, to: string): Promise<"moved" | "exists"> {
  const res = await fetch(davUrl(from), {
    method: "MOVE",
    headers: { Authorization: davAuth(), Destination: davUrl(to), Overwrite: "F" },
    signal: AbortSignal.timeout(60_000),
  });
  if (res.status === 412) return "exists";
  if (!res.ok) throw new Error(`Could not move ${from} (storage answered ${res.status}).`);
  return "moved";
}

/** A folder name from a slug: lower-case words and dashes only. */
function folderSlug(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "untitled";
}

/** The /api/media URL of a key. Refuses names a URL cannot carry losslessly through urlKey's decodeURI. */
function mediaUrl(key: string): string | null {
  if (/[#?%\\]/.test(key)) return null;
  return `/api/media/${encodeURI(key)}`;
}

// ── folders of records ───────────────────────────────────────────────────

/** The tour's folder (made, and recorded in threads.metadata.mediaFolder, the first time). Tours only. */
export async function ensureTourFolder(threadId: string): Promise<string> {
  needStorage();
  const [t] = (await db`
    SELECT slug, metadata->>'mediaFolder' AS folder FROM threads WHERE id = ${threadId} AND org_id = ${ORG} AND kind = 'tour'
  `) as unknown as { slug: string; folder: string | null }[];
  if (!t) throw new Error("That tour is not on this site.");
  const key = t.folder || `${BASE}/Tours/${folderSlug(t.slug)}`;
  await mkcol(`${BASE}/Tours`);
  await mkcol(key);
  await mkcol(`${key}/Private`);
  if (!t.folder) {
    await db`
      UPDATE threads SET metadata = COALESCE(metadata, '{}'::jsonb) || ${db.json({ mediaFolder: key })}
      WHERE id = ${threadId} AND org_id = ${ORG} AND kind = 'tour'
    `;
  }
  return key;
}

/** The place's folder (made, and recorded in places.media_folder, the first time). */
export async function ensurePlaceFolder(placeId: string): Promise<string> {
  needStorage();
  const [p] = (await db`SELECT slug, media_folder FROM places WHERE id = ${placeId} AND org_id = ${ORG}`) as unknown as {
    slug: string;
    media_folder: string | null;
  }[];
  if (!p) throw new Error("That place is not in this catalogue.");
  const key = p.media_folder || `${BASE}/Places/${folderSlug(p.slug)}`;
  await mkcol(`${BASE}/Places`);
  await mkcol(key);
  if (!p.media_folder) await db`UPDATE places SET media_folder = ${key} WHERE id = ${placeId} AND org_id = ${ORG}`;
  return key;
}

/** For create paths: make the folder without failing the save when storage is down. */
export function ensureFolderSoon(kind: "tour" | "place", id: string): void {
  const run = kind === "tour" ? ensureTourFolder(id) : ensurePlaceFolder(id);
  run.catch((err) => console.error(`[elktours] ${kind} folder:`, err instanceof Error ? err.message : err));
}

export interface BackfillResult {
  tours: number;
  places: number;
  failed: { kind: "tour" | "place"; id: string; title: string; error: string }[];
}

/** Folders for every tour and place that has none (not archived). Idempotent. */
export async function backfillFolders(): Promise<BackfillResult> {
  const tours = (await db`
    SELECT id, title FROM threads
    WHERE org_id = ${ORG} AND kind = 'tour' AND status <> 'archived' AND COALESCE(metadata->>'mediaFolder', '') = ''
  `) as unknown as { id: string; title: string }[];
  const places = (await db`
    SELECT id::text AS id, title FROM places WHERE org_id = ${ORG} AND archived_at IS NULL AND media_folder IS NULL
  `) as unknown as { id: string; title: string }[];
  const out: BackfillResult = { tours: 0, places: 0, failed: [] };
  for (const t of tours) {
    try {
      await ensureTourFolder(t.id);
      out.tours++;
    } catch (err) {
      out.failed.push({ kind: "tour", id: t.id, title: t.title, error: err instanceof Error ? err.message : String(err) });
    }
  }
  for (const p of places) {
    try {
      await ensurePlaceFolder(p.id);
      out.places++;
    } catch (err) {
      out.failed.push({ kind: "place", id: p.id, title: p.title, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}

export interface FolderCounts {
  toursWithout: number;
  placesWithout: number;
}

export async function folderCounts(): Promise<FolderCounts> {
  const [r] = (await db`
    SELECT
      (SELECT COUNT(*) FROM threads WHERE org_id = ${ORG} AND kind = 'tour' AND status <> 'archived'
         AND COALESCE(metadata->>'mediaFolder', '') = '')::int AS tours,
      (SELECT COUNT(*) FROM places WHERE org_id = ${ORG} AND archived_at IS NULL AND media_folder IS NULL)::int AS places
  `) as unknown as { tours: number; places: number }[];
  return { toursWithout: r?.tours ?? 0, placesWithout: r?.places ?? 0 };
}

// ── Scan: files dropped into a folder become hidden rows ─────────────────

export interface ScanResult {
  folder: string;
  added: number;
  already: number;
  skipped: { file: string; reason: string }[];
}

/** True when the picture carries a GPS position (exifr; unreadable files count as no position). */
export async function hasGps(key: string): Promise<boolean> {
  const got = await fetch(davUrl(key), { headers: { Authorization: davAuth() }, signal: AbortSignal.timeout(60_000) });
  if (!got.ok) throw new Error(`storage answered ${got.status}`);
  const exifr = (await import("exifr")).default;
  const gps = await exifr.gps(Buffer.from(await got.arrayBuffer())).catch(() => null);
  return !!gps && Number.isFinite(gps.latitude);
}

/**
 * Register the pictures in a tour's or place's folder that no row points at yet, hidden, with the Commons credit
 * when the file is found there. Files in Private/, films and documents are listed as skipped with the reason.
 * Archived rows count as registered, so a removed picture does not come back.
 */
export async function scanFolder(scope: { threadId: string } | { placeId: string }, userId: string | null): Promise<ScanResult> {
  const folder = "threadId" in scope ? await ensureTourFolder(scope.threadId) : await ensurePlaceFolder(scope.placeId);
  const entries = (await listDav(folder)) ?? [];
  const known = new Set(
    ((await db`
      SELECT storage_key FROM tour_assets WHERE org_id = ${ORG} AND storage_key LIKE ${`${folder}/%`}
    `) as unknown as { storage_key: string }[]).map((r) => r.storage_key)
  );
  const out: ScanResult = { folder, added: 0, already: 0, skipped: [] };
  const fresh: string[] = [];
  for (const e of entries) {
    if (e.dir) continue;
    const key = `${folder}/${e.name}`;
    if (known.has(key)) {
      out.already++;
      continue;
    }
    if (VIDEO.test(e.name)) out.skipped.push({ file: e.name, reason: "Films are added from the tour's media screen." });
    else if (DOC.test(e.name)) out.skipped.push({ file: e.name, reason: "Documents belong in the Private folder, where only the team can open them." });
    else if (!IMAGE.test(e.name)) out.skipped.push({ file: e.name, reason: "Not a picture this site can show." });
    else if (!mediaUrl(key)) out.skipped.push({ file: e.name, reason: "Rename the file without # ? % or \\ in its name." });
    else fresh.push(e.name);
  }
  if (fresh.length === 0) return out;
  const info = await credits(fresh);
  for (const name of fresh) {
    const key = `${folder}/${name}`;
    try {
      if (await hasGps(key)) {
        out.skipped.push({ file: name, reason: "The picture records where it was taken. Move it to Private/ or use the place photo upload, which removes the location." });
        continue;
      }
    } catch (err) {
      out.skipped.push({ file: name, reason: `Could not read it (${err instanceof Error ? err.message : "storage error"}).` });
      continue;
    }
    const c = info.get(name);
    const caption = captionOf(c?.title ?? name) || null;
    await upsertAsset(
      {
        ...("threadId" in scope ? { threadId: scope.threadId, role: "gallery" } : { placeId: scope.placeId }),
        kind: "image",
        url: mediaUrl(key)!,
        source: "folder",
        attribution: c?.credit ?? null,
        caption,
        altText: caption,
        visible: false,
      },
      userId
    );
    out.added++;
  }
  return out;
}

// ── the Stops/ folders: reviewed move into Places/ and Tours/ ────────────

export interface StopsPlanItem {
  /** Folder under Stops/ and file name. */
  folder: string;
  file: string;
  caption: string | null;
  credit: string | null;
  tourId: string;
  tourTitle: string;
  stopId: string | null;
  stopTitle: string | null;
  placeId: string | null;
  placeTitle: string | null;
  /** Where the file goes. The plan's default; the reviewer can change it per file (allowedChoices). */
  choice: MoveChoice;
  /** Order among the stop's pictures (the stage's order). 0 when unset. */
  position?: number;
}


export interface StopsPlan {
  items: StopsPlanItem[];
  /** Folders under Stops/ that no tour claimed. */
  unclaimed: string[];
  /** Files already registered (a live row points at them): left out of `items`. */
  registered?: number;
}

/** What registering would do: the files in Stops/ that no live row points at yet. Read only. */
export async function planStopsMove(): Promise<StopsPlan> {
  needStorage();
  const tours = (await db`
    SELECT id, slug, title FROM threads WHERE org_id = ${ORG} AND kind = 'tour' AND status <> 'archived' ORDER BY title
  `) as unknown as { id: string; slug: string; title: string }[];
  const stops = (await db`
    SELECT s.id::text AS id, s.thread_id, s.title, s.place_id::text AS place_id, p.title AS place_title
    FROM tour_stops s LEFT JOIN places p ON p.id = s.place_id AND p.org_id = ${ORG}
    WHERE s.org_id = ${ORG} AND s.thread_id = ANY(${tours.map((t) => t.id)}::text[])
    ORDER BY s.position
  `) as unknown as { id: string; thread_id: string; title: string; place_id: string | null; place_title: string | null }[];
  const items: StopsPlanItem[] = [];
  const claimed = new Set<string>();
  for (const t of tours) {
    const own = stops.filter((s) => s.thread_id === t.id);
    const m = await matchStopFolder(t, own.map((s) => ({ id: s.id, title: s.title, placeTitle: s.place_title })));
    if (!m || claimed.has(m.folder)) continue;
    claimed.add(m.folder);
    for (const f of m.files) {
      const s = f.stopId ? own.find((x) => x.id === f.stopId) ?? null : null;
      items.push({
        folder: m.folder,
        file: f.file,
        caption: f.caption,
        credit: f.credit,
        tourId: t.id,
        tourTitle: t.title,
        stopId: s?.id ?? null,
        stopTitle: s?.title ?? null,
        placeId: s?.place_id ?? null,
        placeTitle: s?.place_title ?? null,
        choice: s?.place_id ? "place" : s ? "stop" : "overview",
      });
    }
  }
  const all = ((await listDav(`${BASE}/Stops`)) ?? []).filter((e) => e.dir).map((e) => e.name);
  // A file with a live row is registered: it is not offered again (so running twice cannot make a second row).
  const known = new Set(
    ((await db`
      SELECT storage_key FROM tour_assets WHERE org_id = ${ORG} AND archived_at IS NULL AND storage_key LIKE ${`${BASE}/Stops/%`}
    `) as unknown as { storage_key: string }[]).map((r) => r.storage_key)
  );
  const fresh = items.filter((it) => !known.has(`${BASE}/Stops/${it.folder}/${it.file}`));
  return { items: fresh, unclaimed: all.filter((n) => !claimed.has(n)), registered: items.length - fresh.length };
}

export interface RegisterResult {
  /** New rows made for files that had none. */
  registered: number;
  /** Rows that already existed for the file and now record the chosen owner. */
  updated: number;
  /** Files whose row already said this. */
  already: number;
  failed: { file: string; error: string }[];
}

/**
 * "What is this picture of" (2026-11-21, developer: register where it sits). Records, per file, which tour, stop or
 * place the picture belongs to on the picture's own row, shown, WITHOUT moving or copying the file:
 *   place    the row is the place's picture (place_id; no tour, no stop). Stops at that place show it through the place.
 *   stop     the row is on that stop (thread_id + stop_id).
 *   overview the row is in the tour's overview gallery.
 * One row per file: a row that already points at the file's storage key (live) is updated, never doubled, so running
 * this twice changes nothing the second time. The file's storage key and url are never changed. A picture that records
 * where it was taken is refused (as Scan does). `sql` is the connection (a transaction in tests).
 */
export async function registerInPlace(
  items: StopsPlanItem[],
  userId: string | null,
  opts: { sql?: typeof db; checkGps?: boolean; visible?: boolean } = {}
): Promise<RegisterResult> {
  const sql = opts.sql ?? db;
  const out: RegisterResult = { registered: 0, updated: 0, already: 0, failed: [] };
  for (const it of items) {
    if (it.choice === "leave") continue;
    try {
      if (!allowedChoices(it).includes(it.choice)) throw new Error(`"${it.choice}" does not fit this file`);
      const key = `${BASE}/Stops/${it.folder}/${it.file}`;
      const url = mediaUrl(key);
      if (!url) throw new Error("the file name has # ? % or a backslash in it; rename it first");
      const owner =
        it.choice === "place"
          ? { thread: null as string | null, stop: null as string | null, place: it.placeId, role: null as string | null }
          : it.choice === "stop"
            ? { thread: it.tourId as string | null, stop: it.stopId, place: null as string | null, role: null as string | null }
            : { thread: it.tourId as string | null, stop: null as string | null, place: null as string | null, role: "gallery" as string | null };
      const [row] = (await sql`
        SELECT id, thread_id, stop_id::text AS stop_id, place_id::text AS place_id FROM tour_assets
        WHERE org_id = ${ORG} AND storage_key = ${key} AND archived_at IS NULL ORDER BY created_at LIMIT 1
      `) as unknown as { id: string; thread_id: string | null; stop_id: string | null; place_id: string | null }[];
      if (row) {
        if (row.thread_id === owner.thread && row.stop_id === owner.stop && row.place_id === owner.place) out.already++;
        else {
          await sql`
            UPDATE tour_assets SET thread_id = ${owner.thread}, stop_id = ${owner.stop}, place_id = ${owner.place},
              role = COALESCE(${owner.role}, role), updated_at = NOW()
            WHERE id = ${row.id} AND org_id = ${ORG}
          `;
          out.updated++;
        }
        continue;
      }
      if (opts.checkGps !== false && (await hasGps(key))) {
        throw new Error("the picture records where it was taken; use the place photo upload, which removes the location");
      }
      await sql`
        INSERT INTO tour_assets (org_id, thread_id, stop_id, place_id, kind, role, storage, storage_key, url, source, attribution,
                                 visible, position, caption, alt_text, created_by)
        VALUES (${ORG}, ${owner.thread}, ${owner.stop}, ${owner.place}, 'image', ${owner.role}, 'nextcloud', ${key}, ${url}, 'folder',
                ${it.credit}, ${opts.visible ?? true}, ${it.position ?? 0}, ${it.caption}, ${it.caption}, ${userId})
      `;
      out.registered++;
    } catch (err) {
      out.failed.push({ file: `${it.folder}/${it.file}`, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}

export interface StopsMoveResult {
  moved: number;
  duplicates: number;
  rows: number;
  failed: { file: string; error: string }[];
}

/**
 * RETIRED from the menu (2026-11-21): moving a file in order to choose where it shows made duplicate rows. The menu now
 * calls registerInPlace. This stays only as the record of the old behaviour; do not call it for files in Stops/. The
 * one move that is still right is a file leaving a Private/ folder to be shown, which setAssetVisible does
 * (publishPrivateFile in lib/assets.ts: copy, strip the location, point the row at the public copy).
 *
 * Carry out the plan, per file as its `choice` says ("leave" skips it): each file moves to its place's (or tour's) folder and gets rows, shown, so the tour pages show
 * what they show today: a place row plus a stop row pointing at the same file (as "Use for this stop" does), or a
 * tour row (stop row when the file names a stop with no place; gallery when it names no stop). A file whose name is
 * already in the target folder is not overwritten: it moves to Private/Media/Images/stops-duplicates/<folder>/ and the
 * stop uses the picture already there. Nothing is deleted.
 */
export async function runStopsMove(items: StopsPlanItem[], userId: string | null): Promise<StopsMoveResult> {
  needStorage();
  const out: StopsMoveResult = { moved: 0, duplicates: 0, rows: 0, failed: [] };
  for (const it of items) {
    if (it.choice === "leave") continue;
    try {
      if (!allowedChoices(it).includes(it.choice)) throw new Error(`"${it.choice}" does not fit this file`);
      const from = `${BASE}/Stops/${it.folder}/${it.file}`;
      const folder = it.choice === "place" && it.placeId ? await ensurePlaceFolder(it.placeId) : await ensureTourFolder(it.tourId);
      const key = `${folder}/${it.file}`;
      const url = mediaUrl(key);
      if (!url) throw new Error("the file name has # ? % or \\ in it; rename it first");
      const moved = await moveDav(from, key);
      if (moved === "exists") {
        const holding = `${BASE}/Private/Media/Images/stops-duplicates/${it.folder}`;
        await mkcol(`${BASE}/Private/Media/Images/stops-duplicates`);
        await mkcol(holding);
        await moveDav(from, `${holding}/${it.file}`);
        out.duplicates++;
      } else out.moved++;

      const common = { kind: "image" as const, url, source: "folder", attribution: it.credit, caption: it.caption, altText: it.caption, visible: true };
      if (it.choice === "place" && it.placeId) {
        // The place's row for this file: reuse it when a duplicate (or an earlier run) already made it.
        const [existing] = (await db`
          SELECT id FROM tour_assets
          WHERE org_id = ${ORG} AND place_id = ${it.placeId} AND thread_id IS NULL AND storage_key = ${key} AND archived_at IS NULL
          LIMIT 1
        `) as unknown as { id: string }[];
        const placeAsset = existing ? await getAsset(existing.id) : await upsertAsset({ ...common, placeId: it.placeId }, userId);
        if (!existing) out.rows++;
        if (it.stopId && placeAsset) {
          const [dup] = (await db`
            SELECT id FROM tour_assets WHERE org_id = ${ORG} AND stop_id = ${it.stopId} AND storage_key = ${key} AND archived_at IS NULL LIMIT 1
          `) as unknown as Row[];
          if (!dup) {
            const stopAsset = await upsertAsset({ ...common, stopId: it.stopId, threadId: it.tourId }, userId);
            await db`
              UPDATE tour_assets SET place_id = ${it.placeId}, meta = meta || ${db.json({ fromPlaceAssetId: placeAsset.id })}
              WHERE id = ${stopAsset.id} AND org_id = ${ORG}
            `;
            out.rows++;
          }
        }
      } else {
        const [dup] = (await db`
          SELECT id FROM tour_assets WHERE org_id = ${ORG} AND thread_id = ${it.tourId} AND storage_key = ${key} AND archived_at IS NULL LIMIT 1
        `) as unknown as Row[];
        if (!dup) {
          await upsertAsset(
            it.choice === "stop" && it.stopId ? { ...common, threadId: it.tourId, stopId: it.stopId } : { ...common, threadId: it.tourId, role: "gallery" },
            userId
          );
          out.rows++;
        }
      }
    } catch (err) {
      out.failed.push({ file: `${it.folder}/${it.file}`, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}

/** The recorded folder of a tour or place, or null when none was made yet. Read only. */
export async function recordedFolder(scope: { threadId: string } | { placeId: string }): Promise<string | null> {
  try {
    if ("threadId" in scope) {
      const [t] = (await db`
        SELECT metadata->>'mediaFolder' AS folder FROM threads WHERE id = ${scope.threadId} AND org_id = ${ORG}
      `) as unknown as { folder: string | null }[];
      return t?.folder || null;
    }
    const [p] = (await db`SELECT media_folder FROM places WHERE id = ${scope.placeId} AND org_id = ${ORG}`) as unknown as { media_folder: string | null }[];
    return p?.media_folder ?? null;
  } catch (err) {
    console.error("[elktours] recordedFolder:", err instanceof Error ? err.message : err);
    return null;
  }
}
