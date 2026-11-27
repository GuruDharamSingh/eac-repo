// ============================================================================
// One folder of a media source, for the one picker (cms-ui MediaLibrary).
// docs/open/ELKTOURS_MEDIA_STRUCTURE_2026-11-26.md §5.
//
// browseMediaFolder (media-library.ts) lists pictures only and drops type,
// size and date. This lists every family the caller accepts, keeps them, and
// answers in the listing contract MediaLibrary and MediaBrowser read:
//
//   { path, browsable: true, search?, items: [{ name, path, isFolder, url?,
//     thumb?, mimeType?, size?, lastModified?, family }] }
//
// The ROOT is the authorization boundary and never comes from a request; the
// caller has decided the viewer may see it. `path` does come from a request and
// is checked: no `..`, no absolute path, no backslash, nothing outside the root.
// Dotfiles are never listed. Private/ folders are hidden unless the caller
// passes showPrivate (and has decided the viewer may see them).
// ============================================================================

import { davList, davListDeep, type DavEntry } from './dav';

export type MediaFamily = 'image' | 'video' | 'audio' | 'document' | 'other';

export interface MediaSourceItem {
  name: string;
  /** Relative to the root; pass back as `path` to open a folder. */
  path: string;
  isFolder: boolean;
  /** Platform URL (files only). */
  url?: string;
  /** What to draw a thumbnail from (pictures only). */
  thumb?: string;
  mimeType?: string | null;
  size?: number;
  lastModified?: string | null;
  family?: MediaFamily;
}

export interface MediaSourceListing {
  path: string;
  browsable: true;
  search?: boolean;
  items: MediaSourceItem[];
}

export interface ListMediaSourceOptions {
  /** Name search across everything under the root. */
  q?: string | null;
  /** Families to list. Default every family. Folders are always listed. */
  accept?: MediaFamily[];
  /** Show folders named Private (and allow `path` inside them). Default false. */
  showPrivate?: boolean;
  /** Cap on items returned. Default 300. */
  limit?: number;
}

const EXT: Record<string, MediaFamily> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', avif: 'image',
  mp4: 'video', m4v: 'video', mov: 'video', webm: 'video',
  mp3: 'audio', m4a: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', aac: 'audio',
  pdf: 'document', doc: 'document', docx: 'document', odt: 'document', rtf: 'document', txt: 'document', md: 'document',
  xls: 'document', xlsx: 'document', ods: 'document', csv: 'document', ppt: 'document', pptx: 'document', odp: 'document',
};

/** The family of a file, from its extension, then its MIME type. */
export function mediaFamilyOf(name: string, mime?: string | null): MediaFamily {
  const ext = /\.([a-z0-9]{1,8})$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  if (EXT[ext]) return EXT[ext];
  if (mime?.startsWith('image/') && !/svg|heic|heif|tiff/.test(mime)) return 'image';
  if (mime?.startsWith('video/')) return 'video';
  if (mime?.startsWith('audio/')) return 'audio';
  return 'other';
}

const PRIVATE_SEG = /(^|\/)private(\/|$)/i;

/** A caller-supplied relative path, or null when it tries to leave the root (or enter Private/ without leave). */
export function cleanSourcePath(raw: unknown, showPrivate = false): string | null {
  const s = typeof raw === 'string' ? raw.trim().replace(/^\/+|\/+$/g, '') : '';
  if (!s) return '';
  const parts = s.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || p.startsWith('.') || p.includes('\\') || p.includes('\0'))) return null;
  if (!showPrivate && PRIVATE_SEG.test(s)) return null;
  return s;
}

function toItem(e: DavEntry, rel: string): MediaSourceItem {
  if (e.isFolder) return { name: e.name, path: rel, isFolder: true, lastModified: e.lastModified, family: undefined };
  const family = mediaFamilyOf(e.name, e.mimeType);
  return {
    name: e.name,
    path: rel,
    isFolder: false,
    url: e.url,
    ...(family === 'image' ? { thumb: e.url } : {}),
    mimeType: e.mimeType,
    size: e.size,
    lastModified: e.lastModified,
    family,
  };
}

/** One level of `root/path`, or a name search under `root`. `{ error }` for a path that is not allowed. */
export async function listMediaSource(
  root: string,
  rawPath: unknown,
  options: ListMediaSourceOptions = {}
): Promise<MediaSourceListing | { error: string }> {
  const showPrivate = options.showPrivate ?? false;
  const path = cleanSourcePath(rawPath, showPrivate);
  if (path === null) return { error: 'Not a folder here.' };
  const accept = options.accept && options.accept.length ? new Set(options.accept) : null;
  const limit = options.limit ?? 300;
  const wanted = (it: MediaSourceItem) => it.isFolder || !accept || accept.has(it.family ?? 'other');
  const q = options.q?.trim().toLowerCase().slice(0, 80);

  if (q) {
    const all = await davListDeep(root, 5000);
    const items: MediaSourceItem[] = [];
    for (const f of all) {
      const rel = f.path.slice(root.length + 1);
      if (!rel || rel.split('/').some((p) => p.startsWith('.'))) continue;
      if (!showPrivate && PRIVATE_SEG.test(rel)) continue;
      if (!f.name.toLowerCase().includes(q)) continue;
      const it = toItem(f, rel);
      if (!wanted(it)) continue;
      items.push(it);
      if (items.length >= limit) break;
    }
    return { path: '', browsable: true, search: true, items };
  }

  const entries = await davList(path ? `${root}/${path}` : root);
  const items: MediaSourceItem[] = [];
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    if (e.isFolder && !showPrivate && /^private$/i.test(e.name)) continue;
    const it = toItem(e, path ? `${path}/${e.name}` : e.name);
    if (wanted(it)) items.push(it);
  }
  items.sort((a, b) => (a.isFolder === b.isFolder ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.isFolder ? -1 : 1));
  return { path, browsable: true, items: items.slice(0, limit) };
}
