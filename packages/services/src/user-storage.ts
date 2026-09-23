/**
 * Per-person cloud storage, surfaced through the platform.
 *
 * Every principal gets EAC_Network/users/<slug>/ the moment they exist —
 * created by the service account, independent of whether they will ever have
 * a Nextcloud login. 35 people have a folder; 9 have a Nextcloud account. The
 * other 26 reach their files only through the platform, which is the point:
 * Nextcloud is the storage backend, not the product.
 *
 * Every function here is scoped to ONE person's folder and refuses to leave
 * it. The service account can read the whole tree, so the containment check
 * is not decoration — it is the only thing standing between a crafted
 * `path` parameter and someone else's files. `resolveUserPath` is therefore
 * the single place a caller-supplied path is turned into a real one, and it
 * throws rather than clamping, so a bug surfaces instead of silently reading
 * the wrong folder.
 *
 * Reads elsewhere go through canReadMedia (media-authz.ts); this module is
 * the write/manage side and always acts as the owner.
 */

import { db } from '@elkdonis/db';
import {
  davConfigured,
  davDelete,
  davList,
  davMkcol,
  davPut,
  resolveWithin,
  type DavEntry,
} from './dav';

const ROOT = process.env.NEXTCLOUD_ORG_ROOT_FOLDER || 'EAC_Network';

/** Subfolders a person's tree is organised into, mirroring the org folders. */
export const USER_MEDIA_FOLDERS = ['Images', 'Audio', 'Videos', 'Documents'] as const;
export type UserMediaFolder = (typeof USER_MEDIA_FOLDERS)[number];

/** Kept as a name for callers; identical to the shared DAV entry shape. */
export type UserFile = DavEntry;

/** The root of one person's storage. */
export function userStorageRoot(slug: string): string {
  if (!slug || slug.includes('/') || slug.includes('..')) {
    throw new Error(`userStorageRoot: invalid slug ${JSON.stringify(slug)}`);
  }
  return `${ROOT}/users/${slug}`;
}

/**
 * Turn a caller-supplied relative path into a real one, or throw.
 *
 * Throws rather than clamping: a path that tries to escape is a bug or an
 * attack, and silently serving the folder root would hide both.
 */
export function resolveUserPath(slug: string, relative = ''): string {
  return resolveWithin(userStorageRoot(slug), relative);
}

/** Look up a person's storage slug from their platform user id. */
export async function getStorageSlug(userId: string): Promise<string | null> {
  try {
    const rows = await db<Array<{ slug: string | null }>>`
      SELECT slug FROM users WHERE id = ${userId} OR auth_user_id = ${userId} LIMIT 1
    `;
    return rows[0]?.slug ?? null;
  } catch (err) {
    console.error('[user-storage] getStorageSlug:', err);
    return null;
  }
}

/** List one level of a person's storage. */
export async function listUserFiles(slug: string, relative = ''): Promise<UserFile[]> {
  return davList(resolveUserPath(slug, relative));
}

/**
 * Store a file in a person's own folder.
 *
 * `folder` is constrained to the known media buckets rather than free-form,
 * so a caller cannot invent a tree shape the rest of the platform will not
 * recognise. Returns the platform URL, never a Nextcloud one.
 */
export interface UploadResult {
  ok: boolean;
  path?: string;
  url?: string;
  error?: string;
}

/**
 * Deliberately one shape with optional fields rather than a discriminated
 * union: this repo compiles with `strict: false`, and without strictNullChecks
 * TypeScript will not narrow `{ok:true,...} | {ok:false,...}` at all, so a
 * union would force every caller into casts.
 */
export async function uploadUserFile(
  slug: string,
  folder: UserMediaFolder,
  filename: string,
  body: Buffer | Uint8Array,
  mimeType?: string
): Promise<UploadResult> {
  if (!davConfigured()) return { ok: false, error: 'Storage is not configured' };
  if (!USER_MEDIA_FOLDERS.includes(folder)) {
    return { ok: false, error: `Unknown folder ${folder}` };
  }

  const safeName = filename.replace(/[^a-zA-Z0-9.\-_ ]/g, '_').replace(/^\.+/, '');
  if (!safeName) return { ok: false, error: 'Invalid filename' };
  // Timestamp prefix: content at a path is then immutable in practice, which
  // is what lets the media routes serve it with a long cache lifetime.
  const stamped = `${Date.now()}-${safeName}`;

  let path: string;
  try {
    path = resolveUserPath(slug, `Media/${folder}/${stamped}`);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  if (!(await davPut(path, body as Uint8Array, mimeType || 'application/octet-stream'))) {
    return { ok: false, error: 'Upload failed' };
  }
  return { ok: true, path, url: `/api/media/${path}` };
}

/**
 * Create a folder inside a person's storage, and every missing folder above
 * it — MKCOL is not recursive. Idempotent: an existing folder is success.
 * The twin of createOrgFolder in org-storage.ts.
 */
export async function createUserFolder(slug: string, relative: string): Promise<boolean> {
  const parts = relative.split('/').filter(Boolean);
  if (parts.length === 0) return false; // refuse to "create" the root
  let ok = true;
  for (let i = 1; i <= parts.length; i++) {
    ok = await davMkcol(resolveUserPath(slug, parts.slice(0, i).join('/')));
    if (!ok) return false;
  }
  return ok;
}

/** Delete something inside a person's own folder. Never the root itself. */
export async function deleteUserFile(
  slug: string,
  relative: string
): Promise<{ ok: boolean; error?: string }> {
  if (!relative || !relative.replace(/\/+$/, '')) {
    return { ok: false, error: 'Refusing to delete the storage root' };
  }
  let path: string;
  try {
    path = resolveUserPath(slug, relative);
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  if (path === userStorageRoot(slug)) {
    return { ok: false, error: 'Refusing to delete the storage root' };
  }
  if (!(await davDelete(path))) return { ok: false, error: 'Delete failed' };
  return { ok: true };
}

/**
 * Bytes stored by one person.
 *
 * Team folder quota is folder-wide — Nextcloud cannot cap an individual
 * users/<slug> subtree — so any per-person limit has to be enforced here.
 */
export async function getUserStorageUsage(slug: string): Promise<number> {
  const walk = async (rel: string): Promise<number> => {
    const entries = await listUserFiles(slug, rel);
    let total = 0;
    for (const e of entries) {
      total += e.isFolder
        ? await walk(rel ? `${rel}/${e.name}` : e.name)
        : e.size;
    }
    return total;
  };
  try {
    return await walk('');
  } catch (err) {
    console.error('[user-storage] getUserStorageUsage:', err);
    return 0;
  }
}
