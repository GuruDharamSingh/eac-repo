/**
 * Nextcloud OCS Share API — user-to-user folder shares.
 *
 * Used by org provisioning: org folders live under the service account
 * (NEXTCLOUD_ADMIN_USER) and are shared to org owners (write) and guides
 * (read-only). Ownership transfer is then just revoke + re-grant — no file
 * migration.
 *
 * OCS endpoints (relative to /ocs/v2.php):
 *   POST   /apps/files_sharing/api/v1/shares
 *   GET    /apps/files_sharing/api/v1/shares?path=...
 *   PUT    /apps/files_sharing/api/v1/shares/{id}
 *   DELETE /apps/files_sharing/api/v1/shares/{id}
 */

import { type NextcloudClient, extractOcsData } from './client';

/** OCS shareType values. */
export const SHARE_TYPE_USER = 0;
export const SHARE_TYPE_GROUP = 1;

/** OCS permission bits. */
export const PERM_READ = 1;
export const PERM_UPDATE = 2;
export const PERM_CREATE = 4;
export const PERM_DELETE = 8;
export const PERM_SHARE = 16;

/** Read-only access (guides). */
export const PERMISSIONS_READ = PERM_READ;
/** Read + write + create + delete, no re-share (owners). */
export const PERMISSIONS_WRITE = PERM_READ + PERM_UPDATE + PERM_CREATE + PERM_DELETE;

export interface NextcloudShare {
  id: string;
  share_type: number;
  /** Account that created the share (the service account). */
  uid_owner: string;
  /** Recipient user id. */
  share_with: string | null;
  /** Path relative to the sharer's files root, e.g. "/EAC_Network/my-org". */
  path: string;
  permissions: number;
  /** Where the share appears in the recipient's tree, e.g. "/my-org". */
  file_target: string | null;
}

function toShare(raw: any): NextcloudShare {
  return {
    id: String(raw.id),
    share_type: Number(raw.share_type),
    uid_owner: String(raw.uid_owner ?? ''),
    share_with: raw.share_with != null ? String(raw.share_with) : null,
    path: String(raw.path ?? ''),
    permissions: Number(raw.permissions ?? 0),
    file_target: raw.file_target != null ? String(raw.file_target) : null,
  };
}

function normalizeSharePath(path: string): string {
  const clean = path.replace(/^\/+|\/+$/g, '');
  return `/${clean}`;
}

/**
 * Share a folder (path relative to the client account's files root) with
 * another user. Idempotent: if an equivalent share already exists, its
 * permissions are updated instead.
 */
export async function shareFolderWithUser(
  client: NextcloudClient,
  path: string,
  recipientUserId: string,
  permissions: number
): Promise<NextcloudShare> {
  const sharePath = normalizeSharePath(path);

  const existing = await getSharesForPath(client, sharePath);
  const match = existing.find(
    (s) => s.share_type === SHARE_TYPE_USER && s.share_with === recipientUserId
  );
  if (match) {
    if (match.permissions !== permissions) {
      return updateSharePermissions(client, match.id, permissions);
    }
    return match;
  }

  const form = new URLSearchParams();
  form.set('path', sharePath);
  form.set('shareType', String(SHARE_TYPE_USER));
  form.set('shareWith', recipientUserId);
  form.set('permissions', String(permissions));

  const response = await client.ocs.post(
    '/apps/files_sharing/api/v1/shares',
    form.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return toShare(extractOcsData<any>(response));
}

/** List shares created by this account for a given path. */
export async function getSharesForPath(
  client: NextcloudClient,
  path: string
): Promise<NextcloudShare[]> {
  const response = await client.ocs.get('/apps/files_sharing/api/v1/shares', {
    params: { path: normalizeSharePath(path), reshares: 'true' },
  });
  const data = extractOcsData<any>(response);
  const list = Array.isArray(data) ? data : [];
  return list.map(toShare);
}

export async function updateSharePermissions(
  client: NextcloudClient,
  shareId: string,
  permissions: number
): Promise<NextcloudShare> {
  const form = new URLSearchParams();
  form.set('permissions', String(permissions));
  const response = await client.ocs.put(
    `/apps/files_sharing/api/v1/shares/${encodeURIComponent(shareId)}`,
    form.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return toShare(extractOcsData<any>(response));
}

export async function deleteShare(
  client: NextcloudClient,
  shareId: string
): Promise<void> {
  await client.ocs.delete(
    `/apps/files_sharing/api/v1/shares/${encodeURIComponent(shareId)}`
  );
}

/** Remove every user-share of `path` granted to `recipientUserId`. */
export async function unshareFolderWithUser(
  client: NextcloudClient,
  path: string,
  recipientUserId: string
): Promise<number> {
  const shares = await getSharesForPath(client, path);
  let removed = 0;
  for (const share of shares) {
    if (share.share_type === SHARE_TYPE_USER && share.share_with === recipientUserId) {
      await deleteShare(client, share.id);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Shares received by the authenticated user. Used to discover where a shared
 * org folder appears in the recipient's own WebDAV tree (`file_target`).
 */
export async function getReceivedShares(
  client: NextcloudClient
): Promise<NextcloudShare[]> {
  const response = await client.ocs.get('/apps/files_sharing/api/v1/shares', {
    params: { shared_with_me: 'true' },
  });
  const data = extractOcsData<any>(response);
  const list = Array.isArray(data) ? data : [];
  return list.map(toShare);
}

/**
 * Find the recipient-side WebDAV path for a specific share (by share id —
 * the id is identical on both sides). Returns e.g. "/my-org" (relative to the
 * recipient's files root), or null when the share isn't visible/accepted yet.
 *
 * Note: in `shared_with_me` results, `path`/`file_target` are
 * recipient-relative; the sharer's source path is not exposed, which is why
 * matching happens on the id.
 */
export async function findReceivedSharePath(
  recipientClient: NextcloudClient,
  shareId: string
): Promise<string | null> {
  const received = await getReceivedShares(recipientClient);
  const match = received.find((s) => s.id === shareId);
  return match?.file_target ?? match?.path ?? null;
}
