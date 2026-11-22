// Server only. The picture libraries a person can choose from (MEDIA lane, 2026-11-21).
//
// A library is a LIST of pictures that are already stored; choosing one returns the picture's /api/media URL and
// never moves, copies or writes anything. Four libraries, each decided on the server from who is asking:
//
//   tours    pictures registered on a tour (tour_assets), one folder per tour. Owners and guides: every tour.
//   places   pictures registered on a place (tour_assets.place_id), one folder per place. Owners and guides.
//   general  the site's own Media/Images in storage (the old "This site" tab). Owners and guides.
//
// (There is no "My pictures" library here: an upload made for a site or a tour goes into the org's media, not a personal
// folder, and a person's profile photo is not part of this. 2026-11-21, developer.)
//
// What is never returned: anything with a Private segment in its path, anything outside this org's files, hidden or
// archived rows, Street View stills and live features, films.
// The org comes from the deployment (siteConfig), the person from the session; the request supplies only a folder
// name and a search word, both checked here.
//
// Shape of a listing: what MediaBrowser (packages/cms-ui) reads, `{ path, items, browsable }`.

import { db } from "@elkdonis/db";
import { browseMediaFolder } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import type { Viewer } from "@/lib/auth";
import { listStopFolders } from "@/lib/media-stop-folders";

const ORG = siteConfig.orgId;
const ORG_MEDIA = `/api/media/EAC_Network/${ORG}/`;
const USERS_MEDIA = "/api/media/EAC_Network/users/";
const LIMIT = 200;
const SLUG = /^[a-z0-9][a-z0-9-]{0,100}$/;
const ID = /^[A-Za-z0-9_-]{10,40}$/;

export type LibraryKey = "tours" | "places" | "general" | "stops";
export const LIBRARY_KEYS: LibraryKey[] = ["tours", "places", "general", "stops"];

/** The part of the session this module needs (lib/auth Viewer). Null is a stranger. */
export type LibraryViewer = Pick<Viewer, "userId" | "role" | "canEdit" | "isMember"> | null;

export interface LibraryItem {
  name: string;
  path: string;
  isFolder: boolean;
  url?: string;
  thumb?: string;
}
export interface LibraryListing {
  path: string;
  items: LibraryItem[];
  browsable: boolean;
  search?: boolean;
}
export type LibraryResult = { ok: true; listing: LibraryListing } | { ok: false; status: 401 | 403 | 404 | 502; error: string };

/** The libraries this person may open, in the order a picker shows them. */
export function librariesFor(viewer: LibraryViewer): { key: LibraryKey; label: string }[] {
  return viewer?.canEdit ? [{ key: "tours", label: "Tours" }, { key: "places", label: "Places" }, { key: "general", label: "General" }, { key: "stops", label: "Stop folders" }] : [];
}

// ── what may never be listed ─────────────────────────────────────────────

const PRIVATE = /(^|\/)private(\/|$)/i;
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * True when a picture URL may be offered: our own media route inside this org's files, or an external https picture;
 * no `..`, no Private segment, however it is spelled or encoded. (`allowUsers` is kept for callers of the check; no
 * library here lists the users/ tree.)
 */
export function isOfferablePicture(url: string | null | undefined, allowUsers = false): boolean {
  if (!url || typeof url !== "string") return false;
  const path = safeDecode(url.split("?")[0]!);
  if (path.includes("..") || path.includes("\\") || PRIVATE.test(path)) return false;
  if (url.startsWith("https://")) return true;
  return url.startsWith(ORG_MEDIA) || (allowUsers && url.startsWith(USERS_MEDIA));
}

const fileName = (url: string) => safeDecode(url.split("?")[0]!.split("/").pop() ?? "");
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// ── rows to items ────────────────────────────────────────────────────────

interface PictureRow {
  url: string;
  caption: string | null;
}

function pictureItems(rows: PictureRow[]): LibraryItem[] {
  const seen = new Set<string>();
  const out: LibraryItem[] = [];
  for (const r of rows) {
    if (!isOfferablePicture(r.url) || seen.has(r.url)) continue;
    seen.add(r.url);
    out.push({ name: r.caption?.trim() || fileName(r.url), path: r.url, isFolder: false, url: r.url, thumb: r.url });
  }
  return out;
}

/** Registered, shown, not archived, nothing under Private/, not the copy of another picture. */
const registered = () => db`
  a.org_id = ${ORG} AND a.archived_at IS NULL AND a.visible AND a.url IS NOT NULL
  AND COALESCE(a.storage_key, '') NOT ILIKE '%/private/%' AND a.url NOT ILIKE '%/private/%'
  AND a.meta->>'fromPlaceAssetId' IS NULL`;

// ── tours ────────────────────────────────────────────────────────────────

async function listTours(viewer: NonNullable<LibraryViewer>, path: string, q: string, tourId: string | null): Promise<LibraryResult> {
  // Owners and guides see every tour (developer, 2026-11-21).
  if (!viewer.canEdit) return { ok: false, status: 403, error: "Not allowed" };
  const own = db``;

  // Inside one tour (a folder, or the creation flow's "This tour"), or a name search across the allowed tours.
  if (tourId || path || q) {
    if (path && !SLUG.test(path)) return { ok: false, status: 404, error: "Not a folder here." };
    const rows = (await db`
      SELECT a.url, a.caption FROM tour_assets a JOIN threads t ON t.id = a.thread_id AND t.org_id = ${ORG}
      WHERE ${registered()} AND a.kind IN ('image', 'poster') AND t.kind = 'tour' AND t.status <> 'archived' ${own}
        ${tourId ? db`AND t.id = ${tourId}` : db``}
        ${path ? db`AND t.slug = ${path}` : db``}
        ${q ? db`AND (COALESCE(a.caption, '') ILIKE ${like(q)} OR a.url ILIKE ${like(q)} OR t.title ILIKE ${like(q)})` : db``}
      ORDER BY a.position, a.created_at LIMIT ${LIMIT}
    `) as unknown as PictureRow[];
    return { ok: true, listing: { path: q || tourId ? "" : path, items: pictureItems(rows), browsable: !tourId, ...(q ? { search: true } : {}) } };
  }

  const rows = (await db`
    SELECT t.slug, t.title, COUNT(DISTINCT a.url)::int AS n
    FROM threads t JOIN tour_assets a ON a.thread_id = t.id
    WHERE ${registered()} AND a.kind IN ('image', 'poster') AND t.org_id = ${ORG} AND t.kind = 'tour' AND t.status <> 'archived' ${own}
    GROUP BY t.slug, t.title ORDER BY t.title
  `) as unknown as { slug: string; title: string; n: number }[];
  return { ok: true, listing: { path: "", browsable: true, items: rows.map((r) => ({ name: `${r.title} (${r.n})`, path: r.slug, isFolder: true })) } };
}

// ── places ───────────────────────────────────────────────────────────────

async function listPlaces(viewer: NonNullable<LibraryViewer>, path: string, q: string): Promise<LibraryResult> {
  if (!viewer.canEdit) return { ok: false, status: 403, error: "Not allowed" };
  if (path || q) {
    if (path && !SLUG.test(path)) return { ok: false, status: 404, error: "Not a folder here." };
    const rows = (await db`
      SELECT a.url, a.caption FROM tour_assets a JOIN places p ON p.id = a.place_id AND p.org_id = ${ORG}
      WHERE ${registered()} AND a.kind = 'image' AND a.thread_id IS NULL AND a.stop_id IS NULL
        AND p.is_public AND p.archived_at IS NULL
        ${path ? db`AND p.slug = ${path}` : db``}
        ${q ? db`AND (COALESCE(a.caption, '') ILIKE ${like(q)} OR a.url ILIKE ${like(q)} OR p.title ILIKE ${like(q)})` : db``}
      ORDER BY a.position, a.created_at LIMIT ${LIMIT}
    `) as unknown as PictureRow[];
    return { ok: true, listing: { path: q ? "" : path, items: pictureItems(rows), browsable: true, ...(q ? { search: true } : {}) } };
  }
  const rows = (await db`
    SELECT p.slug, p.title, COUNT(DISTINCT a.url)::int AS n
    FROM places p JOIN tour_assets a ON a.place_id = p.id
    WHERE ${registered()} AND a.kind = 'image' AND a.thread_id IS NULL AND a.stop_id IS NULL
      AND p.org_id = ${ORG} AND p.is_public AND p.archived_at IS NULL
    GROUP BY p.slug, p.title ORDER BY p.title
  `) as unknown as { slug: string; title: string; n: number }[];
  return { ok: true, listing: { path: "", browsable: true, items: rows.map((r) => ({ name: `${r.title} (${r.n})`, path: r.slug, isFolder: true })) } };
}

// ── general ──────────────────────────────────────────────────────────────

/** Files the site draws itself from Street View: registered as stills or live features, not pictures to choose. */
async function streetViewUrls(): Promise<Set<string>> {
  const rows = (await db`SELECT url FROM tour_assets WHERE org_id = ${ORG} AND kind IN ('still', 'streetview') AND url IS NOT NULL`) as unknown as { url: string }[];
  return new Set(rows.map((r) => r.url));
}

async function listGeneral(viewer: NonNullable<LibraryViewer>, path: string, q: string): Promise<LibraryResult> {
  if (!viewer.canEdit) return { ok: false, status: 403, error: "Not allowed" };
  let result;
  try {
    // The root is fixed here; browseMediaFolder refuses `..`, absolute paths, Private/ and dotfiles in `path`.
    result = await browseMediaFolder(`EAC_Network/${ORG}/Media/Images`, path, { q: q || null, limit: LIMIT });
  } catch (err) {
    console.error("[elktours] general library:", err instanceof Error ? err.message : err);
    return { ok: false, status: 502, error: "The file storage could not be reached." };
  }
  if ("error" in result) return { ok: false, status: 404, error: result.error };
  const skip = await streetViewUrls();
  const items = result.items.filter((i) => i.isFolder || (isOfferablePicture(i.url) && !skip.has(i.url!)));
  return { ok: true, listing: { path: result.path, items, browsable: true, ...(result.search ? { search: true } : {}) } };
}

// ── entry ────────────────────────────────────────────────────────────────

/**
 * One listing. `path` is a tour or place slug (tours, places) or a folder inside Media/Images (general); `q` a name
 * search; `tourId` opens the tours library straight into one tour (the creation flow's "This tour").
 */
export async function listLibrary(
  viewer: LibraryViewer,
  key: string,
  opts: { path?: unknown; q?: unknown; tourId?: unknown } = {}
): Promise<LibraryResult> {
  if (!viewer) return { ok: false, status: 401, error: "Sign in first." };
  if (!LIBRARY_KEYS.includes(key as LibraryKey)) return { ok: false, status: 404, error: "No such library." };
  const path = typeof opts.path === "string" ? opts.path.trim().replace(/^\/+|\/+$/g, "") : "";
  const q = typeof opts.q === "string" ? opts.q.trim().slice(0, 80) : "";
  const tourId = typeof opts.tourId === "string" && opts.tourId ? opts.tourId : null;
  if (tourId && !ID.test(tourId)) return { ok: false, status: 404, error: "No such tour." };
  try {
    switch (key as LibraryKey) {
      case "tours":
        return await listTours(viewer, path, q, tourId);
      case "places":
        return await listPlaces(viewer, path, q);
      case "general":
        return await listGeneral(viewer, path, q);
      case "stops":
        // The sorted Stops/ folders, tour then stop, with or without a row. Owners and guides.
        return viewer.canEdit ? await listStopFolders(path, q, (u) => isOfferablePicture(u)) : { ok: false, status: 403, error: "Not allowed" };
    }
  } catch (err) {
    console.error(`[elktours] library ${key}:`, err instanceof Error ? err.message : err);
    return { ok: false, status: 502, error: "Could not load the library." };
  }
}
