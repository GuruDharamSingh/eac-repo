import { db } from '@elkdonis/db';
import { listFiles } from './nextcloud';
import { getOrgFolderPath } from '@elkdonis/nextcloud';

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
