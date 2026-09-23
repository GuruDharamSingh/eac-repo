import { db } from '@elkdonis/db';
import { listFiles } from './nextcloud';
import { getOrgFolderPath } from '@elkdonis/nextcloud';
import { getStorageSlug, listUserFiles, resolveUserPath } from './user-storage';
import { davList, davListDeep } from './dav';

// ============================================================================
// An org's media library — what is already in its storage, for a picker.
//
// Two sources, merged:
//   - the `media` table, which the upload routes write and which carries the
//     original filename, type and size; and
//   - a live listing of the Nextcloud folder, so files dropped straight into
//     Nextcloud (outside any app) still appear.
//
// Nextcloud is the source of truth for what exists; the database adds the
// metadata. If Nextcloud is unreachable the database listing alone is still
// returned rather than failing the picker — an author with a slow storage
// backend should still see what they uploaded through the app.
//
// This is a plain function, not a route factory, deliberately. Every app gates
// its library differently (`getApiEditor` here, a role check there), and the
// authorization is the part that must NOT be shared and silently made uniform.
// The logic is what was duplicated — 79 lines in amrit-canada and 57 in
// hidden-enneagram, differing only in the org id.
// ============================================================================

export interface MediaLibraryItem {
  url: string;
  filename: string;
  type: string;
  source: 'upload' | 'nextcloud';
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

export interface ListOrgMediaLibraryOptions {
  /** Cap on the database half. Nextcloud's listing is bounded by the folder. */
  limit?: number;
  /**
   * Media type to return. 'image' is the picker case; pass null for
   * everything the `media` table holds.
   */
  type?: string | null;
}

export async function listOrgMediaLibrary(
  orgId: string,
  options: ListOrgMediaLibraryOptions = {}
): Promise<MediaLibraryItem[]> {
  const { limit = 200, type = 'image' } = options;
  const items = new Map<string, MediaLibraryItem>();

  try {
    const rows = type
      ? await db<{ url: string; filename: string; type: string }[]>`
          SELECT url, filename, type FROM media
          WHERE org_id = ${orgId} AND type = ${type}
          ORDER BY created_at DESC LIMIT ${limit}
        `
      : await db<{ url: string; filename: string; type: string }[]>`
          SELECT url, filename, type FROM media
          WHERE org_id = ${orgId}
          ORDER BY created_at DESC LIMIT ${limit}
        `;

    for (const row of rows) {
      if (!row.url) continue;
      items.set(row.url, {
        url: row.url,
        filename: row.filename,
        type: row.type,
        source: 'upload',
      });
    }
  } catch (err) {
    console.error(`[media-library] db listing for ${orgId}:`, err);
  }

  try {
    // Resolved through the shared helper rather than a hardcoded
    // `EAC_Network/${orgId}` literal — that literal appears 127 times across
    // the repo and is exactly why orgs whose folder path differs (a hyphen
    // typo, a legacy lowercase root) have media that no proxy can serve.
    const folder = `${getOrgFolderPath(orgId)}/Media/Images`;
    const files = await listFiles(folder);

    for (const file of files) {
      const name: string | undefined =
        typeof file === 'string'
          ? file
          : (file?.name ?? file?.basename ?? file?.filename);
      if (!name || !IMAGE_EXT.test(name)) continue;

      const url = `/api/media/${folder}/${name}`;
      if (!items.has(url)) {
        items.set(url, { url, filename: name, type: 'image', source: 'nextcloud' });
      }
    }
  } catch (err) {
    // Degrade to the database listing rather than breaking the picker.
    console.error(`[media-library] nextcloud listing for ${orgId}:`, err);
  }

  return [...items.values()];
}

// ============================================================================
// A PERSON's media library.
//
// Same two sources as the org listing above, pointed at the person's own
// storage instead: their rows in the `media` table, merged with a live listing
// of EAC_Network/users/<slug>/Media/Images.
//
// Kept beside the org version rather than generalised into one function with a
// mode flag, because the two differ in the thing that matters most — WHOSE
// files they are. A single function taking "scope" is one wrong argument away
// from showing one person's private uploads to another, and that is not a
// mistake worth making reachable.
//
// Authorization is again NOT here: a caller passes a user id, and the route is
// responsible for proving that id is the person asking. See the header of
// listOrgMediaLibrary for why.
// ============================================================================

export interface ListUserMediaLibraryOptions extends ListOrgMediaLibraryOptions {
  /** Which of the person's media buckets to list. */
  folder?: 'Images' | 'Audio' | 'Videos' | 'Documents';
}

export async function listUserMediaLibrary(
  userId: string,
  options: ListUserMediaLibraryOptions = {}
): Promise<MediaLibraryItem[]> {
  const { limit = 200, type = 'image', folder = 'Images' } = options;
  const items = new Map<string, MediaLibraryItem>();

  try {
    // `uploaded_by` rather than org_id: this is the person's own work, wherever
    // they happened to publish it.
    const rows = type
      ? await db<{ url: string; filename: string; type: string }[]>`
          SELECT url, filename, type FROM media
          WHERE uploaded_by = ${userId} AND type = ${type}
          ORDER BY created_at DESC LIMIT ${limit}
        `
      : await db<{ url: string; filename: string; type: string }[]>`
          SELECT url, filename, type FROM media
          WHERE uploaded_by = ${userId}
          ORDER BY created_at DESC LIMIT ${limit}
        `;

    for (const row of rows) {
      if (!row.url) continue;
      items.set(row.url, {
        url: row.url,
        filename: row.filename,
        type: row.type,
        source: 'upload',
      });
    }
  } catch (err) {
    console.error(`[media-library] db listing for user ${userId}:`, err);
  }

  try {
    const slug = await getStorageSlug(userId);
    // No slug means no personal folder has been provisioned yet — an empty
    // library, not an error. The database half above may still have rows.
    if (slug) {
      const relative = `Media/${folder}`;
      const files = await listUserFiles(slug, relative);
      // The same path the proxy serves, built by the same helper that guards
      // against a relative path escaping the person's own root.
      const base = resolveUserPath(slug, relative);

      for (const file of files) {
        const name: string | undefined =
          typeof file === 'string'
            ? file
            : ((file as { name?: string; basename?: string; filename?: string })?.name ??
              (file as { basename?: string })?.basename ??
              (file as { filename?: string })?.filename);
        if (!name || (type === 'image' && !IMAGE_EXT.test(name))) continue;

        const url = `/api/media/${base}/${name}`;
        if (!items.has(url)) {
          items.set(url, { url, filename: name, type: type ?? 'image', source: 'nextcloud' });
        }
      }
    }
  } catch (err) {
    console.error(`[media-library] nextcloud listing for user ${userId}:`, err);
  }

  return [...items.values()];
}

// ============================================================================
// BROWSING a storage folder — folders and pictures, one level at a time.
//
// The listings above are FLAT: the files directly in Media/Images and nothing
// below it. A person whose work is filed in folders (Dana's old site: one
// folder per page, ~700 pictures, four levels down) saw one picture and no way
// in. This walks a tree instead: a caller names a ROOT it has already decided
// the viewer may see, and a path relative to it.
//
// The root is the authorization boundary and is never taken from a request.
// `path` is, so it is checked: no `..`, no absolute path, no escaping the root.
// Private/ folders and dotfiles are never shown.
// ============================================================================

export interface BrowseItem {
  name: string;
  /** Relative to the root — pass back as `path` to open a folder. */
  path: string;
  isFolder: boolean;
  /** Platform URL of a picture (absent for a folder). */
  url?: string;
  /** A small version of the picture for a thumbnail. */
  thumb?: string;
}

export interface BrowseResult {
  /** The folder listed, relative to the root ('' = the root itself). */
  path: string;
  items: BrowseItem[];
  /** True when the listing was a search across the whole root. */
  search?: boolean;
}

const HIDDEN = /(^|\/)(Private|\.[^/]*)(\/|$)/;

/** A caller-supplied relative path, or null if it tries to leave the root. */
export function cleanBrowsePath(raw: unknown): string | null {
  const s = typeof raw === 'string' ? raw.trim().replace(/^\/+|\/+$/g, '') : '';
  if (!s) return '';
  const parts = s.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || p.includes('\\'))) return null;
  if (HIDDEN.test(s)) return null;
  return s;
}

function thumbOf(url: string) {
  return `${url}?w=240`;
}

export async function browseMediaFolder(
  root: string,
  rawPath: unknown,
  options: { q?: string | null; limit?: number } = {}
): Promise<BrowseResult | { error: string }> {
  const path = cleanBrowsePath(rawPath);
  if (path === null) return { error: 'Not a folder here.' };
  const q = options.q?.trim().toLowerCase();

  if (q) {
    // A name search across everything under the root — the only way to find
    // one picture among hundreds without knowing its folder.
    const all = await davListDeep(root);
    const hits = all
      .filter((f) => IMAGE_EXT.test(f.name) && f.name.toLowerCase().includes(q))
      .map((f) => ({ ...f, rel: f.path.slice(root.length + 1) }))
      .filter((f) => !HIDDEN.test(f.rel))
      .slice(0, options.limit ?? 200);
    return {
      path: '',
      search: true,
      items: hits.map((f) => ({ name: f.name, path: f.rel, isFolder: false, url: f.url, thumb: thumbOf(f.url) })),
    };
  }

  const entries = await davList(path ? `${root}/${path}` : root);
  const items: BrowseItem[] = [];
  for (const e of entries) {
    if (e.name.startsWith('.') || (e.isFolder && e.name === 'Private')) continue;
    const rel = path ? `${path}/${e.name}` : e.name;
    if (e.isFolder) items.push({ name: e.name, path: rel, isFolder: true });
    else if (IMAGE_EXT.test(e.name)) items.push({ name: e.name, path: rel, isFolder: false, url: e.url, thumb: thumbOf(e.url) });
  }
  items.sort((a, b) =>
    a.isFolder === b.isFolder ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.isFolder ? -1 : 1
  );
  return { path, items };
}
