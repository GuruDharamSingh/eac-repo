import { db } from '@elkdonis/db';
import { listFiles } from './nextcloud';
import { getOrgFolderPath } from '@elkdonis/nextcloud';
import { getStorageSlug, listUserFiles, resolveUserPath } from './user-storage';

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
