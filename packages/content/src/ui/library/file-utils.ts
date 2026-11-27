// What a file is, and how a folder listing is read. Lifted from MediaLibrary (2026-11-26) so the
// folder browser, the remote file items and the MediaLibrary wrapper share one copy.

import { familyOf, type FileFamily } from "@elkdonis/cms-ui/file-types";

/** One entry of a folder listing, as the library reads it. */
export interface FolderItem {
  name: string;
  path: string;
  isFolder: boolean;
  url?: string;
  thumb?: string;
  mimeType?: string | null;
  size?: number;
  lastModified?: string | null;
  shortcut?: { source: string; path: string };
}

export interface Listing {
  items: FolderItem[];
  /** Folders can be opened. */
  navigable: boolean;
  /** Items carry their own `path` (true), or folders are opened by name (FileBrowser shape). */
  ownPaths: boolean;
  /** The endpoint takes `q` across its tree. */
  searchable: boolean;
  search: boolean;
}

export type KindFilter = "all" | "image" | "video" | "audio" | "document" | "other";

export const KIND_WORD: Record<Exclude<KindFilter, "all">, string> = {
  image: "Pictures",
  video: "Films",
  audio: "Sound",
  document: "Documents",
  other: "Other",
};

export const EMPTY_LISTING: Listing = { items: [], navigable: false, ownPaths: false, searchable: false, search: false };

// ── storage, each access guarded (private windows, blocked storage) ─────────

export function readStore(ns: string, key: string): string | null {
  try {
    return sessionStorage.getItem(`${ns}:${key}`);
  } catch {
    return null;
  }
}
export function writeStore(ns: string, key: string, value: string) {
  try {
    sessionStorage.setItem(`${ns}:${key}`, value);
  } catch {
    /* the library still works; it just won't remember */
  }
}

// ── what a file is ─────────────────────────────────────────────────────────

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg",
  pdf: "application/pdf",
};
export const extOf = (name: string) => /\.([a-z0-9]{1,8})$/i.exec(name)?.[1]?.toLowerCase() ?? "";

export function guessMime(item: { name: string; mimeType?: string | null }): string {
  return item.mimeType || EXT_MIME[extOf(item.name)] || "";
}

/** Does an <input accept> list take this file? */
export function acceptsFile(accept: string, item: { name: string; mimeType?: string | null }): boolean {
  const list = accept.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (list.length === 0 || list.includes("*") || list.includes("*/*")) return true;
  const mime = guessMime(item).toLowerCase();
  const ext = `.${extOf(item.name)}`;
  return list.some((a) => (a.endsWith("/*") ? mime.startsWith(a.slice(0, -1)) : a.startsWith(".") ? a === ext : a === mime));
}

/** The kind filter a file falls under. */
export function kindOf(item: { name: string; mimeType?: string | null }): Exclude<KindFilter, "all"> {
  const fam: FileFamily = familyOf(item);
  if (fam === "image" && !/^(svg|heic|tif|tiff)$/.test(extOf(item.name))) return "image";
  if (fam === "video") return "video";
  if (fam === "audio") return "audio";
  if (fam === "pdf" || fam === "doc" || fam === "sheet" || fam === "slides" || fam === "text") return "document";
  return "other";
}

export function withQuery(endpoint: string, params: Record<string, string>) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== ""));
  const s = q.toString();
  return s ? `${endpoint}${endpoint.includes("?") ? "&" : "?"}${s}` : endpoint;
}

export function parseListing(body: Record<string, unknown>): Listing {
  const browsable = Boolean(body.browsable);
  const fileShape = Array.isArray(body.files) && !Array.isArray(body.items);
  const raw = (Array.isArray(body.items) ? body.items : Array.isArray(body.files) ? body.files : []) as Array<Record<string, unknown>>;
  const navigable = browsable || fileShape;
  const items: FolderItem[] = [];
  for (const r of raw) {
    const isFolder = Boolean(r.isFolder);
    const url = typeof r.url === "string" ? r.url : undefined;
    const sc = r.shortcut as { source?: unknown; path?: unknown } | undefined;
    const shortcut = sc && typeof sc.source === "string" && typeof sc.path === "string" ? { source: sc.source, path: sc.path } : undefined;
    if (!isFolder && !url) continue;
    // An old flat endpoint has no way into a folder: don't offer one.
    if (isFolder && !navigable && !shortcut) continue;
    items.push({
      name: String(r.name ?? r.filename ?? url ?? ""),
      path: String(r.path ?? url ?? r.name ?? ""),
      isFolder,
      url,
      thumb: typeof r.thumb === "string" ? r.thumb : undefined,
      mimeType: typeof r.mimeType === "string" ? r.mimeType : null,
      size: typeof r.size === "number" ? r.size : undefined,
      lastModified: typeof r.lastModified === "string" ? r.lastModified : null,
      shortcut,
    });
  }
  // A browsable endpoint's order is kept: it may put a tour's stops first, in
  // tour order. The older shapes are sorted here, folders first.
  if (!browsable) items.sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { items, navigable, ownPaths: browsable, searchable: browsable, search: Boolean(body.search) };
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export const noun = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
