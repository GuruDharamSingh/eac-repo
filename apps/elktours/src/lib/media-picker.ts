// Server only. The one picker's sources, attach and upload for this site
// (docs/open/ELKTOURS_MEDIA_STRUCTURE_2026-11-26.md §3, §5; developer, 2026-11-26).
//
// Sources (owners and guides; the root of each is decided here, never by the request):
//   tour    the tour's folder, EAC_Network/<org>/Tours/<slug>/ (made on first open), Private/ included: the team's own
//           folder. While the owner's old Stops/<FOLDER>/ is matched to the tour, it shows as a shortcut.
//   place   one place's folder, Places/<slug>/ (lists nothing until the place has pictures).
//   places  the places: this tour's stops first (tour order), then every place that has a folder.
//   org     the whole org tree, public folders only.
//   mine    the person's own folder, users/<storage_folder>/, public folders only.
//   stops   the owner's old Stops/ folders, until they move into the tours (§4).
//
// Who: owners and guides; a tour's folder only for owners and the tour's author (the tour editor's rule).
// Attach (a pick): link or copy, decided here by §3. A file already inside the destination's own folder (and not
// under Private/) is linked as it is; so is a place's picture picked for a stop at that place. Everything else is
// copied into the destination folder: pictures re-encoded without metadata, never replacing a file.
//
// Upload: into the destination's folder, named after its context (`pont-neuf-2026-11-26-01.jpg`), pictures
// re-encoded without metadata. With no destination: Media/Images.

import { db } from "@elkdonis/db";
import {
  contextFileBase,
  copyIntoFolder,
  davMkcol,
  getStorageSlug,
  listMediaSource,
  putUniqueFile,
  safeFileBase,
  stripPictureMetadata,
  userStorageRoot,
  type MediaSourceItem,
  type MediaSourceListing,
} from "@elkdonis/services";
import { validateUploadBuffer } from "@elkdonis/utils";
import { siteConfig } from "@/config/site";
import type { Viewer } from "@/lib/auth";
import { ensurePlaceFolder, ensureTourFolder } from "@/lib/media-folders";
import { matchStopFolder } from "@/lib/stop-folder-photos";

const ORG = siteConfig.orgId;
const BASE = `EAC_Network/${ORG}`;
const ID = /^[A-Za-z0-9_-]{6,40}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,100}$/;
const PRIVATE_SEG = /(^|\/)private(\/|$)/i;
const MAX_UPLOAD = 25 * 1024 * 1024;

export type SourceKey = "tour" | "place" | "places" | "org" | "mine" | "stops";
const KEYS: SourceKey[] = ["tour", "place", "places", "org", "mine", "stops"];

export type PickerResult<T> = { ok: true; value: T } | { ok: false; status: 400 | 401 | 403 | 404 | 502; error: string };

export interface SourceContext {
  tourId?: string | null;
  placeId?: string | null;
}

/** Where a picked or uploaded file is going. */
export type Destination =
  | { kind: "tour"; tourId: string; slot: "cover" | "gallery" | "stop"; stopId?: string | null }
  | { kind: "place"; placeId: string }
  | { kind: "general"; context?: string | null };

// ── roots ────────────────────────────────────────────────────────────────

/**
 * The tour, when this viewer may file into it: owners any tour, guides the tours they wrote (the tour editor's own
 * rule, getTourSheet in lib/office-actions.ts).
 */
async function tourRow(tourId: string, viewer: Viewer): Promise<{ id: string; slug: string; title: string } | null> {
  if (!ID.test(tourId)) return null;
  const [t] = (await db`
    SELECT id, slug, title, author_id FROM threads WHERE id = ${tourId} AND org_id = ${ORG} AND kind = 'tour' AND status <> 'archived'
  `) as unknown as { id: string; slug: string; title: string; author_id: string | null }[];
  if (!t) return null;
  if (viewer.role !== "owner" && t.author_id !== viewer.userId) return null;
  return { id: t.id, slug: t.slug, title: t.title };
}

async function placeRow(placeId: string): Promise<{ id: string; slug: string; title: string; media_folder: string | null } | null> {
  if (!UUID.test(placeId)) return null;
  const [p] = (await db`
    SELECT id::text AS id, slug, title, media_folder FROM places WHERE id = ${placeId}::uuid AND org_id = ${ORG} AND archived_at IS NULL
  `) as unknown as { id: string; slug: string; title: string; media_folder: string | null }[];
  return p ?? null;
}

/** The old Stops/<FOLDER> matched to a tour (the stage's own rule), or null. */
async function oldStopsFolder(tour: { id: string; slug: string; title: string }): Promise<string | null> {
  const stops = (await db`
    SELECT s.id::text AS id, s.title, p.title AS place_title
    FROM tour_stops s LEFT JOIN places p ON p.id = s.place_id AND p.org_id = ${ORG}
    WHERE s.org_id = ${ORG} AND s.thread_id = ${tour.id} ORDER BY s.position
  `) as unknown as { id: string; title: string; place_title: string | null }[];
  const m = await matchStopFolder(tour, stops.map((s) => ({ id: s.id, title: s.title, placeTitle: s.place_title }))).catch(() => null);
  return m?.folder ?? null;
}

interface Root {
  root: string;
  showPrivate: boolean;
}

/** The storage root of a source for this viewer, or an error. `place` and `tour` need their id. */
async function rootOf(viewer: Viewer, key: SourceKey, ctx: SourceContext, opts: { create?: boolean } = {}): Promise<PickerResult<Root>> {
  switch (key) {
    case "tour": {
      const t = ctx.tourId ? await tourRow(ctx.tourId, viewer) : null;
      if (!t) return { ok: false, status: 404, error: "No such tour." };
      const [r] = (await db`SELECT metadata->>'mediaFolder' AS folder FROM threads WHERE id = ${t.id} AND org_id = ${ORG}`) as unknown as { folder: string | null }[];
      const root = r?.folder || (opts.create === false ? `${BASE}/Tours/${t.slug}` : await ensureTourFolder(t.id));
      return { ok: true, value: { root, showPrivate: true } };
    }
    case "place": {
      const p = ctx.placeId ? await placeRow(ctx.placeId) : null;
      if (!p) return { ok: false, status: 404, error: "No such place." };
      return { ok: true, value: { root: p.media_folder || `${BASE}/Places/${p.slug}`, showPrivate: false } };
    }
    case "places":
      return { ok: true, value: { root: `${BASE}/Places`, showPrivate: false } };
    case "org":
      return { ok: true, value: { root: BASE, showPrivate: false } };
    case "stops":
      return { ok: true, value: { root: `${BASE}/Stops`, showPrivate: false } };
    case "mine": {
      const slug = await getStorageSlug(viewer.userId);
      if (!slug) return { ok: false, status: 404, error: "You have no file space yet." };
      return { ok: true, value: { root: userStorageRoot(slug), showPrivate: false } };
    }
  }
}

// ── listing ──────────────────────────────────────────────────────────────

const shortcut = (name: string, source: SourceKey, path: string): MediaSourceItem & { shortcut: { source: string; path: string } } => ({
  name,
  path: `shortcut:${source}:${path}`,
  isFolder: true,
  shortcut: { source, path },
});

/** One listing for the picker. Owners and guides only. */
export async function listSource(
  viewer: Viewer | null,
  rawKey: string,
  q: { path?: string | null; q?: string | null; tourId?: string | null; placeId?: string | null }
): Promise<PickerResult<MediaSourceListing>> {
  if (!viewer) return { ok: false, status: 401, error: "Sign in first." };
  if (!viewer.canEdit) return { ok: false, status: 403, error: "Owners and guides only." };
  const key = rawKey as SourceKey;
  if (!KEYS.includes(key)) return { ok: false, status: 404, error: "No such library." };
  const path = (q.path ?? "").trim();
  const search = (q.q ?? "").trim().slice(0, 80) || null;
  const ctx = { tourId: q.tourId || null, placeId: q.placeId || null };

  try {
    // The places root: this tour's stops first, in tour order, then every place with a folder.
    if (key === "places" && !path && !search) {
      const stops = ctx.tourId && ID.test(ctx.tourId)
        ? ((await db`
            SELECT p.slug, p.title FROM tour_stops s JOIN places p ON p.id = s.place_id AND p.org_id = ${ORG}
            WHERE s.org_id = ${ORG} AND s.thread_id = ${ctx.tourId} AND p.archived_at IS NULL ORDER BY s.position
          `) as unknown as { slug: string; title: string }[])
        : [];
      const filed = (await db`
        SELECT slug, title FROM places WHERE org_id = ${ORG} AND archived_at IS NULL AND media_folder IS NOT NULL ORDER BY title
      `) as unknown as { slug: string; title: string }[];
      const seen = new Set<string>();
      const items: MediaSourceItem[] = [];
      for (const [i, s] of stops.entries()) {
        if (seen.has(s.slug)) continue;
        seen.add(s.slug);
        items.push({ name: `${i + 1}. ${s.title}`, path: s.slug, isFolder: true });
      }
      for (const p of filed) {
        if (seen.has(p.slug)) continue;
        seen.add(p.slug);
        items.push({ name: p.title, path: p.slug, isFolder: true });
      }
      return { ok: true, value: { path: "", browsable: true, items } };
    }

    // Inside one place under `places`: its recorded folder (a place's folder name is fixed when made).
    let rootInfo: PickerResult<Root>;
    let rel = path;
    if (key === "places" && path) {
      const [slug, ...rest] = path.split("/");
      if (!slug || !SLUG.test(slug)) return { ok: false, status: 404, error: "Not a folder here." };
      const [p] = (await db`SELECT id::text AS id FROM places WHERE org_id = ${ORG} AND slug = ${slug} AND archived_at IS NULL`) as unknown as { id: string }[];
      if (!p) return { ok: false, status: 404, error: "No such place." };
      rootInfo = await rootOf(viewer, "place", { placeId: p.id });
      rel = rest.join("/");
      if (rootInfo.ok === false) return rootInfo;
      const r = await listMediaSource(rootInfo.value.root, rel, { showPrivate: false });
      if ("error" in r) return { ok: false, status: 404, error: r.error };
      return { ok: true, value: { ...r, path, items: r.items.map((i) => ({ ...i, path: `${slug}/${i.path}` })) } };
    }

    rootInfo = await rootOf(viewer, key, ctx);
    if (rootInfo.ok === false) return rootInfo;
    const r = await listMediaSource(rootInfo.value.root, rel, { q: search, showPrivate: rootInfo.value.showPrivate });
    if ("error" in r) return { ok: false, status: 404, error: r.error };

    // The tour's top level: the old Stops folder, while it is still where the owner put it.
    if (key === "tour" && !rel && !search && ctx.tourId) {
      const t = await tourRow(ctx.tourId, viewer);
      const old = t ? await oldStopsFolder(t) : null;
      if (old) r.items.unshift(shortcut("Stop pictures (old Stops folder)", "stops", old));
    }
    return { ok: true, value: r };
  } catch (err) {
    console.error(`[elktours] picker ${key}:`, err instanceof Error ? err.message : err);
    return { ok: false, status: 502, error: "The file storage could not be reached." };
  }
}

// ── resolving a pick to a storage key ────────────────────────────────────

async function keyOfPick(viewer: Viewer, source: string, path: string, ctx: SourceContext): Promise<PickerResult<string>> {
  const key = source as SourceKey;
  if (!KEYS.includes(key)) return { ok: false, status: 400, error: "Unknown library." };
  const clean = path.trim().replace(/^\/+|\/+$/g, "");
  if (!clean || clean.split("/").some((p) => !p || p === "." || p === ".." || p.startsWith(".") || p.includes("\\"))) {
    return { ok: false, status: 400, error: "Not a file here." };
  }
  if (key === "places") {
    const [slug, ...rest] = clean.split("/");
    const [p] = (await db`SELECT id::text AS id FROM places WHERE org_id = ${ORG} AND slug = ${slug ?? ""} AND archived_at IS NULL`) as unknown as { id: string }[];
    if (!p || rest.length === 0) return { ok: false, status: 404, error: "No such picture." };
    return keyOfPick(viewer, "place", rest.join("/"), { placeId: p.id });
  }
  const r = await rootOf(viewer, key, ctx, { create: false });
  if (r.ok === false) return r;
  if (!r.value.showPrivate && PRIVATE_SEG.test(clean)) return { ok: false, status: 403, error: "Not a file you can use here." };
  return { ok: true, value: `${r.value.root}/${clean}` };
}

/** The folder a destination files into (made when missing), and what counts as "already its own". */
async function destinationFolder(dest: Destination, viewer: Viewer): Promise<PickerResult<{ folder: string; own: string[]; context: string }>> {
  if (dest.kind === "tour") {
    const t = await tourRow(dest.tourId, viewer);
    if (!t) return { ok: false, status: 404, error: "No such tour." };
    const root = await ensureTourFolder(t.id);
    if (dest.slot !== "stop") return { ok: true, value: { folder: root, own: [root], context: t.slug } };
    if (!dest.stopId || !UUID.test(dest.stopId)) return { ok: false, status: 400, error: "Which stop?" };
    const [s] = (await db`
      SELECT s.title, p.slug AS place_slug, p.media_folder FROM tour_stops s LEFT JOIN places p ON p.id = s.place_id AND p.org_id = ${ORG}
      WHERE s.id = ${dest.stopId}::uuid AND s.org_id = ${ORG} AND s.thread_id = ${t.id}
    `) as unknown as { title: string; place_slug: string | null; media_folder: string | null }[];
    if (!s) return { ok: false, status: 404, error: "No such stop on this tour." };
    const folder = `${root}/Stops`;
    await davMkcol(folder);
    // A stop links to its place's pictures (and to the tour's own folder); the old Stops folder stays linked until it moves.
    const own = [root];
    if (s.media_folder) own.push(s.media_folder);
    const old = await oldStopsFolder(t);
    if (old) own.push(`${BASE}/Stops/${old}`);
    return { ok: true, value: { folder, own, context: s.place_slug || safeFileBase(s.title).toLowerCase().replace(/[^a-z0-9]+/g, "-") } };
  }
  if (dest.kind === "place") {
    const p = await placeRow(dest.placeId);
    if (!p) return { ok: false, status: 404, error: "No such place." };
    const folder = await ensurePlaceFolder(p.id);
    return { ok: true, value: { folder, own: [folder], context: p.slug } };
  }
  const folder = `${BASE}/Media/Images`;
  return { ok: true, value: { folder, own: [`${BASE}/Media`, `${BASE}/Places`, `${BASE}/Tours`], context: dest.context || "" } };
}

const within = (key: string, folder: string) => key.startsWith(`${folder}/`);
const urlOf = (key: string) => `/api/media/${encodeURI(key)}`;

export interface AttachResult {
  url: string;
  key: string;
  copied: boolean;
  copiedFrom: string | null;
  sha256: string | null;
}

/** A pick: link it where it is, or copy it into the destination (§3). */
export async function attachPick(
  viewer: Viewer | null,
  input: { source: string; path: string; url?: string | null; tourId?: string | null; destination: Destination }
): Promise<PickerResult<AttachResult>> {
  if (!viewer) return { ok: false, status: 401, error: "Sign in first." };
  if (!viewer.canEdit) return { ok: false, status: 403, error: "Owners and guides only." };
  const dest = parseDestination(input.destination);
  if (!dest) return { ok: false, status: 400, error: "Where should the file go?" };

  let src: string;
  if (input.source === "upload" || input.source === "drop") {
    // A file this picker just uploaded into the destination, or a tile dragged from another library on the page:
    // only this org's public files are taken as they are.
    const u = (input.url ?? "").split("?")[0]!;
    let k: string;
    try {
      k = u.startsWith("/api/media/") ? decodeURI(u.slice("/api/media/".length)) : "";
    } catch {
      k = "";
    }
    if (!k || !within(k, BASE) || k.includes("..") || PRIVATE_SEG.test(k)) return { ok: false, status: 400, error: "That file cannot be used here." };
    return { ok: true, value: { url: urlOf(k), key: k, copied: false, copiedFrom: null, sha256: null } };
  } else {
    const r = await keyOfPick(viewer, input.source, input.path, { tourId: input.tourId ?? (dest.kind === "tour" ? dest.tourId : null) });
    if (r.ok === false) return r;
    src = r.value;
  }

  const d = await destinationFolder(dest, viewer);
  if (d.ok === false) return d;
  const isPrivate = PRIVATE_SEG.test(src.slice(BASE.length));
  if (!isPrivate && d.value.own.some((f) => within(src, f))) {
    return { ok: true, value: { url: urlOf(src), key: src, copied: false, copiedFrom: null, sha256: null } };
  }
  try {
    const c = await copyIntoFolder(src, d.value.folder, {
      findByHash: async (sha) => {
        const [row] = (await db`
          SELECT storage_key FROM tour_assets
          WHERE org_id = ${ORG} AND sha256 = ${sha} AND archived_at IS NULL AND storage_key LIKE ${`${d.value.folder}/%`} LIMIT 1
        `) as unknown as { storage_key: string }[];
        return row?.storage_key ?? null;
      },
    });
    return { ok: true, value: { url: c.url, key: c.key, copied: !c.reused, copiedFrom: src, sha256: c.sha256 } };
  } catch (err) {
    return { ok: false, status: 502, error: err instanceof Error ? err.message : "Could not copy the file." };
  }
}

export function parseDestination(raw: unknown): Destination | null {
  if (!raw || typeof raw !== "object") return { kind: "general" };
  const d = raw as Record<string, unknown>;
  if (d.kind === "tour" && typeof d.tourId === "string") {
    const slot = d.slot === "stop" || d.slot === "gallery" ? d.slot : "cover";
    return { kind: "tour", tourId: d.tourId, slot, stopId: typeof d.stopId === "string" ? d.stopId : null };
  }
  if (d.kind === "place" && typeof d.placeId === "string") return { kind: "place", placeId: d.placeId };
  if (d.kind === "general" || d.kind === undefined) return { kind: "general", context: typeof d.context === "string" ? d.context.slice(0, 60) : null };
  return null;
}

// ── upload into a destination ────────────────────────────────────────────

const EXT_OF: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif",
  "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm", "application/pdf": ".pdf",
};

/** An upload filed in the destination's folder under its context name. Pictures lose their metadata. */
export async function uploadTo(viewer: Viewer | null, file: File | null, rawDest: unknown): Promise<PickerResult<AttachResult & { name: string }>> {
  if (!viewer) return { ok: false, status: 401, error: "Sign in first." };
  if (!viewer.canEdit) return { ok: false, status: 403, error: "Owners and guides only." };
  if (!file || typeof file.arrayBuffer !== "function") return { ok: false, status: 400, error: "No file." };
  if (file.size > MAX_UPLOAD) return { ok: false, status: 400, error: "Files up to 25 MB." };
  const dest = parseDestination(rawDest);
  if (!dest) return { ok: false, status: 400, error: "Where should the file go?" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const v = validateUploadBuffer(bytes, ["image", "video", "document"]);
  if (v.ok === false) return { ok: false, status: 400, error: v.reason };
  const d = await destinationFolder(dest, viewer);
  if (d.ok === false) return d;

  const original = safeFileBase(file.name.replace(/\.[a-z0-9]{1,8}$/i, ""));
  const base = d.value.context ? contextFileBase(d.value.context) : original;
  const numbered = Boolean(d.value.context);
  try {
    let body: Uint8Array = bytes;
    let mime = v.sniffed.mime;
    let ext = EXT_OF[mime] ?? (/\.[a-z0-9]{1,8}$/i.exec(file.name)?.[0]?.toLowerCase() ?? "");
    if (v.sniffed.kind === "image") {
      const s = await stripPictureMetadata(bytes);
      body = s.bytes;
      mime = s.mime;
      ext = s.ext;
    }
    const { key, name } = await putUniqueFile(d.value.folder, base, ext, body, mime, { numbered });
    return { ok: true, value: { url: urlOf(key), key, name, copied: false, copiedFrom: null, sha256: null } };
  } catch (err) {
    return { ok: false, status: 502, error: err instanceof Error ? err.message : "Could not store the file." };
  }
}
