// Server only. Pictures from the org's Nextcloud folder EAC_Network/elktours/Stops/<TOUR FOLDER>/ (filled by the owner
// 2026-11-19, one folder per tour, files loose inside) put on the stops they name (developer, 2026-11-20: "match to
// stops by name"). Credits: each file is looked up on Wikimedia Commons by its name and, when found, shows
// "author · licence · Wikimedia Commons"; files not found there are shown without a credit (developer, 2026-11-20:
// "credit those you can, post all regardless"). Read only: nothing is copied, renamed or stored.
//
// Matching. Folder to tour: the part after the first "_" (ILEDELACITE, FOODTOUR, NAPOLEON …) found in the tour's slug
// or title with accents and punctuation removed. File to stop: words of the file name (plus the Commons title and
// categories when the file is there, so "Santa_Capilla" finds Sainte-Chapelle) against the stop's and its place's
// title; a match needs one distinctive word (not "pont", "place", "rue" …). Unmatched files go to the overview.

import { siteConfig } from "@/config/site";
import type { StagePhoto } from "@/components/tours/stage/types";

const ORG = siteConfig.orgId;
const ROOT = `EAC_Network/${ORG}/Stops`;
const LIST_TTL_MS = 10 * 60_000;
const CREDIT_TTL_MS = 24 * 3600_000;
const IMAGE = /\.(jpe?g|png|webp|gif|avif)$/i;
/** Served scaled down by /api/media (THUMBNAIL_WIDTHS tops out at 1024). */
const WIDTH = 1024;

function davUrl(key: string): string {
  const base = (process.env.NEXTCLOUD_URL ?? "").replace(/\/$/, "");
  const user = process.env.NEXTCLOUD_ADMIN_USER ?? "";
  return `${base}/remote.php/dav/files/${encodeURIComponent(user)}/${key.split("/").map(encodeURIComponent).join("/")}`;
}
function davAuth(): string {
  return `Basic ${Buffer.from(`${process.env.NEXTCLOUD_ADMIN_USER ?? ""}:${process.env.NEXTCLOUD_ADMIN_PASSWORD ?? ""}`).toString("base64")}`;
}

interface Entry {
  name: string;
  dir: boolean;
}

const listCache = new Map<string, { at: number; entries: Entry[] }>();

/** One level of a folder (PROPFIND Depth 1), cached for ten minutes; [] when storage is not reachable. */
async function list(key: string): Promise<Entry[]> {
  const hit = listCache.get(key);
  if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.entries;
  if (!process.env.NEXTCLOUD_URL) return [];
  const res = await fetch(davUrl(key), {
    method: "PROPFIND",
    headers: { Authorization: davAuth(), Depth: "1", "Content-Type": "application/xml" },
    body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`storage answered ${res.status}`);
  const xml = await res.text();
  const entries: Entry[] = [];
  for (const block of xml.split(/<d:response>/i).slice(1)) {
    const href = block.match(/<d:href>([^<]+)<\/d:href>/i)?.[1];
    if (!href) continue;
    const segs = href.replace(/\/$/, "").split("/");
    const name = decodeURIComponent(segs[segs.length - 1] ?? "");
    const self = decodeURIComponent(href.replace(/\/$/, "")).endsWith(`/${key}`);
    if (!name || self) continue;
    entries.push({ name, dir: /<d:collection\s*\/>/i.test(block) });
  }
  listCache.set(key, { at: Date.now(), entries });
  return entries;
}

// ── words ────────────────────────────────────────────────────────────────

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const STOP_WORDS = new Set(
  "paris france de la le les des du et the of in at on a an and to copy images image jpg jpeg png webp img dd hdr width height fill crop bgcolor lazyload tt ffffff mv2 panoramio vue view francia paris"
    .split(" ")
);
/** Words that name a kind of place, not which one: a match needs one word that is not among these. */
const GENERIC = new Set(
  "pont rue place square eglise church musee museum cathedrale cathedral jardin jardins garden gardens hotel palais palace tour tower quai porte boulevard avenue saint sainte st ste maison house station metro fontaine fountain".split(" ")
);

function words(s: string): string[] {
  return fold(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * A readable caption from a file name or a Commons title: "Paris,_Conciergerie_--_2014_--_1320.jpg" → "Paris,
 * Conciergerie"; "Santa Capilla, París, Francia, 2022-11-01, DD 80-82 HDR" → "Santa Capilla, París, Francia";
 * "Place_Dauphine_18042017.jpg" → "Place Dauphine"; "Bouquinistes in Paris (22890464511)" → "Bouquinistes in Paris".
 */
export function captionOf(file: string): string {
  return file
    .replace(IMAGE, "")
    .replace(/ copy$/i, "")
    .replace(/_/g, " ")
    .replace(/\s*\(\d+\)/g, "")
    .replace(/\s*--.*$/, "")
    .replace(/[,\s]+\d{4}-\d{2}-\d{2}.*$/, "")
    .replace(/[,\s]+\d{1,2}\s+[A-Z][a-z]+\s+\d{4}.*$/, "")
    .replace(/\s+\d{6,}$/, "")
    .replace(/[\s,;:-]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Wikimedia Commons credits ────────────────────────────────────────────

interface Credit {
  credit: string | null;
  title: string | null;
  /** Extra words for matching: the Commons object name, then (only when nothing else matches) its categories. */
  titleWords: string[];
  categoryWords: string[];
}
const creditCache = new Map<string, { at: number; credit: Credit }>();
const NONE: Credit = { credit: null, title: null, titleWords: [], categoryWords: [] };

const plainText = (html: string | undefined) =>
  (html ?? "").replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, " ").trim();

/** Commons file titles for a set of local names ("Robespierre copy.jpg" is looked up as "Robespierre.jpg"). */
const commonsTitle = (file: string) => `File:${file.replace(/ copy(\.[a-z0-9]+)$/i, "$1").replace(/_/g, " ")}`;

export async function credits(files: string[]): Promise<Map<string, Credit>> {
  const out = new Map<string, Credit>();
  const want: string[] = [];
  for (const f of files) {
    const hit = creditCache.get(f);
    if (hit && Date.now() - hit.at < CREDIT_TTL_MS) out.set(f, hit.credit);
    else want.push(f);
  }
  for (let i = 0; i < want.length; i += 40) {
    const batch = want.slice(i, i + 40);
    const byTitle = new Map(batch.map((f) => [commonsTitle(f), f]));
    try {
      const qs = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        prop: "imageinfo",
        iiprop: "extmetadata",
        iiextmetadatafilter: "Artist|LicenseShortName|ObjectName|Categories",
        titles: [...byTitle.keys()].join("|"),
      });
      // A generic client name: no personal or project contact details go to an outside service.
      const res = await fetch(`https://commons.wikimedia.org/w/api.php?${qs}`, {
        headers: { "User-Agent": "elktours-stage/1.0 (tour page pictures)" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`commons answered ${res.status}`);
      const json = (await res.json()) as {
        query?: {
          normalized?: { from: string; to: string }[];
          pages?: { title: string; missing?: boolean; imageinfo?: { extmetadata?: Record<string, { value?: string }> }[] }[];
        };
      };
      const renamed = new Map((json.query?.normalized ?? []).map((n) => [n.to, n.from]));
      for (const page of json.query?.pages ?? []) {
        const file = byTitle.get(renamed.get(page.title) ?? page.title) ?? byTitle.get(page.title);
        if (!file) continue;
        const meta = page.imageinfo?.[0]?.extmetadata;
        let credit = NONE;
        if (!page.missing && meta) {
          const artist = plainText(meta.Artist?.value).replace(/\s+\./g, ".");
          const licence = plainText(meta.LicenseShortName?.value);
          const name = plainText(meta.ObjectName?.value);
          credit = {
            credit: [artist || null, licence || null, "Wikimedia Commons"].filter(Boolean).join(" · "),
            title: name || null,
            titleWords: words(name),
            categoryWords: words((meta.Categories?.value ?? "").replace(/\|/g, " ")),
          };
        }
        creditCache.set(file, { at: Date.now(), credit });
        out.set(file, credit);
      }
      for (const f of batch) if (!out.has(f)) {
        creditCache.set(f, { at: Date.now(), credit: NONE });
        out.set(f, NONE);
      }
    } catch (err) {
      // Not cached: the next request tries Commons again. The pictures still show, without credits.
      console.error("[elktours] commons credits:", err instanceof Error ? err.message : err);
      for (const f of batch) out.set(f, NONE);
    }
  }
  return out;
}

// ── the tour's pictures ─────────────────────────────────────────────────

export interface FolderStop {
  id: string;
  title: string;
  placeTitle?: string | null;
}

export interface FolderPhotos {
  byStop: Map<string, StagePhoto[]>;
  /** Pictures that name no stop: the overview's. */
  rest: StagePhoto[];
}

const urlOf = (folder: string, file: string) =>
  `/api/media/${[...ROOT.split("/"), folder, file].map(encodeURIComponent).join("/")}?w=${WIDTH}`;
const urlOfKey = (dir: string, file: string) => `/api/media/${[...dir.split("/"), file].map(encodeURIComponent).join("/")}?w=${WIDTH}`;

export interface FolderMatch {
  /** The folder's name under Stops/. */
  folder: string;
  files: { file: string; stopId: string | null; caption: string | null; credit: string | null }[];
}

/** The tour's Stops folder and, per file, the stop it names (null: the overview). Null when no folder is the tour's. */
export async function matchStopFolder(tour: { slug: string; title: string }, stops: FolderStop[]): Promise<FolderMatch | null> {
  const tourKey = fold(`${tour.slug} ${tour.title}`).replace(/[^a-z0-9]/g, "");
  const folders = (await list(ROOT)).filter((e) => e.dir);
  const folder = folders.find((f) => {
    const key = fold(f.name.includes("_") ? f.name.slice(f.name.indexOf("_") + 1) : f.name).replace(/[^a-z0-9]/g, "");
    return key.length >= 4 && tourKey.includes(key);
  });
  if (!folder) return null;
  return { folder: folder.name, files: await matchFiles(`${ROOT}/${folder.name}`, stops) };
}

/** The pictures directly in `dir` and, per file, the stop it names (null: the overview). */
async function matchFiles(dir: string, stops: FolderStop[]): Promise<FolderMatch["files"]> {
  const files = (await list(dir)).filter((e) => !e.dir && IMAGE.test(e.name)).map((e) => e.name).sort();
  const info = files.length ? await credits(files) : new Map<string, Credit>();

  const stopWords = stops.map((s) => {
    const ws = new Set(words(`${s.title} ${s.placeTitle ?? ""}`));
    return { id: s.id, all: ws, distinct: [...ws].filter((w) => !GENERIC.has(w)) };
  });
  const match = (fw: Set<string>) => {
    let best: { id: string; score: number } | null = null;
    for (const s of stopWords) {
      if (!s.distinct.some((w) => fw.has(w))) continue;
      const score = [...s.all].filter((w) => fw.has(w)).length;
      if (!best || score > best.score) best = { id: s.id, score };
    }
    return best;
  };
  return files.map((file) => {
    const c = info.get(file) ?? NONE;
    const best = match(new Set([...words(file), ...c.titleWords])) ?? match(new Set(c.categoryWords));
    const caption = captionOf(c.title ?? file);
    return { file, stopId: best?.id ?? null, caption: caption || null, credit: c.credit };
  });
}

/**
 * The tour's stop pictures, matched to its stops. Read from the tour's own folder, `<mediaFolder>/Stops/`, once it
 * holds pictures (the owner's Stops/<FOLDER>/ moves there: docs/open/ELKTOURS_MEDIA_STRUCTURE_2026-11-26.md §4), and
 * from the old Stops/<FOLDER>/ until then. Empty when neither has pictures or storage is down.
 */
export async function stopFolderPhotos(tour: { slug: string; title: string; mediaFolder?: string | null }, stops: FolderStop[]): Promise<FolderPhotos> {
  const out: FolderPhotos = { byStop: new Map(), rest: [] };
  if (tour.mediaFolder) {
    const dir = `${tour.mediaFolder}/Stops`;
    const files = await matchFiles(dir, stops).catch(() => []);
    if (files.length) {
      for (const f of files) {
        const photo: StagePhoto = { url: urlOfKey(dir, f.file), caption: f.caption, alt: f.caption, credit: f.credit };
        if (f.stopId) (out.byStop.get(f.stopId) ?? out.byStop.set(f.stopId, []).get(f.stopId)!).push(photo);
        else out.rest.push(photo);
      }
      return out;
    }
  }
  const m = await matchStopFolder(tour, stops);
  if (!m) return out;
  for (const f of m.files) {
    const photo: StagePhoto = { url: urlOf(m.folder, f.file), caption: f.caption, alt: f.caption, credit: f.credit };
    if (f.stopId) (out.byStop.get(f.stopId) ?? out.byStop.set(f.stopId, []).get(f.stopId)!).push(photo);
    else out.rest.push(photo);
  }
  return out;
}
