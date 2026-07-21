/**
 * Workshop materials folders — service-account model (mirrors org-provisioning).
 *
 * Each workshop gets `EAC_Network/{orgId}/workshops/{threadId}/materials`
 * under the SERVICE account:
 *   author   → read/write share (uploads course material)
 *   attendee → read-only share  (granted on RSVP / paid join)
 *
 * Shares surface in the recipient's own files root (usually `/materials` or a
 * deduped name); use resolveReceivedOrgPath-style lookup when a direct path is
 * needed. All functions are idempotent and safe to re-run.
 */

import { type NextcloudClient } from './client';
import { ensureOrgFolderPath, getOrgFolderPath } from './org-folders';
import {
  PERMISSIONS_READ,
  PERMISSIONS_WRITE,
  shareFolderWithUser,
  unshareFolderWithUser,
  type NextcloudShare,
} from './shares';
import { listFiles, type NextcloudFile } from './files';

export function getWorkshopMaterialsPath(orgId: string, threadId: string): string {
  return `${getOrgFolderPath(orgId)}/workshops/${threadId}/materials`;
}

/** Ensure the materials folder tree exists. Idempotent. */
export async function ensureWorkshopMaterialsFolder(
  serviceClient: NextcloudClient,
  orgId: string,
  threadId: string
): Promise<string> {
  return ensureOrgFolderPath(serviceClient, getWorkshopMaterialsPath(orgId, threadId), {
    includeStandardMediaFolders: false,
  });
}

/**
 * Grant access to a workshop's materials folder.
 * role 'author' → read/write, 'attendee' → read-only.
 */
export async function grantMaterialsAccess(
  serviceClient: NextcloudClient,
  orgId: string,
  threadId: string,
  ncUserId: string,
  role: 'author' | 'attendee'
): Promise<NextcloudShare> {
  const path = getWorkshopMaterialsPath(orgId, threadId);
  const permissions = role === 'author' ? PERMISSIONS_WRITE : PERMISSIONS_READ;
  return shareFolderWithUser(serviceClient, path, ncUserId, permissions);
}

/** Revoke a user's access to a workshop's materials folder. */
export async function revokeMaterialsAccess(
  serviceClient: NextcloudClient,
  orgId: string,
  threadId: string,
  ncUserId: string
): Promise<number> {
  return unshareFolderWithUser(serviceClient, getWorkshopMaterialsPath(orgId, threadId), ncUserId);
}

/** List the files currently in a workshop's materials folder (service view). */
export async function listWorkshopMaterials(
  serviceClient: NextcloudClient,
  orgId: string,
  threadId: string
): Promise<NextcloudFile[]> {
  return listFiles(serviceClient, getWorkshopMaterialsPath(orgId, threadId));
}
