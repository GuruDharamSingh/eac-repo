// ============================================================================
// Attach by copy: put a file into the folder of what it is attached to.
// docs/open/ELKTOURS_MEDIA_STRUCTURE_2026-11-26.md §3 (developer, 2026-11-26).
//
// A pick that crosses an owner, privacy or stability boundary (a person's own
// folder, a Private/ folder, a slot such as a cover) is copied into the
// destination folder, so the destination never depends on the source staying
// put. A copy is a NEW file: its own file id, no version history.
//
//   pictures   read, re-encoded without metadata (EXIF, GPS, XMP, IPTC;
//              orientation applied to the pixels), hashed, written with
//              If-None-Match so nothing is ever replaced.
//   others     WebDAV COPY with Overwrite: F (films can be hundreds of MB;
//              nothing is read into memory). No hash.
//
// A name clash adds -2, -3 … (or, numbered, -01, -02 …). Nothing here is a
// security boundary: the caller has decided the viewer may read the source and
// write the destination (dav.ts header).
// ============================================================================

import { createHash } from 'node:crypto';
import { davCopy, davGetBytes, davPutNew } from './dav';

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;
const HEIC_RE = /\.(heic|heif)$/i;
/** Characters /api/media URLs cannot carry losslessly (elktours mediaUrl refuses them). */
const UNSAFE_NAME = /[#?%\\/\u0000-\u001f]+/g;

export interface CopyIntoFolderOptions {
  /**
   * The new file's name without extension. Default: the source's own name.
   * With `numbered`, "-01", "-02" … is always added (context names such as
   * `pont-neuf-2026-11-26-01`).
   */
  baseName?: string;
  numbered?: boolean;
  /** Re-encode pictures without metadata. Default true. */
  stripMetadata?: boolean;
  /**
   * Reuse a file already in the destination with the same content: given the
   * hash of the prepared picture, return that file's storage key, or null.
   * Only pictures are hashed.
   */
  findByHash?: (sha256: string) => Promise<string | null>;
  /** Up to how many names to try before giving up. Default 50. */
  maxNames?: number;
}

export interface CopyIntoFolderResult {
  /** Storage key of the file in the destination (EAC_Network/…). */
  key: string;
  /** Its platform URL. */
  url: string;
  name: string;
  /** Hex sha256 of what was written (pictures only). */
  sha256: string | null;
  mimeType: string | null;
  bytes: number | null;
  /** True when findByHash returned an existing file and nothing was written. */
  reused: boolean;
  /** Where it came from, for the row's meta.copiedFrom. */
  copiedFrom: string;
}

/** A file name safe for a storage key and an /api/media URL. */
export function safeFileBase(raw: string): string {
  const s = raw.normalize('NFC').replace(UNSAFE_NAME, '-').replace(/\s+/g, ' ').trim().replace(/^[-.]+|[-.]+$/g, '');
  return s.slice(0, 120) || 'file';
}

/** `pont-neuf-2026-11-26`: the base for a context-named upload (§3 naming). */
export function contextFileBase(contextSlug: string, date = new Date()): string {
  const slug = contextSlug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'upload';
  return `${slug}-${date.toISOString().slice(0, 10)}`;
}

function splitName(name: string): { base: string; ext: string } {
  const m = /^(.*?)(\.[a-z0-9]{1,8})?$/i.exec(name);
  return { base: m?.[1] || name, ext: (m?.[2] ?? '').toLowerCase() };
}

function candidates(base: string, ext: string, numbered: boolean, max: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= max; i++) {
    if (numbered) out.push(`${base}-${String(i).padStart(2, '0')}${ext}`);
    else out.push(i === 1 ? `${base}${ext}` : `${base}-${i}${ext}`);
  }
  return out;
}

/** Same spelling as the elktours rows (encodeURI); names written here never hold # ? % or a backslash. */
function urlOf(key: string): string {
  return `/api/media/${encodeURI(key)}`;
}

/** Re-encode a picture without metadata. JPEG stays JPEG; PNG and WebP keep their format; others become JPEG. */
export async function stripPictureMetadata(input: Uint8Array): Promise<{ bytes: Uint8Array; ext: string; mime: string }> {
  const sharp = (await import('sharp')).default;
  const meta = await sharp(input).metadata();
  // .rotate() with no angle applies the EXIF orientation to the pixels; sharp
  // writes no metadata unless asked (withMetadata), so the output carries none.
  const img = sharp(input, { failOn: 'error' }).rotate();
  if (meta.format === 'png') return { bytes: new Uint8Array(await img.png().toBuffer()), ext: '.png', mime: 'image/png' };
  if (meta.format === 'webp') return { bytes: new Uint8Array(await img.webp({ quality: 88 }).toBuffer()), ext: '.webp', mime: 'image/webp' };
  if (meta.format === 'gif') {
    // Animated GIFs keep their frames; sharp drops GIF metadata on output.
    const out = await sharp(input, { animated: true }).gif().toBuffer();
    return { bytes: new Uint8Array(out), ext: '.gif', mime: 'image/gif' };
  }
  return { bytes: new Uint8Array(await img.jpeg({ quality: 88, mozjpeg: true }).toBuffer()), ext: '.jpg', mime: 'image/jpeg' };
}

/**
 * Write `bytes` into `folder` under the first free name. Never replaces a file.
 * Returns the key and name written. The folder must exist (MKCOL makes no parents).
 */
export async function putUniqueFile(
  folder: string,
  base: string,
  ext: string,
  bytes: Uint8Array,
  contentType: string,
  opts: { numbered?: boolean; maxNames?: number } = {}
): Promise<{ key: string; name: string }> {
  for (const name of candidates(safeFileBase(base), ext, opts.numbered ?? false, opts.maxNames ?? 50)) {
    const key = `${folder}/${name}`;
    const r = await davPutNew(key, bytes, contentType);
    if (r === 'written') return { key, name };
    if (r === 'failed') throw new Error('The file storage refused the file.');
  }
  throw new Error('Too many files with that name in the folder.');
}

/**
 * Copy one file into `destFolder` (which must exist). See the header for what
 * happens to pictures and to everything else.
 */
export async function copyIntoFolder(srcKey: string, destFolder: string, opts: CopyIntoFolderOptions = {}): Promise<CopyIntoFolderResult> {
  if (!srcKey || srcKey.includes('..') || srcKey.includes('\\') || srcKey.startsWith('/')) throw new Error('Not a file that can be copied.');
  if (!destFolder || destFolder.includes('..') || destFolder.startsWith('/')) throw new Error('Not a folder that can be written.');
  const srcName = srcKey.split('/').pop() ?? 'file';
  const { base: srcBase, ext: srcExt } = splitName(srcName);
  const base = opts.baseName ?? srcBase;
  const numbered = opts.numbered ?? false;
  const max = opts.maxNames ?? 50;

  if (HEIC_RE.test(srcName)) {
    throw new Error("This photo is in HEIC format, which the site cannot show yet. Export it as JPEG (or set the phone camera to 'Most Compatible') and use that.");
  }

  if (IMAGE_RE.test(srcName)) {
    const raw = await davGetBytes(srcKey);
    if (!raw) throw new Error('Could not read the picture.');
    const prepared = opts.stripMetadata === false
      ? { bytes: raw, ext: srcExt === '.jpeg' ? '.jpg' : srcExt, mime: mimeOfExt(srcExt) }
      : await stripPictureMetadata(raw);
    const sha256 = createHash('sha256').update(prepared.bytes).digest('hex');
    const existing = opts.findByHash ? await opts.findByHash(sha256) : null;
    if (existing) {
      return {
        key: existing,
        url: urlOf(existing),
        name: existing.split('/').pop() ?? existing,
        sha256,
        mimeType: prepared.mime,
        bytes: prepared.bytes.length,
        reused: true,
        copiedFrom: srcKey,
      };
    }
    // Try each free name; on a clash, a file with the same content is the earlier copy of this pick: reuse it.
    for (const name of candidates(safeFileBase(base), prepared.ext, numbered, max)) {
      const key = `${destFolder}/${name}`;
      const r = await davPutNew(key, prepared.bytes, prepared.mime);
      if (r === 'written') {
        return { key, url: urlOf(key), name, sha256, mimeType: prepared.mime, bytes: prepared.bytes.length, reused: false, copiedFrom: srcKey };
      }
      if (r === 'failed') throw new Error('The file storage refused the file.');
      const there = await davGetBytes(key);
      if (there && there.length === prepared.bytes.length && createHash('sha256').update(there).digest('hex') === sha256) {
        return { key, url: urlOf(key), name, sha256, mimeType: prepared.mime, bytes: prepared.bytes.length, reused: true, copiedFrom: srcKey };
      }
    }
    throw new Error('Too many files with that name in the folder.');
  }

  for (const name of candidates(safeFileBase(base), srcExt, numbered, max)) {
    const key = `${destFolder}/${name}`;
    const r = await davCopy(srcKey, key);
    if (r === 'copied') return { key, url: urlOf(key), name, sha256: null, mimeType: mimeOfExt(srcExt), bytes: null, reused: false, copiedFrom: srcKey };
    if (r === 'failed') throw new Error('The file storage refused the copy.');
  }
  throw new Error('Too many files with that name in the folder.');
}

function mimeOfExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.avif':
      return 'image/avif';
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.pdf':
      return 'application/pdf';
    case '.md':
      return 'text/markdown';
    default:
      return 'application/octet-stream';
  }
}
