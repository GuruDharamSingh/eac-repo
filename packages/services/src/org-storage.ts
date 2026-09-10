/**
 * An org's shared cloud storage, surfaced through the platform.
 *
 * The org-scoped twin of user-storage.ts, which had no counterpart: every
 * file browser that wanted an org folder — admin's, inner-gathering's, the two
 * in packages/ui — reimplemented listing from scratch, in Mantine, against a
 * different response shape each time.
 *
 * NOT a security boundary. Everything goes out over the service account, which
 * can read every org's tree, so the caller must establish org membership
 * first (see apps/ifac/src/lib/hub-auth.ts for the pattern). What this file
 * does guarantee is that a path cannot escape the org's own root.
 *
 * The root is DERIVED from the org id, never read from
 * `organizations.nextcloud_folder_path`. That column is empty for several orgs
 * whose folders demonstrably exist (they were seeded by migrations predating
 * it, and only the admin app's setup-folders route ever backfills it), so
 * reading it would make correctness depend on which route an org went through.
 */

import { db } from '@elkdonis/db';
import { nanoid } from 'nanoid';
import {
  davDelete,
  davList,
  davMkcol,
  davPut,
  resolveWithin,
  type DavEntry,
} from './dav';

const ROOT = process.env.NEXTCLOUD_ORG_ROOT_FOLDER || 'EAC_Network';

/** Subfolders an org's tree is organised into. */
export const ORG_MEDIA_FOLDERS = ['Images', 'Audio', 'Videos', 'Documents'] as const;
export type OrgMediaFolder = (typeof ORG_MEDIA_FOLDERS)[number];

export type OrgFile = DavEntry;

/** The root of one org's shared storage. */
export function orgStorageRoot(orgId: string): string {
  if (!orgId || orgId.includes('/') || orgId.includes('..')) {
    throw new Error(`orgStorageRoot: invalid orgId ${JSON.stringify(orgId)}`);
  }
  return `${ROOT}/${orgId}`;
}

/** Resolve a caller-supplied relative path inside the org root, or throw. */
export function resolveOrgPath(orgId: string, relative = ''): string {
  return resolveWithin(orgStorageRoot(orgId), relative);
}

/** List one level of an org's shared storage. */
export async function listOrgFiles(orgId: string, relative = ''): Promise<OrgFile[]> {
  return davList(resolveOrgPath(orgId, relative));
}

export async function createOrgFolder(orgId: string, relative: string): Promise<boolean> {
  const path = resolveOrgPath(orgId, relative);
  if (path === orgStorageRoot(orgId)) return false; // refuse to "create" the root
  return davMkcol(path);
}

export interface OrgUploadResult {
  path: string;
  url: string;
  name: string;
  size: number;
}

/**
 * Upload into the org's shared storage and record it in `media`.
 *
 * The filename is timestamped the way every other upload path in the repo
 * does it, so two members uploading `scan.pdf` on the same day don't overwrite
 * each other.
 */
export async function uploadOrgFile(
  orgId: string,
  relativeFolder: string,
  filename: string,
  data: Uint8Array,
  mimeType: string,
  uploaderId: string
): Promise<OrgUploadResult | null> {
  const safeName = filename.replace(/[/\\:*?"<>|\0]/g, '_').slice(0, 180);
  const stamped = `${Date.now()}-${safeName}`;
  const folder = resolveOrgPath(orgId, relativeFolder);
  const path = `${folder}/${stamped}`;

  // The folder may not exist yet (a fresh org, or a subfolder a member typed).
  await davMkcol(folder);
  if (!(await davPut(path, data, mimeType))) return null;

  const url = `/api/media/${path}`;
  try {
    // `nextcloud_file_id` is NOT NULL but we don't PROPFIND for the real id
    // here — the proxy addresses files by path, not by id, so an empty string
    // costs nothing and a second round trip would.
    await db`
      INSERT INTO media (
        id, org_id, uploaded_by, nextcloud_file_id, url, type,
        filename, size_bytes, mime_type, nextcloud_path
      ) VALUES (
        ${nanoid()}, ${orgId}, ${uploaderId}, '', ${url}, ${mediaType(mimeType)},
        ${stamped}, ${data.byteLength}, ${mimeType}, ${path}
      )
    `;
  } catch (error) {
    // The file is uploaded and readable through the proxy either way; a
    // missing index row must not read to the member as a failed upload.
    console.error('[org-storage] media row insert failed:', error);
  }

  return { path, url, name: stamped, size: data.byteLength };
}

export async function deleteOrgFile(orgId: string, relative: string): Promise<boolean> {
  const path = resolveOrgPath(orgId, relative);
  if (path === orgStorageRoot(orgId)) return false;
  const ok = await davDelete(path);
  if (ok) {
    try {
      await db`DELETE FROM media WHERE org_id = ${orgId} AND nextcloud_path = ${path}`;
    } catch (error) {
      console.error('[org-storage] media row delete failed:', error);
    }
  }
  return ok;
}

/** Which of the four folders a MIME type belongs in. */
export function folderForMime(mimeType: string): OrgMediaFolder {
  if (mimeType.startsWith('image/')) return 'Images';
  if (mimeType.startsWith('audio/')) return 'Audio';
  if (mimeType.startsWith('video/')) return 'Videos';
  return 'Documents';
}

function mediaType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}
