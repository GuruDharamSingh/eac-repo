// Server only. The "Stop folders" picture library (ELK-stop-photos, 2026-11-21): the sorted folders under
// EAC_Network/<org>/Stops/ shown as they are filed, tour then stop, so a picture can be chosen whether or not the site
// has a record (tour_assets row) of it.
//
// Which tour a folder belongs to, and which stop a file is of, is the guess the tour stage already makes
// (matchStopFolder in lib/stop-folder-photos.ts): same folder-to-tour rule, same file-name-to-stop rule, same stop list.
// Nothing is written, moved or copied. Choosing a picture returns its /api/media URL, which is all a block or a tour
// picture field keeps, so no row is needed to use it.
//
// A picture that records where it was taken is never offered (the file sits outside Private/, so its URL is public): it
// is listed under "Not offered" with the reason, as the folders menu refuses it too. The check reads the file
// (lib/media-folders hasGps) and is remembered for a few hours.
//
// Paths in a listing are readable names, never file paths: the tour's slug, then the stop's slug, resolved here
// against what storage and the database say. Who may list this is decided by the caller (owners and guides).

import { db } from "@elkdonis/db";
import { listTourStops } from "@elkdonis/commerce/server";
import { browseMediaFolder } from "@elkdonis/services";
import { siteConfig } from "@/config/site";
import { matchStopFolder } from "@/lib/stop-folder-photos";
import { hasGps } from "@/lib/media-folders";
import type { LibraryItem, LibraryResult } from "@/lib/media-libraries";

const ORG = siteConfig.orgId;
const ROOT = `EAC_Network/${ORG}/Stops`;
const OTHER = "other";
const UNSORTED = "unsorted";
const REFUSED = "not-offered";
const LIMIT = 200;
const SEARCH_SCREEN_MAX = 24;
const SCREEN_TTL_MS = 6 * 3600_000;
const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;

interface Pic {
  name: string;
  key: string;
  url: string;
  caption: string | null;
}
interface Group {
  slug: string;
  title: string;
  files: Pic[];
}
interface TourFolder {
  slug: string;
  title: string;
  draft: boolean;
  groups: Group[];
  count: number;
}
interface Everything {
  tours: TourFolder[];
  loose: { folder: string; files: Pic[] }[];
  /** Files whose names a URL cannot carry (# ? % \): never offered. */
  unusable: string[];
}

const slugOf = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "stop";

function pic(folder: string, file: string, caption: string | null, unusable: string[]): Pic | null {
  const key = `${ROOT}/${folder}/${file}`;
  if (/[#?%\\]/.test(key)) {
    unusable.push(`${folder}/${file}`);
    return null;
  }
  return { name: file, key, url: `/api/media/${encodeURI(key)}`, caption };
}

/** Every tour's Stops folder grouped by stop, and the folders no tour claims. Reads storage and the database only. */
async function gather(): Promise<Everything> {
  const threads = (await db`
    SELECT id, slug, title, status FROM threads WHERE org_id = ${ORG} AND kind = 'tour' AND status <> 'archived'
    ORDER BY (status = 'published') DESC, title
  `) as unknown as { id: string; slug: string; title: string; status: string }[];
  // As the stage does: a place's title helps match only when the place is public.
  const placeRows = (await db`
    SELECT id::text AS id, title FROM places WHERE org_id = ${ORG} AND is_public AND archived_at IS NULL
  `) as unknown as { id: string; title: string }[];
  const placeTitle = new Map(placeRows.map((p) => [p.id, p.title]));

  const unusable: string[] = [];
  const matched = new Set<string>();
  const tours: TourFolder[] = [];
  for (const t of threads) {
    const stops = await listTourStops(t.id).catch(() => []);
    const m = await matchStopFolder(
      { slug: t.slug, title: t.title },
      stops.map((s) => ({ id: s.id, title: s.title, placeTitle: s.placeId ? placeTitle.get(s.placeId) ?? null : null }))
    ).catch(() => null);
    if (!m) continue;
    matched.add(m.folder);
    const groups: Group[] = [];
    const used = new Set<string>();
    stops.forEach((s, i) => {
      const files = m.files
        .filter((f) => f.stopId === s.id)
        .map((f) => pic(m.folder, f.file, f.caption, unusable))
        .filter((p): p is Pic => !!p);
      if (files.length) {
        let slug = `${i + 1}-${slugOf(s.title)}`;
        while (used.has(slug)) slug += "-x";
        used.add(slug);
        groups.push({ slug, title: s.title, files });
      }
    });
    const rest = m.files
      .filter((f) => !f.stopId || !stops.some((s) => s.id === f.stopId))
      .map((f) => pic(m.folder, f.file, f.caption, unusable))
      .filter((p): p is Pic => !!p);
    if (rest.length) groups.push({ slug: OTHER, title: "Not on a stop", files: rest });
    const count = groups.reduce((n, g) => n + g.files.length, 0);
    if (count) tours.push({ slug: t.slug, title: t.title, draft: t.status !== "published", groups, count });
  }

  const loose: Everything["loose"] = [];
  const top = await browseMediaFolder(ROOT, "");
  if (!("error" in top)) {
    for (const f of top.items.filter((i) => i.isFolder && !matched.has(i.name))) {
      const inner = await browseMediaFolder(ROOT, f.name);
      if ("error" in inner) continue;
      const files = inner.items
        .filter((i) => !i.isFolder && IMAGE.test(i.name))
        .map((i) => pic(f.name, i.name, null, unusable))
        .filter((p): p is Pic => !!p);
      if (files.length) loose.push({ folder: f.name, files });
    }
  }
  return { tours, loose, unusable };
}

// ── location stamps ──────────────────────────────────────────────────────

type Verdict = "ok" | "location" | "unreadable";
const screened = new Map<string, { at: number; v: Verdict }>();

async function verdictOf(key: string): Promise<Verdict> {
  const hit = screened.get(key);
  if (hit && Date.now() - hit.at < (hit.v === "unreadable" ? 60_000 : SCREEN_TTL_MS)) return hit.v;
  let v: Verdict;
  try {
    v = (await hasGps(key)) ? "location" : "ok";
  } catch {
    v = "unreadable";
  }
  screened.set(key, { at: Date.now(), v });
  return v;
}

/** Split pictures into the ones that may be offered and the ones that may not, with the reason. Four at a time. */
async function screen(files: Pic[]): Promise<{ ok: Pic[]; refused: { pic: Pic; reason: string }[] }> {
  const out = { ok: [] as Pic[], refused: [] as { pic: Pic; reason: string }[] };
  for (let i = 0; i < files.length; i += 4) {
    const batch = files.slice(i, i + 4);
    const verdicts = await Promise.all(batch.map((p) => verdictOf(p.key)));
    batch.forEach((p, j) => {
      const v = verdicts[j]!;
      if (v === "ok") out.ok.push(p);
      else out.refused.push({ pic: p, reason: v === "location" ? "it records where it was taken" : "it could not be read" });
    });
  }
  return out;
}

const like = (s: string, q: string) => s.toLowerCase().includes(q.toLowerCase());
const items = (pics: Pic[]): LibraryItem[] =>
  pics.map((p) => ({ name: p.caption?.trim() || p.name, path: p.url, isFolder: false, url: p.url, thumb: `${p.url}?w=240` }));
const folder = (name: string, path: string): LibraryItem => ({ name, path, isFolder: true });

/**
 * One listing of the Stop folders library. `path`: "" (tours), "<tour slug>" (its stops), "<tour slug>/<stop>" or
 * "<tour slug>/other" (pictures), "unsorted" (folders no tour claims), "unsorted/<folder>" (pictures); "<...>/not-offered"
 * shows what is held back. `offerable` is the caller's check that a URL may be offered (never Private/).
 */
export async function listStopFolders(path: string, q: string, offerable: (url: string) => boolean): Promise<LibraryResult> {
  let all: Everything;
  try {
    all = await gather();
  } catch (err) {
    console.error("[elktours] stop folders library:", err instanceof Error ? err.message : err);
    return { ok: false, status: 502, error: "The file storage could not be reached." };
  }
  const keep = (pics: Pic[]) => pics.filter((p) => offerable(p.url));
  const notFound: LibraryResult = { ok: false, status: 404, error: "Not a folder here." };
  const parts = path ? path.split("/") : [];
  // Every part is only ever compared with names read from storage and the database, never used as a path.
  if (parts.length > 4 || parts.some((p) => !/^[^/\\]{1,120}$/.test(p) || p === "..")) return notFound;
  const reply = (list: LibraryItem[], extra: { search?: boolean } = {}): LibraryResult => ({
    ok: true,
    listing: { path: extra.search ? "" : path, items: list, browsable: true, ...(extra.search ? { search: true } : {}) },
  });

  // A name search over every picture (file name, caption, stop, tour).
  if (q) {
    const hits: Pic[] = [];
    for (const t of all.tours)
      for (const g of t.groups)
        for (const p of keep(g.files)) if (like(p.name, q) || like(p.caption ?? "", q) || like(g.title, q) || like(t.title, q)) hits.push(p);
    for (const l of all.loose) for (const p of keep(l.files)) if (like(p.name, q) || like(l.folder, q)) hits.push(p);
    const seen = new Set<string>();
    const uniq = hits.filter((p) => !seen.has(p.key) && seen.add(p.key)).slice(0, SEARCH_SCREEN_MAX);
    return reply(items((await screen(uniq)).ok), { search: true });
  }

  if (parts.length === 0) {
    const list = all.tours.map((t) => folder(`${t.title}${t.draft ? " (draft)" : ""} (${t.count})`, t.slug));
    const n = all.loose.reduce((a, l) => a + l.files.length, 0);
    if (n) list.push(folder(`Not matched to a tour (${n})`, UNSORTED));
    return reply(list);
  }

  if (parts[0] === UNSORTED) {
    if (parts.length === 1) return reply(all.loose.map((l) => folder(`${l.folder} (${l.files.length})`, `${UNSORTED}/${l.folder}`)));
    const l = all.loose.find((x) => x.folder === parts[1]);
    if (!l) return notFound;
    return pictures(keep(l.files), parts, reply);
  }

  const t = all.tours.find((x) => x.slug === parts[0]);
  if (!t) return notFound;
  if (parts.length === 1) return reply(t.groups.map((g) => folder(`${g.title} (${g.files.length})`, `${t.slug}/${g.slug}`)));
  const g = t.groups.find((x) => x.slug === parts[1]);
  if (!g) return notFound;
  return pictures(keep(g.files), parts, reply);
}

/** The pictures of one stop (or loose folder), minus the ones that may not be offered, which open under "Not offered". */
async function pictures(files: Pic[], parts: string[], reply: (l: LibraryItem[]) => LibraryResult): Promise<LibraryResult> {
  const base = parts.slice(0, 2).join("/");
  if (parts.length > 2 && parts[2] !== REFUSED) return { ok: false, status: 404, error: "Not a folder here." };
  if (parts.length === 4) return reply([]); // a held-back file is only a label
  const { ok, refused } = await screen(files.slice(0, LIMIT));
  if (parts.length === 3) return reply(refused.map((r) => folder(`${r.pic.name}: ${r.reason}`, `${base}/${REFUSED}/${slugOf(r.pic.name)}`)));
  const list = items(ok);
  if (refused.length) list.push(folder(`Not offered (${refused.length}): they record where they were taken`, `${base}/${REFUSED}`));
  return reply(list);
}
